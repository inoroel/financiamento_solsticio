// Serviço de integração com a API e-Rede
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Credenciais OAuth 2.0 da e-Rede
// PV = clientId (obtido no portal e-Rede)
// TOKEN = clientSecret (Chave de Integração, obtida no portal e-Rede)
// O access_token é obtido dinamicamente via OAuth 2.0 a cada 24 minutos
const PV = process.env.REDE_PV; // clientId
const TOKEN = process.env.REDE_TOKEN; // clientSecret (Chave de Integração)
const ENVIRONMENT = process.env.REDE_ENVIRONMENT || 'sandbox';

// URLs da API e-Rede
const API_BASE_URL = process.env.REDE_API_BASE_URL || (
  ENVIRONMENT === 'production'
    ? 'https://api.userede.com.br/erede'
    : 'https://sandbox-erede.useredecloud.com.br'
);

// URLs para OAuth 2.0 (obter access_token)
const OAUTH_TOKEN_URL = process.env.REDE_OAUTH_TOKEN_URL || (
  ENVIRONMENT === 'production'
    ? 'https://api.userede.com.br/redelabs/oauth2/token'
    : 'https://rl7-sandbox-api.useredecloud.com.br/oauth2/token'
);

// Cache do access_token (válido por 24 minutos, renovamos aos 20 minutos)
let accessTokenCache = {
  token: null,
  expiresAt: null
};

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
 * Obtém access_token via OAuth 2.0 (conforme nova documentação e-Rede)
 * O token é válido por 24 minutos e é cacheado para evitar requisições desnecessárias
 * @returns {Promise<string>} Access token
 */
async function getAccessToken() {
  // Verifica se temos um token válido no cache
  if (accessTokenCache.token && accessTokenCache.expiresAt && Date.now() < accessTokenCache.expiresAt) {
    console.log('🔐 Usando access_token do cache');
    return accessTokenCache.token;
  }

  if (!PV || !TOKEN) {
    throw new Error('REDE_PV (clientId) e REDE_TOKEN (clientSecret) devem estar configurados');
  }

  console.log('🔐 Obtendo novo access_token via OAuth 2.0...');
  
  try {
    // Conforme documentação OAuth 2.0:
    // - clientId = PV (Ponto de Venda)
    // - clientSecret = TOKEN (Chave de Integração)
    // - Usamos Basic Auth apenas para obter o access_token
    // - O access_token obtido é usado nas requisições da API (Bearer token)
    const authHeader = `Basic ${Buffer.from(`${PV}:${TOKEN}`).toString('base64')}`;
    
    const response = await axios.post(
      OAUTH_TOKEN_URL,
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000 // 10 segundos para obter token
      }
    );

    if (!response.data || !response.data.access_token) {
      throw new Error('Resposta OAuth inválida: access_token não encontrado');
    }

    const accessToken = response.data.access_token;
    const expiresIn = response.data.expires_in || 1440; // 24 minutos padrão (em segundos)
    
    // Cache o token, renovando 4 minutos antes de expirar (aos 20 minutos)
    const expiresAt = Date.now() + (expiresIn - 240) * 1000; // -240 segundos = 4 minutos antes
    
    accessTokenCache = {
      token: accessToken,
      expiresAt: expiresAt
    };

    console.log(`✅ Access_token obtido com sucesso (válido por ${expiresIn} segundos)`);
    return accessToken;

  } catch (error) {
    console.error('❌ Erro ao obter access_token via OAuth 2.0:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
    throw new Error(`Falha ao obter access_token: ${error.message}`);
  }
}

/**
 * Cria headers de autenticação para a API e-Rede
 * SEMPRE usa OAuth 2.0 (Bearer token) - Basic Auth não é mais aceito em produção
 * 
 * IMPORTANTE: 
 * - REDE_PV = clientId (obtido no portal e-Rede)
 * - REDE_TOKEN = clientSecret (Chave de Integração, obtida no portal e-Rede)
 * - access_token = obtido dinamicamente via OAuth 2.0 a cada 24 minutos
 * 
 * @returns {Promise<Object>} Headers de autenticação
 */
