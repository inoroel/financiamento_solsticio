// Serviço de processamento de webhooks da e-Rede
const crypto = require('crypto');
const { processConfirmedTransaction, getCobranca } = require('./dbService');
require('dotenv').config();

// Função auxiliar para buscar cobrança por rede_tid (evita dependência circular)
async function getCobrancaByRedeTid(rede_tid) {
  try {
    const { sql } = require('../config/database');
    const result = await sql`
      SELECT * FROM cobrancas WHERE rede_tid = ${rede_tid}
    `;
    
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('❌ Erro ao buscar cobrança por rede_tid:', error.message);
    return null;
  }
}

/**
 * Valida o IP de origem do webhook contra whitelist (se configurado)
 * @param {string} clientIp - IP do cliente
 * @returns {boolean} true se válido ou se whitelist não estiver configurada
 */
function validateWebhookIP(clientIp) {
  const ipWhitelist = process.env.REDE_WEBHOOK_IP_WHITELIST;
  
  if (!ipWhitelist) {
    // Se não houver whitelist configurada, permite em desenvolvimento
    if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️  REDE_WEBHOOK_IP_WHITELIST não configurado em produção');
    }
    return true; // Permite se não houver whitelist (desenvolvimento)
  }
  
  const allowedIPs = ipWhitelist.split(',').map(ip => ip.trim());
  
  // Verifica se o IP está na whitelist
  if (allowedIPs.includes(clientIp)) {
    return true;
  }
  
  // Verifica ranges CIDR (básico)
  for (const allowedIP of allowedIPs) {
    if (allowedIP.includes('/')) {
      // Implementação básica de verificação CIDR
      // Em produção, use uma biblioteca adequada
      const [network, prefix] = allowedIP.split('/');
      // Simplificação: apenas verifica se começa com o mesmo prefixo
      if (clientIp.startsWith(network.split('.').slice(0, parseInt(prefix) / 8).join('.'))) {
        return true;
      }
    }
  }
  
  console.error(`❌ IP ${clientIp} não está na whitelist permitida`);
  return false;
}

/**
 * Valida a assinatura do webhook (HMAC)
 * @param {Object} payload - Payload do webhook
 * @param {string} signature - Assinatura recebida
 * @returns {boolean} true se válido
 */
function validateWebhookSignature(payload, signature) {
  const webhookSecret = process.env.REDE_WEBHOOK_SECRET;
  
  // Em produção, SEMPRE deve ter secret configurado
  if (!webhookSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ CRÍTICO: REDE_WEBHOOK_SECRET não configurado em produção!');
      return false;
    }
    // Em desenvolvimento, ainda exige assinatura se fornecida
    if (signature) {
      console.warn('⚠️  REDE_WEBHOOK_SECRET não configurado - não é possível validar assinatura');
      return false;
    }
    console.warn('⚠️  REDE_WEBHOOK_SECRET não configurado - validação de assinatura desabilitada (apenas em desenvolvimento)');
    return true;
  }
  
  // Em produção, assinatura é obrigatória
  if (!signature) {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ Webhook recebido sem assinatura em produção');
      return false;
    }
    console.warn('⚠️  Webhook recebido sem assinatura (desenvolvimento)');
    return false; // Por padrão, exige assinatura se secret estiver configurado
  }
  
  // Implementa validação HMAC conforme documentação da e-Rede
  // A e-Rede pode usar diferentes métodos de validação (HMAC-SHA256, etc)
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payloadString)
    .digest('hex');
  
  // Comparação segura contra timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Extrai dados do webhook da e-Rede
 * @param {Object} webhookBody - Corpo do webhook recebido
 * @returns {Object|null} Dados extraídos ou null se inválido
 */
