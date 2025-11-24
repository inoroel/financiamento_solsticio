// Rotas da API de Pagamentos (PIX, Crédito, Débito) - e-Rede
const express = require('express');
const router = express.Router();
const { 
  createPixCharge, 
  createCreditCardTransaction, 
  createDebitCardTransaction,
  consultTransaction 
} = require('../services/redeService');
const { saveCobranca, getCobranca } = require('../services/dbService');
const { processWebhook } = require('../services/redeWebhookService');
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
 * Valida dados do cartão
 * @param {Object} cartaoData - Dados do cartão
 * @returns {Object|null} Dados validados ou null
 */
function validateCartaoData(cartaoData) {
  if (!cartaoData || typeof cartaoData !== 'object') {
    return null;
  }
  
  // Token é obrigatório (deve ser gerado no frontend)
  if (!cartaoData.token || typeof cartaoData.token !== 'string') {
    return null;
  }
  
  return {
    token: cartaoData.token,
    bandeira: cartaoData.bandeira || null
  };
}

/**
 * Valida número de parcelas
 * @param {number} parcelas - Número de parcelas
 * @returns {number|null} Parcelas validadas ou null
 */
function validateParcelas(parcelas) {
  const numParcelas = parseInt(parcelas);
  if (isNaN(numParcelas) || numParcelas < 1 || numParcelas > 12) {
    return null;
  }
  return numParcelas;
}

/**
 * POST /api/gerar-pagamento
 * Cria uma nova cobrança (PIX, Crédito ou Débito)
 * Body: { 
 *   tipo_pagamento: 'PIX' | 'CREDITO' | 'DEBITO',
 *   valor: number, 
 *   cid: string, 
 *   doador?: { nome?, whatsapp?, anonimo: boolean },
 *   cartao?: { token: string, bandeira?: string }, // Para crédito/débito
 *   parcelas?: number // Apenas para crédito (1-12)
 * }
 */
