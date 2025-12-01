// Serviço de integração com a API e-Rede
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const PV = process.env.REDE_PV;
const TOKEN = process.env.REDE_TOKEN;
const ENVIRONMENT = process.env.REDE_ENVIRONMENT || 'sandbox';

// URLs da API e-Rede
const API_BASE_URL = process.env.REDE_API_BASE_URL || (
  ENVIRONMENT === 'production'
    ? 'https://api.userede.com.br/erede'
    : 'https://sandbox-erede.useredecloud.com.br'
);

// URL da API de Tokenização de Bandeira (Network Tokenization)
const TOKENIZATION_API_URL = process.env.REDE_TOKENIZATION_API_URL || (
  ENVIRONMENT === 'production'
    ? 'https://api.userede.com.br/redelabs/token-service/v1/tokenization'
    : 'https://rl7-sandbox-api.useredecloud.com.br/v1/tokenization'
);

/**
 * Gera um Correlation ID único para rastreamento de requisições
 * @returns {string} UUID v4
 */
function generateCorrelationId() {
  return uuidv4();
}

/**
 * Cria headers de autenticação para a API e-Rede
 * @returns {Object} Headers de autenticação
 */
function getAuthHeaders() {
  if (!PV || !TOKEN) {
    throw new Error('REDE_PV e REDE_TOKEN devem estar configurados');
  }

  return {
    'Authorization': `Basic ${Buffer.from(`${PV}:${TOKEN}`).toString('base64')}`,
    'Content-Type': 'application/json',
    'User-Agent': 'financiamento-solsticio/1.0'
  };
}

/**
 * Tokeniza um cartão usando o serviço de Tokenização de Bandeira (Network Tokenization)
 * Obrigatório para transações Visa na e-Rede
 * @param {Object} cardData - Dados do cartão {cardNumber, cardholderName, expirationMonth, expirationYear, securityCode}
 * @param {string} brandName - Nome da bandeira ('visa', 'mastercard', 'elo')
 * @returns {Object|null} Dados do token gerado ou null em caso de erro
 */
async function tokenizeCard(cardData, brandName = 'visa') {
  try {
    // Validações básicas
    if (!cardData || !cardData.cardNumber || !cardData.cardholderName) {
      throw new Error('Dados do cartão inválidos para tokenização');
    }

    if (!cardData.expirationMonth || !cardData.expirationYear) {
      throw new Error('Data de validade do cartão é obrigatória');
    }

    if (!cardData.securityCode) {
      throw new Error('CVV do cartão é obrigatório para tokenização');
    }

    console.log(`\n🔐 Iniciando tokenização de bandeira (${brandName.toUpperCase()})...`);

    const correlationId = generateCorrelationId();

    // Estrutura da requisição para tokenização
    const requestBody = {
      cardNumber: cardData.cardNumber.replace(/\s/g, ''), // Remove espaços
      cardholderName: cardData.cardholderName.trim(),
      expirationMonth: String(cardData.expirationMonth).padStart(2, '0'),
      expirationYear: String(cardData.expirationYear),
      securityCode: cardData.securityCode,
      brand: brandName.toLowerCase(),
      email: cardData.email || 'teste@example.com', // Email obrigatório na API e-Rede
      storageCard: cardData.storageCard || '0', // 0 = não armazenado, 1 = primeira vez, 2 = já armazenado
      kind: cardData.kind || 'credit' // credit ou debit
    };

    const response = await axios.post(
      TOKENIZATION_API_URL,
      requestBody,
      {
        headers: {
          ...getAuthHeaders(),
          'X-Request-Id': correlationId
        }
      }
    );

    console.log('✅ TOKENIZAÇÃO DE BANDEIRA CONCLUÍDA COM SUCESSO!');

    // Retorna o token da bandeira (Network Token) e cryptogram
    return {
      success: true,
      networkToken: response.data.token || response.data.networkToken,
      cryptogram: response.data.cryptogram || null,
      expirationMonth: response.data.expirationMonth || cardData.expirationMonth,
      expirationYear: response.data.expirationYear || cardData.expirationYear,
      brand: response.data.brand || brandName,
      tokenRequestorId: response.data.tokenRequestorId || null
    };

  } catch (error) {
    console.error('❌ ERRO AO TOKENIZAR CARTÃO ---');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Erro:', error.message);
    }
    return null;
  }
}

