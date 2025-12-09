// Rotas da API de Pagamentos (PIX, Crédito, Débito, Cripto) - e-Rede e Stellar
const express = require('express');
const router = express.Router();
const {
  createPixCharge,
  createCreditCardTransaction,
  createDebitCardTransaction,
  consultTransaction,
  cancelTransaction,
  tokenizeCard,
  authorizeZeroDollar,
  queryTransactionByReference,
  captureTransaction
} = require('../services/redeService');
const {
  createStellarPayment,
  consultStellarTransaction,
  findPaymentByMemo,
  isSupportedCurrency
} = require('../services/stellarService');
const { saveCobranca, getCobranca, processConfirmedTransaction, getDoadoresIdentificados } = require('../services/dbService');
const { processWebhook } = require('../services/redeWebhookService');
const { processWebhook: processStellarWebhook } = require('../services/stellarWebhookService');
const { createChargeLimiter, consultChargeLimiter, webhookLimiter } = require('../middleware/security');
const {
  validateValor,
  validateTxid,
  validateNome,
  validateWhatsapp,
  validateCampanhaId,
  sanitizeString
} = require('../utils/validation');

// NOTA: O handler OPTIONS para preflight CORS está no server.js
// O handler global já cuida de todas as requisições OPTIONS antes de chegar nas rotas
// Não precisamos de um handler específico aqui, pois o Express Router não suporta router.options('*', ...)

/**
 * Detecta bandeira do cartão pelo número
 * @param {string} cardNumber - Número do cartão (sem espaços)
 * @returns {string|null} Bandeira detectada ou null
 */
function detectarBandeira(cardNumber) {
  const num = cardNumber.replace(/\s/g, '');
  
  // Visa: 13-19 dígitos, começa com 4
  if (/^4\d{12,18}$/.test(num)) {
    return 'visa';
  }
  
  // Mastercard: 16 dígitos, começa com 5 (51-55) ou 2 (2221-2720)
  if (/^(5[1-5]\d{14}|2[2-7]\d{14})$/.test(num)) {
    return 'mastercard';
  }
  
  // Elo: 16 dígitos, vários prefixos
  if (/^(4011|4312|4389|4514|4573|4576|5041|5066|5067|5090|6277|6362|6363|6504|6505|6507|6509|6516|6550)\d{12}$/.test(num)) {
    return 'elo';
  }
  
    return null;
  }

/**
 * Valida e processa dados do cartão
 * Aceita tanto token quanto dados do cartão (para tokenização automática)
 * @param {Object} cartaoData - Dados do cartão (token OU dados completos)
 * @returns {Promise<Object|null>} Dados validados com token ou null
 */
async function processarDadosCartao(cartaoData) {
  if (!cartaoData || typeof cartaoData !== 'object') {
    return null;
  }

  // Se já tem token, retorna direto (mas preserva cardNumber se disponível para Zero Dollar)
  if (cartaoData.token && typeof cartaoData.token === 'string') {
    return {
      token: cartaoData.token,
      bandeira: cartaoData.bandeira || null,
      jaTokenizado: true,
      // Preserva dados do cartão se disponíveis (para Zero Dollar quando necessário)
      cardNumber: cartaoData.cardNumber || null,
      expirationMonth: cartaoData.expirationMonth || null,
      expirationYear: cartaoData.expirationYear || null,
      securityCode: cartaoData.securityCode || null,
      cardholderName: cartaoData.cardholderName || null,
      email: cartaoData.email || null
    };
  }

  // Se não tem token, precisa ter dados do cartão para tokenizar
  if (!cartaoData.cardNumber || !cartaoData.cardholderName || 
      !cartaoData.expirationMonth || !cartaoData.expirationYear || 
      !cartaoData.securityCode || !cartaoData.email) {
    return null;
  }

  // Detecta bandeira automaticamente se não fornecida ou valida se fornecida
  let bandeira = cartaoData.bandeira;
  const bandeiraDetectada = detectarBandeira(cartaoData.cardNumber);
  
  if (!bandeira) {
    // Se não forneceu, usa a detectada
    bandeira = bandeiraDetectada;
    if (!bandeira) {
      throw new Error('Não foi possível detectar a bandeira do cartão. Informe a bandeira manualmente.');
    }
  } else {
    // Se forneceu, valida se corresponde ao número
    if (bandeiraDetectada && bandeiraDetectada !== bandeira.toLowerCase()) {
      console.warn(`⚠️  Bandeira fornecida (${bandeira}) não corresponde à detectada (${bandeiraDetectada}). Usando a detectada.`);
      bandeira = bandeiraDetectada;
    }
  }

  // NOTA: Tokenização de bandeira será feita depois, se necessário (Visa/Elo)
  // Por enquanto, apenas retorna os dados do cartão para processamento posterior
  return {
    cardNumber: cartaoData.cardNumber.replace(/\s/g, ''),
    cardholderName: cartaoData.cardholderName.trim(),
    expirationMonth: parseInt(cartaoData.expirationMonth),
    expirationYear: parseInt(cartaoData.expirationYear),
    securityCode: cartaoData.securityCode,
    email: cartaoData.email.trim(),
    bandeira: bandeira.toLowerCase(),
    jaTokenizado: false,
    tokenizadoAgora: false
    // Tokenização de bandeira será feita depois, se necessário
  };
}

/**
 * Valida número de parcelas
 * @param {number} parcelas - Número de parcelas
 * @returns {number|null} Parcelas validadas ou null
 */
function validateParcelas(parcelas) {
  const numParcelas = parseInt(parcelas);
  if (isNaN(numParcelas) || numParcelas < 1 || numParcelas > 12) {
    return null;
  }
  return numParcelas;
}

/**
 * POST /api/gerar-pagamento
 * Cria uma nova cobrança (PIX, Crédito, Débito ou Cripto)
 * Body: { 
 *   tipo_pagamento: 'PIX' | 'CREDITO' | 'DEBITO' | 'CRIPTO',
 *   valor: number, 
 *   cid: string, 
 *   doador?: { nome?, whatsapp?, anonimo: boolean },
 *   cartao?: { 
 *     // Opção 1: Token já gerado
 *     token: string, 
 *     bandeira?: string 
 *   } | {
 *     // Opção 2: Dados do cartão (tokenização automática)
 *     cardNumber: string,
 *     cardholderName: string,
 *     expirationMonth: number,
 *     expirationYear: number,
 *     securityCode: string,
 *     email: string,
 *     bandeira?: string, // Opcional, detecta automaticamente
 *     kind?: 'credit' | 'debit'
 *   },
 *   parcelas?: number, // Apenas para crédito (1-12)
 *   currency?: 'USDC' | 'XLM' // Apenas para CRIPTO
 * }
 * 
 * NOTA: Para Visa e Mastercard, a tokenização e 3DS são aplicados automaticamente pelo backend.
 * 
 * AUTENTICAÇÃO 3DS (Pop-up):
 * Quando a resposta contém requires3DS: true e threeDSecureUrl, o frontend deve:
 * 1. Abrir pop-up: const popup = window.open(threeDSecureUrl, '3DS Authentication', 'width=500,height=600,scrollbars=yes,resizable=yes')
 * 2. Monitorar fechamento: setInterval(() => { if (popup.closed) { checkTransactionStatus(txid) } }, 1000)
 * 3. O callback 3DS será processado automaticamente pelo backend
 * 
 * IMPORTANTE: Usamos pop-up unificado (sandbox + produção) porque iframe não funciona em sandbox.
 */
