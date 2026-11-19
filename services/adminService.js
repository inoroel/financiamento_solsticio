// Serviço de administração, controle de acesso por e-mail e auditoria de estornos
const { sql } = require('../config/database');

const ROOT_ADMIN_EMAIL = (process.env.ROOT_ADMIN_EMAIL || 'inoroel@gmail.com').trim().toLowerCase();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let ensureTablesPromise = null;

function createServiceError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * Normaliza e valida um endereço de e-mail.
 * @param {string} email
 * @returns {string|null}
 */
function normalizeEmail(email) {
  if (typeof email !== 'string') return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized || normalized.length > 255 || !EMAIL_REGEX.test(normalized)) {
    return null;
  }
  return normalized;
}

/**
 * Verifica se o e-mail informado é o administrador root.
 * @param {string} email
 * @returns {boolean}
 */
function isRootAdmin(email) {
  const normalized = normalizeEmail(email);
  return Boolean(normalized && normalized === ROOT_ADMIN_EMAIL);
}

/**
 * Lê e-mails adicionais definidos via variável de ambiente ADMIN_EMAILS.
 * @returns {string[]}
 */
function getEnvAdminEmails() {
  const raw = process.env.ADMIN_EMAILS || '';
  return raw
    .split(',')
    .map((item) => normalizeEmail(item))
    .filter(Boolean);
}

/**
 * Garante que as tabelas administrativas existam e que o root esteja cadastrado.
 * Memoizado por processo, mas limpa o cache em caso de falha transitória.
 * @returns {Promise<void>}
 */
async function ensureAdminTables() {
  if (ensureTablesPromise) {
    return ensureTablesPromise;
  }

  ensureTablesPromise = (async () => {
    if (!sql) {
      throw new Error('Conexão com banco de dados não inicializada.');
    }

    await sql`
      CREATE TABLE IF NOT EXISTS admin_users (
        email VARCHAR(255) PRIMARY KEY,
        role VARCHAR(20) NOT NULL DEFAULT 'admin',
        active BOOLEAN NOT NULL DEFAULT true,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT check_admin_role CHECK (role IN ('root', 'admin'))
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS estornos_log (
        id SERIAL PRIMARY KEY,
        tid VARCHAR(100) NOT NULL,
        cobranca_txid VARCHAR(35),
        valor_estornado DECIMAL(10, 2),
        estorno_total BOOLEAN NOT NULL DEFAULT true,
        refund_id VARCHAR(100),
        cancel_id VARCHAR(100),
        nsu VARCHAR(100),
        status VARCHAR(40) NOT NULL,
        return_code VARCHAR(20),
        return_message TEXT,
        admin_email VARCHAR(255) NOT NULL,
        motivo TEXT,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_estornos_log_tid ON estornos_log(tid)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_estornos_log_admin ON estornos_log(admin_email)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_estornos_log_criado_em ON estornos_log(criado_em DESC)`;

    await sql`
      INSERT INTO admin_users (email, role, active, created_by)
      VALUES (${ROOT_ADMIN_EMAIL}, 'root', true, 'system')
      ON CONFLICT (email) DO UPDATE
      SET role = 'root', active = true, updated_at = CURRENT_TIMESTAMP
    `;
  })().catch((error) => {
    ensureTablesPromise = null;
    throw error;
  });

  return ensureTablesPromise;
}

/**
 * Retorna o registro de administrador para o e-mail informado, ou null se não autorizado.
 * @param {string} email
 * @returns {Promise<{email: string, role: string, active: boolean, source: string}|null>}
 */
async function getAdminRecord(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return null;
  }

  if (isRootAdmin(normalized)) {
    ensureAdminTables().catch((err) => {
      console.warn('⚠️  Aviso ao sincronizar tabelas admin:', err.message);
    });
    return {
      email: ROOT_ADMIN_EMAIL,
      role: 'root',
      active: true,
      source: 'root'
    };
  }

  await ensureAdminTables();

  const result = await sql`
    SELECT email, role, active, created_by, created_at
    FROM admin_users
    WHERE email = ${normalized}
    LIMIT 1
  `;

  if (result.rows && result.rows.length > 0) {
    const row = result.rows[0];
    if (row.active === true) {
      return {
        email: row.email,
        role: row.role === 'root' ? 'root' : 'admin',
        active: true,
        created_by: row.created_by,
        created_at: row.created_at,
        source: 'database'
      };
    }
    return null;
  }

  if (getEnvAdminEmails().includes(normalized)) {
    return {
      email: normalized,
      role: 'admin',
      active: true,
      source: 'env'
    };
  }

  return null;
}

/**
 * Lista todos os administradores cadastrados (banco + root + ADMIN_EMAILS).
 * @returns {Promise<Array<Object>>}
 */