/**
 * Cria uma cobrança PIX (QR Code) na e-Rede
 * @param {string} txid - Identificador único da transação (26-35 caracteres)
 * @param {number} valor - Valor da cobrança
 * @param {string} solicitacaoPagador - Mensagem para o pagador (opcional)
 * @param {number} expiracao - Tempo de expiração em segundos (padrão: 3600)
 * @returns {Object|null} Dados da cobrança criada ou null em caso de erro
 */
async function createPixCharge(txid, valor, solicitacaoPagador = "Doação para o Festival Solsticio", expiracao = 3600) {
  try {
    // Validações de segurança
    const { validateTxid, validateValor, sanitizeString } = require('../utils/validation');

    if (!validateTxid(txid)) {
      throw new Error('TXID inválido');
    }

    const valorValidado = validateValor(valor);
    if (!valorValidado) {
      throw new Error('Valor inválido');
    }

    // Sanitiza mensagem
    let mensagemSanitizada = null;
    if (solicitacaoPagador) {
      mensagemSanitizada = sanitizeString(solicitacaoPagador);
      mensagemSanitizada = mensagemSanitizada.replace(/[\x00-\x1F\x7F]/g, '');
      mensagemSanitizada = mensagemSanitizada.slice(0, 140);
    }

    // Valida expiração (máximo 24 horas, padrão 3600 se não informado)
    const expiracaoValidada = expiracao ? Math.min(Math.max(parseInt(expiracao) || 3600, 60), 86400) : 3600;

    console.log(`\n📝 Criando cobrança PIX e-Rede com txid: ${txid} e valor: ${valorValidado}`);

    const endpoint = '/v2/transactions';
    const correlationId = generateCorrelationId();

    // Estrutura da requisição para PIX conforme documentação e-Rede
    const requestBody = {
      capture: true,
      kind: 'pix',
      amount: Math.round(valorValidado * 100), // Valor em centavos
      reference: txid,
      expirationTime: expiracaoValidada
    };

    // Adiciona mensagem se fornecida
    if (mensagemSanitizada) {
      requestBody.description = mensagemSanitizada;
    }

    const response = await axios.post(
      `${API_BASE_URL}${endpoint}`,
      requestBody,
      {
        headers: {
          ...getAuthHeaders(),
          'X-Request-Id': correlationId
        }
      }
    );

    console.log('✅ COBRANÇA PIX e-Rede CRIADA COM SUCESSO!');

    // A e-Rede retorna o QR Code e Transaction ID (tid)
    return {
      status: response.data.returnCode === '00' ? 'ATIVA' : 'ERRO',
      txid: txid,
      rede_tid: response.data.tid || response.data.reference,
      brCode: response.data.qrCode || response.data.qrcode || null,
      expiracao: expiracaoValidada,
      valor: valorValidado,
      criadoEm: response.data.dateTime || new Date().toISOString(),
      returnCode: response.data.returnCode,
      returnMessage: response.data.returnMessage
    };

  } catch (error) {
    console.error('❌ ERRO AO CRIAR COBRANÇA PIX e-Rede ---');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Erro:', error.message);
    }
    return null;
  }
}

/**
 * Cria uma transação com cartão de crédito na e-Rede
 * @param {string} txid - Identificador único da transação
 * @param {number} valor - Valor da transação
 * @param {Object} cartaoData - Dados do cartão tokenizado
 * @param {number} parcelas - Número de parcelas (1-12)
 * @param {string} bandeira - Bandeira do cartão (opcional, detectada automaticamente)
 * @param {Object} threeDSecure - Dados de autenticação 3DS (opcional, obrigatório para MasterCard DataOnly)
 * @param {Object} recurrenceData - Dados de recorrência/COF (opcional): {subscription, storageCard, brandTid, credentialId}
 * @returns {Object|null} Dados da transação criada ou null em caso de erro
 */
