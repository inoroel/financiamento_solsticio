// Serviço de integração com a API PIX v2 do Itaú
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Cache simples para o access token (evita requisições desnecessárias)
let tokenCache = {
  token: null,
  expiresAt: null
};

const CLIENT_ID = process.env.ITAU_CLIENT_ID;
const CLIENT_SECRET = process.env.ITAU_CLIENT_SECRET;
const API_KEY = process.env.ITAU_API_KEY;
const CHAVE_PIX = process.env.ITAU_CHAVE_PIX;
// URL de autenticação: sts.itau.com.br para produção, oauthd.itau para sandbox
const AUTH_URL = process.env.ITAU_AUTH_URL || (process.env.NODE_ENV === 'production' 
  ? 'https://sts.itau.com.br/api/oauth/token' 
  : 'https://oauthd.itau/identity/connect/token');
// URL da API: detecta automaticamente sandbox vs produção
const API_BASE_URL = process.env.ITAU_API_BASE_URL || (process.env.NODE_ENV === 'production'
  ? 'https://secure.api.itau/pix_recebimentos_conciliacoes_v2_ext/v2'
  : 'https://devportal.itau.com.br/sandboxapi/itau-ep9-gtw-pix-recebimentos-conciliacoes-v2-ext/v2');

// Caminhos para certificado mTLS (opcional, necessário apenas em produção)
const CERT_PATH = process.env.ITAU_CERT_PATH; // Caminho para certificado .crt
const KEY_PATH = process.env.ITAU_KEY_PATH;   // Caminho para chave privada .key

/**
 * Gera um Correlation ID único para rastreamento de requisições
 * @returns {string} UUID v4
 */
function generateCorrelationId() {
  return uuidv4();
}

/**
 * Busca um Access Token da API do Itaú (OAuth2 Client Credentials com mTLS opcional).
 * Implementa cache para evitar requisições desnecessárias.
 * 
 * Nota: Em produção, o Itaú exige mTLS (certificado + chave privada).
 * O token expira em 5 minutos (300 segundos) conforme documentação.
 */
