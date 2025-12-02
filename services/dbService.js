// Serviço de operações no banco de dados
const { sql } = require('../config/database');

/**
 * Salva uma cobrança no banco de dados
 * @param {Object} cobranca - Dados da cobrança
 * @returns {Object|null} Cobrança salva ou null em caso de erro
 */
async function saveCobranca(cobranca) {
  try {
    const { 
      txid, valor, status, campanhaId, tipoPagamento, provider, chavePix, brCode, expiracao, 
      redeTid, providerTid, dadosPagamento, cryptoCurrency, cryptoAddress, dadosDoadorTemp 
    } = cobranca;
    
    // Validação crítica
    if (!txid || typeof txid !== 'string' || txid.length < 10) {
      throw new Error(`TXID inválido: ${txid}`);
    }
    
    console.log(`\n💾 saveCobranca: Salvando cobrança:`);
    console.log(`   - txid: ${txid} (tamanho: ${txid?.length})`);
    console.log(`   - tipoPagamento: ${tipoPagamento}`);
    console.log(`   - provider: ${provider}`);
    console.log(`   - valor: ${valor}`);
    console.log(`   - status: ${status}`);
    console.log(`   - cryptoCurrency: ${cryptoCurrency}`);
    console.log(`   - cryptoAddress: ${cryptoAddress}`);
    
    // Verifica se sql está disponível
    if (!sql) {
      throw new Error('sql não está definido. Banco de dados não inicializado.');
    }
    
    // Usa provider_tid se fornecido, senão usa rede_tid (compatibilidade)
    const finalProviderTid = providerTid || redeTid || null;
    const finalProvider = provider || 'REDE';
    
    // @vercel/postgres trata JSONB automaticamente quando passamos um objeto
    const result = await sql`
      INSERT INTO cobrancas (
        txid, valor, status, campanha_id, tipo_pagamento, provider, chave_pix, brcode, expiracao, 
        rede_tid, provider_tid, dados_pagamento, crypto_currency, crypto_address, dados_doador_temp
      )
      VALUES (
        ${txid}, ${valor}, ${status}, ${campanhaId || null}, 
        ${tipoPagamento || 'PIX'}, ${finalProvider}, ${chavePix || null}, ${brCode}, ${expiracao}, 
        ${redeTid || null}, ${finalProviderTid}, ${dadosPagamento || null}, 
        ${cryptoCurrency || null}, ${cryptoAddress || null}, ${dadosDoadorTemp}
      )
      ON CONFLICT (txid) DO UPDATE SET
        status = EXCLUDED.status,
        brcode = EXCLUDED.brcode,
        tipo_pagamento = EXCLUDED.tipo_pagamento,
        provider = EXCLUDED.provider,
        rede_tid = COALESCE(EXCLUDED.rede_tid, cobrancas.rede_tid),
        provider_tid = COALESCE(EXCLUDED.provider_tid, cobrancas.provider_tid),
        dados_pagamento = EXCLUDED.dados_pagamento,
        crypto_currency = EXCLUDED.crypto_currency,
        crypto_address = EXCLUDED.crypto_address,
        dados_doador_temp = EXCLUDED.dados_doador_temp,
        atualizado_em = CURRENT_TIMESTAMP
      RETURNING txid, tipo_pagamento, provider, status, criado_em
    `;
    
    if (result.rows && result.rows.length > 0) {
      console.log(`✅ Cobrança ${txid} salva no banco de dados (${result.rows[0].tipo_pagamento}, ${result.rows[0].provider})`);
      
      // VERIFICAÇÃO CRÍTICA: Confirma que a cobrança realmente foi salva
      const cobrancaVerificada = await getCobranca(txid);
      if (!cobrancaVerificada) {
        console.error(`❌ ERRO CRÍTICO: Cobrança salva mas não encontrada imediatamente após INSERT: ${txid}`);
        throw new Error(`Falha ao verificar cobrança salva: ${txid}`);
      }
      
      console.log(`✅ Cobrança ${txid} verificada e confirmada no banco`);
      return { txid, valor, status, tipoPagamento: tipoPagamento || 'PIX', provider: finalProvider };
    } else {
      console.error(`❌ ERRO CRÍTICO: INSERT executado mas nenhuma linha retornada para txid: ${txid}`);
      throw new Error(`Falha ao salvar cobrança: nenhuma linha retornada para ${txid}`);
    }
  } catch (error) {
    console.error('❌ Erro ao salvar cobrança no banco:', error.message);
    console.error('   Stack:', error.stack);
    console.error('   Dados da cobrança:', JSON.stringify({ txid, tipoPagamento, provider, valor }, null, 2));
    throw error; // Lança o erro em vez de retornar null
  }
}