async function createCreditCardTransaction(txid, valor, cartaoData, parcelas = 1, bandeira = null, threeDSecure = null, recurrenceData = null) {
  try {
    // Validações
    const { validateValor } = require('../utils/validation');

    const valorValidado = validateValor(valor);
    if (!valorValidado) {
      throw new Error('Valor inválido');
    }

    if (!cartaoData || !cartaoData.token) {
      throw new Error('Dados do cartão inválidos: token é obrigatório');
    }

    if (parcelas < 1 || parcelas > 12) {
      throw new Error('Número de parcelas inválido (deve ser entre 1 e 12)');
    }

    console.log(`\n📝 Criando transação de crédito e-Rede com txid: ${txid} e valor: ${valorValidado}`);

    const endpoint = '/v2/transactions';
    const correlationId = generateCorrelationId();

    // Estrutura da requisição para cartão de crédito
    const requestBody = {
      capture: true,
      kind: 'credit',
      amount: Math.round(valorValidado * 100), // Valor em centavos
      reference: txid,
      installments: parcelas,
      card: {
        token: cartaoData.token
      }
    };

    // Adiciona bandeira se fornecida
    if (bandeira) {
      requestBody.card.brand = bandeira;
    }

    // Adiciona dados de recorrência/COF (Card-on-File) - Manual p.202-208
    if (recurrenceData && typeof recurrenceData === 'object') {
      // subscription: indica se é recorrência (true/false)
      if (recurrenceData.subscription !== undefined) {
        requestBody.subscription = recurrenceData.subscription;
      }

      // storageCard: 0=não armazenado, 1=primeira vez, 2=já armazenado
      if (recurrenceData.storageCard !== undefined) {
        requestBody.storageCard = String(recurrenceData.storageCard);
      }

      // brandTid: correlaciona primeira transação com subsequentes
      if (recurrenceData.brandTid) {
        requestBody.brandTid = recurrenceData.brandTid;
      }

      // transactionCredentials: obrigatório para Mastercard quando storageCard=1|2
      if (recurrenceData.credentialId) {
        requestBody.transactionCredentials = {
          credentialId: recurrenceData.credentialId
        };
      }

      console.log('🔄 Transação com dados de recorrência/COF configurados');
    }

    // Adiciona dados de autenticação 3DS/DataOnly (obrigatório para MasterCard)
    // DataOnly: autenticação frictionless para Mastercard/Visa
    if (threeDSecure && typeof threeDSecure === 'object') {
      requestBody.threeDSecure = {
        embedded: threeDSecure.embedded !== false, // Default: true (frictionless)
        onFailure: threeDSecure.onFailure || 'decline', // 'decline' ou 'continue'
        ...threeDSecure // Permite outros campos como eci, cavv, xid, etc.
      };

      console.log('🔒 Transação com autenticação 3DS/DataOnly ativada');
    }

    const response = await axios.post(
      `${API_BASE_URL}${endpoint}`,
      requestBody,
      {
        headers: {
          ...getAuthHeaders(),
          'X-Request-Id': correlationId
        }
      }
    );

    console.log('✅ TRANSAÇÃO DE CRÉDITO e-Rede CRIADA COM SUCESSO!');

    return {
      status: response.data.returnCode === '00' ? 'AUTORIZADA' : 'NEGADA',
      txid: txid,
      rede_tid: response.data.tid || response.data.reference,
      valor: valorValidado,
      parcelas: parcelas,
      bandeira: response.data.card?.brand || bandeira || 'UNKNOWN',
      criadoEm: response.data.dateTime || new Date().toISOString(),
      returnCode: response.data.returnCode,
      returnMessage: response.data.returnMessage,
      authorizationCode: response.data.authorizationCode
    };

  } catch (error) {
    console.error('❌ ERRO AO CRIAR TRANSAÇÃO DE CRÉDITO e-Rede ---');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Erro:', error.message);
    }
    return null;
  }
}

