// Serviço de processamento de webhooks Stellar
// Como Stellar não tem webhooks nativos, usamos polling ou serviços externos
const crypto = require('crypto');
const { processConfirmedTransaction, getCobranca } = require('./dbService');
const { monitorPayments, consultStellarTransaction } = require('./stellarService');
require('dotenv').config();

/**
 * Valida a assinatura do webhook (se usar serviço externo de monitoramento)
 * @param {Object} payload - Payload do webhook
 * @param {string} signature - Assinatura recebida
 * @returns {boolean} true se válido
 */
function validateWebhookSignature(payload, signature) {
  const webhookSecret = process.env.STELLAR_WEBHOOK_SECRET;

  if (!webhookSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ CRÍTICO: STELLAR_WEBHOOK_SECRET não configurado em produção!');
      return false;
    }
    console.warn('⚠️  STELLAR_WEBHOOK_SECRET não configurado - validação desabilitada (apenas em desenvolvimento)');
    return true;
  }

  if (!signature) {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ Webhook recebido sem assinatura em produção');
      return false;
    }
    console.warn('⚠️  Webhook recebido sem assinatura (desenvolvimento)');
    return false;
  }

  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payloadString)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Extrai dados do webhook Stellar
 * @param {Object} webhookBody - Corpo do webhook recebido
 * @returns {Object|null} Dados extraídos ou null se inválido
 */
function extractWebhookData(webhookBody) {
  try {
    // Formato esperado do webhook (de serviço de monitoramento ou polling)
    const hash = webhookBody.hash || webhookBody.transaction_hash;
    const memo = webhookBody.memo || webhookBody.transaction_memo;
    const currency = webhookBody.currency || webhookBody.asset_code || 'XLM';
    const valor = webhookBody.valor || webhookBody.amount;
    const successful = webhookBody.successful !== false && webhookBody.transaction_successful !== false;

    if (!hash) {
      throw new Error('Hash da transação não encontrado no webhook');
    }

    if (!valor || isNaN(parseFloat(valor))) {
      throw new Error('Valor inválido no webhook');
    }

    return {
      provider_tid: hash,
      provider: 'STELLAR',
      txid: memo || hash, // Usa memo como txid se disponível
      tipo_pagamento: 'CRIPTO',
      currency: currency.toUpperCase(),
      valor: parseFloat(valor),
      status: successful ? 'CONFIRMADA' : 'FALHADA',
      horario: webhookBody.created_at || webhookBody.timestamp || new Date().toISOString(),
      hash: hash,
      memo: memo,
      from: webhookBody.from || null,
      to: webhookBody.to || null,
      rawData: webhookBody
    };

  } catch (error) {
    console.error('❌ Erro ao extrair dados do webhook Stellar:', error.message);
    return null;
  }
}

/**
 * Processa um webhook de pagamento confirmado Stellar
 * @param {Object} webhookBody - Corpo do webhook recebido
 * @param {string} signature - Assinatura do webhook (opcional)
 * @param {string} clientIp - IP do cliente (opcional)
 * @param {Object} doadorData - Dados opcionais do doador
 * @returns {Object|null} Resultado do processamento ou null
 */
