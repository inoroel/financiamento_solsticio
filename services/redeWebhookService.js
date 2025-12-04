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
 * Valida a assinatura do webhook (HMAC) - OPCIONAL
 * NOTA: A e-Rede não permite configurar secret no portal de webhooks.
 * Esta validação só funciona se a e-Rede enviar assinatura no header (o que pode não acontecer).
 * A segurança principal deve ser via IP Whitelist (REDE_WEBHOOK_IP_WHITELIST).
 * 
 * @param {Object} payload - Payload do webhook
 * @param {string} signature - Assinatura recebida (opcional)
 * @returns {boolean} true se válido ou se não houver assinatura/secret
 */
function validateWebhookSignature(payload, signature) {
  const webhookSecret = process.env.REDE_WEBHOOK_SECRET;

  // Se não houver secret configurado, não valida assinatura (comportamento padrão)
  if (!webhookSecret) {
    // Se recebeu assinatura mas não tem secret, apenas loga aviso
    if (signature) {
      console.warn('⚠️  Webhook recebido com assinatura, mas REDE_WEBHOOK_SECRET não configurado - assinatura ignorada');
    }
    return true; // Permite webhook sem validação de assinatura
  }

  // Se houver secret mas não recebeu assinatura, permite (e-Rede pode não enviar)
  if (!signature) {
    console.warn('⚠️  Webhook recebido sem assinatura (e-Rede pode não enviar assinatura)');
    return true; // Permite, pois e-Rede pode não enviar assinatura
  }

  // Se houver secret E assinatura, valida HMAC
  try {
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payloadString)
    .digest('hex');

  // Comparação segura contra timing attacks
    const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );

    if (!isValid) {
      console.error('❌ Assinatura do webhook inválida');
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Erro ao validar assinatura do webhook:', error.message);
    return false;
  }
}

/**
 * Extrai dados do webhook da e-Rede
 * 
 * IMPORTANTE: Diferenças entre PIX e Cartões:
 * 
 * - PIX: 
 *   - Status inicial: AGUARDANDO (cobrança criada, QR Code gerado)
 *   - Webhook: Avisa quando o PIX foi PAGO pelo usuário
 *   - Ação: Muda status de AGUARDANDO → CONFIRMADA
 * 
 * - Cartões (Crédito/Débito):
 *   - Status inicial: AUTORIZADA/CAPTURADA (se aprovado) ou NEGADA (se negado)
 *   - Webhook: Confirma a autorização/captura que JÁ ACONTECEU na criação
 *   - Ação: Confirma status já existente (idempotência)
 * 
 * @param {Object} webhookBody - Corpo do webhook recebido
 * @returns {Object|null} Dados extraídos ou null se inválido
 */
function extractWebhookData(webhookBody) {
  try {
    // O formato do webhook da e-Rede pode variar
    // Suporta formato legado (transaction) e novo formato de eventos (PIX)
    let transaction = webhookBody.transaction || webhookBody;

    // Tratamento específico para formato de eventos (ex: PIX)
    if (webhookBody.events && webhookBody.data) {
      // Exemplo: { events: ['PV.UPDATE_TRANSACTION_PIX'], data: { id: '...' } }
      const isPixEvent = webhookBody.events.some(e => e.includes('PIX'));

      return {
        rede_tid: webhookBody.data.id, // ID da transação no objeto data
        provider_tid: webhookBody.data.id,
        provider: 'REDE',
        txid: webhookBody.data.id, // Usa ID como referência se não houver outra
        tipo_pagamento: isPixEvent ? 'PIX' : 'DESCONHECIDO',
        valor: null, // Valor geralmente não vem no payload de evento simples
        status: 'CONFIRMADA', // Assume confirmada se recebeu evento de update/sucesso
        horario: new Date().toISOString(),
        returnCode: '00',
        returnMessage: 'Webhook Event Received',
        authorizationCode: null,
        bandeira: null,
        parcelas: 1,
        rawData: webhookBody
      };
    }

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
    // NOTA: Para PIX, status será CONFIRMADA (pagamento realizado)
    // Para cartões, status será AUTORIZADA/CAPTURADA (confirmação da autorização)
    let status = 'CONFIRMADA';
    if (transaction.returnCode !== '00') {
      status = 'NEGADA';
    } else if (transaction.status) {
      status = transaction.status.toUpperCase();
    }

    return {
      rede_tid,
      provider_tid: rede_tid, // provider_tid genérico (mesmo valor para e-Rede)
      provider: 'REDE', // Provider fixo para e-Rede
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
 * 
 * IMPORTANTE: Diferenças entre PIX e Cartões:
 * 
 * - PIX: 
 *   - Cobrança criada com status AGUARDANDO
 *   - Webhook avisa quando usuário PAGOU o PIX
 *   - Ação: Muda status de AGUARDANDO → CONFIRMADA e cria transação
 * 
 * - Cartões (Crédito/Débito):
 *   - Transação criada com status AUTORIZADA/CAPTURADA (se aprovado)
 *   - Webhook CONFIRMA a autorização que já aconteceu
 *   - Ação: Valida idempotência e confirma transação existente
 * 
 * @param {Object} webhookBody - Corpo do webhook recebido
 * @param {string} signature - Assinatura do webhook (opcional - e-Rede pode não enviar)
 * @param {string} clientIp - IP do cliente (validação via REDE_WEBHOOK_IP_WHITELIST)
 * @param {Object} doadorData - Dados opcionais do doador (se fornecidos na criação da cobrança)
 * @returns {Object|null} Resultado do processamento ou null
 */
async function processWebhook(webhookBody, signature = null, clientIp = null, doadorData = null) {
  try {
    // 1. Valida IP de origem (se configurado) - PRINCIPAL MÉTODO DE SEGURANÇA
    // NOTA: A e-Rede não permite configurar secret no portal, então a segurança
    // principal é via IP Whitelist (REDE_WEBHOOK_IP_WHITELIST)
    if (clientIp && !validateWebhookIP(clientIp)) {
      throw new Error('IP de origem não autorizado');
    }

    // 2. Valida assinatura (OPCIONAL - e-Rede pode não enviar)
    // NOTA: A e-Rede não permite configurar secret no portal.
    // A segurança principal é via IP Whitelist (REDE_WEBHOOK_IP_WHITELIST).
    if (signature) {
      if (!validateWebhookSignature(webhookBody, signature)) {
        throw new Error('Assinatura do webhook inválida');
      }
      console.log('✅ Assinatura do webhook validada com sucesso');
    } else {
      // e-Rede pode não enviar assinatura - isso é normal
      console.log('ℹ️  Webhook recebido sem assinatura (e-Rede pode não enviar)');
    }

    // 3. Extrai dados do webhook
    const webhookData = extractWebhookData(webhookBody);
    if (!webhookData || !webhookData.rede_tid) {
      // TID não encontrado no próprio webhook (formato inválido)
      throw new Error('Dados do webhook inválidos: TID não encontrado no payload');
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
      // TID existe no webhook mas cobrança não existe no banco
      // Isso pode acontecer se:
      // - Webhook de teste/desenvolvimento
      // - Cobrança foi deletada
      // - Webhook de outra aplicação/env
      console.warn(`⚠️  Webhook e-Rede recebido para cobrança inexistente: ${webhookData.rede_tid || webhookData.txid}`);
      throw new Error(`Cobrança inexistente: TID ${webhookData.rede_tid || webhookData.txid} não encontrado no banco de dados`);
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

