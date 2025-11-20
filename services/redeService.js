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
    : 'https://api.userede.com.br/desenvolvedores'
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

    const endpoint = '/v1/transactions';
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
 * @returns {Object|null} Dados da transação criada ou null em caso de erro
 */
async function createCreditCardTransaction(txid, valor, cartaoData, parcelas = 1, bandeira = null) {
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

    const endpoint = '/v1/transactions';
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
 * @returns {Object|null} Dados da transação criada ou null em caso de erro
 */
async function createDebitCardTransaction(txid, valor, cartaoData, bandeira = null) {
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

    const endpoint = '/v1/transactions';
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

    const endpoint = `/v1/transactions/${encodeURIComponent(tid)}`;
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

module.exports = {
  createPixCharge,
  createCreditCardTransaction,
  createDebitCardTransaction,
  consultTransaction,
  getAuthHeaders
};