async function processWebhook(webhookBody, signature = null, clientIp = null, doadorData = null) {
  try {
    // Detecta se é chamada interna (confirm-donation / check-payment-by-memo)
    const isInternalCall =
      webhookBody &&
      webhookBody.provider === 'STELLAR' &&
      webhookBody.tipo_pagamento === 'CRIPTO' &&
      (webhookBody.provider_tid || webhookBody.rede_tid);

    // Valida assinatura APENAS para webhooks externos
    if (!isInternalCall) {
      if (signature) {
        if (!validateWebhookSignature(webhookBody, signature)) {
          throw new Error('Assinatura do webhook inválida');
        }
      } else if (process.env.NODE_ENV === 'production') {
        // Em produção, assinatura é recomendada para webhooks externos
        console.warn('⚠️  Webhook Stellar externo recebido sem assinatura em produção');
      }
    }

    // Extrai dados do webhook
    // - Para chamadas externas: converte payload bruto → formato interno
    // - Para chamadas internas: payload já vem normalizado
    let webhookData;
    if (isInternalCall) {
      webhookData = {
        provider_tid: webhookBody.provider_tid || webhookBody.rede_tid,
        provider: 'STELLAR',
        txid: webhookBody.txid,
        tipo_pagamento: 'CRIPTO',
        valor: webhookBody.valor,
        status: webhookBody.status || 'CONFIRMADA',
        horario: webhookBody.horario || new Date().toISOString(),
        hash: webhookBody.endToEndId || webhookBody.provider_tid || webhookBody.rede_tid,
        memo: webhookBody.txid,
        currency: (webhookBody.crypto_currency || webhookBody.currency || 'XLM').toUpperCase(),
        from: null,
        to: webhookBody.crypto_address || null,
        rawData: webhookBody
      };
    } else {
      webhookData = extractWebhookData(webhookBody);
    }
    if (!webhookData || !webhookData.provider_tid) {
      throw new Error('Dados do webhook inválidos ou hash não encontrado');
    }

    // Prepara dados para processConfirmedTransaction
    // O campanha_id será obtido automaticamente da cobrança encontrada
    const transactionData = {
      txid: webhookData.txid,
      provider_tid: webhookData.provider_tid,
      provider: 'STELLAR',
      tipo_pagamento: 'CRIPTO',
      valor: webhookData.valor,
      status: webhookData.status,
      horario: webhookData.horario,
      crypto_currency: webhookData.currency,
      crypto_address: webhookData.to || null,
      endToEndId: webhookData.hash
      // campanha_id não precisa ser passado aqui, pois será obtido da cobrança
    };

    // Verifica se a cobrança existe no banco (por txid ou memo)
    let cobranca = null;
    if (webhookData.txid) {
      console.log(`🔍 Buscando cobrança por txid: ${webhookData.txid} (tamanho: ${webhookData.txid.length})`);
      cobranca = await getCobranca(webhookData.txid);
      if (cobranca) {
        console.log(`✅ Cobrança encontrada por txid: ${cobranca.txid}`);
      } else {
        console.log(`⚠️  Cobrança não encontrada por txid: ${webhookData.txid}`);
      }
    }

    // Se não encontrou por txid, tenta buscar por provider_tid
    if (!cobranca && webhookData.provider_tid) {
      console.log(`🔍 Buscando cobrança por provider_tid: ${webhookData.provider_tid}`);
      const { sql } = require('../config/database');
      const result = await sql`
        SELECT * FROM cobrancas WHERE provider_tid = ${webhookData.provider_tid}
      `;
      cobranca = result.rows.length > 0 ? result.rows[0] : null;
      if (cobranca) {
        console.log(`✅ Cobrança encontrada por provider_tid: ${cobranca.txid}`);
      }
    }
    
    // Se ainda não encontrou, tenta buscar por memo nos dados_pagamento
    if (!cobranca && webhookData.txid) {
      console.log(`🔍 Buscando cobrança por memo nos dados_pagamento: ${webhookData.txid}`);
      const { sql } = require('../config/database');
      const allCobrancas = await sql`
        SELECT * FROM cobrancas 
        WHERE tipo_pagamento = 'CRIPTO' AND provider = 'STELLAR'
        ORDER BY criado_em DESC
        LIMIT 50
      `;
      
      // Verifica se alguma cobrança tem memo que corresponde ao txid
      for (const c of allCobrancas.rows) {
        if (c.dados_pagamento && typeof c.dados_pagamento === 'object') {
          const memo = c.dados_pagamento.memo || c.dados_pagamento.paymentMemo;
          if (memo === webhookData.txid) {
            console.log(`✅ Cobrança encontrada por memo nos dados_pagamento: ${c.txid}`);
            cobranca = c;
            break;
          }
        }
      }
    }

    if (!cobranca) {
      console.error(`❌ SEGURANÇA: Webhook Stellar recebido para cobrança inexistente: ${webhookData.txid || webhookData.provider_tid}`);
      console.error(`   Tentou buscar por: txid=${webhookData.txid}, provider_tid=${webhookData.provider_tid}`);
      
      // SOLUÇÃO TEMPORÁRIA: Para pagamentos já confirmados na blockchain que não têm cobrança prévia
      // Isso só acontece se a criação da cobrança falhou anteriormente
      // Criamos a cobrança agora para permitir processar o pagamento já feito
      console.warn(`⚠️  SOLUÇÃO TEMPORÁRIA: Criando cobrança retroativamente para pagamento já confirmado`);
      console.warn(`   ⚠️  ATENÇÃO: Isso só deve acontecer em casos excepcionais!`);
      
      try {
        const { saveCobranca } = require('./dbService');
        const novaCobranca = await saveCobranca({
          txid: webhookData.txid,
          valor: webhookData.valor,
          status: 'AGUARDANDO', // Será atualizado para CONFIRMADA no processConfirmedTransaction
          campanhaId: null, // Não temos o cid aqui
          tipoPagamento: 'CRIPTO',
          provider: 'STELLAR',
          cryptoCurrency: webhookData.currency || 'XLM',
          cryptoAddress: webhookData.to || null,
          providerTid: webhookData.provider_tid,
          dadosPagamento: {
            memo: webhookData.txid,
            paymentMemo: webhookData.txid,
            currency: webhookData.currency || 'XLM',
            tipo: 'CRIPTO',
            provider: 'STELLAR',
            txid: webhookData.txid,
            created_retroactively: true // Marca que foi criada retroativamente
          },
          dadosDoadorTemp: null // Não temos dados do doador aqui
        });
        
        if (novaCobranca) {
          console.log(`✅ Cobrança criada retroativamente: ${novaCobranca.txid}`);
          cobranca = await getCobranca(webhookData.txid);
          if (cobranca) {
            console.log(`✅ Cobrança encontrada após criação retroativa: ${cobranca.txid}`);
          } else {
            throw new Error(`Cobrança criada mas não encontrada: ${webhookData.txid}`);
          }
        } else {
          throw new Error(`Falha ao criar cobrança retroativamente: ${webhookData.txid}`);
        }
      } catch (error) {
        console.error(`❌ ERRO ao criar cobrança retroativamente: ${error.message}`);
        console.error(`   Stack: ${error.stack}`);
        throw new Error(`Cobrança ${webhookData.txid || webhookData.provider_tid} não encontrada e falha ao criar retroativamente. Pagamento rejeitado.`);
      }
    }

    // Verifica se já foi processado (idempotência)
    const existingTransaction = await require('./dbService').getTransacaoByProviderTid(webhookData.provider_tid);
    if (existingTransaction && existingTransaction.status === 'CONFIRMADA') {
      console.log(`ℹ️  Transação ${webhookData.provider_tid} já foi processada anteriormente`);
      return {
        success: true,
        message: 'Transação já processada',
        transacao: existingTransaction
      };
    }

    // Recupera dados do doador da cobrança (se não fornecidos explicitamente)
    let dadosDoadorFinal = doadorData;
    if (!dadosDoadorFinal && cobranca && cobranca.dados_doador_temp) {
      let dadosDoadorTemp = cobranca.dados_doador_temp;
      if (typeof dadosDoadorTemp === 'string') {
        try {
          dadosDoadorTemp = JSON.parse(dadosDoadorTemp);
        } catch (error) {
          console.warn('⚠️  Erro ao fazer parse de dados_doador_temp:', error.message);
          dadosDoadorTemp = null;
        }
      }
      dadosDoadorFinal = dadosDoadorTemp;
    }

    // Processa a transação confirmada
    const result = await processConfirmedTransaction(transactionData, dadosDoadorFinal);

    if (!result) {
      throw new Error('Falha ao processar transação no banco de dados');
    }

    console.log(`✅ Webhook Stellar processado com sucesso para hash: ${webhookData.provider_tid}`);

    return {
      success: true,
      message: 'Transação confirmada e processada',
      transacao: result.transacao,
      doador: result.doador
    };

  } catch (error) {
    console.error('❌ Erro ao processar webhook Stellar:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Processa pagamentos via polling (para uso em cron job ou background job)
 * Verifica novos pagamentos na conta Stellar e processa automaticamente
 * @param {number} sinceLedger - Ledger desde quando verificar (opcional)
 * @returns {Object} Resultado do processamento
 */
async function processPendingPayments(sinceLedger = null) {
  try {
    console.log('\n🔄 Verificando pagamentos Stellar pendentes...');

    // Monitora pagamentos recebidos
    const payments = await monitorPayments(null, sinceLedger);

    if (payments.length === 0) {
      console.log('ℹ️  Nenhum pagamento novo encontrado');
      return {
        success: true,
        processed: 0,
        payments: []
      };
    }

    console.log(`📨 Encontrados ${payments.length} pagamento(s) novo(s)`);

    const processed = [];
    const errors = [];

    for (const payment of payments) {
      try {
        // Cria payload no formato de webhook
        const webhookPayload = {
          hash: payment.hash,
          memo: payment.memo,
          currency: payment.currency,
          valor: payment.valor,
          from: payment.from,
          to: payment.to,
          created_at: payment.created_at,
          successful: payment.successful,
          transaction_successful: payment.successful
        };

        // Processa como webhook
        const result = await processWebhook(webhookPayload, null, null, null);

        if (result && result.success) {
          processed.push({
            hash: payment.hash,
            memo: payment.memo,
            status: 'processed'
          });
        } else {
          errors.push({
            hash: payment.hash,
            error: result?.error || 'Erro desconhecido'
          });
        }

      } catch (error) {
        console.error(`❌ Erro ao processar pagamento ${payment.hash}:`, error.message);
        errors.push({
          hash: payment.hash,
          error: error.message
        });
      }
    }

    return {
      success: true,
      processed: processed.length,
      errors: errors.length,
      payments: processed,
      errors_list: errors
    };

  } catch (error) {
    console.error('❌ Erro ao processar pagamentos pendentes:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  validateWebhookSignature,
  extractWebhookData,
  processWebhook,
  processPendingPayments
};

