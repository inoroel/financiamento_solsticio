// Serviço de processamento de webhooks do Banco do Brasil
const crypto = require('crypto');
const { processConfirmedTransaction, getCobranca } = require('./dbService');
const { validateClientCertificateFromRequest } = require('./bbCertificateValidator');
require('dotenv').config();

/**
 * Valida o certificado do cliente (mTLS) do Banco do Brasil
 * IMPORTANTE: Valida que a requisição realmente vem do BB, não de qualquer origem
 * @param {Object} req - Objeto da requisição Express
 * @returns {boolean} true se válido e pertence ao BB
 */
function validateClientCertificate(req) {
  // Valida se o certificado do cliente pertence ao Banco do Brasil
  // Isso garante que apenas o BB pode acessar o endpoint do webhook
  return validateClientCertificateFromRequest(req);
}

/**
 * Valida a assinatura do webhook (se configurado)
 * @param {Object} payload - Payload do webhook
 * @param {string} signature - Assinatura recebida
 * @returns {boolean} true se válido
 */
function validateWebhookSignature(payload, signature) {
  const webhookSecret = process.env.WEBHOOK_SECRET;
  
  // Em produção, SEMPRE deve ter secret configurado
  if (!webhookSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ CRÍTICO: WEBHOOK_SECRET não configurado em produção!');
      return false; // Rejeita em produção se não tiver secret
    }
    console.warn('⚠️  WEBHOOK_SECRET não configurado - validação de assinatura desabilitada (apenas em desenvolvimento)');
    return true; // Aceita apenas em desenvolvimento
  }
  
  if (!signature) {
    console.error('❌ Webhook recebido sem assinatura');
    return false;
  }
  
  // Implementa validação HMAC se necessário
  // O BB pode usar diferentes métodos de validação
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Extrai dados do webhook do Banco do Brasil
 * @param {Object} webhookBody - Corpo do webhook recebido
 * @returns {Object|null} Dados extraídos ou null se inválido
 */
function extractWebhookData(webhookBody) {
  try {
    // O formato do webhook do BB pode variar
    // Aqui assumimos um formato comum baseado na documentação PIX
    const pix = webhookBody.pix?.[0] || webhookBody;
    
    // Valida e sanitiza TXID
    const txid = pix.txid || webhookBody.txid;
    if (!txid || typeof txid !== 'string') {
      throw new Error('TXID não encontrado ou inválido no webhook');
    }
    
    // Valida formato do TXID
    const { validateTxid } = require('../utils/validation');
    if (!validateTxid(txid)) {
      throw new Error('TXID do webhook tem formato inválido');
    }
    
    // Valida valor monetário
    const valor = pix.valor ? parseFloat(pix.valor) : null;
    if (valor !== null && (isNaN(valor) || valor <= 0)) {
      throw new Error('Valor do webhook inválido');
    }
    
    return {
      txid,
      endToEndId: pix.endToEndId || null,
      valor,
      horario: pix.horario || new Date().toISOString(),
      status: 'CONFIRMADA', // Webhook só é enviado quando confirmado
      chave: pix.chave || webhookBody.chave || null,
      infoPagador: pix.infoPagador || webhookBody.infoPagador || null,
      // Dados completos para armazenar no JSONB (sanitizado)
      rawData: webhookBody
    };
  } catch (error) {
    console.error('❌ Erro ao extrair dados do webhook:', error.message);
    return null;
  }
}

/**
 * Processa um webhook de pagamento confirmado
 * @param {Object} webhookBody - Corpo do webhook recebido
 * @param {string} signature - Assinatura do webhook (opcional)
 * @param {Object} doadorData - Dados opcionais do doador (se fornecidos na criação da cobrança)
 * @returns {Object|null} Resultado do processamento ou null
 */
async function processWebhook(webhookBody, signature = null, doadorData = null, req = null) {
  try {
    // 1. Valida certificado do cliente (mTLS) se fornecido
    // IMPORTANTE: O BB valida o certificado do SERVIDOR durante o handshake TLS
    // O certificado do servidor (primeiro da cadeia) é usado para estabelecer a conexão
    // A cadeia completa foi enviada ao BB para validação
    if (req && !validateClientCertificate(req)) {
      throw new Error('Certificado do cliente inválido');
    }
    
    // 2. Valida assinatura (se configurado)
    if (signature && !validateWebhookSignature(webhookBody, signature)) {
      throw new Error('Assinatura do webhook inválida');
    }
    
    // 3. Extrai dados do webhook
    const webhookData = extractWebhookData(webhookBody);
    if (!webhookData || !webhookData.txid) {
      throw new Error('Dados do webhook inválidos ou txid não encontrado');
    }
    
    // 4. Verifica se a cobrança existe no banco
    const cobranca = await getCobranca(webhookData.txid);
    if (!cobranca) {
      console.warn(`⚠️  Webhook recebido para cobrança inexistente: ${webhookData.txid}`);
      // Pode ser uma cobrança criada externamente, mas vamos processar mesmo assim
    }
    
    // 5. Verifica se já foi processado (idempotência)
    // Isso evita processar o mesmo webhook múltiplas vezes
    const existingTransaction = await require('./dbService').getTransacao(webhookData.txid);
    if (existingTransaction && existingTransaction.status === 'CONFIRMADA') {
      console.log(`ℹ️  Transação ${webhookData.txid} já foi processada anteriormente`);
      return {
        success: true,
        message: 'Transação já processada',
        transacao: existingTransaction
      };
    }
    
    // 6. Processa a transação confirmada usando controle de transação
    // IMPORTANTE: Esta é a ÚNICA função que salva dados do doador na tabela 'doadores'
    // Os dados só são persistidos APÓS confirmação do pagamento via webhook
    // Antes disso, ficam apenas temporariamente em 'cobrancas.dados_doador_temp'
    const result = await processConfirmedTransaction(webhookData, doadorData);
    
    if (!result) {
      throw new Error('Falha ao processar transação no banco de dados');
    }
    
    console.log(`✅ Webhook processado com sucesso para txid: ${webhookData.txid}`);
    
    return {
      success: true,
      message: 'Transação confirmada e processada',
      transacao: result.transacao,
      doador: result.doador
    };
    
  } catch (error) {
    console.error('❌ Erro ao processar webhook:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  validateClientCertificate,
  validateWebhookSignature,
  extractWebhookData,
  processWebhook
};