router.post('/gerar-pagamento', createChargeLimiter, async (req, res) => {
  try {
    const { tipo_pagamento, valor, cid, doador, cartao, parcelas } = req.body;

    // Validação do tipo de pagamento
    const tiposValidos = ['PIX', 'CREDITO', 'DEBITO'];
    if (!tipo_pagamento || !tiposValidos.includes(tipo_pagamento.toUpperCase())) {
      return res.status(400).json({ 
        error: 'Tipo de pagamento inválido. Deve ser: PIX, CREDITO ou DEBITO.' 
      });
    }
    
    const tipoPagamento = tipo_pagamento.toUpperCase();

    // Validação rigorosa do valor monetário
    const valorValidado = validateValor(valor, 0.01, 100000);
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
      
      doador.nome = nomeValidado;
      doador.whatsapp = whatsappValidado;
    }

    // Validações específicas para cartões
    if (tipoPagamento === 'CREDITO' || tipoPagamento === 'DEBITO') {
      const cartaoValidado = validateCartaoData(cartao);
      if (!cartaoValidado) {
        return res.status(400).json({ 
          error: 'Dados do cartão inválidos. Token do cartão é obrigatório.' 
        });
      }
      
      // Valida parcelas para crédito
      if (tipoPagamento === 'CREDITO') {
        const parcelasValidadas = validateParcelas(parcelas || 1);
        if (!parcelasValidadas) {
          return res.status(400).json({ 
            error: 'Número de parcelas inválido. Deve ser entre 1 e 12.' 
          });
        }
      }
    }

    // Gera o TXID único e rastreável
    const prefixo = 'solsticiocampanha';
    const campaignId = cidValidado.slice(0, 2).padStart(2, '0');
    const timestamp = Date.now().toString().slice(-7);
    const txid = `${prefixo}${campaignId}${timestamp}`;
    
    if (!validateTxid(txid)) {
      return res.status(500).json({ 
        error: 'Erro ao gerar identificador da transação.' 
      });
    }

    // Verifica se já existe uma cobrança com esse txid
    const existingCobranca = await getCobranca(txid);
    if (existingCobranca) {
      return res.status(409).json({ 
        error: 'TXID já existe. Tente novamente.' 
      });
    }

    // Cria a cobrança na e-Rede conforme o tipo de pagamento
    let cobranca = null;
    let dadosPagamento = null;

    if (tipoPagamento === 'PIX') {
      const nomeSanitizado = doador?.anonimo === false && doador?.nome
        ? sanitizeString(doador.nome)
        : null;
      
      const solicitacaoPagador = nomeSanitizado
        ? `Doação de ${nomeSanitizado} para o Festival Solsticio`
        : "Doação para o Festival Solsticio";

      cobranca = await createPixCharge(txid, valorValidado, solicitacaoPagador);
      
      if (!cobranca) {
        return res.status(500).json({ 
          error: 'Não foi possível gerar a cobrança PIX na e-Rede.' 
        });
      }
    } else if (tipoPagamento === 'CREDITO') {
      const cartaoValidado = validateCartaoData(cartao);
      const parcelasValidadas = validateParcelas(parcelas || 1);
      
      cobranca = await createCreditCardTransaction(
        txid, 
        valorValidado, 
        cartaoValidado, 
        parcelasValidadas,
        cartaoValidado.bandeira
      );
      
      if (!cobranca) {
        return res.status(500).json({ 
          error: 'Não foi possível processar o pagamento com cartão de crédito.' 
        });
      }
      
      dadosPagamento = {
        tipo: 'CREDITO',
        parcelas: parcelasValidadas,
        bandeira: cobranca.bandeira
      };
    } else if (tipoPagamento === 'DEBITO') {
      const cartaoValidado = validateCartaoData(cartao);
      
      cobranca = await createDebitCardTransaction(
        txid, 
        valorValidado, 
        cartaoValidado,
        cartaoValidado.bandeira
      );
      
      if (!cobranca) {
        return res.status(500).json({ 
          error: 'Não foi possível processar o pagamento com cartão de débito.' 
        });
      }
      
      dadosPagamento = {
        tipo: 'DEBITO',
        bandeira: cobranca.bandeira
      };
    }

    // Salva a cobrança no banco de dados (status: AGUARDANDO ou AUTORIZADA/CAPTURADA)
    const dadosDoadorTemp = doador ? {
      nome: doador.nome || null,
      whatsapp: doador.whatsapp || null,
      anonimo: doador.anonimo !== false
    } : null;

    const statusInicial = tipoPagamento === 'PIX' 
      ? 'AGUARDANDO' 
      : (cobranca.status === 'AUTORIZADA' || cobranca.status === 'CAPTURADA' ? 'CONFIRMADA' : 'AGUARDANDO');

    const cobrancaSalva = await saveCobranca({
      txid: cobranca.txid || txid,
      valor: cobranca.valor || valorValidado,
      status: statusInicial,
      campanhaId: cid,
      tipoPagamento: tipoPagamento,
      provider: 'REDE', // Provider fixo para e-Rede
      chavePix: tipoPagamento === 'PIX' ? (cobranca.chave || null) : null,
      brCode: tipoPagamento === 'PIX' ? cobranca.brCode : null,
      expiracao: tipoPagamento === 'PIX' ? (cobranca.expiracao || 3600) : null,
      redeTid: cobranca.rede_tid || null,
      providerTid: cobranca.rede_tid || null, // provider_tid genérico
      dadosPagamento: dadosPagamento,
      dadosDoadorTemp
    });

    if (!cobrancaSalva) {
      console.warn(`⚠️  Cobrança criada na e-Rede mas não salva no DB: ${txid}`);
    }

    // Retorna resposta conforme tipo de pagamento
    const response = {
      success: true,
      txid: cobranca.txid || txid,
      rede_tid: cobranca.rede_tid || null,
      tipo_pagamento: tipoPagamento,
      valor: cobranca.valor || valorValidado,
      status: statusInicial
    };

    if (tipoPagamento === 'PIX') {
      response.brCode = cobranca.brCode;
      response.expiracao = cobranca.expiracao;
    } else {
      response.autorizacao = {
        codigo: cobranca.authorizationCode,
        status: cobranca.status,
        bandeira: cobranca.bandeira
      };
      if (tipoPagamento === 'CREDITO') {
        response.parcelas = cobranca.parcelas;
      }
    }

    res.status(200).json(response);

  } catch (error) {
    console.error('❌ Erro inesperado no endpoint /api/gerar-pagamento:', error.message);
    res.status(500).json({ 
      error: 'Erro interno do servidor.',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/cobranca/:tid
 * Consulta o status de uma cobrança por Transaction ID da e-Rede
 */
router.get('/cobranca/:tid', consultChargeLimiter, async (req, res) => {
  try {
    const { tid } = req.params;

    if (!tid || typeof tid !== 'string') {
      return res.status(400).json({ 
        error: 'TID inválido.' 
      });
    }

    // Consulta na e-Rede para obter status atualizado
    const cobrancaRede = await consultTransaction(tid);
    
    if (!cobrancaRede) {
      return res.status(404).json({ 
        error: 'Cobrança não encontrada na e-Rede.' 
      });
    }

    // Busca no banco de dados local
    const cobrancaDB = await getCobranca(cobrancaRede.txid);

    // Atualiza o status no banco local se necessário
    if (cobrancaDB && cobrancaDB.status !== cobrancaRede.status) {
      await require('../services/dbService').updateCobrancaStatus(cobrancaRede.txid, cobrancaRede.status);
    }

    // Retorna os dados combinados
    res.status(200).json({
      success: true,
      txid: cobrancaRede.txid,
      rede_tid: cobrancaRede.rede_tid,
      tipo_pagamento: cobrancaRede.tipo_pagamento,
      status: cobrancaRede.status,
      valor: cobrancaRede.valor,
      brCode: cobrancaRede.brCode,
      criadoEm: cobrancaRede.criadoEm,
      atualizadoEm: cobrancaRede.atualizadoEm,
      bandeira: cobrancaRede.bandeira,
      parcelas: cobrancaRede.parcelas,
      campanhaId: cobrancaDB?.campanha_id || null
    });

  } catch (error) {
    console.error('❌ Erro inesperado no endpoint /api/cobranca/:tid:', error.message);
    res.status(500).json({ 
      error: 'Erro interno do servidor.',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/cobranca/txid/:txid
 * Consulta o status de uma cobrança por TXID interno (compatibilidade)
 */
router.get('/cobranca/txid/:txid', consultChargeLimiter, async (req, res) => {
  try {
    const { txid } = req.params;

    if (!validateTxid(txid)) {
      return res.status(400).json({ 
        error: 'TXID inválido. Deve ser alfanumérico e ter entre 26 e 35 caracteres.' 
      });
    }

    // Busca no banco de dados local
    const cobrancaDB = await getCobranca(txid);
    
    if (!cobrancaDB) {
      return res.status(404).json({ 
        error: 'Cobrança não encontrada.' 
      });
    }

    // Se tiver rede_tid, consulta na e-Rede para obter status atualizado
    let cobrancaRede = null;
    if (cobrancaDB.rede_tid) {
      cobrancaRede = await consultTransaction(cobrancaDB.rede_tid);
    }

    // Retorna os dados combinados
    res.status(200).json({
      success: true,
      txid: cobrancaDB.txid,
      rede_tid: cobrancaDB.rede_tid || null,
      tipo_pagamento: cobrancaDB.tipo_pagamento || 'PIX',
      status: cobrancaRede?.status || cobrancaDB.status,
      valor: cobrancaDB.valor,
      brCode: cobrancaDB.brcode,
      criadoEm: cobrancaDB.criado_em,
      atualizadoEm: cobrancaDB.atualizado_em,
      campanhaId: cobrancaDB.campanha_id || null
    });

  } catch (error) {
    console.error('❌ Erro inesperado no endpoint /api/cobranca/txid/:txid:', error.message);
    res.status(500).json({ 
      error: 'Erro interno do servidor.',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/webhook/pagamento
 * Recebe notificações de pagamento confirmado da e-Rede
 * Body: Dados do webhook da e-Rede
 * Headers: x-signature (opcional, para validação)
 */
router.post('/webhook/pagamento', webhookLimiter, async (req, res) => {
  try {
    const webhookBody = req.body;
    const signature = req.headers['x-signature'] || req.headers['x-rede-signature'];
    const clientIp = req.ip || req.connection.remoteAddress;

    // Log mínimo (sem dados sensíveis)
    console.log('📨 Webhook recebido da e-Rede', {
      hasSignature: !!signature,
      hasBody: !!webhookBody && Object.keys(webhookBody).length > 0,
      clientIp: clientIp,
      protocol: req.protocol,
      secure: req.secure
    });

    // Recupera dados do doador da cobrança original (armazenados temporariamente)
    let doadorData = null;
    if (webhookBody.transaction?.tid || webhookBody.transaction?.reference || webhookBody.tid) {
      const tid = webhookBody.transaction?.tid || webhookBody.transaction?.reference || webhookBody.tid;
      const { getCobrancaByRedeTid } = require('../services/redeWebhookService');
      const cobranca = await getCobrancaByRedeTid(tid);
      if (!cobranca) {
        // Tenta por txid se não encontrou por rede_tid
        const txid = webhookBody.transaction?.reference || tid;
        const cobrancaByTxid = await getCobranca(txid);
        if (cobrancaByTxid && cobrancaByTxid.dados_doador_temp) {
          let dadosDoadorTemp = cobrancaByTxid.dados_doador_temp;
          if (typeof dadosDoadorTemp === 'string') {
            try {
              dadosDoadorTemp = JSON.parse(dadosDoadorTemp);
            } catch (error) {
              console.warn('⚠️  Erro ao fazer parse de dados_doador_temp:', error.message);
            }
          }
          doadorData = dadosDoadorTemp;
        }
      } else if (cobranca.dados_doador_temp) {
        let dadosDoadorTemp = cobranca.dados_doador_temp;
        if (typeof dadosDoadorTemp === 'string') {
          try {
            dadosDoadorTemp = JSON.parse(dadosDoadorTemp);
          } catch (error) {
            console.warn('⚠️  Erro ao fazer parse de dados_doador_temp:', error.message);
          }
        }
        doadorData = dadosDoadorTemp;
      }
    }
    
    // Processa o webhook
    const result = await processWebhook(webhookBody, signature, clientIp, doadorData);

    if (!result || !result.success) {
      const isSecurityError = result?.error?.includes('assinatura') || 
                             result?.error?.includes('IP') ||
                             result?.error?.includes('inválido');
      
      if (isSecurityError) {
        return res.status(401).json({
          success: false,
          error: result?.error || 'Erro de validação de segurança'
        });
      }
      
      return res.status(400).json({
        success: false,
        error: result?.error || 'Erro ao processar webhook'
      });
    }

    // Retorna 200 OK para a e-Rede (importante para não receber retentativas)
    res.status(200).json({
      success: true,
      message: 'Webhook processado com sucesso',
      tid: result.transacao?.rede_tid || result.transacao?.cobranca_txid
    });

  } catch (error) {
    console.error('❌ Erro inesperado no endpoint /api/webhook/pagamento:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error('Stack:', error.stack);
    }
    
    // Retorna 200 para evitar retentativas, mas apenas para erros não críticos
    const isSecurityError = error.message.includes('Assinatura') || 
                           error.message.includes('IP') ||
                           error.message.includes('inválido');
    
    if (isSecurityError) {
      return res.status(401).json({
        success: false,
        error: 'Erro de validação de segurança'
      });
    }
    
    res.status(200).json({
      success: false,
      error: 'Erro ao processar webhook (logado para investigação)'
    });
  }
});

module.exports = router;

