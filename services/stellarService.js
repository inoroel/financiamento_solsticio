// Serviço de integração com a rede Stellar (USDC e XLM)
const StellarSdk = require('@stellar/stellar-sdk');
// Na versão 14.x do SDK, Server está em Horizon.Server
const Server = StellarSdk.Horizon.Server;
const { Asset, Keypair, TransactionBuilder, Operation, Networks } = StellarSdk;
const axios = require('axios');
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

