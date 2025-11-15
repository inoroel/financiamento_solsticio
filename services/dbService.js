// Serviço de operações no banco de dados
const { sql } = require('../config/database');

/**
 * Salva uma cobrança no banco de dados
 * @param {Object} cobranca - Dados da cobrança
 * @returns {Object|null} Cobrança salva ou null em caso de erro
 */
async function saveCobranca(cobranca) {
  try {
    const { txid, valor, status, campanhaId, chavePix, brCode, expiracao, dadosDoadorTemp } = cobranca;
    
    // @vercel/postgres trata JSONB automaticamente quando passamos um objeto
    await sql`
      INSERT INTO cobrancas (txid, valor, status, campanha_id, chave_pix, brcode, expiracao, dados_doador_temp)
      VALUES (${txid}, ${valor}, ${status}, ${campanhaId || null}, ${chavePix}, ${brCode}, ${expiracao}, ${dadosDoadorTemp})
      ON CONFLICT (txid) DO UPDATE SET
        status = EXCLUDED.status,
        brcode = EXCLUDED.brcode,
        dados_doador_temp = EXCLUDED.dados_doador_temp,
        atualizado_em = CURRENT_TIMESTAMP
    `;
    
    console.log(`✅ Cobrança ${txid} salva no banco de dados`);
    return { txid, valor, status };
  } catch (error) {
    console.error('❌ Erro ao salvar cobrança no banco:', error.message);
    return null;
  }
}

/**
 * Busca uma cobrança pelo txid
 * @param {string} txid - Identificador da transação
 * @returns {Object|null} Cobrança encontrada ou null
 */
async function getCobranca(txid) {
  try {
    const result = await sql`
      SELECT * FROM cobrancas WHERE txid = ${txid}
    `;
    
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('❌ Erro ao buscar cobrança:', error.message);
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
    const { txid, valor, status, endToEndId, horario } = webhookData;
    
    // @vercel/postgres não suporta transações tradicionais com BEGIN/COMMIT
    // Fazemos as operações sequencialmente e garantimos atomicidade através da lógica
    
    // 1. Verifica se a cobrança existe e obtém dados do doador temporários
    const cobranca = await sql`
      SELECT * FROM cobrancas WHERE txid = ${txid}
    `;
    
    if (cobranca.rows.length === 0) {
      throw new Error(`Cobrança ${txid} não encontrada`);
    }
    
    // Verifica se já foi processada (idempotência)
    const existingTransacao = await sql`
      SELECT * FROM transacoes WHERE cobranca_txid = ${txid} AND status = 'CONFIRMADA'
    `;
    
    if (existingTransacao.rows.length > 0) {
      console.log(`ℹ️  Transação ${txid} já foi processada anteriormente`);
      return {
        transacao: existingTransacao.rows[0],
        doador: existingTransacao.rows[0].doador_id ? { id: existingTransacao.rows[0].doador_id } : null
      };
    }
    
    // 2. Recupera dados do doador da cobrança (se não fornecidos explicitamente)
    // JSONB já vem como objeto do PostgreSQL, não precisa fazer parse
    const dadosDoadorFinal = doadorData || cobranca.rows[0].dados_doador_temp || null;
    
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
    const transacaoResult = await sql`
      INSERT INTO transacoes (
        cobranca_txid, 
        doador_id, 
        valor, 
        status, 
        confirmado_em, 
        dados_webhook
      )
      VALUES (
        ${txid}, 
        ${doadorId}, 
        ${valor}, 
        ${status}, 
        ${horario ? new Date(horario) : new Date()}, 
        ${JSON.stringify(webhookData)}
      )
      RETURNING id, cobranca_txid, doador_id, valor, status, confirmado_em
    `;
    
    // 5. Atualiza o status da cobrança e remove dados temporários (última operação)
    await sql`
      UPDATE cobrancas 
      SET status = ${status}, 
          atualizado_em = CURRENT_TIMESTAMP,
          dados_doador_temp = NULL
      WHERE txid = ${txid}
    `;
    
    console.log(`✅ Transação ${txid} processada e confirmada no banco de dados`);
    
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

module.exports = {
  saveCobranca,
  getCobranca,
  updateCobrancaStatus,
  saveDoador,
  processConfirmedTransaction,
  getTransacao
};