/**
 * Cria uma transação com cartão de débito na e-Rede
 * @param {string} txid - Identificador único da transação
 * @param {number} valor - Valor da transação
 * @param {Object} cartaoData - Dados do cartão tokenizado
 * @param {string} bandeira - Bandeira do cartão (Mastercard, Visa ou Elo)
 * @param {Object} recurrenceData - Dados de recorrência/COF (opcional): {subscription, storageCard, brandTid, credentialId}
 * @param {Object} threeDSecure - Dados de autenticação 3DS (obrigatório para débito)
 * @returns {Object|null} Dados da transação criada ou null em caso de erro
 */
async function createDebitCardTransaction(txid, valor, cartaoData, bandeira = null, recurrenceData = null, threeDSecure = null) {
  try {
    // Validações
    const { validateValor } = require('../utils/validation');

    const valorValidado = validateValor(valor);
    if (!valorValidado) {
      throw new Error('Valor inválido');
    }

    if (!cartaoData || !cartaoData.token) {
      throw new Error('Dados do cartão inválidos: token é obrigatório');
    }

    // Valida bandeira para débito (apenas Mastercard, Visa, Elo)
    const bandeirasValidas = ['mastercard', 'visa', 'elo'];
    if (bandeira && !bandeirasValidas.includes(bandeira.toLowerCase())) {
      throw new Error(`Bandeira inválida para débito. Apenas: ${bandeirasValidas.join(', ')}`);
    }

    console.log(`\n📝 Criando transação de débito e-Rede com txid: ${txid} e valor: ${valorValidado}`);

    const endpoint = '/v2/transactions';
    const correlationId = generateCorrelationId();

    // Estrutura da requisição para cartão de débito
    const requestBody = {
      capture: true,
      kind: 'debit',
      amount: Math.round(valorValidado * 100), // Valor em centavos
      reference: txid,
      card: {
        token: cartaoData.token
      }
    };

    // Adiciona bandeira se fornecida
    if (bandeira) {
      requestBody.card.brand = bandeira;
    }

    // Adiciona dados de recorrência/COF (Card-on-File) - Manual p.202-208
    if (recurrenceData && typeof recurrenceData === 'object') {
      // subscription: indica se é recorrência (true/false)
      if (recurrenceData.subscription !== undefined) {
        requestBody.subscription = recurrenceData.subscription;
      }

      // storageCard: 0=não armazenado, 1=primeira vez, 2=já armazenado
      if (recurrenceData.storageCard !== undefined) {
        requestBody.storageCard = String(recurrenceData.storageCard);
      }

      // brandTid: correlaciona primeira transação com subsequentes
      if (recurrenceData.brandTid) {
        requestBody.brandTid = recurrenceData.brandTid;
      }

      // transactionCredentials: obrigatório para Mastercard quando storageCard=1|2
      if (recurrenceData.credentialId) {
        requestBody.transactionCredentials = {
          credentialId: recurrenceData.credentialId
        };
      }

      console.log('🔄 Transação DÉBITO com dados de recorrência/COF configurados');
    }

    // Adiciona dados de autenticação 3DS (obrigatório para débito)
    if (threeDSecure && typeof threeDSecure === 'object') {
      requestBody.threeDSecure = {
        embedded: threeDSecure.embedded !== false, // Default: true (frictionless)
        onFailure: threeDSecure.onFailure || 'decline', // 'decline' para débito (obrigatório)
        ...threeDSecure // Permite outros campos como eci, cavv, xid, etc.
      };

      console.log('🔒 Transação DÉBITO com autenticação 3DS ativada');
    }

    const response = await axios.post(
      `${API_BASE_URL}${endpoint}`,
      requestBody,
      {
        headers: {
          ...getAuthHeaders(),
          'X-Request-Id': correlationId
        }
      }
    );

    console.log('✅ TRANSAÇÃO DE DÉBITO e-Rede CRIADA COM SUCESSO!');

    return {
      status: response.data.returnCode === '00' ? 'CAPTURADA' : 'NEGADA',
      txid: txid,
      rede_tid: response.data.tid || response.data.reference,
      valor: valorValidado,
      bandeira: response.data.card?.brand || bandeira || 'UNKNOWN',
      criadoEm: response.data.dateTime || new Date().toISOString(),
      returnCode: response.data.returnCode,
      returnMessage: response.data.returnMessage,
      authorizationCode: response.data.authorizationCode
    };

  } catch (error) {
    console.error('❌ ERRO AO CRIAR TRANSAÇÃO DE DÉBITO e-Rede ---');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Erro:', error.message);
    }
    return null;
  }
}

