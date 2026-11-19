// Serviço de administração, controle de acesso por e-mail e auditoria de estornos
const { sql } = require('../config/database');

const ROOT_ADMIN_EMAIL = (process.env.ROOT_ADMIN_EMAIL || 'inoroel@gmail.com').trim().toLowerCase();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OPERATIONAL_TABS = ['estornos', 'recompensas', 'metas', 'doacao'];
const USERS_TAB = 'usuarios';
const ALL_TABS = ['estornos', 'recompensas', 'metas', 'doacao', 'usuarios'];
const VALID_ROLES = ['root', 'admin', 'user'];

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
 * Normaliza a lista de abas permitidas armazenada no banco de acordo com o perfil.
 * @param {unknown} raw
 * @param {string} role
 * @returns {string[]}
 */
function parseAllowedTabs(raw, role = 'user') {
  if (role === 'root') {
    return [...ALL_TABS];
  }

  let parsed = raw;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch (_) {
      parsed = null;
    }
  }

  if ((parsed === null || parsed === undefined) && role === 'admin') {
    return [...ALL_TABS];
  }

  const allowedSet = new Set();
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (typeof item !== 'string') continue;
      const clean = item.trim().toLowerCase();
      if (ALL_TABS.includes(clean)) {
        allowedSet.add(clean);
      }
    }
  }

  if (role === 'admin') {
    allowedSet.add(USERS_TAB);
    return ALL_TABS.filter((tab) => allowedSet.has(tab));
  }

  // Perfil 'user' nunca recebe acesso à aba 'usuarios'
  allowedSet.delete(USERS_TAB);
  return OPERATIONAL_TABS.filter((tab) => allowedSet.has(tab));
}

/**
 * Valida perfil e abas solicitadas ao criar ou editar um usuário.
 * @param {Object} params
 * @param {string} params.role
 * @param {unknown} params.allowedTabs
 * @param {Object} [params.actor]
 * @returns {{ role: 'admin'|'user', allowedTabs: string[] }}
 */
