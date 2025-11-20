// Rotas da API PIX
const express = require('express');
const router = express.Router();
const { createPixCharge, consultPixCharge } = require('../services/pixService');
const { saveCobranca, getCobranca } = require('../services/dbService');
const { processWebhook } = require('../services/webhookService');
const { createChargeLimiter, consultChargeLimiter, webhookLimiter } = require('../middleware/security');
const { 
  validateValor, 
  validateTxid, 
  validateNome, 
  validateWhatsapp, 
  validateCampanhaId,
  sanitizeString 
} = require('../utils/validation');

/**
 * POST /api/gerar-pix
 * Cria uma nova cobrança PIX
 * Body: { valor: number, cid: string, doador?: { nome?, whatsapp?, anonimo: boolean } }
 * NOTA: Os dados do doador são armazenados temporariamente e só serão salvos no DB após confirmação via webhook
 * Se anonimo=false, é obrigatório informar nome E whatsapp
 */
router.post('/gerar-pix', createChargeLimiter, async (req, res) => {
  try {
    const { valor, cid, doador } = req.body;

    // Validação rigorosa do valor monetário
    const valorValidado = validateValor(valor, 0.01, 100000); // Min: R$ 0,01 | Max: R$ 100.000
    if (!valorValidado) {
      return res.status(400).json({ 
        error: 'Valor inválido. Deve ser um número entre R$ 0,01 e R$ 100.000,00.' 
      });
    }

    // Validação do ID de campanha
    const cidValidado = validateCampanhaId(cid);
    if (!cidValidado) {
      return res.status(400).json({ 
        error: 'ID de Campanha (cid) inválido. Deve conter apenas letras, números, hífens e underscores (máx. 50 caracteres).' 
      });
    }

    // Validação: Se o doador optou por se identificar (anonimo=false), deve informar nome E whatsapp
    if (doador && doador.anonimo === false) {
      const nomeValidado = validateNome(doador.nome);
      if (!nomeValidado) {
        return res.status(400).json({ 
          error: 'Para doações identificadas, o nome é obrigatório e deve conter apenas letras, números e espaços.' 
        });
      }
      
      const whatsappValidado = validateWhatsapp(doador.whatsapp);
      if (!whatsappValidado) {
        return res.status(400).json({ 
          error: 'Para doações identificadas, o WhatsApp é obrigatório e deve ser um número válido (10-15 dígitos).' 
        });
      }
      
      // Atualiza com valores validados
      doador.nome = nomeValidado;
      doador.whatsapp = whatsappValidado;
    }

    // Gera o TXID único e rastreável
    // REGRA: O txid deve ser alfanumérico e ter entre 26 e 35 caracteres.
    const prefixo = 'solsticiocampanha'; // 17 caracteres
    const campaignId = cidValidado.slice(0, 2).padStart(2, '0'); // 2 caracteres (garante máximo)
    const timestamp = Date.now().toString().slice(-7); // 7 caracteres
    // Total: 17 + 2 + 7 = 26 caracteres. VÁLIDO.
    const txid = `${prefixo}${campaignId}${timestamp}`;
    
    // Valida o TXID gerado (segurança extra)
    if (!validateTxid(txid)) {
      return res.status(500).json({ 
        error: 'Erro ao gerar identificador da transação.' 
      });
    }

    // Verifica se já existe uma cobrança com esse txid (improvável, mas possível)
    const existingCobranca = await getCobranca(txid);
    if (existingCobranca) {
      return res.status(409).json({ 
        error: 'TXID já existe. Tente novamente.' 
      });
    }

    // Cria a cobrança no Itaú
    // Sanitiza o nome antes de usar na mensagem (prevenção XSS)
    const nomeSanitizado = doador?.anonimo === false && doador?.nome
      ? sanitizeString(doador.nome)
      : null;
    
    const solicitacaoPagador = nomeSanitizado
      ? `Doação de ${nomeSanitizado} para o Festival Solsticio`
      : "Doação para o Festival Solsticio";

    const cobranca = await createPixCharge(txid, valorValidado, solicitacaoPagador);
    
    if (!cobranca) {
      return res.status(500).json({ 
        error: 'Não foi possível gerar a cobrança Pix no Itaú.' 
      });
    }

    // Salva a cobrança no banco de dados (status: AGUARDANDO)
    // IMPORTANTE: Armazena dados do doador TEMPORARIAMENTE em dados_doador_temp
    // Estes dados NÃO são salvos na tabela doadores até que o webhook confirme o pagamento
    // Isso garante que só escrevemos no DB após confirmação da transferência
    const dadosDoadorTemp = doador ? {
      nome: doador.nome || null,
      whatsapp: doador.whatsapp || null,
      anonimo: doador.anonimo !== false // default é anônimo
    } : null;

    const cobrancaSalva = await saveCobranca({
      txid: cobranca.txid,
      valor: cobranca.valor,
      status: 'AGUARDANDO',
      campanhaId: cid,
      chavePix: cobranca.chave,
      brCode: cobranca.brCode,
      expiracao: cobranca.expiracao,
      dadosDoadorTemp
    });

    if (!cobrancaSalva) {
      console.warn(`⚠️  Cobrança criada no Itaú mas não salva no DB: ${txid}`);
      // Não falha a requisição, mas registra o problema
    }

    // Log dos dados do doador (serão salvos apenas após confirmação via webhook)
    if (doador) {
      console.log(`📝 Dados do doador armazenados temporariamente (serão salvos apenas após confirmação):`, {
        txid,
        anonimo: dadosDoadorTemp.anonimo,
        temNome: !!dadosDoadorTemp.nome,
        temWhatsapp: !!dadosDoadorTemp.whatsapp
      });
    }

    // Retorna o QR Code (BRCode) e txid para o frontend
    res.status(200).json({
      success: true,
      brCode: cobranca.brCode,
      txid: cobranca.txid,
      valor: cobranca.valor,
      expiracao: cobranca.expiracao,
      status: 'AGUARDANDO'
    });

  } catch (error) {
    console.error('❌ Erro inesperado no endpoint /api/gerar-pix:', error.message);
    res.status(500).json({ 
      error: 'Erro interno do servidor.',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/cobranca/:txid
 * Consulta o status de uma cobrança PIX
 */
router.get('/cobranca/:txid', consultChargeLimiter, async (req, res) => {
  try {
    const { txid } = req.params;

    // Validação rigorosa do TXID
    if (!validateTxid(txid)) {
      return res.status(400).json({ 
        error: 'TXID inválido. Deve ser alfanumérico e ter entre 26 e 35 caracteres.' 
      });
    }

    // Consulta no Itaú para obter status atualizado
    const cobrancaItau = await consultPixCharge(txid);
    
    if (!cobrancaItau) {
      return res.status(404).json({ 
        error: 'Cobrança não encontrada no Itaú.' 
      });
    }

    // Busca no banco de dados local
    const cobrancaDB = await getCobranca(txid);

    // Atualiza o status no banco local se necessário
    if (cobrancaDB && cobrancaDB.status !== cobrancaItau.status) {
      await require('../services/dbService').updateCobrancaStatus(txid, cobrancaItau.status);
    }

    // Retorna os dados combinados
    res.status(200).json({
      success: true,
      txid: cobrancaItau.txid,
      status: cobrancaItau.status,
      valor: cobrancaItau.valor,
      brCode: cobrancaItau.brCode,
      criadoEm: cobrancaItau.criadoEm,
      atualizadoEm: cobrancaItau.atualizadoEm,
      pagamento: cobrancaItau.pagamento,
      // Dados do banco local
      campanhaId: cobrancaDB?.campanha_id || null
    });

  } catch (error) {
    console.error('❌ Erro inesperado no endpoint /api/cobranca/:txid:', error.message);
    res.status(500).json({ 
      error: 'Erro interno do servidor.',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/webhook/pix
 * Recebe notificações de pagamento confirmado do Itaú
 * Body: Dados do webhook do Itaú (formato pode variar)
 * Headers: x-signature (opcional, para validação)
 */
router.post('/webhook/pix', webhookLimiter, async (req, res) => {
  try {
    const webhookBody = req.body;
    const signature = req.headers['x-signature'] || req.headers['x-itau-signature'];

    // Log mínimo (sem dados sensíveis)
    // IMPORTANTE: O Itaú pode validar o certificado do SERVIDOR durante o handshake TLS
    // Configure conforme a documentação do Itaú para webhooks
    console.log('📨 Webhook recebido do Itaú', {
      hasSignature: !!signature,
      hasBody: !!webhookBody && Object.keys(webhookBody).length > 0,
      protocol: req.protocol,
      secure: req.secure
    });

    // Processa o webhook
    // Nota: Os dados do doador devem ser recuperados da cobrança original
    // ou passados de outra forma. Por enquanto, processamos sem dados do doador
    // pois eles devem ser salvos apenas quando o pagamento for confirmado.
    // Em uma implementação completa, você pode armazenar os dados do doador
    // temporariamente na criação da cobrança e recuperá-los aqui.
    
    // Passa o objeto req para validação do certificado do cliente (mTLS) se necessário
    const result = await processWebhook(webhookBody, signature, null, req);

    if (!result || !result.success) {
      return res.status(400).json({
        success: false,
        error: result?.error || 'Erro ao processar webhook'
      });
    }

           // Retorna 200 OK para o Itaú (importante para não receber retentativas)
    res.status(200).json({
      success: true,
      message: 'Webhook processado com sucesso',
      txid: result.transacao?.cobranca_txid
    });

  } catch (error) {
    console.error('❌ Erro inesperado no endpoint /api/webhook/pix:', error.message);
           // Retorna 200 mesmo em caso de erro para evitar retentativas do Itaú
    // Mas loga o erro para investigação
    res.status(200).json({
      success: false,
      error: 'Erro ao processar webhook (logado para investigação)'
    });
  }
});

module.exports = router;