/**
 * Busca uma cobrança pelo txid
 * @param {string} txid - Identificador da transação
 * @returns {Object|null} Cobrança encontrada ou null
 */
async function getCobranca(txid) {
  try {
    if (!txid || typeof txid !== 'string') {
      console.error(`❌ getCobranca: txid inválido: ${txid}`);
      return null;
    }
    
    console.log(`🔍 getCobranca: buscando txid="${txid}" (tamanho: ${txid?.length})`);
    
    // Verifica se sql está disponível
    if (!sql) {
      console.error(`❌ getCobranca: sql não está definido. Banco não inicializado.`);
      return null;
    }
    
    const result = await sql`
      SELECT * FROM cobrancas WHERE txid = ${txid}
    `;
    
    if (result.rows && result.rows.length > 0) {
      console.log(`✅ getCobranca: encontrada cobrança txid="${result.rows[0].txid}"`);
      console.log(`   - Tipo: ${result.rows[0].tipo_pagamento}, Provider: ${result.rows[0].provider}`);
      console.log(`   - Status: ${result.rows[0].status}, Valor: ${result.rows[0].valor}`);
      return result.rows[0];
    } else {
      console.log(`⚠️  getCobranca: nenhuma cobrança encontrada com txid="${txid}"`);
      // Debug: lista algumas cobranças recentes para ver o formato
      try {
        const recent = await sql`
          SELECT txid, tipo_pagamento, provider, criado_em, status
          FROM cobrancas 
          WHERE tipo_pagamento = 'CRIPTO' 
          ORDER BY criado_em DESC 
          LIMIT 10
        `;
        if (recent.rows && recent.rows.length > 0) {
          console.log(`📋 Cobranças CRIPTO recentes (últimas 10):`);
          recent.rows.forEach((r, i) => {
            console.log(`   ${i + 1}. txid="${r.txid}" (tamanho: ${r.txid?.length}), provider="${r.provider}", status="${r.status}"`);
          });
        } else {
          console.log(`⚠️  Nenhuma cobrança CRIPTO encontrada no banco`);
        }
      } catch (debugError) {
        console.error(`❌ Erro ao buscar cobranças recentes para debug:`, debugError.message);
      }
      return null;
    }
  } catch (error) {
    console.error('❌ Erro ao buscar cobrança:', error.message);
    console.error('   Stack:', error.stack);
    return null;
  }
}

/**
 * Atualiza o status de uma cobrança
 * @param {string} txid - Identificador da transação
 * @param {string} status - Novo status
 * @returns {boolean} true se atualizado com sucesso
 */