/**
 * Consulta o status de uma transação na e-Rede
 * @param {string} tid - Transaction ID da e-Rede (ou txid interno)
 * @returns {Object|null} Dados da transação ou null em caso de erro
 */
async function consultTransaction(tid) {
  try {
    if (!tid || typeof tid !== 'string') {
      throw new Error('TID ou TXID inválido');
    }

    console.log(`\n🔍 Consultando transação e-Rede com identificador: ${tid}`);

    const endpoint = `/v2/transactions/${encodeURIComponent(tid)}`;
    const correlationId = generateCorrelationId();

    const response = await axios.get(
      `${API_BASE_URL}${endpoint}`,
      {
        headers: {
          ...getAuthHeaders(),
          'X-Request-Id': correlationId
        }
      }
    );

    console.log('✅ TRANSAÇÃO e-Rede CONSULTADA COM SUCESSO!');

    // Determina tipo de pagamento baseado no kind
    let tipoPagamento = 'PIX';
    if (response.data.kind === 'credit') {
      tipoPagamento = 'CREDITO';
    } else if (response.data.kind === 'debit') {
      tipoPagamento = 'DEBITO';
    }

    return {
      status: response.data.returnCode === '00' ? 'CONFIRMADA' : response.data.status || 'PENDENTE',
      txid: response.data.reference || tid,
      rede_tid: response.data.tid || tid,
      tipo_pagamento: tipoPagamento,
      valor: response.data.amount ? parseFloat(response.data.amount) / 100 : null,
      bandeira: response.data.card?.brand || null,
      parcelas: response.data.installments || null,
      criadoEm: response.data.dateTime || null,
      atualizadoEm: response.data.dateTime || null,
      returnCode: response.data.returnCode,
      returnMessage: response.data.returnMessage,
      authorizationCode: response.data.authorizationCode,
      // Para PIX
      brCode: response.data.qrCode || response.data.qrcode || null
    };

  } catch (error) {
    console.error('❌ ERRO AO CONSULTAR TRANSAÇÃO e-Rede ---');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Erro:', error.message);
    }
    return null;
  }
}

/**
 * Cancela (estorna) uma transação total ou parcialmente
 * Documentação: Manual p.72-75
 * 
 * @param {string} tid - TID da transação a ser cancelada
 * @param {number} valor - Valor do cancelamento em centavos (opcional, default: valor total)
 * @param {string} callbackUrl - URL para callback de status (opcional)
 * @returns {Object|null} Dados do cancelamento ou null em caso de erro
 */
async function cancelTransaction(tid, valor = null, callbackUrl = null) {
  try {
    // Validações
    if (!tid || typeof tid !== 'string') {
      throw new Error('TID inválido');
    }

    console.log(`\n🔄 Cancelando transação e-Rede TID: ${tid}${valor ? ` - Valor: R$ ${(valor / 100).toFixed(2)}` : ' (total)'}`);

    const endpoint = `/v2/transactions/${encodeURIComponent(tid)}/refunds`;
    const correlationId = generateCorrelationId();

    // Estrutura da requisição de cancelamento
    const requestBody = {};

    // Adiciona valor se for cancelamento parcial
    if (valor !== null) {
      requestBody.amount = Math.round(valor);
    }

    // Adiciona callback URL se fornecida
    if (callbackUrl) {
      requestBody.urls = [
        {
          kind: 'callback',
          url: callbackUrl
        }
      ];
    }

    const response = await axios.post(
      `${API_BASE_URL}${endpoint}`,
      requestBody,
      {
        headers: {
          ...getAuthHeaders(),
          'X-Request-Id': correlationId
        }
      }
    );

    console.log('✅ CANCELAMENTO e-Rede SOLICITADO COM SUCESSO!');

    return {
      refundId: response.data.refundId || null,
      tid: response.data.tid,
      nsu: response.data.nsu,
      cancelId: response.data.cancelId || null, // Retornado apenas em cancelamentos D+1
      refundDateTime: response.data.refundDateTime,
      status: response.data.status || 'Processing', // Processing, Done, Denied
      amount: valor || response.data.amount,
      returnCode: response.data.returnCode,
      returnMessage: response.data.returnMessage
    };

  } catch (error) {
    console.error('❌ ERRO AO CANCELAR TRANSAÇÃO e-Rede ---');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Erro:', error.message);
    }
    return null;
  }
}

