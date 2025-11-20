// Serviço de processamento de webhooks do Itaú
const crypto = require('crypto');
const { processConfirmedTransaction, getCobranca } = require('./dbService');
const { validateClientCertificateFromRequest } = require('./itauCertificateValidator');
require('dotenv').config();

/**
 * Valida o certificado do cliente (mTLS) do Itaú
 * IMPORTANTE: Valida que a requisição realmente vem do Itaú, não de qualquer origem
 * Conforme documentação: https://devportal.itau.com.br
 * O Itaú usa mTLS para webhooks, validando o certificado do cliente contra as CAs fornecidas
 * @param {Object} req - Objeto da requisição Express
 * @returns {boolean} true se válido e pertence ao Itaú
 */
function validateClientCertificate(req) {
  // Valida se o certificado do cliente pertence ao Itaú
  // Isso garante que apenas o Itaú pode acessar o endpoint do webhook
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
    // Em desenvolvimento, ainda exige assinatura se fornecida
    // Mas não rejeita se não houver secret configurado (apenas para testes locais)
    if (signature) {
      console.warn('⚠️  WEBHOOK_SECRET não configurado - não é possível validar assinatura');
      return false; // Rejeita se houver assinatura mas não houver secret para validar
    }
    console.warn('⚠️  WEBHOOK_SECRET não configurado - validação de assinatura desabilitada (apenas em desenvolvimento)');
    return true; // Aceita apenas em desenvolvimento E sem assinatura
  }
  
  // Em produção, assinatura é obrigatória
  if (!signature) {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ Webhook recebido sem assinatura em produção');
      return false;
    }
    console.warn('⚠️  Webhook recebido sem assinatura (desenvolvimento)');
    // Em desenvolvimento, permite sem assinatura apenas se não houver secret configurado
    return false; // Por padrão, exige assinatura se secret estiver configurado
  }
  
  // Implementa validação HMAC conforme documentação do Itaú
  // O Itaú pode usar diferentes métodos de validação (HMAC-SHA256, etc)
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
 * Extrai dados do webhook do Itaú
 * @param {Object} webhookBody - Corpo do webhook recebido
 * @returns {Object|null} Dados extraídos ou null se inválido
 */
function extractWebhookData(webhookBody) {
  try {
    // O formato do webhook do Itaú pode variar
    // Aqui assumimos um formato comum baseado na documentação PIX do Itaú
    const pix = webhookBody.pix?.[0] || webhookBody;
    
    // Valida e sanitiza TXID
    const txid = pix.txid || webhookBody.txid;
    if (!txid || typeof txid !== 'string') {
      throw new Error('TXID não encontrado ou inválido no webhook');
    }
    
    // Valida formato do TXID (aceita também id_cobranca_estatico_pix)
    const { validateTxid } = require('../utils/validation');
    // Se não for um txid válido, pode ser um id_cobranca_estatico_pix (UUID)
    if (!validateTxid(txid) && !txid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      throw new Error('TXID ou ID de cobrança do webhook tem formato inválido');
    }
    
    // Valida valor monetário
    const valor = pix.valor ? parseFloat(pix.valor) : (webhookBody.valor?.original ? parseFloat(webhookBody.valor.original) : null);
    if (valor !== null && (isNaN(valor) || valor <= 0)) {
      throw new Error('Valor do webhook inválido');
    }
    
    return {
      txid,
      endToEndId: pix.endToEndId || webhookBody.endToEndId || null,
      valor,
      horario: pix.horario || webhookBody.horario || new Date().toISOString(),
      status: 'CONFIRMADA', // Webhook só é enviado quando confirmado
      chave: pix.chave || webhookBody.chave || null,
      infoPagador: pix.infoPagador || webhookBody.infoPagador || null,
      // Dados completos para armazenar no JSONB (sanitizado)
      rawData: webhookBody
    };
  } catch (error) {
    console.error('❌ Erro ao extrair dados do webhook Itaú:', error.message);
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
    // IMPORTANTE: O Itaú pode validar o certificado do SERVIDOR durante o handshake TLS
    // Configure conforme a documentação do Itaú para webhooks
    if (req && !validateClientCertificate(req)) {
      throw new Error('Certificado do cliente inválido ou ausente');
    }
    
    // 2. Valida assinatura (obrigatória em produção, opcional em desenvolvimento)
    // Sempre valida se signature for fornecida, independente do ambiente
    if (signature) {
      if (!validateWebhookSignature(webhookBody, signature)) {
        throw new Error('Assinatura do webhook inválida');
      }
    } else if (process.env.NODE_ENV === 'production') {
      // Em produção, assinatura é obrigatória
      throw new Error('Webhook recebido sem assinatura em produção');
    } else {
      // Em desenvolvimento, apenas loga aviso
      console.warn('⚠️  Webhook recebido sem assinatura (desenvolvimento)');
    }
    
    // 3. Extrai dados do webhook
    const webhookData = extractWebhookData(webhookBody);
    if (!webhookData || !webhookData.txid) {
      throw new Error('Dados do webhook inválidos ou txid não encontrado');
    }
    
    // 4. Verifica se a cobrança existe no banco
    const cobranca = await getCobranca(webhookData.txid);
    if (!cobranca) {
      console.warn(`⚠️  Webhook Itaú recebido para cobrança inexistente: ${webhookData.txid}`);
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
    
    console.log(`✅ Webhook Itaú processado com sucesso para txid: ${webhookData.txid}`);
    
    return {
      success: true,
      message: 'Transação confirmada e processada',
      transacao: result.transacao,
      doador: result.doador
    };
    
  } catch (error) {
    console.error('❌ Erro ao processar webhook Itaú:', error.message);
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