async function updateCobrancaStatus(txid, status) {
  try {
    await sql`
      UPDATE cobrancas 
      SET status = ${status}, atualizado_em = CURRENT_TIMESTAMP
      WHERE txid = ${txid}
    `;
    
    console.log(`✅ Status da cobrança ${txid} atualizado para ${status}`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar status da cobrança:', error.message);
    return false;
  }
}

/**
 * Cria ou atualiza um doador
 * @param {Object} doadorData - Dados do doador
 * @returns {Object|null} Doador criado/atualizado ou null
 */
async function saveDoador(doadorData) {
  try {
    const { nome, whatsapp, anonimo } = doadorData;
    
    // Se for anônimo, não salva dados pessoais
    if (anonimo) {
      const result = await sql`
        INSERT INTO doadores (anonimo)
        VALUES (true)
        RETURNING id
      `;
      return { id: result.rows[0].id, anonimo: true };
    }
    
    // Se não for anônimo, salva os dados fornecidos
    // Validação: deve ter nome E whatsapp (já validado na rota, mas garantimos aqui também)
    const temNome = nome && nome.trim().length > 0;
    const temWhatsapp = whatsapp && whatsapp.trim().length > 0;
    
    if (!temNome) {
      throw new Error('Doador identificado deve ter nome');
    }
    
    if (!temWhatsapp) {
      throw new Error('Doador identificado deve ter WhatsApp');
    }
    
    const result = await sql`
      INSERT INTO doadores (nome, whatsapp, anonimo)
      VALUES (${nome}, ${whatsapp}, false)
      RETURNING id, nome, whatsapp, anonimo
    `;
    
    console.log(`✅ Doador salvo no banco de dados (ID: ${result.rows[0].id})`);
    return result.rows[0];
  } catch (error) {
    console.error('❌ Erro ao salvar doador:', error.message);
    return null;
  }
}

/**
 * Processa uma transação confirmada via webhook usando controle de transação
 * Garante que os dados do doador só sejam salvos após confirmação do pagamento
 * @param {Object} webhookData - Dados recebidos do webhook
 * @param {Object} doadorData - Dados opcionais do doador
 * @returns {Object|null} Transação processada ou null em caso de erro
 */
async function processConfirmedTransaction(webhookData, doadorData = null) {
  try {
    const { 
      txid, rede_tid, provider_tid, provider, tipo_pagamento, valor, status, horario, 
      bandeira, parcelas, crypto_currency, crypto_address, endToEndId 
    } = webhookData;
    
    // @vercel/postgres não suporta transações tradicionais com BEGIN/COMMIT
    // Fazemos as operações sequencialmente e garantimos atomicidade através da lógica
    
    // 1. Verifica se a cobrança existe e obtém dados do doador temporários
    // Busca por txid, provider_tid ou rede_tid (compatibilidade)
    let cobranca = null;
    const finalProviderTid = provider_tid || rede_tid || null;
    
    if (txid) {
      cobranca = await sql`
        SELECT * FROM cobrancas WHERE txid = ${txid}
      `;
    }
    
    // Se não encontrou por txid, tenta por provider_tid
    if ((!cobranca || cobranca.rows.length === 0) && finalProviderTid) {
      console.log(`🔍 Buscando cobrança por provider_tid: ${finalProviderTid}`);
      cobranca = await sql`
        SELECT * FROM cobrancas WHERE provider_tid = ${finalProviderTid}
      `;
    }
    
    // Se não encontrou por provider_tid, tenta por rede_tid (compatibilidade)
    if ((!cobranca || cobranca.rows.length === 0) && rede_tid) {
      console.log(`🔍 Buscando cobrança por rede_tid: ${rede_tid}`);
      cobranca = await sql`
        SELECT * FROM cobrancas WHERE rede_tid = ${rede_tid}
      `;
    }
    
    // Se ainda não encontrou, tenta buscar por memo (para Stellar, o memo pode ser o txid)
    if ((!cobranca || cobranca.rows.length === 0) && txid) {
      console.log(`🔍 Buscando cobrança por txid (como memo): ${txid}`);
      // Tenta buscar todas as cobranças e verificar se o memo corresponde
      const allCobrancas = await sql`
        SELECT * FROM cobrancas WHERE tipo_pagamento = 'CRIPTO' AND provider = 'STELLAR'
        ORDER BY criado_em DESC
        LIMIT 50
      `;
      
      // Verifica se alguma cobrança tem memo que corresponde ao txid
      for (const c of allCobrancas.rows) {
        if (c.dados_pagamento && typeof c.dados_pagamento === 'object') {
          const memo = c.dados_pagamento.memo || c.dados_pagamento.paymentMemo;
          if (memo === txid) {
            console.log(`✅ Cobrança encontrada por memo: ${c.txid}`);
            cobranca = { rows: [c] };
            break;
          }
        }
      }
    }
    
    if (!cobranca || cobranca.rows.length === 0) {
      console.error(`❌ SEGURANÇA: Cobrança não encontrada - txid: ${txid}, provider_tid: ${finalProviderTid}, rede_tid: ${rede_tid}`);
      console.error(`   ⚠️  PAGAMENTO REJEITADO: Cobrança deve existir antes do pagamento ser processado`);
      throw new Error(`Cobrança ${txid || finalProviderTid || rede_tid} não encontrada. Pagamento rejeitado por segurança.`);
    }
    
    // Verifica se já foi processada (idempotência) - por txid, provider_tid ou rede_tid
    let existingTransacao = null;
    if (txid) {
      existingTransacao = await sql`
        SELECT * FROM transacoes WHERE cobranca_txid = ${txid} AND status = 'CONFIRMADA'
      `;
    }
    if ((!existingTransacao || existingTransacao.rows.length === 0) && finalProviderTid) {
      existingTransacao = await sql`
        SELECT * FROM transacoes WHERE provider_tid = ${finalProviderTid} AND status = 'CONFIRMADA'
      `;
    }
    if ((!existingTransacao || existingTransacao.rows.length === 0) && rede_tid) {
      existingTransacao = await sql`
        SELECT * FROM transacoes WHERE rede_tid = ${rede_tid} AND status = 'CONFIRMADA'
      `;
    }
    
    if (existingTransacao && existingTransacao.rows.length > 0) {
      console.log(`ℹ️  Transação ${txid || finalProviderTid || rede_tid} já foi processada anteriormente`);
      return {
        transacao: existingTransacao.rows[0],
        doador: existingTransacao.rows[0].doador_id ? { id: existingTransacao.rows[0].doador_id } : null
      };
    }
    
    // 2. Recupera dados do doador da cobrança (se não fornecidos explicitamente)
    // JSONB pode vir como objeto ou string dependendo do driver, verifica tipo
    let dadosDoadorTemp = cobranca.rows[0].dados_doador_temp;
    if (dadosDoadorTemp && typeof dadosDoadorTemp === 'string') {
      try {
        dadosDoadorTemp = JSON.parse(dadosDoadorTemp);
      } catch (error) {
        console.warn('⚠️  Erro ao fazer parse de dados_doador_temp:', error.message);
        dadosDoadorTemp = null;
      }
    }
    const dadosDoadorFinal = doadorData || dadosDoadorTemp || null;
    
    // 3. Cria o doador APENAS APÓS confirmação do pagamento (se dados fornecidos)
    // IMPORTANTE: Esta é a única função que salva dados do doador no banco
    // Os dados só são persistidos quando o webhook confirma o pagamento
    let doadorId = null;
    if (dadosDoadorFinal) {
      const { nome, whatsapp, anonimo } = dadosDoadorFinal;
      
      try {
        if (anonimo === true || anonimo === undefined || anonimo === null) {
          // Doador anônimo
          const doadorResult = await sql`
            INSERT INTO doadores (anonimo)
            VALUES (true)
            RETURNING id
          `;
          doadorId = doadorResult.rows[0].id;
        } else {
          // Doador identificado (anonimo === false) - deve ter nome E whatsapp (já validado na criação)
          const temNome = nome && nome.trim().length > 0;
          const temWhatsapp = whatsapp && whatsapp.trim().length > 0;
          
          if (!temNome || !temWhatsapp) {
            console.warn(`⚠️  Doador identificado sem nome ou WhatsApp para txid ${txid}`);
            // Cria como anônimo se não tiver dados obrigatórios
            const doadorResult = await sql`
              INSERT INTO doadores (anonimo)
              VALUES (true)
              RETURNING id
            `;
            doadorId = doadorResult.rows[0].id;
          } else {
            const doadorResult = await sql`
              INSERT INTO doadores (nome, whatsapp, anonimo)
              VALUES (${nome}, ${whatsapp}, false)
              RETURNING id
            `;
            doadorId = doadorResult.rows[0].id;
          }
        }
      } catch (error) {
        console.error('❌ Erro ao criar doador:', error.message);
        // Continua mesmo se falhar ao criar doador (pode ser duplicado, etc)
      }
    }
    
    // 4. Cria o registro de transação confirmada
    const txidFinal = txid || cobranca.rows[0].txid;
    const finalProvider = provider || cobranca.rows[0].provider || 'REDE';
    const finalProviderTidForTransaction = provider_tid || rede_tid || null;
    
    const transacaoResult = await sql`
      INSERT INTO transacoes (
        cobranca_txid, 
        doador_id, 
        valor, 
        status,
        tipo_pagamento,
        provider,
        rede_tid,
        provider_tid,
        bandeira_cartao,
        parcelas,
        crypto_currency,
        crypto_address,
        confirmado_em, 
        dados_webhook
      )
      VALUES (
        ${txidFinal}, 
        ${doadorId}, 
        ${valor}, 
        ${status},
        ${tipo_pagamento || 'PIX'},
        ${finalProvider},
        ${rede_tid || null},
        ${finalProviderTidForTransaction},
        ${bandeira || null},
        ${parcelas || null},
        ${crypto_currency || null},
        ${crypto_address || null},
        ${horario ? new Date(horario) : new Date()}, 
        ${JSON.stringify(webhookData)}
      )
      RETURNING id, cobranca_txid, doador_id, valor, status, tipo_pagamento, provider, provider_tid, confirmado_em
    `;
    
    // 5. Atualiza o status da cobrança e remove dados temporários (última operação)
    await sql`
      UPDATE cobrancas 
      SET status = ${status}, 
          provider = COALESCE(${finalProvider}, provider),
          rede_tid = COALESCE(${rede_tid || null}, rede_tid),
          provider_tid = COALESCE(${finalProviderTidForTransaction}, provider_tid),
          tipo_pagamento = COALESCE(${tipo_pagamento || null}, tipo_pagamento),
          crypto_currency = COALESCE(${crypto_currency || null}, crypto_currency),
          crypto_address = COALESCE(${crypto_address || null}, crypto_address),
          atualizado_em = CURRENT_TIMESTAMP,
          dados_doador_temp = NULL
      WHERE txid = ${txidFinal}
    `;
    
    console.log(`✅ Transação ${txidFinal} processada e confirmada no banco de dados`);
    
    return {
      transacao: transacaoResult.rows[0],
      doador: doadorId ? { id: doadorId } : null
    };
    
  } catch (error) {
    console.error('❌ Erro ao processar transação:', error.message);
    return null;
  }
}

/**
 * Busca uma transação pelo txid
 * @param {string} txid - Identificador da transação
 * @returns {Object|null} Transação encontrada ou null
 */
async function getTransacao(txid) {
  try {
    const result = await sql`
      SELECT 
        t.*,
        c.valor as valor_cobranca,
        c.status as status_cobranca,
        c.campanha_id,
        d.nome as doador_nome,
        d.whatsapp as doador_whatsapp,
        d.anonimo as doador_anonimo
      FROM transacoes t
      LEFT JOIN cobrancas c ON t.cobranca_txid = c.txid
      LEFT JOIN doadores d ON t.doador_id = d.id
      WHERE t.cobranca_txid = ${txid}
      ORDER BY t.criado_em DESC
      LIMIT 1
    `;
    
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('❌ Erro ao buscar transação:', error.message);
    return null;
  }
}

/**
 * Busca uma transação pelo rede_tid
 * @param {string} rede_tid - Transaction ID da e-Rede
 * @returns {Object|null} Transação encontrada ou null
 */
async function getTransacaoByRedeTid(rede_tid) {
  try {
    const result = await sql`
      SELECT 
        t.*,
        c.valor as valor_cobranca,
        c.status as status_cobranca,
        c.campanha_id,
        d.nome as doador_nome,
        d.whatsapp as doador_whatsapp,
        d.anonimo as doador_anonimo
      FROM transacoes t
      LEFT JOIN cobrancas c ON t.cobranca_txid = c.txid
      LEFT JOIN doadores d ON t.doador_id = d.id
      WHERE t.rede_tid = ${rede_tid}
      ORDER BY t.criado_em DESC
      LIMIT 1
    `;
    
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('❌ Erro ao buscar transação por rede_tid:', error.message);
    return null;
  }
}

/**
 * Busca uma transação pelo provider_tid (genérico para qualquer provider)
 * @param {string} provider_tid - Transaction ID do provider
 * @returns {Object|null} Transação encontrada ou null
 */
async function getTransacaoByProviderTid(provider_tid) {
  try {
    const result = await sql`
      SELECT 
        t.*,
        c.valor as valor_cobranca,
        c.status as status_cobranca,
        c.campanha_id,
        d.nome as doador_nome,
        d.whatsapp as doador_whatsapp,
        d.anonimo as doador_anonimo
      FROM transacoes t
      LEFT JOIN cobrancas c ON t.cobranca_txid = c.txid
      LEFT JOIN doadores d ON t.doador_id = d.id
      WHERE t.provider_tid = ${provider_tid}
      ORDER BY t.criado_em DESC
      LIMIT 1
    `;
    
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('❌ Erro ao buscar transação por provider_tid:', error.message);
    return null;
  }
}

module.exports = {
  saveCobranca,
  getCobranca,
  updateCobrancaStatus,
  saveDoador,
  processConfirmedTransaction,
  getTransacao,
  getTransacaoByRedeTid,
  getTransacaoByProviderTid
};