function validateUserPermissions({ role, allowedTabs, actor }) {
  const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : 'user';
  if (!['user', 'admin'].includes(normalizedRole)) {
    throw createServiceError('Perfil inválido. Escolha entre Administrador ou Usuário.', 400);
  }

  if (normalizedRole === 'admin' && actor && !actor.isRoot) {
    throw createServiceError(
      'Apenas o administrador root pode conceder ou alterar o perfil Administrador.',
      403
    );
  }

  let requestedSet = null;
  if (allowedTabs !== undefined) {
    if (!Array.isArray(allowedTabs)) {
      throw createServiceError('O campo allowedTabs deve ser uma lista de abas.', 400);
    }

    const invalidTabs = [];
    requestedSet = new Set();
    for (const tab of allowedTabs) {
      const clean = typeof tab === 'string' ? tab.trim().toLowerCase() : '';
      if (!clean || !ALL_TABS.includes(clean)) {
        invalidTabs.push(String(tab));
      } else {
        requestedSet.add(clean);
      }
    }

    if (invalidTabs.length > 0) {
      throw createServiceError(`Abas inválidas: ${invalidTabs.join(', ')}.`, 400);
    }
  }

  let normalizedTabs;
  if (normalizedRole === 'user') {
    if (requestedSet && requestedSet.has(USERS_TAB)) {
      throw createServiceError('A aba Usuários é restrita a administradores e root.', 400);
    }
    normalizedTabs = requestedSet
      ? OPERATIONAL_TABS.filter((tab) => requestedSet.has(tab))
      : [];
    if (normalizedTabs.length === 0) {
      throw createServiceError('Selecione ao menos uma aba para o usuário.', 400);
    }
  } else {
    if (!requestedSet) {
      normalizedTabs = [...ALL_TABS];
    } else {
      requestedSet.add(USERS_TAB);
      normalizedTabs = ALL_TABS.filter((tab) => requestedSet.has(tab));
    }
  }

  if (actor && !actor.isRoot) {
    const actorTabs = new Set(Array.isArray(actor.allowedTabs) ? actor.allowedTabs : []);
    const unauthorizedTabs = normalizedTabs.filter((tab) => !actorTabs.has(tab));
    if (unauthorizedTabs.length > 0) {
      throw createServiceError(
        'Você só pode conceder acesso às abas às quais também tem permissão.',
        403
      );
    }
  }

  return {
    role: normalizedRole,
    allowedTabs: normalizedTabs
  };
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
        allowed_tabs JSONB NOT NULL DEFAULT '["estornos","recompensas","metas","doacao","usuarios"]'::jsonb,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT check_admin_role CHECK (role IN ('root', 'admin', 'user'))
      )
    `;

    await sql`
      ALTER TABLE admin_users
      ADD COLUMN IF NOT EXISTS allowed_tabs JSONB NOT NULL DEFAULT '["estornos","recompensas","metas","doacao","usuarios"]'::jsonb
    `;

    const constraintCheck = await sql`
      SELECT pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      WHERE t.relname = 'admin_users' AND c.conname = 'check_admin_role'
      LIMIT 1
    `;
    const constraintDef = constraintCheck.rows?.[0]?.def || '';
    if (!constraintDef.includes('user')) {
      try {
        await sql`ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS check_admin_role`;
        await sql`ALTER TABLE admin_users ADD CONSTRAINT check_admin_role CHECK (role IN ('root', 'admin', 'user'))`;
      } catch (constraintErr) {
        if (!String(constraintErr.message || '').includes('already exists')) {
          throw constraintErr;
        }
      }
    }

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
      INSERT INTO admin_users (email, role, active, allowed_tabs, created_by)
      VALUES (${ROOT_ADMIN_EMAIL}, 'root', true, ${JSON.stringify(ALL_TABS)}::jsonb, 'system')
      ON CONFLICT (email) DO UPDATE
      SET role = 'root',
          active = true,
          allowed_tabs = ${JSON.stringify(ALL_TABS)}::jsonb,
          updated_at = CURRENT_TIMESTAMP
    `;
  })().catch((error) => {
    ensureTablesPromise = null;
    throw error;
  });

  return ensureTablesPromise;
}

/**
 * Retorna o registro de usuário autorizado para o e-mail informado, ou null se não autorizado.
 * @param {string} email
 * @returns {Promise<{email: string, role: string, active: boolean, allowedTabs: string[], source: string}|null>}
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
      allowedTabs: [...ALL_TABS],
      source: 'root'
    };
  }

  await ensureAdminTables();

  const result = await sql`
    SELECT email, role, active, allowed_tabs, created_by, created_at
    FROM admin_users
    WHERE email = ${normalized}
    LIMIT 1
  `;

  if (result.rows && result.rows.length > 0) {
    const row = result.rows[0];
    if (row.active === true) {
      const resolvedRole = VALID_ROLES.includes(row.role) ? row.role : 'user';
      return {
        email: row.email.toLowerCase(),
        role: resolvedRole,
        active: true,
        allowedTabs: parseAllowedTabs(row.allowed_tabs, resolvedRole),
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
      allowedTabs: [...ALL_TABS],
      source: 'env'
    };
  }

  return null;
}

/**
 * Lista todos os usuários e administradores cadastrados (banco + root + ADMIN_EMAILS).
 * @returns {Promise<Array<Object>>}
 */
async function listAdmins() {
  await ensureAdminTables();

  const result = await sql`
    SELECT email, role, active, allowed_tabs, created_by, created_at, updated_at
    FROM admin_users
    ORDER BY CASE role WHEN 'root' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, email ASC
  `;

  const byEmail = new Map();
  for (const row of result.rows || []) {
    if (row.active === false) continue;
    const resolvedRole = VALID_ROLES.includes(row.role) ? row.role : 'user';
    byEmail.set(row.email.toLowerCase(), {
      email: row.email.toLowerCase(),
      role: resolvedRole,
      active: row.active,
      allowedTabs: parseAllowedTabs(row.allowed_tabs, resolvedRole),
      created_by: row.created_by || null,
      created_at: row.created_at || null,
      source: resolvedRole === 'root' ? 'root' : 'database'
    });
  }

  if (!byEmail.has(ROOT_ADMIN_EMAIL)) {
    byEmail.set(ROOT_ADMIN_EMAIL, {
      email: ROOT_ADMIN_EMAIL,
      role: 'root',
      active: true,
      allowedTabs: [...ALL_TABS],
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
        allowedTabs: [...ALL_TABS],
        created_by: 'env:ADMIN_EMAILS',
        created_at: null,
        source: 'env'
      });
    }
  }

  return Array.from(byEmail.values());
}