router.post('/gerar-pagamento', createChargeLimiter, async (req, res) => {
  try {
    const { tipo_pagamento, valor, cid, doador, cartao, parcelas, currency } = req.body;

    // Validação do tipo de pagamento
    const tiposValidos = ['PIX', 'CREDITO', 'DEBITO', 'CRIPTO'];
    if (!tipo_pagamento || !tiposValidos.includes(tipo_pagamento.toUpperCase())) {
      return res.status(400).json({
        error: 'Tipo de pagamento inválido. Deve ser: PIX, CREDITO, DEBITO ou CRIPTO.'
      });
    }

    const tipoPagamento = tipo_pagamento.toUpperCase();

    // Validação do valor monetário
    // Para CRIPTO: valor é opcional (será obtido da blockchain quando confirmado)
    // Para outros tipos: valor é obrigatório
    let valorValidado = null;
    if (tipoPagamento === 'CRIPTO') {
      // Para CRIPTO, o valor é opcional - será obtido da blockchain quando o pagamento for confirmado
      // Se fornecido, apenas valida o formato (mas não é obrigatório)
      if (valor !== undefined && valor !== null) {
        valorValidado = validateValor(valor, 0.01, 100000);
    if (!valorValidado) {
      return res.status(400).json({
        error: 'Valor inválido. Deve ser um número entre R$ 0,01 e R$ 100.000,00.'
      });
        }
      }
      // Se não fornecido, valorValidado permanece null - será obtido da blockchain depois
    } else {
      // Para PIX, CREDITO, DEBITO: valor é obrigatório
      valorValidado = validateValor(valor, 0.01, 100000);
      if (!valorValidado) {
        return res.status(400).json({
          error: 'Valor inválido. Deve ser um número entre R$ 0,01 e R$ 100.000,00.'
        });
      }
    }

    // Validação do ID de campanha
    const cidValidado = validateCampanhaId(cid);
    if (!cidValidado) {
      return res.status(400).json({
        error: 'ID de Campanha (cid) inválido. Deve conter apenas letras, números, hífens e underscores (máx. 50 caracteres).'
      });
    }

    // Validação: Se o doador optou por se identificar (anonimo=false), deve informar nome E whatsapp
    if (doador && doador.anonimo === false) {
      const nomeValidado = validateNome(doador.nome);
      if (!nomeValidado) {
        return res.status(400).json({
          error: 'Para doações identificadas, o nome é obrigatório e deve conter apenas letras, números e espaços.'
        });
      }

      const whatsappValidado = validateWhatsapp(doador.whatsapp);
      if (!whatsappValidado) {
        return res.status(400).json({
          error: 'Para doações identificadas, o WhatsApp é obrigatório e deve ser um número válido (10-15 dígitos).'
        });
      }

      doador.nome = nomeValidado;
      doador.whatsapp = whatsappValidado;
    }

    // Validações específicas para cartões
    let cartaoProcessado = null;
    if (tipoPagamento === 'CREDITO' || tipoPagamento === 'DEBITO') {
      try {
        cartaoProcessado = await processarDadosCartao(cartao);
        if (!cartaoProcessado) {
        return res.status(400).json({
            error: 'Dados do cartão inválidos. Forneça um token ou dados completos do cartão (número, nome, validade, CVV, email).'
          });
        }
      } catch (error) {
        return res.status(400).json({
          error: error.message || 'Erro ao processar dados do cartão.'
        });
      }

      // Valida parcelas para crédito
      if (tipoPagamento === 'CREDITO') {
        const parcelasValidadas = validateParcelas(parcelas || 1);
        if (!parcelasValidadas) {
          return res.status(400).json({
            error: 'Número de parcelas inválido. Deve ser entre 1 e 12.'
          });
        }
      }
    }

    // Gera o TXID único e rastreável
    const prefixo = 'solsticiocampanha';
    const campaignId = cidValidado.slice(0, 2).padStart(2, '0');
    const timestamp = Date.now().toString().slice(-7);
    const txid = `${prefixo}${campaignId}${timestamp}`;

    if (!validateTxid(txid)) {
      return res.status(500).json({
        error: 'Erro ao gerar identificador da transação.'
      });
    }

    // Verifica se já existe uma cobrança com esse txid
    const existingCobranca = await getCobranca(txid);
    if (existingCobranca) {
      return res.status(409).json({
        error: 'TXID já existe. Tente novamente.'
      });
    }

    // Cria a cobrança na e-Rede conforme o tipo de pagamento
    let cobranca = null;
    let dadosPagamento = null;

    if (tipoPagamento === 'PIX') {
      const nomeSanitizado = doador?.anonimo === false && doador?.nome
        ? sanitizeString(doador.nome)
        : null;

      const solicitacaoPagador = nomeSanitizado
        ? `Doação de ${nomeSanitizado} para o Festival Solsticio`
        : "Doação para o Festival Solsticio";

      cobranca = await createPixCharge(txid, valorValidado, solicitacaoPagador);
      
      // Prepara dados_pagamento incluindo a imagem base64 do QR Code
      if (cobranca && !cobranca.error && cobranca.qrCodeImage) {
        dadosPagamento = {
          brCode: cobranca.brCode,
          qrCodeImage: cobranca.qrCodeImage, // Imagem base64 do QR Code (evita problemas com CSP)
          rede_tid: cobranca.rede_tid,
          expiracao: cobranca.expiracao
        };
      }

      if (!cobranca || cobranca.error) {
        // Se retornou erro, inclui detalhes para diagnóstico
        // Prioriza mensagem customizada do serviço, depois mensagem da API, depois genérica
        const errorMessage = cobranca?.errorDetails?.message 
          || cobranca?.errorDetails?.data?.returnMessage 
          || cobranca?.message 
          || 'Não foi possível gerar a cobrança PIX na e-Rede.';
        
        // Preserva o status code original (403 para CloudFront, 401 para credenciais, etc)
        const statusCode = cobranca?.errorDetails?.status || 500;
        
        return res.status(statusCode).json({
          error: errorMessage,
          details: process.env.NODE_ENV === 'development' ? cobranca?.errorDetails : undefined
        });
      }
    } else if (tipoPagamento === 'CREDITO') {
      const parcelasValidadas = validateParcelas(parcelas || 1);

      // Zero Dollar: OBRIGATÓRIO apenas quando vamos armazenar cartão (storageCard: 1 ou 2)
      // Para transações normais, é apenas recomendado (não obrigatório)
      const vaiArmazenarCartao = req.body.recurrenceData?.storageCard === '1' || 
                                  req.body.recurrenceData?.storageCard === '2' ||
                                  req.body.storageCard === '1' || 
                                  req.body.storageCard === '2';
      
      if (vaiArmazenarCartao) {
        console.log('🔒 Executando Zero Dollar Authorization (obrigatório para armazenar cartão)...');
        const zeroDollarTxid = `zerodollar${txid.slice(-15)}`;
        
        // Zero Dollar precisa do cardNumber original, não do token
        if (!cartaoProcessado.cardNumber || !cartaoProcessado.securityCode) {
          return res.status(400).json({
            error: 'Para armazenar cartão, é necessário fornecer número do cartão e CVV para validação Zero Dollar.'
          });
        }
        
        const zeroDollarAuth = await authorizeZeroDollar(
          {
            cardNumber: cartaoProcessado.cardNumber,
            expirationMonth: cartaoProcessado.expirationMonth,
            expirationYear: cartaoProcessado.expirationYear,
            securityCode: cartaoProcessado.securityCode,
            cardholderName: cartaoProcessado.cardholderName
          },
          zeroDollarTxid,
          'credit'
        );

        if (!zeroDollarAuth || zeroDollarAuth.aprovado !== true) {
          return res.status(400).json({
            error: 'Cartão não passou na validação Zero Dollar.',
            details: zeroDollarAuth?.returnMessage || 'Cartão inválido ou bloqueado'
          });
        }

        console.log('✅ Zero Dollar Authorization aprovada. Prosseguindo com transação...');
      } else {
        console.log('ℹ️  Zero Dollar não necessário (transação normal, sem armazenar cartão)');
      }

      // Tokenização de Bandeira: OBRIGATÓRIA apenas para Visa
      // Conforme documentação: https://developer.userede.com.br/e-rede
      const bandeiraLower = (cartaoProcessado.bandeira || '').toLowerCase();
      if (bandeiraLower === 'visa') {
        console.log(`🔐 Tokenizando cartão ${bandeiraLower.toUpperCase()} (obrigatório para Visa)...`);
        
        // Se já temos um token de rede, não precisa tokenizar novamente
        if (!cartaoProcessado.networkToken && cartaoProcessado.cardNumber) {
          const tokenizationResult = await tokenizeCard(
            {
              cardNumber: cartaoProcessado.cardNumber,
              cardholderName: cartaoProcessado.cardholderName,
              expirationMonth: cartaoProcessado.expirationMonth,
              expirationYear: cartaoProcessado.expirationYear,
              securityCode: cartaoProcessado.securityCode,
              email: cartaoProcessado.email || req.body.doador?.email || 'doacao@solsticio.com.br',
              kind: 'credit',
              storageCard: vaiArmazenarCartao ? '1' : '0'
            },
            bandeiraLower
          );

          if (tokenizationResult && tokenizationResult.networkToken) {
            cartaoProcessado.networkToken = tokenizationResult.networkToken;
            cartaoProcessado.cryptogram = tokenizationResult.cryptogram;
            console.log(`✅ Tokenização de bandeira concluída para ${bandeiraLower.toUpperCase()}`);
          } else {
            console.warn(`⚠️  Tokenização de bandeira falhou para ${bandeiraLower.toUpperCase()}, continuando com token padrão`);
          }
        }
      }

      // 3DS/DataOnly: DataOnly para Visa/Mastercard (melhor aprovação, sem liability shift)
      // 3DS normal para Elo (com liability shift)
      // IMPORTANTE: Para usar MPI Rede, os seguintes campos são OBRIGATÓRIOS:
      // - userAgent, ipAddress, device, billing
      // Esses dados devem vir do frontend (navegador do usuário)
      let threeDSecureData = null;
      if (bandeiraLower === 'visa' || bandeiraLower === 'mastercard') {
        // DataOnly: melhor aprovação, sem challenge, sem liability shift
        threeDSecureData = {
          embedded: true,
          onFailure: 'continue', // Continua mesmo se falhar (crédito é opcional)
          challengePreference: 'DATA_ONLY' // ✅ DataOnly para melhor aprovação
        };
        console.log(`🔒 Aplicando DataOnly automático para ${bandeiraLower.toUpperCase()}`);
      } else if (bandeiraLower === 'elo') {
        // 3DS normal para Elo (com liability shift)
        threeDSecureData = {
          embedded: true,
          onFailure: 'continue' // Continua mesmo se falhar (crédito é opcional)
        };
        console.log(`🔒 Aplicando 3DS automático para ${bandeiraLower.toUpperCase()}`);
      }

      // Se dados de 3DS foram fornecidos manualmente, usa eles (mas mantém challengePreference se DataOnly)
      if (req.body.threeDSecure) {
        threeDSecureData = { 
          ...threeDSecureData, 
          ...req.body.threeDSecure,
          // Mantém challengePreference se já estava configurado para DataOnly
          challengePreference: req.body.threeDSecure.challengePreference || threeDSecureData?.challengePreference
        };
      }

      // Coleta dados obrigatórios do MPI Rede do request/frontend
      // Se não fornecidos pelo frontend, tenta obter do request
      if (threeDSecureData) {
        // userAgent: deve vir do frontend (navigator.userAgent)
        if (!threeDSecureData.userAgent) {
          threeDSecureData.userAgent = req.headers['user-agent'] || 'Unknown';
        }

        // ipAddress: obtém do request (IPv4)
        if (!threeDSecureData.ipAddress) {
          // Tenta obter IP real (considera proxies)
          const forwardedFor = req.headers['x-forwarded-for'];
          const realIp = req.headers['x-real-ip'];
          const clientIp = forwardedFor 
            ? forwardedFor.split(',')[0].trim() 
            : (realIp || req.ip || req.connection?.remoteAddress || '127.0.0.1');
          
          // Remove porta se presente e valida IPv4
          const ipv4Match = clientIp.match(/^(\d{1,3}\.){3}\d{1,3}/);
          threeDSecureData.ipAddress = ipv4Match ? ipv4Match[0] : '127.0.0.1';
        }

        // device: deve vir do frontend, mas fornece valores padrão se não disponível
        if (!threeDSecureData.device || typeof threeDSecureData.device !== 'object') {
          // Calcula timeZoneOffset dinamicamente (diferença em horas do UTC)
          // IMPORTANTE: A documentação mostra exemplos com valor SEM sinal negativo (ex: "3" para UTC-3)
          // Usa valor absoluto (sem sinal negativo)
          const timezoneOffset = Math.abs(Math.round(new Date().getTimezoneOffset() / -60));
          // Se calculado como 0, usa 3 como fallback (para Brazil UTC-3)
          const finalOffset = timezoneOffset === 0 ? 3 : timezoneOffset;
          const timeZoneOffsetFormatted = String(finalOffset); // Converte para string conforme documentação
          
          threeDSecureData.device = {
            colorDepth: 24,
            deviceType3ds: 'BROWSER',
            javaEnabled: false,
            language: req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'pt',
            screenHeight: 1080,
            screenWidth: 1920,
            timeZoneOffset: timeZoneOffsetFormatted // Formato: string com número SEM sinal negativo (ex: "3")
          };
        } else {
          // Garante que timeZoneOffset está no formato correto (string numérica SEM sinal negativo)
          if (threeDSecureData.device.timeZoneOffset !== undefined) {
            // Se for número, converte para string e usa valor absoluto
            if (typeof threeDSecureData.device.timeZoneOffset === 'number') {
              const absOffset = Math.abs(threeDSecureData.device.timeZoneOffset);
              // Se for 0, usa 3 como fallback (para Brazil UTC-3)
              const finalOffset = absOffset === 0 ? 3 : absOffset;
              threeDSecureData.device.timeZoneOffset = String(finalOffset);
            }
            // Se for string, valida formato e remove sinal negativo se presente
            else if (typeof threeDSecureData.device.timeZoneOffset === 'string') {
              // Remove espaços e sinal negativo
              const offset = threeDSecureData.device.timeZoneOffset.trim().replace(/^-/, '');
              if (/^\d+$/.test(offset)) {
                const numOffset = parseInt(offset, 10);
                // Se for 0, usa 3 como fallback (para Brazil UTC-3)
                const finalOffset = numOffset === 0 ? 3 : numOffset;
                threeDSecureData.device.timeZoneOffset = String(finalOffset);
              } else {
                // Formato inválido, calcula dinamicamente
                const timezoneOffset = Math.abs(Math.round(new Date().getTimezoneOffset() / -60));
                const finalOffset = timezoneOffset === 0 ? 3 : timezoneOffset;
                threeDSecureData.device.timeZoneOffset = String(finalOffset);
                console.warn(`⚠️  timeZoneOffset inválido recebido: "${threeDSecureData.device.timeZoneOffset}". Usando valor calculado: ${threeDSecureData.device.timeZoneOffset}`);
              }
            }
          } else {
            // Se não fornecido, calcula dinamicamente
            const timezoneOffset = Math.abs(Math.round(new Date().getTimezoneOffset() / -60));
            const finalOffset = timezoneOffset === 0 ? 3 : timezoneOffset;
            threeDSecureData.device.timeZoneOffset = String(finalOffset);
          }
        }

        // billing: deve vir do frontend com dados do comprador
        // Se não fornecido, tenta usar dados do doador se disponível
        if (!threeDSecureData.billing || typeof threeDSecureData.billing !== 'object') {
          // Tenta usar dados do doador como fallback
          const doador = req.body.doador || {};
          threeDSecureData.billing = {
            address: doador.endereco || 'Não informado',
            city: doador.cidade || 'Não informado',
            postalcode: doador.cep || '00000000',
            state: doador.estado || 'SP',
            country: 'Brasil',
            emailAddress: doador.email || cartaoProcessado.email || 'nao-informado@example.com',
            phoneNumber: doador.telefone || doador.whatsapp || '00000000000'
          };
        }
      }

      cobranca = await createCreditCardTransaction(
        txid,
        valorValidado,
        cartaoProcessado,
        parcelasValidadas,
        cartaoProcessado.bandeira,
        threeDSecureData // Passa dados 3DS/DataOnly
      );

      if (!cobranca) {
        console.error(`❌ createCreditCardTransaction retornou null para txid: ${txid}`);
        console.error(`   Isso significa que a transação falhou na e-Rede antes de ser salva no banco.`);
        console.error(`   Verifique os logs anteriores para identificar o erro específico.`);
        return res.status(500).json({
          error: 'Não foi possível processar o pagamento com cartão de crédito.',
          txid: txid
        });
      }
      
      console.log(`✅ createCreditCardTransaction retornou sucesso para txid: ${txid}`);
      console.log(`   - rede_tid: ${cobranca.rede_tid || 'null'}`);
      console.log(`   - status: ${cobranca.status || 'null'}`);
      console.log(`   - returnCode: ${cobranca.returnCode || 'null'}`);
      console.log(`   - authorizationCode: ${cobranca.authorizationCode || 'null'}`);

      console.log(`📋 Cobrança criada:`, {
        txid: cobranca.txid,
        rede_tid: cobranca.rede_tid,
        status: cobranca.status,
        valor: cobranca.valor,
        bandeira: cobranca.bandeira,
        returnCode: cobranca.returnCode,
        returnMessage: cobranca.returnMessage
      });

      dadosPagamento = {
        tipo: 'CREDITO',
        parcelas: parcelasValidadas,
        bandeira: cobranca.bandeira
      };
      
      // Salva threeDSecureUrl se transação requer 3DS
      if (cobranca.requires3DS && cobranca.threeDSecureUrl) {
        dadosPagamento.threeDSecureUrl = cobranca.threeDSecureUrl;
        dadosPagamento.tid = cobranca.rede_tid; // Salva tid para usar na captura
      }
    } else if (tipoPagamento === 'DEBITO') {
      // Zero Dollar: OBRIGATÓRIO apenas quando vamos armazenar cartão
      const vaiArmazenarCartao = req.body.recurrenceData?.storageCard === '1' || 
                                  req.body.recurrenceData?.storageCard === '2' ||
                                  req.body.storageCard === '1' || 
                                  req.body.storageCard === '2';
      
      if (vaiArmazenarCartao) {
        console.log('🔒 Executando Zero Dollar Authorization (obrigatório para armazenar cartão)...');
        const zeroDollarTxid = `zerodollar${txid.slice(-15)}`;
        
        if (!cartaoProcessado.cardNumber || !cartaoProcessado.securityCode) {
          return res.status(400).json({
            error: 'Para armazenar cartão, é necessário fornecer número do cartão e CVV para validação Zero Dollar.'
          });
        }
        
        const zeroDollarAuth = await authorizeZeroDollar(
          {
            cardNumber: cartaoProcessado.cardNumber,
            expirationMonth: cartaoProcessado.expirationMonth,
            expirationYear: cartaoProcessado.expirationYear,
            securityCode: cartaoProcessado.securityCode,
            cardholderName: cartaoProcessado.cardholderName
          },
          zeroDollarTxid,
          'debit'
        );

        if (!zeroDollarAuth || zeroDollarAuth.aprovado !== true) {
          return res.status(400).json({
            error: 'Cartão não passou na validação Zero Dollar.',
            details: zeroDollarAuth?.returnMessage || 'Cartão inválido ou bloqueado'
          });
        }

        console.log('✅ Zero Dollar Authorization aprovada. Prosseguindo com transação...');
      } else {
        console.log('ℹ️  Zero Dollar não necessário (transação normal, sem armazenar cartão)');
      }

      // Tokenização de Bandeira: OBRIGATÓRIA apenas para Visa
      // Conforme documentação: https://developer.userede.com.br/e-rede
      const bandeiraLower = (cartaoProcessado.bandeira || '').toLowerCase();
      if (bandeiraLower === 'visa') {
        console.log(`🔐 Tokenizando cartão ${bandeiraLower.toUpperCase()} (obrigatório para Visa)...`);
        
        if (!cartaoProcessado.networkToken && cartaoProcessado.cardNumber) {
          const tokenizationResult = await tokenizeCard(
            {
              cardNumber: cartaoProcessado.cardNumber,
              cardholderName: cartaoProcessado.cardholderName,
              expirationMonth: cartaoProcessado.expirationMonth,
              expirationYear: cartaoProcessado.expirationYear,
              securityCode: cartaoProcessado.securityCode,
              email: cartaoProcessado.email || req.body.doador?.email || 'doacao@solsticio.com.br',
              kind: 'debit',
              storageCard: vaiArmazenarCartao ? '1' : '0'
            },
            bandeiraLower
          );

          if (tokenizationResult && tokenizationResult.networkToken) {
            cartaoProcessado.networkToken = tokenizationResult.networkToken;
            cartaoProcessado.cryptogram = tokenizationResult.cryptogram;
            console.log(`✅ Tokenização de bandeira concluída para ${bandeiraLower.toUpperCase()}`);
          } else {
            console.warn(`⚠️  Tokenização de bandeira falhou para ${bandeiraLower.toUpperCase()}, continuando com token padrão`);
          }
        }
      }

      // 3DS é OBRIGATÓRIO para débito (conforme documentação e-Rede)
      // onFailure deve ser 'decline' (não pode continuar sem autenticação)
      // IMPORTANTE: Para usar MPI Rede, os seguintes campos são OBRIGATÓRIOS:
      // - userAgent, ipAddress, device, billing
      let threeDSecureData = {
        embedded: true, // MPI Rede
        onFailure: 'decline' // ✅ OBRIGATÓRIO: Rejeita se 3DS falhar (débito exige autenticação)
      };

      // Se dados de 3DS foram fornecidos manualmente, usa eles (mas mantém onFailure: 'decline')
      if (req.body.threeDSecure) {
        threeDSecureData = { 
          ...threeDSecureData, 
          ...req.body.threeDSecure,
          // Força onFailure: 'decline' para débito (obrigatório)
          onFailure: 'decline'
        };
      }

      // Coleta dados obrigatórios do MPI Rede do request/frontend
      // Se não fornecidos pelo frontend, tenta obter do request
      // userAgent: deve vir do frontend (navigator.userAgent)
      if (!threeDSecureData.userAgent) {
        threeDSecureData.userAgent = req.headers['user-agent'] || 'Unknown';
      }

      // ipAddress: obtém do request (IPv4)
      if (!threeDSecureData.ipAddress) {
        // Tenta obter IP real (considera proxies)
        const forwardedFor = req.headers['x-forwarded-for'];
        const realIp = req.headers['x-real-ip'];
        const clientIp = forwardedFor 
          ? forwardedFor.split(',')[0].trim() 
          : (realIp || req.ip || req.connection?.remoteAddress || '127.0.0.1');
        
        // Remove porta se presente e valida IPv4
        const ipv4Match = clientIp.match(/^(\d{1,3}\.){3}\d{1,3}/);
        threeDSecureData.ipAddress = ipv4Match ? ipv4Match[0] : '127.0.0.1';
      }

      // device: deve vir do frontend, mas fornece valores padrão se não disponível
      if (!threeDSecureData.device || typeof threeDSecureData.device !== 'object') {
        // Calcula timeZoneOffset dinamicamente (diferença em horas do UTC)
        // IMPORTANTE: A documentação mostra exemplos com valor SEM sinal negativo (ex: "3" para UTC-3)
        // Usa valor absoluto (sem sinal negativo)
        const timezoneOffset = Math.abs(Math.round(new Date().getTimezoneOffset() / -60));
        const timeZoneOffsetFormatted = String(timezoneOffset); // Converte para string conforme documentação
        
        threeDSecureData.device = {
          colorDepth: 24,
          deviceType3ds: 'BROWSER',
          javaEnabled: false,
          language: req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'pt',
          screenHeight: 1080,
          screenWidth: 1920,
          timeZoneOffset: timeZoneOffsetFormatted // Formato: string com número SEM sinal negativo (ex: "3")
        };
      } else {
        // Garante que timeZoneOffset está no formato correto (string numérica SEM sinal negativo)
        if (threeDSecureData.device.timeZoneOffset !== undefined) {
          // Se for número, converte para string e usa valor absoluto
          if (typeof threeDSecureData.device.timeZoneOffset === 'number') {
            threeDSecureData.device.timeZoneOffset = String(Math.abs(threeDSecureData.device.timeZoneOffset));
          }
          // Se for string, valida formato e remove sinal negativo se presente
          else if (typeof threeDSecureData.device.timeZoneOffset === 'string') {
            // Remove espaços e sinal negativo
            const offset = threeDSecureData.device.timeZoneOffset.trim().replace(/^-/, '');
            if (/^\d+$/.test(offset)) {
              // Formato válido, usa valor sem sinal negativo
              threeDSecureData.device.timeZoneOffset = offset;
            } else {
              // Formato inválido, calcula dinamicamente
              const timezoneOffset = Math.abs(Math.round(new Date().getTimezoneOffset() / -60));
              threeDSecureData.device.timeZoneOffset = String(timezoneOffset);
              console.warn(`⚠️  timeZoneOffset inválido recebido: "${threeDSecureData.device.timeZoneOffset}". Usando valor calculado: ${threeDSecureData.device.timeZoneOffset}`);
            }
          }
        } else {
          // Se não fornecido, calcula dinamicamente
          const timezoneOffset = Math.abs(Math.round(new Date().getTimezoneOffset() / -60));
          threeDSecureData.device.timeZoneOffset = String(timezoneOffset);
        }
      }

      // billing: deve vir do frontend com dados do comprador
      // Se não fornecido, tenta usar dados do doador se disponível
      if (!threeDSecureData.billing || typeof threeDSecureData.billing !== 'object') {
        // Tenta usar dados do doador como fallback
        const doador = req.body.doador || {};
        threeDSecureData.billing = {
          address: doador.endereco || 'Não informado',
          city: doador.cidade || 'Não informado',
          postalcode: doador.cep || '00000000',
          state: doador.estado || 'SP',
          country: 'Brasil',
          emailAddress: doador.email || cartaoProcessado.email || 'nao-informado@example.com',
          phoneNumber: doador.telefone || doador.whatsapp || '00000000000'
        };
      }
      
      console.log(`🔒 3DS obrigatório configurado para débito (onFailure: decline)`);

      cobranca = await createDebitCardTransaction(
        txid,
        valorValidado,
        cartaoProcessado,
        cartaoProcessado.bandeira,
        null, // recurrenceData
        threeDSecureData // 3DS obrigatório para débito
      );

      if (!cobranca) {
        return res.status(500).json({
          error: 'Não foi possível processar o pagamento com cartão de débito.'
        });
      }

      // Verifica se há erro específico (ex: erro 204 - cartão não suporta 3DS)
      if (cobranca.error) {
        return res.status(400).json({
          error: cobranca.returnMessage || 'Erro ao processar pagamento com cartão de débito.',
          returnCode: cobranca.returnCode,
          details: 'Para transações de débito, o 3DS é obrigatório. O cartão não suporta autenticação 3DS. Entre em contato com o banco emissor.'
        });
      }

      dadosPagamento = {
        tipo: 'DEBITO',
        bandeira: cobranca.bandeira
      };
      
      // Salva threeDSecureUrl se transação requer 3DS
      if (cobranca.requires3DS && cobranca.threeDSecureUrl) {
        dadosPagamento.threeDSecureUrl = cobranca.threeDSecureUrl;
        dadosPagamento.tid = cobranca.rede_tid; // Salva tid para usar na captura
      }
    } else if (tipoPagamento === 'CRIPTO') {
      // Validação de moeda para pagamentos cripto
      const currencyUpper = (currency || 'USDC').toUpperCase();
      if (!isSupportedCurrency(currencyUpper)) {
        return res.status(400).json({
          error: `Moeda não suportada: ${currency}. Use USDC ou XLM.`
        });
      }

      // Cria pagamento Stellar
      // IMPORTANTE: Para CRIPTO, o valor é opcional - será obtido da blockchain quando confirmado
      // Passamos null se não fornecido, e o valor será buscado da blockchain no webhook
      console.log(`\n🚀 Criando pagamento Stellar para txid: ${txid}`);
      console.log(`   Valor fornecido: ${valorValidado || 'NÃO FORNECIDO (será obtido da blockchain)'}`);
      cobranca = await createStellarPayment(txid, valorValidado, currencyUpper, txid);

      if (!cobranca) {
        console.error(`❌ createStellarPayment retornou null para txid: ${txid}`);
        return res.status(500).json({
          error: 'Não foi possível gerar o pagamento Stellar.'
        });
      }
      
      console.log(`✅ Pagamento Stellar criado: txid=${cobranca.txid}, memo=${cobranca.memo}`);

      dadosPagamento = {
        tipo: 'CRIPTO',
        currency: currencyUpper,
        provider: 'STELLAR',
        memo: cobranca.memo || txid, // IMPORTANTE: Salva o memo para busca posterior
        paymentMemo: cobranca.memo || txid, // Compatibilidade
        txid: txid // Salva também o txid para referência
      };
    }

    // Salva a cobrança no banco de dados (status: AGUARDANDO ou AUTORIZADA/CAPTURADA)
    const dadosDoadorTemp = doador ? {
      nome: doador.nome || null,
      whatsapp: doador.whatsapp || null,
      anonimo: doador.anonimo !== false,
      mensagem: doador.mensagem || null
    } : null;

    // Para cartões, verifica se foi autorizado através do objeto autorizacao
    // O status real da autorização está em autorizacao.status, não em cobranca.status
    let foiAutorizado = false;
    let requires3DS = false;
    if (tipoPagamento === 'CREDITO' || tipoPagamento === 'DEBITO') {
      // Verifica se requer autenticação 3DS (returnCode 220)
      requires3DS = cobranca.requires3DS === true && !!cobranca.threeDSecureUrl;
      // Verifica se há authorizationCode (indica autorização imediata)
      foiAutorizado = cobranca.authorizationCode && cobranca.returnCode === '00';
    }
    
    const statusInicial = tipoPagamento === 'PIX' || tipoPagamento === 'CRIPTO'
      ? 'AGUARDANDO'
      : requires3DS
        ? 'PENDENTE_3DS'
        : (foiAutorizado ? 'CONFIRMADA' : 'AGUARDANDO');
    
    console.log(`📊 Status inicial determinado:`, {
      tipoPagamento,
      cobrancaStatus: cobranca.status,
      authorizationCode: cobranca.authorizationCode,
      returnCode: cobranca.returnCode,
      foiAutorizado,
      statusInicial
    });

    // Determina provider baseado no tipo de pagamento
    const provider = tipoPagamento === 'CRIPTO' ? 'STELLAR' : 'REDE';

    // CRÍTICO: Salva a cobrança ANTES de retornar sucesso
    // Se falhar, retorna erro 500 - não podemos continuar sem a cobrança salva
    console.log(`\n💾 Tentando salvar cobrança no banco: txid=${cobranca.txid || txid}`);
    
    const dadosCobranca = {
      txid: cobranca.txid || txid,
      valor: tipoPagamento === 'CRIPTO' ? (cobranca.valor || valorValidado || 0) : (cobranca.valor || valorValidado), // Para CRIPTO, pode ser 0 se não fornecido
      status: statusInicial,
      campanhaId: cid,
      tipoPagamento: tipoPagamento,
      provider: provider,
      chavePix: null, // A chave PIX é configurada no portal e-Rede e usada automaticamente pela API
      brCode: tipoPagamento === 'PIX' ? cobranca.brCode : null,
      expiracao: tipoPagamento === 'PIX' ? (cobranca.expiracao || 3600) : (tipoPagamento === 'CRIPTO' ? 2592000 : 3600), // 30 dias para CRIPTO, 1 hora para outros
      redeTid: cobranca.rede_tid || null,
      providerTid: cobranca.provider_tid || cobranca.rede_tid || null,
      cryptoCurrency: tipoPagamento === 'CRIPTO' ? (cobranca.currency || currencyUpper) : null,
      cryptoAddress: tipoPagamento === 'CRIPTO' ? (cobranca.recipient_address || null) : null,
      dadosPagamento: dadosPagamento,
      dadosDoadorTemp
    };
    
    console.log(`📦 Dados da cobrança a serem salvos:`, {
      txid: dadosCobranca.txid,
      valor: dadosCobranca.valor,
      status: dadosCobranca.status,
      tipoPagamento: dadosCobranca.tipoPagamento,
      provider: dadosCobranca.provider,
      redeTid: dadosCobranca.redeTid,
      providerTid: dadosCobranca.providerTid,
      campanhaId: dadosCobranca.campanhaId
    });
    
    let cobrancaSalva;
    try {
      cobrancaSalva = await saveCobranca(dadosCobranca);
      console.log(`✅ saveCobranca retornou:`, cobrancaSalva ? `sucesso para txid=${cobrancaSalva.txid}` : 'null');
    } catch (error) {
      console.error(`❌ ERRO CRÍTICO ao salvar cobrança: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
      console.error(`   TXID que tentou salvar: ${cobranca.txid || txid}`);
      return res.status(500).json({
        error: 'Erro ao salvar cobrança no banco de dados. Tente novamente.',
        txid: txid,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    if (!cobrancaSalva) {
      console.error(`❌ ERRO CRÍTICO: saveCobranca retornou null para txid: ${txid}`);
      console.error(`   Cobrança criada mas não salva! Isso é um problema grave.`);
      return res.status(500).json({
        error: 'Erro ao salvar cobrança no banco de dados. Tente novamente.',
        txid: txid
      });
    }
    
    // Verificação final: confirma que a cobrança existe no banco
    console.log(`🔍 Verificando se cobrança foi salva: txid=${cobrancaSalva.txid}`);
    const cobrancaVerificada = await getCobranca(cobrancaSalva.txid);
    if (!cobrancaVerificada) {
      console.error(`❌ ERRO CRÍTICO: Cobrança salva mas não encontrada no DB: ${cobrancaSalva.txid}`);
      console.error(`   Isso indica um problema grave com o banco de dados`);
      console.error(`   Tentando buscar novamente em 1 segundo...`);
      // Tenta novamente após 1 segundo (pode ser delay de replicação)
      await new Promise(resolve => setTimeout(resolve, 1000));
      const cobrancaVerificada2 = await getCobranca(cobrancaSalva.txid);
      if (!cobrancaVerificada2) {
        return res.status(500).json({
          error: 'Erro ao verificar cobrança no banco de dados. Tente novamente.',
          txid: cobrancaSalva.txid
        });
      }
      console.log(`✅ Cobrança encontrada na segunda tentativa: ${cobrancaSalva.txid}`);
    } else {
      console.log(`✅ Cobrança confirmada salva e verificada no DB: ${cobrancaSalva.txid}`);
    }

    // Para transações de cartão AUTORIZADAS/CONFIRMADAS imediatamente, cria a transação automaticamente
    // Não precisamos esperar pelo webhook para cartões que são autorizados na hora
    // Verifica se foi realmente autorizado através do authorizationCode e returnCode
    const foiRealmenteAutorizado = foiAutorizado && (tipoPagamento === 'CREDITO' || tipoPagamento === 'DEBITO');
    if (foiRealmenteAutorizado) {
      console.log(`\n💰 Transação ${tipoPagamento} foi AUTORIZADA imediatamente. Criando entrada na tabela transacoes...`);
      
      try {
        // Prepara dados no formato esperado pelo processConfirmedTransaction
        const webhookData = {
          txid: cobranca.txid || txid,
          rede_tid: cobranca.rede_tid || null,
          provider_tid: cobranca.provider_tid || cobranca.rede_tid || null,
          provider: provider,
          tipo_pagamento: tipoPagamento,
          valor: cobranca.valor || valorValidado,
          status: 'CONFIRMADA',
          horario: cobranca.criadoEm || new Date().toISOString(),
          bandeira: dadosPagamento?.bandeira || cobranca.bandeira || null,
          parcelas: dadosPagamento?.parcelas || cobranca.parcelas || null,
          authorizationCode: cobranca.authorizationCode || null
        };

        console.log(`📋 Dados para processConfirmedTransaction:`, {
          txid: webhookData.txid,
          rede_tid: webhookData.rede_tid,
          provider_tid: webhookData.provider_tid,
          valor: webhookData.valor,
          status: webhookData.status,
          bandeira: webhookData.bandeira,
          parcelas: webhookData.parcelas
        });

        const transacaoProcessada = await processConfirmedTransaction(webhookData, dadosDoadorTemp);
        
        if (transacaoProcessada && transacaoProcessada.transacao) {
          console.log(`✅ Transação criada automaticamente na tabela transacoes:`);
          console.log(`   - ID: ${transacaoProcessada.transacao.id}`);
          console.log(`   - Valor: ${transacaoProcessada.transacao.valor}`);
          console.log(`   - Doador ID: ${transacaoProcessada.transacao.doador_id || 'null'}`);
          console.log(`   - Provider TID: ${transacaoProcessada.transacao.provider_tid || 'null'}`);
        } else {
          console.warn(`⚠️  Não foi possível criar transação automaticamente. O webhook ainda pode criar quando chegar.`);
          console.warn(`   Resultado:`, transacaoProcessada);
        }
      } catch (error) {
        console.error(`❌ Erro ao criar transação automaticamente: ${error.message}`);
        console.error(`   Stack: ${error.stack}`);
        // Não bloqueia a resposta - o webhook ainda pode criar a transação quando chegar
      }
    }

    // Retorna resposta conforme tipo de pagamento
    const response = {
      success: true,
      txid: cobranca.txid || txid,
      rede_tid: cobranca.rede_tid || null,
      provider_tid: cobranca.provider_tid || null,
      tipo_pagamento: tipoPagamento,
      valor: cobranca.valor || valorValidado,
      status: statusInicial
    };

    if (tipoPagamento === 'PIX') {
      // Garante que brCode não seja null ou vazio
      if (cobranca.brCode && typeof cobranca.brCode === 'string' && cobranca.brCode.trim().length > 0) {
        response.brCode = cobranca.brCode;
      } else {
        console.error('❌ brCode inválido ou vazio na cobrança:', cobranca.brCode);
        response.brCode = null;
      }
      
      // Retorna também a imagem base64 do QR Code (se disponível)
      // Isso evita problemas com CSP no frontend ao usar bibliotecas que usam eval()
      // Pode vir de cobranca.qrCodeImage (direto) ou de dados_pagamento.qrCodeImage (salvo no banco)
      let qrCodeImage = null;
      if (cobranca.qrCodeImage && typeof cobranca.qrCodeImage === 'string' && cobranca.qrCodeImage.trim().length > 0) {
        qrCodeImage = cobranca.qrCodeImage;
      } else if (cobranca.dados_pagamento && typeof cobranca.dados_pagamento === 'object' && cobranca.dados_pagamento.qrCodeImage) {
        qrCodeImage = cobranca.dados_pagamento.qrCodeImage;
      } else if (typeof cobranca.dados_pagamento === 'string') {
        try {
          const dadosPagamentoParsed = JSON.parse(cobranca.dados_pagamento);
          qrCodeImage = dadosPagamentoParsed?.qrCodeImage || null;
        } catch (e) {
          // Ignora erro de parse
        }
      }
      
      if (qrCodeImage) {
        response.qrCodeImage = qrCodeImage;
      }
      
      response.expiracao = cobranca.expiracao;
      console.log('📋 PIX Response - brCode:', response.brCode ? `${response.brCode.substring(0, 50)}...` : 'null/undefined/vazio');
      console.log('📋 PIX Response - qrCodeImage:', response.qrCodeImage ? 'disponível (base64)' : 'null/undefined');
      console.log('📋 PIX Response - expiracao:', cobranca.expiracao);
      console.log('📋 PIX Response - brCode length:', response.brCode ? response.brCode.length : 0);
    } else if (tipoPagamento === 'CRIPTO') {
      response.recipient_address = cobranca.recipient_address;
      response.memo = cobranca.memo;
      response.currency = cobranca.currency;
      response.network = cobranca.network;
      response.horizon_url = cobranca.horizon_url;
      response.stellar_uri = cobranca.stellar_uri; // URI Stellar (SEP-7) para pagamento direto
      response.stellar_uri_alt = cobranca.stellar_uri_alt; // URI alternativo sem memo_type (para Freighter)
      response.qr_code = cobranca.qr_code; // QR code em base64 para escanear
      response.qr_code_alt = cobranca.qr_code_alt; // QR code alternativo sem memo_type
      response.qr_code_address = cobranca.qr_code_address; // QR code apenas com o endereço Stellar
      response.qr_code_memo = cobranca.qr_code_memo; // QR code apenas com o memo
    } else {
      // Para cartões, verifica se requer autenticação 3DS (returnCode 220)
      if (cobranca.requires3DS && cobranca.threeDSecureUrl) {
        response.requires3DS = true;
        response.threeDSecureUrl = cobranca.threeDSecureUrl;
        response.threeDSecureDisplayMode = 'popup'; // Sempre pop-up (sandbox + produção)
        response.status = 'PENDENTE_3DS';
        response.autorizacao = {
          codigo: null,
          status: 'PENDENTE_3DS',
          bandeira: cobranca.bandeira || dadosPagamento?.bandeira || null
        };
        if (tipoPagamento === 'CREDITO') {
          response.parcelas = cobranca.parcelas || dadosPagamento?.parcelas || 1;
        }
        console.log('🔒 Transação requer autenticação 3DS');
        console.log(`   URL: ${cobranca.threeDSecureUrl}`);
        console.log(`   Modo de exibição: popup (unificado para sandbox e produção)`);
        console.log(`   📖 Frontend deve abrir URL em pop-up usando window.open()`);
      } else {
        // Para cartões, o status real da autorização é baseado no returnCode
        // returnCode '00' = AUTORIZADA, outros = NEGADA
        const statusAutorizacao = cobranca.returnCode === '00' ? 'AUTORIZADA' : 'NEGADA';
        
        response.autorizacao = {
          codigo: cobranca.authorizationCode || null,
          status: statusAutorizacao,
          bandeira: cobranca.bandeira || dadosPagamento?.bandeira || null
        };
        if (tipoPagamento === 'CREDITO') {
          response.parcelas = cobranca.parcelas || dadosPagamento?.parcelas || 1;
        }
      }
    }

    res.status(200).json(response);

  } catch (error) {
    console.error('❌ Erro inesperado no endpoint /api/gerar-pagamento:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error('Stack:', error.stack);
    }

    // IMPORTANTE: Adiciona headers CORS mesmo em caso de erro
    const origin = req.headers.origin;
    const isOriginAllowed = !process.env.ALLOWED_ORIGINS 
      ? (origin?.includes('localhost') || origin?.includes('127.0.0.1') || !origin)
      : process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).includes(origin || '');
    
    if (isOriginAllowed || !origin) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    res.status(500).json({
      error: 'Erro interno do servidor.',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/cobranca/:tid
 * Consulta o status de uma cobrança por Transaction ID da e-Rede
 */
router.get('/cobranca/:tid', consultChargeLimiter, async (req, res) => {
  try {
    const { tid } = req.params;

    if (!tid || typeof tid !== 'string') {
      return res.status(400).json({
        error: 'TID inválido.'
      });
    }

    // Consulta na e-Rede para obter status atualizado
    const cobrancaRede = await consultTransaction(tid);

    if (!cobrancaRede) {
      return res.status(404).json({
        error: 'Cobrança não encontrada na e-Rede.'
      });
    }

    // Busca no banco de dados local
    const cobrancaDB = await getCobranca(cobrancaRede.txid);

    // Atualiza o status no banco local se necessário
    if (cobrancaDB && cobrancaDB.status !== cobrancaRede.status) {
      await require('../services/dbService').updateCobrancaStatus(cobrancaRede.txid, cobrancaRede.status);
    }

    // Retorna os dados combinados
    res.status(200).json({
      success: true,
      txid: cobrancaRede.txid,
      rede_tid: cobrancaRede.rede_tid,
      tipo_pagamento: cobrancaRede.tipo_pagamento,
      status: cobrancaRede.status,
      valor: cobrancaRede.valor,
      brCode: cobrancaRede.brCode,
      criadoEm: cobrancaRede.criadoEm,
      atualizadoEm: cobrancaRede.atualizadoEm,
      bandeira: cobrancaRede.bandeira,
      parcelas: cobrancaRede.parcelas,
      campanhaId: cobrancaDB?.campanha_id || null
    });

  } catch (error) {
    console.error('❌ Erro inesperado no endpoint /api/cobranca/:tid:', error.message);
    res.status(500).json({
      error: 'Erro interno do servidor.',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/cobranca/txid/:txid
 * Consulta o status de uma cobrança por TXID interno (compatibilidade)
 */
router.get('/cobranca/txid/:txid', consultChargeLimiter, async (req, res) => {
  try {
    const { txid } = req.params;

    if (!validateTxid(txid)) {
      return res.status(400).json({
        error: 'TXID inválido. Deve ser alfanumérico e ter entre 26 e 35 caracteres.'
      });
    }

    // Busca no banco de dados local
    const cobrancaDB = await getCobranca(txid);

    if (!cobrancaDB) {
      return res.status(404).json({
        error: 'Cobrança não encontrada.'
      });
    }

    // Se tiver rede_tid, consulta na e-Rede para obter status atualizado
    let cobrancaRede = null;
    if (cobrancaDB.rede_tid) {
      cobrancaRede = await consultTransaction(cobrancaDB.rede_tid);
    }

    // Retorna os dados combinados
    res.status(200).json({
      success: true,
      txid: cobrancaDB.txid,
      rede_tid: cobrancaDB.rede_tid || null,
      tipo_pagamento: cobrancaDB.tipo_pagamento || 'PIX',
      status: cobrancaRede?.status || cobrancaDB.status,
      valor: cobrancaDB.valor,
      brCode: cobrancaDB.brcode,
      criadoEm: cobrancaDB.criado_em,
      atualizadoEm: cobrancaDB.atualizado_em,
      campanhaId: cobrancaDB.campanha_id || null
    });

  } catch (error) {
    console.error('❌ Erro inesperado no endpoint /api/cobranca/txid/:txid:', error.message);
    res.status(500).json({
      error: 'Erro interno do servidor.',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/webhook/pagamento
 * Recebe notificações de pagamento confirmado da e-Rede
 * Body: Dados do webhook da e-Rede
 * Headers: x-signature (opcional, para validação)
 */
router.post('/webhook/pagamento', webhookLimiter, async (req, res) => {
  try {
    const webhookBody = req.body;
    const signature = req.headers['x-signature'] || req.headers['x-rede-signature'];
    const clientIp = req.ip || req.connection.remoteAddress;

    // Log mínimo (sem dados sensíveis)
    console.log('📨 Webhook recebido da e-Rede', {
      hasSignature: !!signature,
      hasBody: !!webhookBody && Object.keys(webhookBody).length > 0,
      clientIp: clientIp,
      protocol: req.protocol,
      secure: req.secure
    });

    // Recupera dados do doador da cobrança original (armazenados temporariamente)
    let doadorData = null;
    if (webhookBody.transaction?.tid || webhookBody.transaction?.reference || webhookBody.tid) {
      const tid = webhookBody.transaction?.tid || webhookBody.transaction?.reference || webhookBody.tid;
      const { getCobrancaByRedeTid } = require('../services/redeWebhookService');
      const cobranca = await getCobrancaByRedeTid(tid);
      if (!cobranca) {
        // Tenta por txid se não encontrou por rede_tid
        const txid = webhookBody.transaction?.reference || tid;
        const cobrancaByTxid = await getCobranca(txid);
        if (cobrancaByTxid && cobrancaByTxid.dados_doador_temp) {
          let dadosDoadorTemp = cobrancaByTxid.dados_doador_temp;
          if (typeof dadosDoadorTemp === 'string') {
            try {
              dadosDoadorTemp = JSON.parse(dadosDoadorTemp);
            } catch (error) {
              console.warn('⚠️  Erro ao fazer parse de dados_doador_temp:', error.message);
            }
          }
          doadorData = dadosDoadorTemp;
        }
      } else if (cobranca.dados_doador_temp) {
        let dadosDoadorTemp = cobranca.dados_doador_temp;
        if (typeof dadosDoadorTemp === 'string') {
          try {
            dadosDoadorTemp = JSON.parse(dadosDoadorTemp);
          } catch (error) {
            console.warn('⚠️  Erro ao fazer parse de dados_doador_temp:', error.message);
          }
        }
        doadorData = dadosDoadorTemp;
      }
    }

    // Processa o webhook
    const result = await processWebhook(webhookBody, signature, clientIp, doadorData);

    if (!result || !result.success) {
      const errorMessage = result?.error || 'Erro ao processar webhook';
      
      // Erros de segurança: retorna 401 para bloquear
      const isSecurityError = errorMessage.includes('assinatura') ||
        errorMessage.includes('IP') ||
        (errorMessage.includes('inválido') && !errorMessage.includes('TID não encontrado'));

      if (isSecurityError) {
        return res.status(401).json({
          success: false,
          error: errorMessage
        });
      }

      // TID não encontrado ou cobrança inexistente: retorna 200 OK para parar retentativas
      // Isso evita que a e-Rede continue tentando reenviar webhooks para transações que não existem
      const isTidNotFound = errorMessage.includes('TID não encontrado') ||
        errorMessage.includes('Cobrança inexistente') ||
        errorMessage.includes('cobrança inexistente') ||
        errorMessage.includes('Dados do webhook inválidos ou TID não encontrado');

      if (isTidNotFound) {
        console.log(`ℹ️  Webhook ignorado (TID não encontrado): retornando 200 OK para parar retentativas`);
        return res.status(200).json({
          success: false,
          message: 'Webhook recebido mas TID não encontrado (ignorado)',
          ignored: true
        });
      }

      // Outros erros: retorna 400 (mas pode causar retentativas)
      return res.status(400).json({
        success: false,
        error: errorMessage
      });
    }

    // Retorna 200 OK para a e-Rede (importante para não receber retentativas)
    res.status(200).json({
      success: true,
      message: 'Webhook processado com sucesso',
      tid: result.transacao?.rede_tid || result.transacao?.cobranca_txid
    });

  } catch (error) {
    console.error('❌ Erro inesperado no endpoint /api/webhook/pagamento:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error('Stack:', error.stack);
    }

    // Retorna 200 para evitar retentativas, mas apenas para erros não críticos
    const isSecurityError = error.message.includes('Assinatura') ||
      error.message.includes('IP') ||
      error.message.includes('inválido');

    if (isSecurityError) {
      return res.status(401).json({
        success: false,
        error: 'Erro de validação de segurança'
      });
    }

    res.status(200).json({
      success: false,
      error: 'Erro ao processar webhook (logado para investigação)'
    });
  }
});

/**
 * POST /api/webhook/stellar
 * Recebe notificações de pagamento confirmado da Stellar
 * Body: Dados do webhook Stellar (de serviço de monitoramento ou polling)
 * Headers: x-signature (opcional, para validação)
 */
router.post('/webhook/stellar', webhookLimiter, async (req, res) => {
  try {
    const webhookBody = req.body;
    const signature = req.headers['x-signature'] || req.headers['x-stellar-signature'];
    const clientIp = req.ip || req.connection.remoteAddress;

    // Log mínimo (sem dados sensíveis)
    console.log('📨 Webhook recebido da Stellar', {
      hasSignature: !!signature,
      hasBody: !!webhookBody && Object.keys(webhookBody).length > 0,
      clientIp: clientIp,
      protocol: req.protocol,
      secure: req.secure
    });

    // Recupera dados do doador da cobrança original (armazenados temporariamente)
    let doadorData = null;
    if (webhookBody.memo || webhookBody.hash) {
      const identifier = webhookBody.memo || webhookBody.hash;
      const cobranca = await getCobranca(identifier);
      if (cobranca && cobranca.dados_doador_temp) {
        let dadosDoadorTemp = cobranca.dados_doador_temp;
        if (typeof dadosDoadorTemp === 'string') {
          try {
            dadosDoadorTemp = JSON.parse(dadosDoadorTemp);
          } catch (error) {
            console.warn('⚠️  Erro ao fazer parse de dados_doador_temp:', error.message);
          }
        }
        doadorData = dadosDoadorTemp;
      }
    }

    // Processa o webhook
    const result = await processStellarWebhook(webhookBody, signature, clientIp, doadorData);

    if (!result || !result.success) {
      const isSecurityError = result?.error?.includes('assinatura') ||
        result?.error?.includes('inválido');

      if (isSecurityError) {
        return res.status(401).json({
          success: false,
          error: result?.error || 'Erro de validação de segurança'
        });
      }

      return res.status(400).json({
        success: false,
        error: result?.error || 'Erro ao processar webhook'
      });
    }

    // Retorna 200 OK para o serviço de monitoramento
    res.status(200).json({
      success: true,
      message: 'Webhook processado com sucesso',
      hash: result.transacao?.provider_tid || result.transacao?.hash
    });

  } catch (error) {
    console.error('❌ Erro inesperado no endpoint /api/webhook/stellar:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error('Stack:', error.stack);
    }

    // Retorna 200 para evitar retentativas, mas apenas para erros não críticos
    const isSecurityError = error.message.includes('Assinatura') ||
      error.message.includes('inválido');

    if (isSecurityError) {
      return res.status(401).json({
        success: false,
        error: 'Erro de validação de segurança'
      });
    }

    res.status(200).json({
      success: false,
      error: 'Erro ao processar webhook (logado para investigação)'
    });
  }
});

/**
 * POST /api/check-payment-by-memo
 * Verifica se existe um pagamento Stellar para um memo específico
 * Usado quando usuário fecha a página e volta depois (botão "Já paguei, verificar agora")
 * Body: { 
 *   memo: string // Memo (txid) da cobrança
 * }
 */
router.post('/check-payment-by-memo', createChargeLimiter, async (req, res) => {
  try {
    const { memo } = req.body;

    // Validação do memo
    if (!memo || typeof memo !== 'string' || memo.length < 10) {
      return res.status(400).json({
        error: 'Memo inválido. Deve ser uma string válida (txid da cobrança).'
      });
    }

    console.log(`\n🔍 Verificando pagamento por memo: ${memo}`);

    // Busca pagamento por memo na conta Stellar
    const payment = await findPaymentByMemo(memo, 100); // Busca nas últimas 100 transações

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Pagamento não encontrado para este memo. Verifique se o pagamento foi realizado e aguarde alguns segundos.',
        memo: memo
      });
    }

    // Se encontrou, processa a confirmação (mesma lógica do confirm-donation)
    const webhookData = {
      txid: payment.memo, // memo é o txid
      provider_tid: payment.hash,
      provider: 'STELLAR',
      tipo_pagamento: 'CRIPTO',
      valor: payment.valor,
      status: 'CONFIRMADA',
      horario: payment.created_at,
      crypto_currency: payment.currency,
      crypto_address: payment.from, // Conta que enviou
      endToEndId: payment.hash
    };

    // Processa usando a mesma lógica do webhook
    const { processWebhook } = require('../services/stellarWebhookService');
    const result = await processWebhook(webhookData, null, req.ip, null);

    if (!result || !result.success) {
      // Se já foi processado, retorna sucesso (idempotência)
      if (result?.message?.includes('já foi processada')) {
        return res.status(200).json({
          success: true,
          message: 'Pagamento já foi confirmado anteriormente',
          hash: payment.hash,
          txid: payment.memo,
          valor: payment.valor,
          currency: payment.currency
        });
      }

      return res.status(400).json({
        error: result?.error || 'Erro ao processar confirmação do pagamento',
        hash: payment.hash
      });
    }

    console.log(`✅ Pagamento encontrado e confirmado por memo: ${memo}`);

    // Retorna sucesso
    res.status(200).json({
      success: true,
      message: 'Pagamento encontrado e confirmado com sucesso',
      hash: payment.hash,
      txid: payment.memo,
      valor: payment.valor,
      currency: payment.currency,
      created_at: payment.created_at,
      transacao: {
        id: result.transacao?.id,
        status: result.transacao?.status,
        confirmado_em: result.transacao?.confirmado_em
      }
    });

  } catch (error) {
    console.error('❌ Erro inesperado no endpoint /api/check-payment-by-memo:', error.message);
    res.status(500).json({
      error: 'Erro interno do servidor.',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/confirm-donation
 * Confirma um pagamento Stellar detectado pelo frontend
 * O frontend detecta o pagamento via SSE/WebSocket e envia o hash para validação
 * Body: { 
 *   hash: string, // Hash da transação Stellar
 *   txid?: string // TXID da cobrança (opcional, para validação extra)
 * }
 */
router.post('/confirm-donation', createChargeLimiter, async (req, res) => {
  try {
    const { hash, txid } = req.body;

    // Validação do hash
    if (!hash || typeof hash !== 'string' || hash.length !== 64) {
      return res.status(400).json({
        error: 'Hash da transação inválido. Deve ser uma string de 64 caracteres hexadecimais.'
      });
    }

    console.log(`\n🔍 Frontend solicitou confirmação de pagamento Stellar: ${hash}`);

    // Consulta a transação na Stellar para validar
    const transactionData = await consultStellarTransaction(hash);

    if (!transactionData) {
      return res.status(404).json({
        error: 'Transação não encontrada na rede Stellar. Verifique se o hash está correto e se a transação foi confirmada.'
      });
    }

    // Valida se a transação foi bem-sucedida
    if (!transactionData.successful) {
      return res.status(400).json({
        error: 'Transação não foi bem-sucedida na rede Stellar.',
        transaction_status: transactionData.status
      });
    }

    // Valida se o txid corresponde (se fornecido)
    if (txid && transactionData.txid !== txid) {
      console.warn(`⚠️  TXID não corresponde: esperado ${txid}, recebido ${transactionData.txid}`);
      // Não bloqueia, apenas avisa (pode ser que o memo seja diferente)
    }

    // Prepara dados para processamento (mesmo formato do webhook)
    const webhookData = {
      txid: transactionData.txid, // memo ou hash
      provider_tid: transactionData.provider_tid, // hash
      provider: 'STELLAR',
      tipo_pagamento: 'CRIPTO',
      valor: transactionData.valor,
      status: 'CONFIRMADA',
      horario: transactionData.horario,
      crypto_currency: transactionData.currency,
      crypto_address: transactionData.source_account, // Conta que enviou
      endToEndId: transactionData.hash
    };

    // Processa usando a mesma lógica do webhook
    const { processWebhook } = require('../services/stellarWebhookService');
    const result = await processWebhook(webhookData, null, req.ip, null);

    if (!result || !result.success) {
      // Se já foi processado, retorna sucesso (idempotência)
      if (result?.message?.includes('já foi processada')) {
        return res.status(200).json({
          success: true,
          message: 'Pagamento já foi confirmado anteriormente',
          hash: hash,
          txid: transactionData.txid
        });
      }

      return res.status(400).json({
        error: result?.error || 'Erro ao processar confirmação do pagamento',
        hash: hash
      });
    }

    console.log(`✅ Pagamento Stellar confirmado via frontend: ${hash}`);

    // Retorna sucesso
    res.status(200).json({
      success: true,
      message: 'Pagamento confirmado com sucesso',
      hash: hash,
      txid: transactionData.txid,
      valor: transactionData.valor,
      currency: transactionData.currency,
      transacao: {
        id: result.transacao?.id,
        status: result.transacao?.status,
        confirmado_em: result.transacao?.confirmado_em
      }
    });

  } catch (error) {
    console.error('❌ Erro inesperado no endpoint /api/confirm-donation:', error.message);
    res.status(500).json({
      error: 'Erro interno do servidor.',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/validar-cartao
 * Valida um cartão usando autorização Zero Dollar
 * Body: { 
 *   cardToken: string, // Token do cartão
 *   bandeira?: string // Bandeira do cartão (opcional)
 * }
 */
router.post('/validar-cartao', createChargeLimiter, async (req, res) => {
  try {
    const { cardToken, bandeira } = req.body;

    // Validação do token
    if (!cardToken || typeof cardToken !== 'string') {
      return res.status(400).json({
        error: 'Token do cartão é obrigatório.'
      });
    }

    // Gera um TXID único para a validação
    const txid = `validacao${Date.now()}${Math.random().toString(36).substring(2, 9)}`;

    // Realiza autorização Zero Dollar
    const validacao = await authorizeZeroDollar(cardToken, txid, bandeira);

    if (!validacao || validacao.status !== 'APROVADO') {
      return res.status(400).json({
        success: false,
        error: 'Cartão inválido ou não autorizado.',
        details: validacao?.returnMessage || null
      });
    }

    res.status(200).json({
      success: true,
      message: 'Cartão validado com sucesso',
      validacao: {
        status: validacao.status,
        bandeira: validacao.bandeira,
        authorizationCode: validacao.authorizationCode,
        validatedAt: validacao.validatedAt
      }
    });

  } catch (error) {
    console.error('❌ Erro inesperado no endpoint /api/validar-cartao:', error.message);
    res.status(500).json({
      error: 'Erro interno do servidor.',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/cancelar-cobranca
 * 
 * Cancela (estorna) uma transação total ou parcialmente
 * Documentação: Manual p.72-75
 * 
 * Regras:
 * - Crédito: até 90 dias
 * - Débito: até 7 dias
 * - Mesmo dia: processamento imediato
 * - D+1: processamento no dia seguinte
 * - Após 21:30: processamento no dia seguinte
 * - Maestro: apenas UMA parcial permitida
 */
router.post('/cancelar-cobranca', async (req, res) => {
  try {
    const { tid, valor, callbackUrl } = req.body;

    // Validações
    if (!tid || typeof tid !== 'string') {
      return res.status(400).json({
        error: 'TID é obrigatório',
        message: 'Informe o TID da transação a ser cancelada'
      });
    }

    // Valor opcional (se não informado, cancela totalmente)
    let valorCentavos = null;
    if (valor !== undefined && valor !== null) {
      if (typeof valor !== 'number' || valor <= 0) {
        return res.status(400).json({
          error: 'Valor inválido',
          message: 'O valor deve ser um número positivo'
        });
      }
      valorCentavos = Math.round(valor * 100); // Converte para centavos
    }

    console.log(`\n🔄 Cancelamento solicitado para TID: ${tid}${valorCentavos ? ` - Valor: R$ ${(valorCentavos / 100).toFixed(2)}` : ' (total)'}`);

    // Executa cancelamento
    const resultado = await cancelTransaction(tid, valorCentavos, callbackUrl);

    if (!resultado) {
      return res.status(422).json({
        error: 'Falha ao cancelar transação',
        message: 'Verifique os logs para mais detalhes'
      });
    }

    // Retorna resultado do cancelamento
    res.status(200).json({
      sucesso: true,
      cancelamento: {
        refundId: resultado.refundId,
        tid: resultado.tid,
        nsu: resultado.nsu,
        cancelId: resultado.cancelId,
        status: resultado.status, // Processing, Done, Denied
        valor: valorCentavos ? (valorCentavos / 100) : null,
        refundDateTime: resultado.refundDateTime,
        returnCode: resultado.returnCode,
        returnMessage: resultado.returnMessage
      },
      observacoes: {
        processamento: resultado.cancelId
          ? 'Cancelamento D+1 - será processado no próximo dia útil'
          : 'Cancelamento sendo processado',
        callback: callbackUrl
          ? `Resultado final será enviado para ${callbackUrl}`
          : 'Consulte o status via API de consulta'
      }
    });

  } catch (error) {
    console.error('❌ Erro inesperado no endpoint /api/cancelar-cobranca:', error.message);
    res.status(500).json({
      error: 'Erro interno do servidor.',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Endpoint de callback 3DS
 * Recebe callbacks da e-Rede após autenticação 3DS
 * Conforme documentação: POST /api/3ds/callback
 * Content-Type: application/x-www-form-urlencoded ou application/json
 */
router.post('/3ds/callback', async (req, res) => {
  try {
    console.log('\n📞 Callback 3DS recebido');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));

    // Extrai dados do callback (pode vir como form-urlencoded ou JSON)
    const callbackData = req.body;
    
    // Valida campos obrigatórios
    if (!callbackData.reference && !callbackData.tid) {
      console.error('❌ Callback 3DS inválido: falta reference ou tid');
      return res.status(400).json({
        error: 'Dados inválidos',
        message: 'reference ou tid são obrigatórios'
      });
    }

    const reference = callbackData.reference;
    const tid = callbackData.tid;
    const threeDSecureReturnCode = callbackData.threeDSecure?.returnCode || callbackData['threeDSecure.returnCode'];
    const returnCode = callbackData.returnCode;
    const returnMessage = callbackData.returnMessage;

    console.log(`📋 Dados do callback:`);
    console.log(`   Reference: ${reference}`);
    console.log(`   TID: ${tid}`);
    console.log(`   3DS ReturnCode: ${threeDSecureReturnCode}`);
    console.log(`   ReturnCode: ${returnCode}`);
    console.log(`   ReturnMessage: ${returnMessage}`);

    // Busca cobrança no banco por reference (que é o txid) ou tid
    let cobranca = null;
    if (reference) {
      // reference é o txid
      cobranca = await getCobranca(reference);
    }
    if (!cobranca && tid) {
      // Se não encontrou por reference, tenta buscar por provider_tid ou rede_tid
      // Precisamos fazer uma query direta no banco
      try {
        const { sql } = require('../config/database');
        const result = await sql`
          SELECT * FROM cobrancas 
          WHERE provider_tid = ${tid} OR rede_tid = ${tid}
          LIMIT 1
        `;
        if (result.rows && result.rows.length > 0) {
          cobranca = result.rows[0];
        }
      } catch (error) {
        console.error('❌ Erro ao buscar cobrança por tid:', error.message);
      }
    }

    if (!cobranca) {
      console.error(`❌ Cobrança não encontrada: reference=${reference}, tid=${tid}`);
      // Retorna 200 mesmo assim (e-Rede espera confirmação)
      return res.status(200).json({ received: true });
    }

    console.log(`✅ Cobrança encontrada: txid=${cobranca.txid}, status=${cobranca.status}`);

    // Verifica se já foi processada (idempotência)
    if (cobranca.status === 'CONFIRMADA' || cobranca.status === 'NEGADA') {
      console.log(`⚠️  Callback já processado anteriormente. Status atual: ${cobranca.status}`);
      return res.status(200).json({ received: true, alreadyProcessed: true });
    }

    // Verifica autenticação 3DS
    // threeDSecure.returnCode indica o resultado da autenticação 3DS
    // Códigos de sucesso: '00', 'Y', '200' (Cardholder successfully authenticated)
    // Código '200' é usado pela e-Rede para indicar autenticação bem-sucedida
    const threeDSAuthenticated = threeDSecureReturnCode === '00' || 
                                  threeDSecureReturnCode === 'Y' || 
                                  threeDSecureReturnCode === '200';
    
    if (!threeDSAuthenticated) {
      console.log(`❌ Autenticação 3DS falhou. 3DS ReturnCode: ${threeDSecureReturnCode}`);
      
      // Atualiza status da cobrança para NEGADA
      await saveCobranca({
        txid: cobranca.txid,
        tipoPagamento: cobranca.tipo_pagamento,
        provider: cobranca.provider,
        valor: cobranca.valor,
        status: 'NEGADA',
        cryptoCurrency: cobranca.crypto_currency,
        cryptoAddress: cobranca.crypto_address,
        dadosPagamento: cobranca.dados_pagamento,
        dadosDoadorTemp: cobranca.dados_doador_temp,
        redeTid: cobranca.rede_tid,
        providerTid: cobranca.provider_tid,
        campanhaId: cobranca.campanha_id
      });

      return res.status(200).json({ received: true, authenticated: false });
    }

    console.log(`✅ Autenticação 3DS bem-sucedida`);

    // IMPORTANTE: O callback já contém todos os dados necessários da transação
    // Não precisamos consultar novamente - os dados já estão no callback
    // O callback vem com: returnCode, returnMessage, authorizationCode, etc.
    const foiAutorizada = returnCode === '00';
    
    console.log(`📊 Status da transação (do callback):`);
    console.log(`   ReturnCode: ${returnCode}`);
    console.log(`   ReturnMessage: ${returnMessage}`);
    console.log(`   AuthorizationCode: ${callbackData.authorizationCode || 'N/A'}`);
    console.log(`   TID: ${tid}`);
    
    if (!foiAutorizada) {
      console.log(`❌ Transação não foi autorizada. ReturnCode: ${transactionData.returnCode}`);
      
      // Atualiza status da cobrança para NEGADA
      await saveCobranca({
        txid: cobranca.txid,
        tipoPagamento: cobranca.tipo_pagamento,
        provider: cobranca.provider,
        valor: cobranca.valor,
        status: 'NEGADA',
        cryptoCurrency: cobranca.crypto_currency,
        cryptoAddress: cobranca.crypto_address,
        dadosPagamento: cobranca.dados_pagamento,
        dadosDoadorTemp: cobranca.dados_doador_temp,
        redeTid: cobranca.rede_tid,
        providerTid: cobranca.provider_tid,
        campanhaId: cobranca.campanha_id
      });

      return res.status(200).json({ received: true, authorized: false });
    }

    console.log(`✅ Transação autorizada. Verificando se precisa capturar...`);

    // IMPORTANTE: Para DÉBITO, a captura já é automática (capture: true na criação)
    // Para CRÉDITO, precisamos capturar manualmente após autorização
    let captureResult = null;
    let foiCapturada = false;
    
    if (cobranca.tipo_pagamento === 'DEBITO') {
      // Débito já é capturado automaticamente na autorização
      console.log(`ℹ️  Transação de DÉBITO - captura já foi feita automaticamente na autorização`);
      foiCapturada = true;
      // Usa os dados do callback como se fosse resultado da captura
      // Converte date (YYYYMMDD) e time (HH:mm:ss) para ISO format
      let dateTimeISO = new Date().toISOString(); // fallback
      if (callbackData.date && callbackData.time) {
        try {
          // callbackData.date vem como "20251204" (YYYYMMDD)
          // callbackData.time vem como "21:04:24" (HH:mm:ss)
          const year = callbackData.date.substring(0, 4);
          const month = callbackData.date.substring(4, 6);
          const day = callbackData.date.substring(6, 8);
          // Constrói data no formato ISO: YYYY-MM-DDTHH:mm:ss
          dateTimeISO = `${year}-${month}-${day}T${callbackData.time}`;
          // Valida se é uma data válida
          const dateObj = new Date(dateTimeISO);
          if (isNaN(dateObj.getTime())) {
            console.warn(`⚠️  Data inválida do callback, usando data atual: ${dateTimeISO}`);
            dateTimeISO = new Date().toISOString();
          } else {
            dateTimeISO = dateObj.toISOString();
          }
        } catch (error) {
          console.warn(`⚠️  Erro ao converter data do callback: ${error.message}`);
          dateTimeISO = new Date().toISOString();
        }
      }
      captureResult = {
        returnCode: returnCode,
        returnMessage: returnMessage,
        authorizationCode: callbackData.authorizationCode,
        dateTime: dateTimeISO
      };
    } else {
      // Para CRÉDITO, faz captura manual
      console.log(`💰 Fazendo captura manual para transação de CRÉDITO...`);
      const amountCentavos = Math.round(cobranca.valor * 100);
      captureResult = await captureTransaction(tid, amountCentavos);

      if (!captureResult || captureResult.returnCode !== '00') {
        // Se erro 171 (Operation not allowed), pode ser que já foi capturada
        if (captureResult?.returnCode === '171') {
          console.log(`ℹ️  Erro 171: Transação pode já ter sido capturada. Processando como confirmada...`);
          foiCapturada = true;
          // Usa dados do callback como fallback
          // Converte date (YYYYMMDD) e time (HH:mm:ss) para ISO format
          let dateTimeISO = new Date().toISOString(); // fallback
          if (callbackData.date && callbackData.time) {
            try {
              // callbackData.date vem como "20251204" (YYYYMMDD)
              // callbackData.time vem como "21:04:24" (HH:mm:ss)
              const year = callbackData.date.substring(0, 4);
              const month = callbackData.date.substring(4, 6);
              const day = callbackData.date.substring(6, 8);
              // Constrói data no formato ISO: YYYY-MM-DDTHH:mm:ss
              dateTimeISO = `${year}-${month}-${day}T${callbackData.time}`;
              // Valida se é uma data válida
              const dateObj = new Date(dateTimeISO);
              if (isNaN(dateObj.getTime())) {
                console.warn(`⚠️  Data inválida do callback, usando data atual: ${dateTimeISO}`);
                dateTimeISO = new Date().toISOString();
              } else {
                dateTimeISO = dateObj.toISOString();
              }
            } catch (error) {
              console.warn(`⚠️  Erro ao converter data do callback: ${error.message}`);
              dateTimeISO = new Date().toISOString();
            }
          }
          captureResult = {
            returnCode: returnCode,
            returnMessage: returnMessage,
            authorizationCode: callbackData.authorizationCode,
            dateTime: dateTimeISO
          };
        } else {
          console.error(`❌ Falha ao capturar transação`);
          console.error(`   ReturnCode: ${captureResult?.returnCode || 'N/A'}`);
          console.error(`   ReturnMessage: ${captureResult?.returnMessage || 'N/A'}`);
          
          // Loga erro mas mantém transação como AUTORIZADA (pode tentar capturar depois)
          // Não atualiza status para não perder a autorização
          return res.status(200).json({ 
            received: true, 
            authorized: true, 
            captured: false,
            error: 'Capture failed but transaction is authorized'
          });
        }
      } else {
        foiCapturada = true;
        console.log(`✅ Transação capturada com sucesso`);
      }
    }

    // Processa transação confirmada (salva doador e cria entrada em transacoes)
    const webhookData = {
      txid: cobranca.txid,
      rede_tid: tid,
      provider_tid: tid,
      provider: cobranca.provider || 'REDE',
      tipo_pagamento: cobranca.tipo_pagamento,
      valor: cobranca.valor,
      status: 'CONFIRMADA',
      horario: (() => {
        // Se captureResult tem dateTime, usa ele
        if (captureResult?.dateTime) {
          return captureResult.dateTime;
        }
        // Senão, tenta construir a partir do callback
        if (callbackData.date && callbackData.time) {
          try {
            // callbackData.date vem como "20251204" (YYYYMMDD)
            // callbackData.time vem como "21:04:24" (HH:mm:ss)
            const year = callbackData.date.substring(0, 4);
            const month = callbackData.date.substring(4, 6);
            const day = callbackData.date.substring(6, 8);
            // Constrói data no formato ISO: YYYY-MM-DDTHH:mm:ss
            const dateTimeStr = `${year}-${month}-${day}T${callbackData.time}`;
            // Valida se é uma data válida
            const dateObj = new Date(dateTimeStr);
            if (!isNaN(dateObj.getTime())) {
              return dateObj.toISOString();
            }
          } catch (error) {
            console.warn(`⚠️  Erro ao converter data do callback para horario: ${error.message}`);
          }
        }
        // Fallback: usa data atual
        return new Date().toISOString();
      })(),
      bandeira: cobranca.dados_pagamento?.bandeira || null,
      parcelas: cobranca.dados_pagamento?.parcelas || null,
      authorizationCode: captureResult?.authorizationCode || callbackData.authorizationCode
    };

    // dados_doador_temp pode vir como string (JSON) ou objeto (JSONB parse automático)
    let dadosDoadorTemp = null;
    if (cobranca.dados_doador_temp) {
      if (typeof cobranca.dados_doador_temp === 'string') {
        try {
          dadosDoadorTemp = JSON.parse(cobranca.dados_doador_temp);
        } catch (error) {
          console.warn('⚠️  Erro ao fazer parse de dados_doador_temp:', error.message);
          dadosDoadorTemp = null;
        }
      } else {
        // Já é um objeto (JSONB foi parseado automaticamente)
        dadosDoadorTemp = cobranca.dados_doador_temp;
      }
    }
    
    const transacaoProcessada = await processConfirmedTransaction(webhookData, dadosDoadorTemp);

    if (transacaoProcessada && transacaoProcessada.transacao) {
      console.log(`✅ Transação processada e confirmada no banco de dados`);
      console.log(`   - Transação ID: ${transacaoProcessada.transacao.id}`);
      console.log(`   - Status da cobrança atualizado para: CONFIRMADA`);
    } else {
      console.error(`⚠️  Transação capturada mas houve erro ao processar no banco`);
      // Mesmo com erro, retorna sucesso para e-Rede (idempotência)
    }

    // IMPORTANTE: processConfirmedTransaction já atualiza o status da cobrança para CONFIRMADA
    // O frontend que está fazendo polling vai detectar a mudança de status na próxima consulta

    // Retorna confirmação para e-Rede
    return res.status(200).json({ 
      received: true, 
      authenticated: true,
      authorized: true,
      captured: true,
      processed: !!transacaoProcessada
    });

  } catch (error) {
    console.error('❌ Erro inesperado no callback 3DS:', error.message);
    console.error(error.stack);
    
    // Retorna 200 mesmo em caso de erro (e-Rede espera confirmação)
    // Loga o erro para debugging
    return res.status(200).json({ 
      received: true, 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal error'
    });
  }
});

/**
 * GET /api/doadores
 * Lista doadores identificados (não anônimos)
 * Query params:
 *   - page: número da página (padrão: 1)
 *   - limit: itens por página (padrão: 50)
 */
router.get('/doadores', async (req, res) => {
  try {
    // Parâmetros de paginação (mantidos para limitar resultados, mas não retornados)
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    
    // Validação de parâmetros
    if (page < 1) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro inválido',
        message: 'page deve ser maior que 0'
      });
    }
    
    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro inválido',
        message: 'limit deve estar entre 1 e 100'
      });
    }
    
    const offset = (page - 1) * limit;
    
    // Busca doadores identificados
    const doadores = await getDoadoresIdentificados(limit, offset);
    
    // Retorna apenas nome e criado_em
    return res.status(200).json({
      success: true,
      data: doadores
    });
    
  } catch (error) {
    console.error('❌ Erro ao listar doadores:', error.message);
    console.error(error.stack);
    
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Erro ao buscar doadores'
    });
  }
});

module.exports = router;

