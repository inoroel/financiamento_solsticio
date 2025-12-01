// Serviço de integração com a rede Stellar (USDC e XLM)
const StellarSdk = require('@stellar/stellar-sdk');
// Na versão 14.x do SDK, Server está em Horizon.Server
const Server = StellarSdk.Horizon.Server;
const { Asset, Keypair, TransactionBuilder, Operation, Networks } = StellarSdk;
const axios = require('axios');
const QRCode = require('qrcode');
require('dotenv').config();

const STELLAR_NETWORK = process.env.STELLAR_NETWORK || 'testnet'; // 'testnet' ou 'public'
const STELLAR_SECRET_KEY = process.env.STELLAR_SECRET_KEY; // Chave secreta da conta que receberá pagamentos
const STELLAR_HORIZON_URL = process.env.STELLAR_HORIZON_URL || (
  STELLAR_NETWORK === 'public'
    ? 'https://horizon.stellar.org'
    : 'https://horizon-testnet.stellar.org'
);

// USDC na Stellar (issuer: Circle)
const USDC_ISSUER = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const USDC_ASSET_CODE = 'USDC';

/**
 * Gera URI Stellar (SEP-7) para pagamento direto na carteira
 * @param {string} destination - Endereço de destino
 * @param {number} amount - Valor do pagamento
 * @param {string} currency - Moeda ('USDC' ou 'XLM')
 * @param {string} memo - Memo da transação
 * @returns {string} URI Stellar no formato SEP-7
 */
function generateStellarURI(destination, amount, currency, memo) {
  const currencyUpper = currency.toUpperCase();
  
  // Constrói o URI baseado na especificação SEP-7
  // IMPORTANTE: Endereços Stellar (começam com G) NÃO devem ser codificados
  // Vamos construir manualmente para garantir compatibilidade com Freighter
  
  // Valida o endereço
  if (!destination || !destination.startsWith('G') || destination.length !== 56) {
    throw new Error('Endereço Stellar inválido');
  }
  
  // Constrói os parâmetros manualmente (sem codificar o endereço)
  const params = [];
  
  // Destination (obrigatório) - NÃO codificar endereços Stellar
  params.push(`destination=${destination}`);
  
  // Amount (obrigatório)
  params.push(`amount=${amount.toString()}`);
  
  // Asset (se não for XLM nativo)
  if (currencyUpper === 'USDC') {
    params.push(`asset_code=${USDC_ASSET_CODE}`);
    params.push(`asset_issuer=${USDC_ISSUER}`);
  }
  
  // Memo (se fornecido)
  // IMPORTANTE: Para memos simples (apenas alfanuméricos), não precisa codificar
  // Apenas codificar se tiver caracteres especiais
  if (memo && memo.trim()) {
    const memoTrimmed = memo.trim();
    // Verificar se o memo tem caracteres que precisam de encoding
    if (/^[a-zA-Z0-9_-]+$/.test(memoTrimmed)) {
      // Memo simples - não precisa codificar (melhor compatibilidade com Freighter)
      params.push(`memo=${memoTrimmed}`);
    } else {
      // Memo com caracteres especiais - codificar
      params.push(`memo=${encodeURIComponent(memoTrimmed)}`);
    }
    // Adicionar memo_type=text para compatibilidade
    params.push(`memo_type=text`);
  }
  
  // Constrói o URI final
  const uri = `web+stellar:pay?${params.join('&')}`;
  
  return uri;
}

/**
 * Gera QR code em base64 para URI Stellar
 * @param {string} stellarURI - URI Stellar (SEP-7)
 * @returns {Promise<string>} QR code em base64 (data URI)
 */
async function generateStellarQRCode(stellarURI) {
  try {
    const qrCodeDataURL = await QRCode.toDataURL(stellarURI, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 500,
      margin: 2
    });
    return qrCodeDataURL;
  } catch (error) {
    console.error('Erro ao gerar QR code:', error);
    return null;
  }
}