async function listAdmins() {
  await ensureAdminTables();

  const result = await sql`
    SELECT email, role, active, created_by, created_at, updated_at
    FROM admin_users
    ORDER BY CASE WHEN role = 'root' THEN 0 ELSE 1 END, email ASC
  `;

  const byEmail = new Map();
  for (const row of result.rows || []) {
    byEmail.set(row.email.toLowerCase(), {
      email: row.email.toLowerCase(),
      role: row.role,
      active: row.active,
      created_by: row.created_by || null,
      created_at: row.created_at || null,
      source: row.role === 'root' ? 'root' : 'database'
    });
  }

  if (!byEmail.has(ROOT_ADMIN_EMAIL)) {
    byEmail.set(ROOT_ADMIN_EMAIL, {
      email: ROOT_ADMIN_EMAIL,
      role: 'root',
      active: true,
      created_by: 'system',
      created_at: null,
      source: 'root'
    });
  }

  for (const envEmail of getEnvAdminEmails()) {
    if (!byEmail.has(envEmail)) {
      byEmail.set(envEmail, {
        email: envEmail,
        role: 'admin',
        active: true,
        created_by: 'env:ADMIN_EMAILS',
        created_at: null,
        source: 'env'
      });
    }
  }

  return Array.from(byEmail.values());
}

/**
 * Cadastra (ou reativa) um novo administrador no banco.
 * @param {string} email
 * @param {string} createdBy
 * @returns {Promise<Object>}
 */
async function addAdmin(email, createdBy) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    throw createServiceError('Informe um endereço de e-mail válido.', 400);
  }

  if (isRootAdmin(normalized)) {
    throw createServiceError('Este e-mail já é o administrador root.', 400);
  }

  await ensureAdminTables();

  const result = await sql`
    INSERT INTO admin_users (email, role, active, created_by, updated_at)
    VALUES (${normalized}, 'admin', true, ${createdBy || ROOT_ADMIN_EMAIL}, CURRENT_TIMESTAMP)
    ON CONFLICT (email) DO UPDATE
    SET active = true, updated_at = CURRENT_TIMESTAMP
    RETURNING email, role, active, created_by, created_at
  `;

  return {
    ...result.rows[0],
    source: 'database'
  };
}

/**
 * Remove um administrador do banco de dados (protege o root contra remoção).
 * @param {string} email
 * @returns {Promise<{removed: boolean, email: string, inEnvList: boolean}>}
 */
async function removeAdmin(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    throw createServiceError('E-mail inválido.', 400);
  }

  if (isRootAdmin(normalized)) {
    throw createServiceError('Não é possível remover o administrador root.', 400);
  }

  await ensureAdminTables();

  const result = await sql`
    DELETE FROM admin_users
    WHERE email = ${normalized} AND role <> 'root'
    RETURNING email
  `;

  const inEnvList = getEnvAdminEmails().includes(normalized);
  const removed = Boolean(result.rows && result.rows.length > 0);

  if (!removed && !inEnvList) {
    throw createServiceError('Administrador não encontrado.', 404);
  }

  return {
    removed,
    email: normalized,
    inEnvList
  };
}

/**
 * Busca uma cobrança local pelo TID da e-Rede.
 * @param {string} tid
 * @returns {Promise<Object|null>}
 */