function extractWebhookData(webhookBody) {
  try {
    // O formato do webhook da e-Rede pode variar
    // Aqui assumimos um formato comum baseado na documentação
    const transaction = webhookBody.transaction || webhookBody;
    
    // Valida e sanitiza TID (Transaction ID da Rede)
    const rede_tid = transaction.tid || transaction.reference || webhookBody.tid;
    if (!rede_tid || typeof rede_tid !== 'string') {
      throw new Error('TID não encontrado ou inválido no webhook');
    }
    
    // Valida valor monetário (em centavos na e-Rede)
    const valor = transaction.amount ? parseFloat(transaction.amount) / 100 : null;
    if (valor !== null && (isNaN(valor) || valor <= 0)) {
      throw new Error('Valor do webhook inválido');
    }
    
    // Determina tipo de pagamento
    let tipoPagamento = 'PIX';
    if (transaction.kind === 'credit') {
      tipoPagamento = 'CREDITO';
    } else if (transaction.kind === 'debit') {
      tipoPagamento = 'DEBITO';
    }
    
    // Determina status
    let status = 'CONFIRMADA';
    if (transaction.returnCode !== '00') {
      status = 'NEGADA';
    } else if (transaction.status) {
      status = transaction.status.toUpperCase();
    }
    
    return {
      rede_tid,
      txid: transaction.reference || rede_tid, // Usa reference como txid interno
      tipo_pagamento: tipoPagamento,
      valor,
      status,
      horario: transaction.dateTime || new Date().toISOString(),
      returnCode: transaction.returnCode,
      returnMessage: transaction.returnMessage,
      authorizationCode: transaction.authorizationCode,
      bandeira: transaction.card?.brand || null,
      parcelas: transaction.installments || null,
      // Dados completos para armazenar no JSONB (sanitizado)
      rawData: webhookBody
    };
  } catch (error) {
    console.error('❌ Erro ao extrair dados do webhook e-Rede:', error.message);
    return null;
  }
}

/**
 * Processa um webhook de pagamento confirmado da e-Rede
 * @param {Object} webhookBody - Corpo do webhook recebido
 * @param {string} signature - Assinatura do webhook (opcional)
 * @param {string} clientIp - IP do cliente
 * @param {Object} doadorData - Dados opcionais do doador (se fornecidos na criação da cobrança)
 * @returns {Object|null} Resultado do processamento ou null
 */
async function processWebhook(webhookBody, signature = null, clientIp = null, doadorData = null) {
  try {
    // 1. Valida IP de origem (se configurado)
    if (clientIp && !validateWebhookIP(clientIp)) {
      throw new Error('IP de origem não autorizado');
    }
    
    // 2. Valida assinatura (obrigatória em produção, opcional em desenvolvimento)
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
    if (!webhookData || !webhookData.rede_tid) {
      throw new Error('Dados do webhook inválidos ou TID não encontrado');
    }
    
    // 4. Verifica se a cobrança existe no banco (por rede_tid ou txid)
    let cobranca = null;
    if (webhookData.rede_tid) {
      // Busca por rede_tid primeiro
      cobranca = await getCobrancaByRedeTid(webhookData.rede_tid);
    }
    
    // Se não encontrou por rede_tid, tenta por txid
    if (!cobranca && webhookData.txid) {
      cobranca = await getCobranca(webhookData.txid);
    }
    
    if (!cobranca) {
      console.warn(`⚠️  Webhook e-Rede recebido para cobrança inexistente: ${webhookData.rede_tid || webhookData.txid}`);
      // Pode ser uma cobrança criada externamente, mas vamos processar mesmo assim
    }
    
    // 5. Verifica se já foi processado (idempotência)
    // Isso evita processar o mesmo webhook múltiplas vezes
    const existingTransaction = await require('./dbService').getTransacaoByRedeTid(webhookData.rede_tid);
    if (existingTransaction && existingTransaction.status === 'CONFIRMADA') {
      console.log(`ℹ️  Transação ${webhookData.rede_tid} já foi processada anteriormente`);
      return {
        success: true,
        message: 'Transação já processada',
        transacao: existingTransaction
      };
    }
    
    // 6. Recupera dados do doador da cobrança (se não fornecidos explicitamente)
    let dadosDoadorFinal = doadorData;
    if (!dadosDoadorFinal && cobranca && cobranca.dados_doador_temp) {
      // JSONB pode vir como objeto ou string, verifica tipo
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
    
    // 7. Processa a transação confirmada usando controle de transação
    // IMPORTANTE: Esta é a ÚNICA função que salva dados do doador na tabela 'doadores'
    // Os dados só são persistidos APÓS confirmação do pagamento via webhook
    const result = await processConfirmedTransaction(webhookData, dadosDoadorFinal);
    
    if (!result) {
      throw new Error('Falha ao processar transação no banco de dados');
    }
    
    console.log(`✅ Webhook e-Rede processado com sucesso para tid: ${webhookData.rede_tid}`);
    
    return {
      success: true,
      message: 'Transação confirmada e processada',
      transacao: result.transacao,
      doador: result.doador
    };
    
  } catch (error) {
    console.error('❌ Erro ao processar webhook e-Rede:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}


module.exports = {
  validateWebhookIP,
  validateWebhookSignature,
  extractWebhookData,
  processWebhook,
  getCobrancaByRedeTid
};