async function getAuthHeaders() {
  if (!PV || !TOKEN) {
    throw new Error('REDE_PV (clientId) e REDE_TOKEN (clientSecret) devem estar configurados');
  }

  // Log de diagnóstico (sem expor credenciais completas)
  console.log(`🔐 Usando ambiente: ${ENVIRONMENT}`);
  console.log(`🔐 API Base URL: ${API_BASE_URL}`);
  console.log(`🔐 PV (clientId) configurado: ${PV ? 'Sim (primeiros 4 chars: ' + PV.substring(0, 4) + '...)' : 'Não'}`);
  console.log(`🔐 TOKEN (clientSecret) configurado: ${TOKEN ? 'Sim (primeiros 4 chars: ' + TOKEN.substring(0, 4) + '...)' : 'Não'}`);

  // SEMPRE usa OAuth 2.0 - Basic Auth não é mais aceito em produção
  // O access_token é obtido dinamicamente via getAccessToken()
  const accessToken = await getAccessToken();
  const authHeader = `Bearer ${accessToken}`;
  
  console.log('🔐 Usando autenticação OAuth 2.0 (Bearer token)');

  return {
    'Authorization': authHeader,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
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

    const authHeaders = await getAuthHeaders();
    const response = await axios.post(
      TOKENIZATION_API_URL,
      requestBody,
      {
        headers: {
          ...authHeaders,
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
 * 
 * NOTA IMPORTANTE: A chave PIX não precisa ser enviada na requisição.
 * A e-Rede usa automaticamente a chave PIX cadastrada no portal (userede.com.br)
 * associada às credenciais REDE_PV e REDE_TOKEN.
 * 
 * Para cadastrar a chave PIX:
 * 1. Acesse userede.com.br
 * 2. Login na sua conta
 * 3. Vá em "Para vender" > PIX > "Quero utilizar Pix"
 * 4. Aceite os termos e selecione sua agência e conta corrente
 * 
 * @param {string} txid - Identificador único da transação (26-35 caracteres)
 * @param {number} valor - Valor da cobrança
 * @param {string} solicitacaoPagador - Mensagem para o pagador (opcional)
 * @param {number} expiracao - Tempo de expiração em segundos (padrão: 3600)
 * @returns {Object|null} Dados da cobrança criada ou null em caso de erro
 */
async function createPixCharge(txid, valor, solicitacaoPagador = "Doação para o Festival Solsticio", expiracao = 3600) {
  try {
    // Valida credenciais antes de prosseguir
    if (!PV || !TOKEN) {
      throw new Error('Credenciais e-Rede não configuradas. Configure REDE_PV e REDE_TOKEN nas variáveis de ambiente.');
    }

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

    // Valida expiração (máximo 15 dias, padrão 1 hora se não informado)
    const expiracaoSegundos = expiracao ? Math.min(Math.max(parseInt(expiracao) || 3600, 60), 1296000) : 3600; // Máximo 15 dias (1296000 segundos)
    
    // Calcula data/hora de expiração no formato YYYY-MM-DDThh:mm:ss
    const dataExpiracao = new Date(Date.now() + expiracaoSegundos * 1000);
    const dataExpiracaoFormatada = dataExpiracao.toISOString().slice(0, 19); // Remove milissegundos e timezone

    console.log(`\n📝 Criando cobrança PIX e-Rede com txid: ${txid} e valor: ${valorValidado}`);
    console.log(`📅 Expiração: ${dataExpiracaoFormatada} (${expiracaoSegundos} segundos)`);

    const endpoint = '/v2/transactions';
    const correlationId = generateCorrelationId();

    // Valida que o reference está dentro do limite (até 50 caracteres conforme documentação e-Rede)
    // Documentação: reference - Até 50, Alfanumérico, Sim, Código da transação gerado pelo estabelecimento
    if (txid.length > 50) {
      throw new Error(`Reference para PIX deve ter no máximo 50 caracteres. TXID: ${txid} (${txid.length} chars)`);
    }

    // Estrutura da requisição para PIX conforme documentação e-Rede
    // Documentação: Manual p.6437-6451
    // IMPORTANTE: reference deve ter até 50 caracteres alfanuméricos
    const requestBody = {
      kind: 'pix',
      reference: txid, // ✅ Até 50 caracteres conforme documentação oficial
      amount: String(Math.round(valorValidado * 100)), // Valor em centavos (string conforme documentação)
      qrCode: {
        'dateTimeExpiration': dataExpiracaoFormatada // Formato: YYYY-MM-DDThh:mm:ss
      }
    };
    
    console.log(`📋 Reference usado na requisição: ${txid} (${txid.length} caracteres, max: 50)`);

    // Adiciona mensagem se fornecida
    if (mensagemSanitizada) {
      requestBody.description = mensagemSanitizada;
    }

    // Log detalhado do body antes de enviar (para diagnóstico)
    console.log(`\n📋 Body da requisição PIX:`);
    console.log(`   - kind: ${requestBody.kind}`);
    console.log(`   - reference: ${requestBody.reference} (${requestBody.reference.length} chars, max: 50)`);
    console.log(`   - amount: ${requestBody.amount} (centavos, tipo: ${typeof requestBody.amount})`);
    console.log(`   - qrCode.dateTimeExpiration: ${requestBody.qrCode['dateTimeExpiration']}`);
    if (requestBody.description) {
      console.log(`   - description: ${requestBody.description.substring(0, 50)}...`);
    }

    // Obtém headers de autenticação (OAuth 2.0 com fallback para Basic Auth)
    const authHeaders = await getAuthHeaders(); // true = tenta OAuth primeiro
    const headers = {
      ...authHeaders,
      'X-Request-Id': correlationId
    };

    console.log(`\n📤 Enviando requisição PIX para: ${API_BASE_URL}${endpoint}`);
    console.log(`📤 Correlation ID: ${correlationId}`);
    console.log(`📤 Headers: Authorization=${authHeaders.Authorization.substring(0, 20)}..., Content-Type=${authHeaders['Content-Type']}, X-Request-Id=${correlationId}`);
    
    // Log adicional para diagnóstico de IP (se disponível)
    // Nota: Na Vercel, o IP de origem pode variar, mas isso ajuda no diagnóstico
    if (process.env.VERCEL) {
      console.log(`🌐 Ambiente Vercel detectado - IPs são dinâmicos`);
    }

    const response = await axios.post(
      `${API_BASE_URL}${endpoint}`,
      requestBody,
      {
        headers,
        timeout: 30000 // 30 segundos de timeout
        // NOTA: Não usamos validateStatus aqui porque queremos que 4xx (403, 401, etc) 
        // sejam tratados como erros e lancem exceção para entrar no catch
      }
    );

    console.log('✅ COBRANÇA PIX e-Rede CRIADA COM SUCESSO!');
    console.log('📦 Resposta completa da e-Rede:', JSON.stringify(response.data, null, 2));

    // A e-Rede retorna o QR Code e Transaction ID (tid)
    // Documentação: Manual p.6500-6504
    // A resposta pode vir em diferentes formatos:
    // - response.data.qrCodeResponse.qrCodeData (formato padrão)
    // - response.data.qrCode (formato alternativo)
    // - response.data.qrcode (formato alternativo)
    const qrCodeData = response.data.qrCodeResponse?.qrCodeData 
      || response.data.qrCode 
      || response.data.qrcode 
      || null;
    
    console.log('🔍 QR Code extraído:', qrCodeData ? `${qrCodeData.substring(0, 50)}...` : 'null');
    
    if (!qrCodeData) {
      console.warn('⚠️  ATENÇÃO: QR Code não encontrado na resposta da e-Rede!');
      console.warn('📋 Estrutura da resposta:', Object.keys(response.data));
      if (response.data.qrCodeResponse) {
        console.warn('📋 qrCodeResponse keys:', Object.keys(response.data.qrCodeResponse));
      }
    }
    
    return {
      status: response.data.qrCodeResponse?.status === 'Pending' || response.data.returnCode === '00' ? 'ATIVA' : 'ERRO',
      txid: txid,
      rede_tid: response.data.tid || response.data.reference,
      brCode: qrCodeData,
      expiracao: expiracaoSegundos,
      valor: valorValidado,
      criadoEm: response.data.qrCodeResponse?.['Date time'] || response.data.qrCodeResponse?.['dateTime'] || response.data.dateTime || new Date().toISOString(),
      returnCode: response.data.qrCodeResponse?.returnCode || response.data.returnCode,
      returnMessage: response.data.qrCodeResponse?.returnMessage || response.data.returnMessage
    };
  } catch (error) {
    console.error('❌ ERRO AO CRIAR COBRANÇA PIX e-Rede ---');
    let errorDetails = {
      message: error.message || 'Erro desconhecido',
      status: null,
      data: null
    };
    
    if (error.response) {
      errorDetails.status = error.response.status;
      errorDetails.data = error.response.data;
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
      
      // Mensagens específicas para erros comuns
      if (error.response.status === 401) {
        if (error.response.data?.returnMessage?.includes('Affiliation')) {
          errorDetails.message = 'Credenciais e-Rede inválidas ou não configuradas. Verifique REDE_PV e REDE_TOKEN nas variáveis de ambiente da Vercel.';
        } else {
          errorDetails.message = 'Não autorizado. Verifique se REDE_PV e REDE_TOKEN estão corretos.';
        }
      } else if (error.response.status === 403) {
        // CloudFront bloqueando a requisição
        const isCloudFrontError = typeof error.response.data === 'string' && 
          (error.response.data.includes('CloudFront') || 
           error.response.data.includes('ERROR: The request could not be satisfied') ||
           error.response.data.includes('Request blocked'));
        
        if (isCloudFrontError) {
          const ambienteInfo = ENVIRONMENT === 'production' 
            ? 'PRODUÇÃO' 
            : 'SANDBOX';
          
          errorDetails.message = `A requisição foi bloqueada pelo CloudFront da e-Rede (ambiente: ${ambienteInfo}). ` +
            `Isso geralmente acontece quando: (1) O IP do servidor (Vercel) não está na whitelist da e-Rede, ` +
            `(2) A API ainda não foi ativada para ${ambienteInfo} (pode levar 24-48h após solicitação), ` +
            `(3) A API está em manutenção, ou (4) Há um problema de configuração na conta e-Rede. ` +
            `SOLUÇÃO: Entre em contato com o suporte da e-Rede informando: ` +
            `"Recebo erro 403 do CloudFront ao tentar criar cobrança PIX via API. ` +
            `Ambiente: ${ambienteInfo}. PV: ${PV ? PV.substring(0, 4) + '...' : 'N/A'}. ` +
            `Preciso que os IPs da Vercel sejam adicionados à whitelist ou que a whitelist seja desabilitada."`;
          
          // Log adicional para diagnóstico
          console.error(`\n🔍 DIAGNÓSTICO ERRO 403 CLOUDFRONT:`);
          console.error(`   - Ambiente: ${ambienteInfo}`);
          console.error(`   - API Base URL: ${API_BASE_URL}`);
          console.error(`   - PV configurado: ${PV ? 'Sim' : 'Não'}`);
          console.error(`   - TOKEN configurado: ${TOKEN ? 'Sim' : 'Não'}`);
          console.error(`   - Plataforma: Vercel (IPs dinâmicos)`);
          console.error(`   - Ação necessária: Contatar suporte e-Rede para whitelist de IPs`);
        } else {
          errorDetails.message = 'Acesso negado pela API e-Rede. Verifique as permissões da sua conta.';
        }
      } else if (error.response.status === 400) {
        errorDetails.message = error.response.data?.returnMessage || 'Dados inválidos na requisição.';
      }
    } else if (error.request) {
      errorDetails.message = 'Erro de conexão com a API e-Rede. Verifique sua conexão com a internet.';
      console.error('Erro de requisição:', error.request);
    } else {
      // Erro de validação ou configuração
      console.error('Erro:', error.message);
      if (error.message.includes('Credenciais')) {
        errorDetails.message = error.message;
      }
    }
    
    // Retorna objeto com erro ao invés de null para melhor diagnóstico
    return {
      error: true,
      errorDetails: errorDetails,
      message: errorDetails.message
    };
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
      card: {}
    };

    // Prioriza networkToken (tokenização de bandeira) se disponível
    // Se não tiver, usa token padrão da e-Rede
    // Se não tiver nenhum, usa cardNumber diretamente (não recomendado, mas permitido)
    if (cartaoData.networkToken) {
      requestBody.card.token = cartaoData.networkToken;
      if (cartaoData.cryptogram) {
        requestBody.tokenCryptogram = cartaoData.cryptogram;
      }
      console.log('🔐 Usando network token (tokenização de bandeira)');
    } else if (cartaoData.token) {
      requestBody.card.token = cartaoData.token;
      console.log('🔐 Usando token padrão e-Rede');
    } else if (cartaoData.cardNumber) {
      // Fallback: usar cardNumber diretamente (não recomendado, mas permitido pela API)
      requestBody.cardNumber = cartaoData.cardNumber;
      requestBody.expirationMonth = cartaoData.expirationMonth;
      requestBody.expirationYear = cartaoData.expirationYear;
      requestBody.securityCode = cartaoData.securityCode;
      requestBody.cardholderName = cartaoData.cardholderName;
      console.warn('⚠️  Usando cardNumber diretamente (não recomendado - tokenize o cartão antes)');
    } else {
      throw new Error('Token do cartão ou dados do cartão são obrigatórios');
    }

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

    const authHeaders = await getAuthHeaders();
    const response = await axios.post(
      `${API_BASE_URL}${endpoint}`,
      requestBody,
      {
        headers: {
          ...authHeaders,
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
      card: {}
    };

    // Prioriza networkToken (tokenização de bandeira) se disponível
    // Se não tiver, usa token padrão da e-Rede
    // Se não tiver nenhum, usa cardNumber diretamente (não recomendado, mas permitido)
    if (cartaoData.networkToken) {
      requestBody.card.token = cartaoData.networkToken;
      if (cartaoData.cryptogram) {
        requestBody.tokenCryptogram = cartaoData.cryptogram;
      }
      console.log('🔐 Usando network token (tokenização de bandeira)');
    } else if (cartaoData.token) {
      requestBody.card.token = cartaoData.token;
      console.log('🔐 Usando token padrão e-Rede');
    } else if (cartaoData.cardNumber) {
      // Fallback: usar cardNumber diretamente (não recomendado, mas permitido pela API)
      requestBody.cardNumber = cartaoData.cardNumber;
      requestBody.expirationMonth = cartaoData.expirationMonth;
      requestBody.expirationYear = cartaoData.expirationYear;
      requestBody.securityCode = cartaoData.securityCode;
      requestBody.cardholderName = cartaoData.cardholderName;
      console.warn('⚠️  Usando cardNumber diretamente (não recomendado - tokenize o cartão antes)');
    } else {
      throw new Error('Token do cartão ou dados do cartão são obrigatórios');
    }

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

    const authHeaders = await getAuthHeaders();
    const response = await axios.post(
      `${API_BASE_URL}${endpoint}`,
      requestBody,
      {
        headers: {
          ...authHeaders,
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

    const authHeaders = await getAuthHeaders();
    const response = await axios.get(
      `${API_BASE_URL}${endpoint}`,
      {
        headers: {
          ...authHeaders,
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

    const authHeaders = await getAuthHeaders();
    const response = await axios.post(
      `${API_BASE_URL}${endpoint}`,
      requestBody,
      {
        headers: {
          ...authHeaders,
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

    const authHeaders = await getAuthHeaders();
    const response = await axios.post(
      `${API_BASE_URL}${endpoint}`,
      requestBody,
      {
        headers: {
          ...authHeaders,
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