/**
 * Executa uma autorização Zero Dollar para validar um cartão
 * IMPORTANTE: Autorização $0.00 é obrigatória antes de armazenar cartões (Manual p.67-71)
 * 
 * @param {Object} cardData - Dados do cartão {cardNumber, expirationMonth, expirationYear, securityCode, cardholderName}
 * @param {string} txid - Identificador único da trans ação Zero Dollar
 * @param {string} kind - Tipo de cartão ('credit' ou 'debit', default: 'credit')
 * @returns {Object|null} Status da validação ou null em caso de erro
 */
async function authorizeZeroDollar(cardData, txid, kind = 'credit') {
  try {
    // Validações
    if (!cardData || typeof cardData !== 'object') {
      throw new Error('Dados do cartão inválidos');
    }

    if (!txid || typeof txid !== 'string') {
      throw new Error('TXID inválido');
    }

    // securityCode é OBRIGATÓRIO para Zero Dollar (Manual p.68)
    if (!cardData.securityCode || typeof cardData.securityCode !== 'string') {
      throw new Error('securityCode é obrigatório para transações Zero Dollar (Manual e-Rede p.68)');
    }

    // Campos obrigatórios
    if (!cardData.cardNumber || !cardData.expirationMonth || !cardData.expirationYear) {
      throw new Error('cardNumber, expirationMonth e expirationYear são obrigatórios');
    }

    console.log(`\n🔒 Executando Zero Dollar Authorization para validar cartão (txid: ${txid})`);

    const endpoint = '/v2/transactions';
    const correlationId = generateCorrelationId();

    // Estrutura da requisição Zero Dollar (Manual p.68)
    const requestBody = {
      capture: true, // OBRIGATÓRIO para Zero Dollar
      kind: kind, // 'credit' ou 'debit'
      amount: 0, // ZERO DOLLAR
      reference: txid,
      cardNumber: cardData.cardNumber,
      expirationMonth: parseInt(cardData.expirationMonth),
      expirationYear: parseInt(cardData.expirationYear),
      securityCode: cardData.securityCode,
      cardholderName: cardData.cardholderName || 'CARDHOLDER'
    };

    const response = await axios.post(
      `${API_BASE_URL}${endpoint}`,
      requestBody,
      {
        headers: {
          ...getAuthHeaders(),
          'X-Request-Id': correlationId
        }
      }
    );

    console.log('✅ ZERO DOLLAR AUTHORIZATION APROVADA!');
    console.log(`   TID: ${response.data.tid}`);
    console.log(`   Return Code: ${response.data.returnCode} - ${response.data.returnMessage}`);

    return {
      aprovado: response.data.returnCode === '00',
      tid: response.data.tid,
      nsu: response.data.nsu,
      authorizationCode: response.data.authorizationCode || response.data.brand?.authorizationCode,
      returnCode: response.data.returnCode,
      returnMessage: response.data.returnMessage,
      cardBin: response.data.cardBin,
      last4: response.data.last4,
      brand: response.data.brand?.name
    };

  } catch (error) {
    console.error('❌ ERRO NO ZERO DOLLAR AUTHORIZATION ---');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Erro:', error.message);
    }
    return null;
  }
}

module.exports = {
  createPixCharge,
  createCreditCardTransaction,
  createDebitCardTransaction,
  consultTransaction,
  cancelTransaction,
  getAuthHeaders,
  tokenizeCard,
  authorizeZeroDollar
};