async function getCobrancaByRedeTid(tid) {
  if (!tid || typeof tid !== 'string') return null;

  const result = await sql`
    SELECT txid, valor, status, tipo_pagamento, provider, rede_tid, provider_tid
    FROM cobrancas
    WHERE rede_tid = ${tid} OR provider_tid = ${tid}
    LIMIT 1
  `;

  return result.rows && result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Atualiza o status local da cobrança e transação após estorno total na e-Rede.
 * @param {string} txid
 * @param {Object} options
 * @param {boolean} options.estornoTotal
 * @param {string} options.status
 * @returns {Promise<boolean>}
 */
async function markRefundedInDatabase(txid, { estornoTotal, status }) {
  if (!txid || !estornoTotal) return false;

  const novoStatus = status === 'Done' ? 'ESTORNADA' : 'ESTORNO_PENDENTE';

  await sql`
    UPDATE cobrancas
    SET status = ${novoStatus}, atualizado_em = CURRENT_TIMESTAMP
    WHERE txid = ${txid}
  `;

  if (novoStatus === 'ESTORNADA') {
    await sql`
      UPDATE transacoes
      SET status = 'ESTORNADA'
      WHERE cobranca_txid = ${txid}
    `;
  }

  return true;
}

/**
 * Registra cada tentativa/execução de estorno na tabela de auditoria estornos_log.
 * @param {Object} entry
 * @returns {Promise<Object|null>}
 */
async function logEstorno({
  tid,
  cobrancaTxid = null,
  valorEstornado = null,
  estornoTotal = true,
  refundId = null,
  cancelId = null,
  nsu = null,
  status = 'ERROR',
  returnCode = null,
  returnMessage = null,
  adminEmail,
  motivo = null
}) {
  await ensureAdminTables();

  const result = await sql`
    INSERT INTO estornos_log (
      tid, cobranca_txid, valor_estornado, estorno_total,
      refund_id, cancel_id, nsu, status, return_code,
      return_message, admin_email, motivo
    )
    VALUES (
      ${tid},
      ${cobrancaTxid},
      ${valorEstornado},
      ${Boolean(estornoTotal)},
      ${refundId},
      ${cancelId},
      ${nsu},
      ${status},
      ${returnCode},
      ${returnMessage},
      ${adminEmail},
      ${motivo}
    )
    RETURNING *
  `;

  return result.rows && result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Lista o histórico de estornos executados.
 * @param {number} [limit=30]
 * @param {number} [offset=0]
 * @returns {Promise<Array<Object>>}
 */
async function listEstornos(limit = 30, offset = 0) {
  await ensureAdminTables();

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  const result = await sql`
    SELECT
      id, tid, cobranca_txid, valor_estornado, estorno_total,
      refund_id, cancel_id, nsu, status, return_code,
      return_message, admin_email, motivo, criado_em
    FROM estornos_log
    ORDER BY criado_em DESC
    LIMIT ${safeLimit}
    OFFSET ${safeOffset}
  `;

  return result.rows || [];
}

/**
 * Lista transações e-Rede do financiamento coletivo para o painel administrativo.
 * @param {Object} [params]
 * @returns {Promise<Array<Object>>}
 */
async function listTransactionsForAdmin({ search = '', status = '', limit = 25, offset = 0 } = {}) {
  await ensureAdminTables();

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);
  const searchTerm = typeof search === 'string' && search.trim() ? `%${search.trim()}%` : null;
  const statusFilter = typeof status === 'string' && status.trim() ? status.trim().toUpperCase() : null;

  const result = await sql`
    SELECT
      c.txid,
      COALESCE(c.rede_tid, c.provider_tid) AS tid,
      c.valor,
      c.status,
      c.tipo_pagamento,
      c.campanha_id,
      c.criado_em,
      c.atualizado_em,
      t.bandeira_cartao,
      t.parcelas,
      t.confirmado_em,
      CASE WHEN d.anonimo = false THEN d.nome ELSE 'Anônimo' END AS doador_nome,
      COALESCE(e.total_estornado, 0) AS total_estornado,
      COALESCE(e.qtd_estornos, 0)::INTEGER AS qtd_estornos
    FROM cobrancas c
    LEFT JOIN LATERAL (
      SELECT doador_id, bandeira_cartao, parcelas, confirmado_em
      FROM transacoes
      WHERE cobranca_txid = c.txid
      ORDER BY criado_em DESC
      LIMIT 1
    ) t ON true
    LEFT JOIN doadores d ON d.id = t.doador_id
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN status IN ('Done', 'Processing') THEN COALESCE(valor_estornado, c.valor)
              ELSE 0
            END
          ),
          0
        ) AS total_estornado,
        COUNT(*) FILTER (WHERE status IN ('Done', 'Processing')) AS qtd_estornos
      FROM estornos_log
      WHERE cobranca_txid = c.txid
         OR (c.rede_tid IS NOT NULL AND tid = c.rede_tid)
    ) e ON true
    WHERE c.provider = 'REDE'
      AND (${statusFilter}::text IS NULL OR UPPER(c.status) = ${statusFilter})
      AND (
        ${searchTerm}::text IS NULL
        OR c.txid ILIKE ${searchTerm}
        OR COALESCE(c.rede_tid, '') ILIKE ${searchTerm}
        OR COALESCE(c.provider_tid, '') ILIKE ${searchTerm}
        OR COALESCE(d.nome, '') ILIKE ${searchTerm}
      )
    ORDER BY c.criado_em DESC
    LIMIT ${safeLimit}
    OFFSET ${safeOffset}
  `;

  return result.rows || [];
}

module.exports = {
  ROOT_ADMIN_EMAIL,
  normalizeEmail,
  isRootAdmin,
  getEnvAdminEmails,
  ensureAdminTables,
  getAdminRecord,
  listAdmins,
  addAdmin,
  removeAdmin,
  getCobrancaByRedeTid,
  markRefundedInDatabase,
  logEstorno,
  listEstornos,
  listTransactionsForAdmin
};
