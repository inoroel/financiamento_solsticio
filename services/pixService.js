// Serviço de integração com a API PIX v2 do Banco do Brasil
const axios = require('axios');
require('dotenv').config();

// Cache simples para o access token (evita requisições desnecessárias)
let tokenCache = {
  token: null,
  expiresAt: null
};

const CLIENT_ID = process.env.BB_CLIENT_ID;
const CLIENT_SECRET = process.env.BB_CLIENT_SECRET;
const DEV_APP_KEY = process.env.BB_DEV_APP_KEY;
const CHAVE_PIX = process.env.BB_CHAVE_PIX || 'hmtestes2@bb.com.br';
const AUTH_URL = process.env.BB_AUTH_URL || 'https://oauth.hm.bb.com.br/oauth/token';
const API_BASE_URL = process.env.BB_API_BASE_URL || 'https://api.hm.bb.com.br';

/**
 * Busca um Access Token da API do BB.
 * Implementa cache para evitar requisições desnecessárias.
 */
async function getAccessToken() {
  // Verifica se o token ainda é válido (com margem de 5 minutos)
  if (tokenCache.token && tokenCache.expiresAt && Date.now() < tokenCache.expiresAt - 300000) {
    return tokenCache.token;
  }

  const credentials = `${CLIENT_ID}:${CLIENT_SECRET}`;
  const base64Credentials = Buffer.from(credentials).toString('base64');
  
  try {
    const scope = 'cob.read cob.write';
    const response = await axios.post(
      AUTH_URL,
      new URLSearchParams({ 
        'grant_type': 'client_credentials', 
        'scope': scope 
      }),
      { 
        headers: {
          'Authorization': `Basic ${base64Credentials}`, 
          'Content-Type': 'application/x-www-form-urlencoded'
        } 
      }
    );
    
    // Cacheia o token (assume expiração em 1 hora se não informado)
    const expiresIn = response.data.expires_in || 3600;
    tokenCache = {
      token: response.data.access_token,
      expiresAt: Date.now() + (expiresIn * 1000)
    };
    
    console.log(`✅ Token gerado com sucesso para os escopos: ${scope}`);
    return tokenCache.token;
  } catch (error) {
    console.error('❌ ERRO AO OBTER TOKEN ---');
    console.error(error.response ? error.response.data : error.message);
    return null;
  }
}

/**
 * Cria a cobrança Pix (QR Code) no Banco do Brasil.
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
    
    // Limita tamanho da mensagem (prevenção de DoS)
    const mensagemSanitizada = sanitizeString(solicitacaoPagador).slice(0, 140);
    
    // Valida expiração (máximo 24 horas)
    const expiracaoValidada = Math.min(Math.max(parseInt(expiracao) || 3600, 60), 86400);
    
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Não foi possível obter token de autenticação');
    }

    console.log(`\n📝 Criando cobrança com txid: ${txid} e valor: ${valorValidado}`);

    const endpoint = `/pix/v2/cob/${encodeURIComponent(txid)}?gw-dev-app-key=${DEV_APP_KEY}`;

    const requestBody = {
      calendario: { expiracao: expiracaoValidada },
      valor: { original: valorValidado.toFixed(2) },
      chave: CHAVE_PIX,
      solicitacaoPagador: mensagemSanitizada
    };

    const response = await axios.put(
      `${API_BASE_URL}${endpoint}`, 
      requestBody,
      { 
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        } 
      }
    );

    console.log('✅ COBRANÇA CRIADA COM SUCESSO!');
    
    return {
      status: response.data.status,
      txid: response.data.txid,
      brCode: response.data.pixCopiaECola,
      expiracao: response.data.calendario?.expiracao || expiracao,
      valor: response.data.valor?.original || valor,
      chave: response.data.chave || CHAVE_PIX,
      criadoEm: response.data.criadoEm || new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ ERRO AO CRIAR COBRANÇA ---');
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
 * Consulta o status de uma cobrança Pix no Banco do Brasil.
 * @param {string} txid - Identificador único da transação
 * @returns {Object|null} Dados da cobrança ou null em caso de erro
 */
async function consultPixCharge(txid) {
  try {
    // Validação de segurança
    const { validateTxid } = require('../utils/validation');
    
    if (!validateTxid(txid)) {
      throw new Error('TXID inválido');
    }
    
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Não foi possível obter token de autenticação');
    }

    console.log(`\n🔍 Consultando cobrança com txid: ${txid}`);

    const endpoint = `/pix/v2/cob/${encodeURIComponent(txid)}?gw-dev-app-key=${DEV_APP_KEY}`;

    const response = await axios.get(
      `${API_BASE_URL}${endpoint}`,
      { 
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        } 
      }
    );

    console.log('✅ COBRANÇA CONSULTADA COM SUCESSO!');
    
    return {
      status: response.data.status,
      txid: response.data.txid,
      brCode: response.data.pixCopiaECola,
      valor: response.data.valor?.original,
      chave: response.data.chave,
      criadoEm: response.data.criadoEm,
      atualizadoEm: response.data.revisao || null,
      // Informações de pagamento se existirem
      pagamento: response.data.pix ? {
        endToEndId: response.data.pix[0]?.endToEndId,
        txid: response.data.pix[0]?.txid,
        valor: response.data.pix[0]?.valor,
        horario: response.data.pix[0]?.horario
      } : null
    };

  } catch (error) {
    console.error('❌ ERRO AO CONSULTAR COBRANÇA ---');
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
  getAccessToken,
  createPixCharge,
  consultPixCharge
};