/**
 * Cadastra um novo usuário ou administrador no banco com controle granular de abas.
 * @param {string} email
 * @param {string} createdBy
 * @param {Object} [options]
 * @param {string} [options.role='user']
 * @param {string[]} [options.allowedTabs]
 * @param {Object} [options.actor]
 * @returns {Promise<Object>}
 */
async function addAdmin(email, createdBy, options = {}) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    throw createServiceError('Informe um endereço de e-mail válido.', 400);
  }

  if (isRootAdmin(normalized)) {
    throw createServiceError('Este e-mail já é o administrador root.', 400);
  }

  const actor = options.actor || {
    email: createdBy || ROOT_ADMIN_EMAIL,
    isRoot: isRootAdmin(createdBy || ROOT_ADMIN_EMAIL),
    allowedTabs: ALL_TABS
  };

  await ensureAdminTables();

  const existingResult = await sql`
    SELECT email, role, active
    FROM admin_users
    WHERE email = ${normalized}
    LIMIT 1
  `;
  const existing = existingResult.rows?.[0] || null;
  const inEnvList = getEnvAdminEmails().includes(normalized);

  if (((existing && existing.active && existing.role === 'admin') || (!existing && inEnvList)) && !actor.isRoot) {
    throw createServiceError('Apenas o administrador root pode alterar contas de administradores.', 403);
  }

  if ((existing && existing.active) || inEnvList) {
    throw createServiceError(
      'Este e-mail já está cadastrado. Use a opção Editar na lista de usuários para alterar as permissões.',
      409
    );
  }

  const targetRole = options.role || 'user';
  const validated = validateUserPermissions({
    role: targetRole,
    allowedTabs: options.allowedTabs,
    actor
  });

  const creatorEmail = createdBy || actor.email || ROOT_ADMIN_EMAIL;
  const result = await sql`
    INSERT INTO admin_users (email, role, active, allowed_tabs, created_by, updated_at)
    VALUES (${normalized}, ${validated.role}, true, ${JSON.stringify(validated.allowedTabs)}::jsonb, ${creatorEmail}, CURRENT_TIMESTAMP)
    ON CONFLICT (email) DO UPDATE
    SET role = ${validated.role},
        active = true,
        allowed_tabs = ${JSON.stringify(validated.allowedTabs)}::jsonb,
        created_by = ${creatorEmail},
        updated_at = CURRENT_TIMESTAMP
    RETURNING email, role, active, allowed_tabs, created_by, created_at
  `;

  const row = result.rows[0];
  const resolvedRole = VALID_ROLES.includes(row.role) ? row.role : 'user';
  return {
    email: row.email.toLowerCase(),
    role: resolvedRole,
    active: row.active,
    allowedTabs: parseAllowedTabs(row.allowed_tabs, resolvedRole),
    created_by: row.created_by || null,
    created_at: row.created_at || null,
    source: 'database'
  };
}

/**
 * Atualiza perfil e abas permitidas de um usuário existente.
 * @param {string} email
 * @param {Object} actor
 * @param {Object} [updates]
 * @returns {Promise<Object>}
 */