async function getAccessToken() {
  // Verifica se o token ainda é válido (com margem de 1 minuto)
  // O token do Itaú expira em 5 minutos (300 segundos)
  if (tokenCache.token && tokenCache.expiresAt && Date.now() < tokenCache.expiresAt - 60000) {
    return tokenCache.token;
  }

  const credentials = `${CLIENT_ID}:${CLIENT_SECRET}`;
  const base64Credentials = Buffer.from(credentials).toString('base64');
  
  // Configuração da requisição
  const requestConfig = {
    headers: {
      'Authorization': `Basic ${base64Credentials}`, 
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  };

  // Adiciona certificado mTLS se configurado (obrigatório em produção)
  if (CERT_PATH && KEY_PATH) {
    const fs = require('fs');
    try {
      requestConfig.httpsAgent = new (require('https').Agent)({
        cert: fs.readFileSync(CERT_PATH),
        key: fs.readFileSync(KEY_PATH)
      });
      console.log('🔐 Usando certificado mTLS para autenticação');
    } catch (error) {
      console.error('❌ Erro ao carregar certificado mTLS:', error.message);
      // Continua sem mTLS (pode funcionar em sandbox)
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️  ATENÇÃO: Certificado mTLS não configurado em produção!');
    console.warn('⚠️  Configure ITAU_CERT_PATH e ITAU_KEY_PATH para autenticação em produção');
  }
  
  try {
    const response = await axios.post(
      AUTH_URL,
      new URLSearchParams({ 
        'grant_type': 'client_credentials'
      }),
      requestConfig
    );
    
    // O token do Itaú expira em 5 minutos (300 segundos)
    const expiresIn = response.data.expires_in || 300;
    tokenCache = {
      token: response.data.access_token,
      expiresAt: Date.now() + (expiresIn * 1000)
    };
    
    console.log(`✅ Token gerado com sucesso para API Itaú (expira em ${expiresIn}s)`);
    return tokenCache.token;
  } catch (error) {
    console.error('❌ ERRO AO OBTER TOKEN ITAÚ ---');
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
 * Cria a cobrança Pix (QR Code) no Itaú.
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
    // Sanitiza e valida caracteres perigosos antes de limitar tamanho
    let mensagemSanitizada = null;
    if (solicitacaoPagador) {
      mensagemSanitizada = sanitizeString(solicitacaoPagador);
      // Remove caracteres de controle e valida formato
      mensagemSanitizada = mensagemSanitizada.replace(/[\x00-\x1F\x7F]/g, '');
      // Limita tamanho após sanitização
      mensagemSanitizada = mensagemSanitizada.slice(0, 140);
    }
    
    // Valida expiração (máximo 24 horas, padrão 86400 se não informado)
    const expiracaoValidada = expiracao ? Math.min(Math.max(parseInt(expiracao) || 86400, 60), 86400) : 86400;
    
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Não foi possível obter token de autenticação');
    }

    if (!API_KEY) {
      throw new Error('ITAU_API_KEY não configurada');
    }

    if (!CHAVE_PIX) {
      throw new Error('ITAU_CHAVE_PIX não configurada');
    }

    console.log(`\n📝 Criando cobrança Itaú com txid: ${txid} e valor: ${valorValidado}`);

    const endpoint = `/cobrancas_imediata_pix`;
    const correlationId = generateCorrelationId();

    // Estrutura mínima obrigatória para o Itaú
    const requestBody = {
      valor: {
        original: valorValidado.toFixed(2)
      },
      chave: CHAVE_PIX
    };

    // Adiciona campos opcionais se fornecidos
    if (txid) {
      requestBody.txid = txid;
    }

    if (expiracaoValidada) {
      requestBody.calendario = {
        expiracao: expiracaoValidada
      };
    }

    if (mensagemSanitizada) {
      requestBody.solicitacaoPagador = mensagemSanitizada;
    }

    const response = await axios.post(
      `${API_BASE_URL}${endpoint}`, 
      requestBody,
      { 
        headers: { 
          'Authorization': `Bearer ${token}`,
          'x-itau-apikey': API_KEY,
          'x-itau-correlationID': correlationId,
          'Content-Type': 'application/json' 
        } 
      }
    );

    console.log('✅ COBRANÇA ITAÚ CRIADA COM SUCESSO!');
    
    // O Itaú retorna o QR Code no campo 'emv' (EMV/BR Code)
    // Também pode retornar 'imagem_base64' para exibição
    // Validação: verifica se a resposta tem estrutura válida
    if (!response.data || !response.data.txid) {
      throw new Error('Resposta inválida da API Itaú: txid não encontrado');
    }
    
    // Fallback robusto para brCode (QR Code)
    const brCode = response.data.emv 
      || response.data.loc?.location 
      || response.data.location 
      || null;
    
    if (!brCode) {
      console.warn('⚠️  QR Code não encontrado na resposta do Itaú');
    }
    
    return {
      status: response.data.status || 'ATIVA',
      txid: response.data.txid,
      brCode: brCode,
      expiracao: response.data.calendario?.expiracao || expiracao,
      valor: parseFloat(response.data.valor?.original) || valor,
      chave: response.data.chave || CHAVE_PIX,
      criadoEm: response.data.calendario?.criacao || new Date().toISOString(),
      idCobranca: response.data.id_cobranca_estatico_pix || null,
      imagemBase64: response.data.imagem_base64 || null,
      location: response.data.location || response.data.loc?.location || null
    };

  } catch (error) {
    console.error('❌ ERRO AO CRIAR COBRANÇA ITAÚ ---');
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
 * Consulta o status de uma cobrança Pix no Itaú.
 * Nota: O Itaú não possui endpoint GET direto. Usamos PATCH com body vazio para consultar.
 * @param {string} txid - Identificador único da transação (ou id_cobranca_estatico_pix)
 * @returns {Object|null} Dados da cobrança ou null em caso de erro
 */
async function consultPixCharge(txid) {
  try {
    // Validação de segurança
    const { validateTxid } = require('../utils/validation');
    
    // O Itaú pode usar txid ou id_cobranca_estatico_pix
    // Aceitamos ambos, mas preferimos txid se válido
    if (!txid || typeof txid !== 'string') {
      throw new Error('TXID ou ID de cobrança inválido');
    }
    
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Não foi possível obter token de autenticação');
    }

    if (!API_KEY) {
      throw new Error('ITAU_API_KEY não configurada');
    }

    console.log(`\n🔍 Consultando cobrança Itaú com identificador: ${txid}`);

    // O Itaú usa GET para consultar cobranças (conforme documentação PIX v2)
    // PATCH é usado apenas para atualizar, não para consultar
    const endpoint = `/cobrancas_imediata_pix/${encodeURIComponent(txid)}`;
    const correlationId = generateCorrelationId();

    const response = await axios.get(
      `${API_BASE_URL}${endpoint}`,
      { 
        headers: { 
          'Authorization': `Bearer ${token}`,
          'x-itau-apikey': API_KEY,
          'x-itau-correlationID': correlationId,
          'Content-Type': 'application/json' 
        } 
      }
    );

    console.log('✅ COBRANÇA ITAÚ CONSULTADA COM SUCESSO!');
    
    return {
      status: response.data.status,
      txid: response.data.txid,
      brCode: response.data.emv || response.data.loc?.location || null,
      valor: response.data.valor ? parseFloat(response.data.valor.original) : null,
      chave: response.data.chave,
      criadoEm: response.data.calendario?.criacao,
      atualizadoEm: response.data.revisao !== undefined ? response.data.revisao : null,
      idCobranca: response.data.id_cobranca_estatico_pix || null,
      imagemBase64: response.data.imagem_base64 || null,
      location: response.data.location || response.data.loc?.location || null,
      // Informações de pagamento se existirem (estrutura pode variar no Itaú)
      pagamento: response.data.pix ? {
        endToEndId: response.data.pix[0]?.endToEndId,
        txid: response.data.pix[0]?.txid,
        valor: response.data.pix[0]?.valor,
        horario: response.data.pix[0]?.horario
      } : null
    };

  } catch (error) {
    console.error('❌ ERRO AO CONSULTAR COBRANÇA ITAÚ ---');
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