/**
 * Obtém o servidor Horizon configurado
 * @returns {Server} Servidor Horizon
 */
function getHorizonServer() {
  return new Server(STELLAR_HORIZON_URL);
}

/**
 * Valida se uma moeda é suportada (USDC ou XLM)
 * @param {string} currency - Código da moeda
 * @returns {boolean} true se suportada
 */
function isSupportedCurrency(currency) {
  const supported = ['USDC', 'XLM'];
  return supported.includes(currency.toUpperCase());
}

/**
 * Cria um endereço de pagamento Stellar para uma cobrança
 * @param {string} txid - Identificador único da transação
 * @param {number} valor - Valor da cobrança
 * @param {string} currency - Moeda ('USDC' ou 'XLM')
 * @param {string} memo - Memo opcional para identificar a transação
 * @returns {Object|null} Dados do pagamento criado ou null em caso de erro
 */
async function createStellarPayment(txid, valor, currency = 'USDC', memo = null) {
  try {
    const { validateValor, validateTxid } = require('../utils/validation');

    // Validações
    if (!validateTxid(txid)) {
      throw new Error('TXID inválido');
    }

    const valorValidado = validateValor(valor, 0.01, 100000);
    if (!valorValidado) {
      throw new Error('Valor inválido');
    }

    const currencyUpper = currency.toUpperCase();
    if (!isSupportedCurrency(currencyUpper)) {
      throw new Error(`Moeda não suportada: ${currency}. Use USDC ou XLM.`);
    }

    if (!STELLAR_SECRET_KEY) {
      throw new Error('STELLAR_SECRET_KEY não configurada');
    }

    // Obtém a chave pública da conta que receberá pagamentos
    const keypair = Keypair.fromSecret(STELLAR_SECRET_KEY);
    const publicKey = keypair.publicKey();

    console.log(`\n📝 Criando pagamento Stellar: ${currencyUpper} ${valorValidado} (txid: ${txid})`);

    // Verifica se a conta existe e está ativa
    const server = getHorizonServer();
    let account;
    try {
      account = await server.loadAccount(publicKey);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        throw new Error('Conta Stellar não encontrada. Crie a conta primeiro com um mínimo de XLM.');
      }
      throw error;
    }

    // Se for USDC, verifica se a conta confia no asset USDC
    if (currencyUpper === 'USDC') {
      const hasUSDC = account.balances.some(
        balance => balance.asset_code === USDC_ASSET_CODE && balance.asset_issuer === USDC_ISSUER
      );
      
      if (!hasUSDC) {
        console.warn('⚠️  Conta não possui trustline para USDC. Adicione trustline antes de receber USDC.');
        // Continua mesmo assim, o pagamento pode criar a trustline automaticamente em alguns casos
      }
    }

    // Gera memo para identificar a transação (máximo 28 caracteres)
    const paymentMemo = memo || txid.slice(-28);

    // Converte valor para a unidade correta
    // XLM: 1 XLM = 10^7 stroops
    // USDC: 1 USDC = 10^7 stroops (mesma precisão)
    const amountInStroops = Math.round(valorValidado * 10000000);

    // Gera URI Stellar (SEP-7) para pagamento direto na carteira
    console.log(`\n🔍 Validando endereço Stellar: ${publicKey}`);
    console.log(`   - Começa com G: ${publicKey.startsWith('G')}`);
    console.log(`   - Tamanho: ${publicKey.length} (esperado: 56)`);
    
    const stellarURI = generateStellarURI(publicKey, valorValidado, currencyUpper, paymentMemo);
    console.log('🔗 URI Stellar gerado:', stellarURI);
    console.log('   - Tamanho do URI:', stellarURI.length);
    
    // Gera também uma versão alternativa sem memo_type (para compatibilidade com Freighter)
    // IMPORTANTE: O memo SEMPRE deve ser incluído para identificar a transação!
    // Apenas removemos o memo_type, mas o memo continua presente
    let stellarURIAlt = null;
    if (paymentMemo) {
      // Constrói manualmente (sem URLSearchParams) para garantir que o endereço não seja codificado
      const paramsAlt = [];
      paramsAlt.push(`destination=${publicKey}`); // NÃO codificar endereço
      paramsAlt.push(`amount=${valorValidado.toString()}`);
      if (currencyUpper === 'USDC') {
        paramsAlt.push(`asset_code=${USDC_ASSET_CODE}`);
        paramsAlt.push(`asset_issuer=${USDC_ISSUER}`);
      }
      // Versão alternativa: memo SEM memo_type (algumas carteiras preferem assim)
      // O MEMO ESTÁ INCLUÍDO - é essencial para identificar a transação!
      const memoTrimmed = paymentMemo.trim();
      // Para memos simples, não codificar (melhor compatibilidade)
      if (/^[a-zA-Z0-9_-]+$/.test(memoTrimmed)) {
        paramsAlt.push(`memo=${memoTrimmed}`);
      } else {
        paramsAlt.push(`memo=${encodeURIComponent(memoTrimmed)}`);
      }
      stellarURIAlt = `web+stellar:pay?${paramsAlt.join('&')}`;
      console.log('🔗 URI Stellar alternativo (memo incluído, sem memo_type):', stellarURIAlt);
      console.log('⚠️  IMPORTANTE: O memo está presente no URI alternativo para identificação da transação');
    }
    
    // Gera QR code para o URI principal
    const qrCodeBase64 = await generateStellarQRCode(stellarURI);
    if (qrCodeBase64) {
      console.log('✅ QR Code gerado com sucesso (tamanho:', qrCodeBase64.length, 'caracteres)');
    } else {
      console.warn('⚠️  QR Code não foi gerado (retornou null)');
    }
    
    // Gera QR code alternativo se disponível
    let qrCodeAltBase64 = null;
    if (stellarURIAlt) {
      qrCodeAltBase64 = await generateStellarQRCode(stellarURIAlt);
    }

    // Retorna dados do pagamento
    // O usuário enviará o pagamento para a conta pública com o memo
    return {
      status: 'AGUARDANDO',
      txid: txid,
      provider_tid: null, // Será preenchido quando o pagamento for confirmado
      provider: 'STELLAR',
      valor: valorValidado,
      currency: currencyUpper,
      recipient_address: publicKey,
      memo: paymentMemo,
      amount_stroops: amountInStroops,
      network: STELLAR_NETWORK,
      horizon_url: STELLAR_HORIZON_URL,
      stellar_uri: stellarURI, // URI Stellar (SEP-7) para pagamento direto
      stellar_uri_alt: stellarURIAlt, // URI alternativo sem memo_type (para Freighter)
      qr_code: qrCodeBase64, // QR code em base64 para escanear
      qr_code_alt: qrCodeAltBase64, // QR code alternativo sem memo_type
      created_at: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ ERRO AO CRIAR PAGAMENTO STELLAR ---');
    console.error('Erro:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

/**
 * Consulta uma transação Stellar por memo ou hash
 * @param {string} identifier - Memo ou hash da transação
 * @returns {Object|null} Dados da transação ou null em caso de erro
 */
async function consultStellarTransaction(identifier) {
  try {
    if (!identifier || typeof identifier !== 'string') {
      throw new Error('Identificador inválido');
    }

    console.log(`\n🔍 Consultando transação Stellar: ${identifier}`);

    const server = getHorizonServer();

    // Tenta buscar por hash primeiro (se for um hash de transação)
    if (identifier.length === 64 && /^[0-9a-f]+$/i.test(identifier)) {
      try {
        const transaction = await server.transactions().transaction(identifier).call();
        return parseTransaction(transaction);
      } catch (error) {
        // Se não encontrou por hash, continua para buscar por memo
        console.log('Transação não encontrada por hash, tentando por memo...');
      }
    }

    // Busca por memo na conta de destino
    if (!STELLAR_SECRET_KEY) {
      throw new Error('STELLAR_SECRET_KEY não configurada');
    }

    const keypair = Keypair.fromSecret(STELLAR_SECRET_KEY);
    const publicKey = keypair.publicKey();

    // Busca transações recebidas com o memo específico
    const payments = await server
      .payments()
      .forAccount(publicKey)
      .limit(100)
      .order('desc')
      .call();

    // Filtra por memo
    for (const payment of payments.records) {
      if (payment.transaction_successful && payment.type === 'payment') {
        const transaction = await server.transactions().transaction(payment.transaction_hash).call();
        
        // Verifica memo
        if (transaction.memo && transaction.memo.toString() === identifier) {
          return parseTransaction(transaction, payment);
        }
      }
    }

    console.log('⚠️  Transação não encontrada');
    return null;

  } catch (error) {
    console.error('❌ ERRO AO CONSULTAR TRANSAÇÃO STELLAR ---');
    console.error('Erro:', error.message);
    return null;
  }
}

/**
 * Parse de uma transação Stellar para formato interno
 * @param {Object} transaction - Transação do Horizon
 * @param {Object} payment - Pagamento do Horizon (opcional)
 * @returns {Object} Dados da transação parseados
 */
function parseTransaction(transaction, payment = null) {
  const memo = transaction.memo ? transaction.memo.toString() : null;
  const hash = transaction.hash;
  
  // Determina moeda e valor
  let currency = 'XLM';
  let valor = 0;

  if (payment) {
    if (payment.asset_type === 'native') {
      currency = 'XLM';
      valor = parseFloat(payment.amount);
    } else if (payment.asset_code === USDC_ASSET_CODE && payment.asset_issuer === USDC_ISSUER) {
      currency = 'USDC';
      valor = parseFloat(payment.amount);
    }
  }

  return {
    status: transaction.successful ? 'CONFIRMADA' : 'FALHADA',
    txid: memo || hash,
    provider_tid: hash,
    provider: 'STELLAR',
    tipo_pagamento: 'CRIPTO',
    currency: currency,
    valor: valor,
    hash: hash,
    memo: memo,
    horario: transaction.created_at,
    ledger: transaction.ledger,
    source_account: transaction.source_account,
    successful: transaction.successful
  };
}

/**
 * Monitora pagamentos recebidos na conta Stellar
 * Usa polling do Horizon para verificar novos pagamentos
 * @param {string} memo - Memo para filtrar (opcional)
 * @param {number} sinceLedger - Ledger desde quando verificar (opcional)
 * @returns {Array} Array de pagamentos encontrados
 */
async function monitorPayments(memo = null, sinceLedger = null) {
  try {
    if (!STELLAR_SECRET_KEY) {
      throw new Error('STELLAR_SECRET_KEY não configurada');
    }

    const keypair = Keypair.fromSecret(STELLAR_SECRET_KEY);
    const publicKey = keypair.publicKey();
    const server = getHorizonServer();

    // Obtém o ledger atual se não foi especificado
    if (!sinceLedger) {
      const ledger = await server.ledgers().order('desc').limit(1).call();
      sinceLedger = ledger.records[0].sequence - 100; // Últimos 100 ledgers
    }

    // Busca pagamentos recebidos
    const payments = await server
      .payments()
      .forAccount(publicKey)
      .cursor(sinceLedger.toString())
      .limit(200)
      .order('asc')
      .call();

    const results = [];

    for (const payment of payments.records) {
      if (payment.type === 'payment' && payment.to === publicKey) {
        // Se foi especificado um memo, filtra por memo
        if (memo) {
          try {
            const transaction = await server.transactions().transaction(payment.transaction_hash).call();
            if (transaction.memo && transaction.memo.toString() !== memo) {
              continue;
            }
          } catch (error) {
            continue;
          }
        }

        // Determina moeda
        let currency = 'XLM';
        if (payment.asset_type !== 'native') {
          if (payment.asset_code === USDC_ASSET_CODE && payment.asset_issuer === USDC_ISSUER) {
            currency = 'USDC';
          } else {
            continue; // Ignora outros assets
          }
        }

        results.push({
          hash: payment.transaction_hash,
          memo: payment.transaction_memo || null,
          currency: currency,
          valor: parseFloat(payment.amount),
          from: payment.from,
          to: payment.to,
          created_at: payment.created_at,
          successful: payment.transaction_successful
        });
      }
    }

    return results;

  } catch (error) {
    console.error('❌ ERRO AO MONITORAR PAGAMENTOS STELLAR ---');
    console.error('Erro:', error.message);
    return [];
  }
}

/**
 * Busca pagamentos recebidos por memo na conta Stellar
 * Usado para verificação manual quando usuário fecha a página antes da confirmação
 * @param {string} memo - Memo da transação (txid)
 * @param {number} limit - Limite de transações para buscar (padrão: 50)
 * @returns {Object|null} Dados do pagamento encontrado ou null
 */
async function findPaymentByMemo(memo, limit = 50) {
  try {
    if (!STELLAR_SECRET_KEY) {
      throw new Error('STELLAR_SECRET_KEY não configurada');
    }

    if (!memo || typeof memo !== 'string') {
      throw new Error('Memo inválido');
    }

    console.log(`\n🔍 Buscando pagamento por memo: ${memo}`);

    const keypair = Keypair.fromSecret(STELLAR_SECRET_KEY);
    const publicKey = keypair.publicKey();
    const server = getHorizonServer();

    // Busca pagamentos recebidos recentemente
    const payments = await server
      .payments()
      .forAccount(publicKey)
      .limit(limit)
      .order('desc')
      .call();

    // Itera pelos pagamentos e verifica o memo
    for (const payment of payments.records) {
      if (payment.type === 'payment' && 
          payment.to === publicKey && 
          payment.transaction_successful) {
        
        try {
          // Busca a transação completa para obter o memo
          const transaction = await server
            .transactions()
            .transaction(payment.transaction_hash)
            .call();
          
          const transactionMemo = transaction.memo ? transaction.memo.toString() : null;
          
          // Verifica se o memo corresponde
          if (transactionMemo === memo) {
            // Determina moeda
            let currency = 'XLM';
            if (payment.asset_type !== 'native') {
              if (payment.asset_code === USDC_ASSET_CODE && payment.asset_issuer === USDC_ISSUER) {
                currency = 'USDC';
              } else {
                continue; // Ignora outros assets
              }
            }

            console.log(`✅ Pagamento encontrado por memo: ${memo}`);

            return {
              hash: payment.transaction_hash,
              memo: transactionMemo,
              currency: currency,
              valor: parseFloat(payment.amount),
              from: payment.from,
              to: payment.to,
              created_at: payment.created_at,
              successful: payment.transaction_successful,
              ledger: transaction.ledger,
              source_account: transaction.source_account
            };
          }
        } catch (error) {
          // Se não conseguir buscar a transação, continua para o próximo
          console.warn(`⚠️  Erro ao buscar transação ${payment.transaction_hash}:`, error.message);
          continue;
        }
      }
    }

    console.log(`⚠️  Nenhum pagamento encontrado para memo: ${memo}`);
    return null;

  } catch (error) {
    console.error('❌ ERRO AO BUSCAR PAGAMENTO POR MEMO ---');
    console.error('Erro:', error.message);
    return null;
  }
}

module.exports = {
  createStellarPayment,
  consultStellarTransaction,
  monitorPayments,
  findPaymentByMemo,
  getHorizonServer,
  isSupportedCurrency
};