async function updateAdmin(email, actor, { role, allowedTabs } = {}) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    throw createServiceError('E-mail inválido.', 400);
  }

  if (isRootAdmin(normalized)) {
    throw createServiceError('Não é possível alterar o administrador root.', 400);
  }

  if (actor && normalizeEmail(actor.email) === normalized) {
    throw createServiceError('Você não pode alterar as permissões da sua própria conta.', 400);
  }

  await ensureAdminTables();

  const existingResult = await sql`
    SELECT email, role, active, allowed_tabs, created_by, created_at
    FROM admin_users
    WHERE email = ${normalized}
    LIMIT 1
  `;
  const existing = existingResult.rows?.[0] || null;
  const inEnvList = getEnvAdminEmails().includes(normalized);

  if ((!existing || existing.active === false) && !inEnvList) {
    throw createServiceError('Usuário não encontrado.', 404);
  }

  const existingRole = existing && existing.active ? existing.role : 'admin';
  if (existingRole === 'admin' && !actor?.isRoot) {
    throw createServiceError('Apenas o administrador root pode editar administradores.', 403);
  }

  const targetRole = role || existingRole;
  const tabsInput =
    allowedTabs !== undefined
      ? allowedTabs
      : existing
        ? parseAllowedTabs(existing.allowed_tabs, targetRole)
        : undefined;

  const validated = validateUserPermissions({
    role: targetRole,
    allowedTabs: tabsInput,
    actor
  });

  const creatorFallback = actor?.email || 'env:ADMIN_EMAILS';
  const result = await sql`
    INSERT INTO admin_users (email, role, active, allowed_tabs, created_by, updated_at)
    VALUES (${normalized}, ${validated.role}, true, ${JSON.stringify(validated.allowedTabs)}::jsonb, ${creatorFallback}, CURRENT_TIMESTAMP)
    ON CONFLICT (email) DO UPDATE
    SET role = ${validated.role},
        active = true,
        allowed_tabs = ${JSON.stringify(validated.allowedTabs)}::jsonb,
        updated_at = CURRENT_TIMESTAMP
    RETURNING email, role, active, allowed_tabs, created_by, created_at
  `;

  const row = result.rows[0];
  const resolvedRole = VALID_ROLES.includes(row.role) ? row.role : 'user';
  return {
    email: row.email.toLowerCase(),
    role: resolvedRole,
    active: row.active,
    allowedTabs: parseAllowedTabs(row.allowed_tabs, resolvedRole),
    created_by: row.created_by || null,
    created_at: row.created_at || null,
    source: 'database'
  };
}

/**
 * Remove um usuário ou administrador do banco de dados (protege root e impede auto-remoção).
 * @param {string} email
 * @param {Object|null} [actor=null]
 * @returns {Promise<{removed: boolean, email: string, inEnvList: boolean}>}
 */
async function removeAdmin(email, actor = null) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    throw createServiceError('E-mail inválido.', 400);
  }

  if (isRootAdmin(normalized)) {
    throw createServiceError('Não é possível remover o administrador root.', 400);
  }

  if (actor && normalizeEmail(actor.email) === normalized) {
    throw createServiceError('Você não pode remover a sua própria conta.', 400);
  }

  await ensureAdminTables();

  const existingResult = await sql`
    SELECT email, role
    FROM admin_users
    WHERE email = ${normalized}
    LIMIT 1
  `;
  const existing = existingResult.rows?.[0] || null;
  const inEnvList = getEnvAdminEmails().includes(normalized);

  if (!existing && !inEnvList) {
    throw createServiceError('Usuário não encontrado.', 404);
  }

  const targetRole = existing ? existing.role : 'admin';
  if (targetRole === 'admin' && actor && !actor.isRoot) {
    throw createServiceError('Apenas o administrador root pode remover outros administradores.', 403);
  }

  const result = await sql`
    DELETE FROM admin_users
    WHERE email = ${normalized} AND role <> 'root'
    RETURNING email
  `;

  const removed = Boolean(result.rows && result.rows.length > 0);

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
  OPERATIONAL_TABS,
  USERS_TAB,
  ALL_TABS,
  VALID_ROLES,
  normalizeEmail,
  isRootAdmin,
  getEnvAdminEmails,
  parseAllowedTabs,
  validateUserPermissions,
  ensureAdminTables,
  getAdminRecord,
  listAdmins,
  addAdmin,
  updateAdmin,
  removeAdmin,
  getCobrancaByRedeTid,
  markRefundedInDatabase,
  logEstorno,
  listEstornos,
  listTransactionsForAdmin
};
