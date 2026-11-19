// Serviço de metas de doação e leitura agregada em tempo real
const { sql } = require('../config/database');
const { sanitizeString, validateCampanhaId } = require('../utils/validation');
const { validateCalendarDate } = require('./rewardsService');

const GOAL_SLUG_REGEX = /^[a-z0-9][a-z0-9_-]{0,58}$/;
let ensureGoalsTablePromise = null;

function createServiceError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function round2(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100) / 100;
}

function slugifyGoalTitle(text) {
  if (typeof text !== 'string') return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 59);
}

function normalizeGoalSlug(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || !GOAL_SLUG_REGEX.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function parseGoalAmount(val, { required = false, allowZero = false, fieldName = 'Valor' } = {}) {
  if (val === undefined || val === null || val === '') {
    if (required) {
      throw createServiceError(`${fieldName} é obrigatório.`, 400);
    }
    return 0;
  }
  const normalized = typeof val === 'string' ? val.trim().replace(',', '.') : val;
  const num = Number(normalized);
  if (!Number.isFinite(num) || num > 100000000 || (allowZero ? num < 0 : num <= 0)) {
    throw createServiceError(
      `${fieldName} deve ser um número ${allowZero ? 'maior ou igual a 0' : 'maior que 0'}.`,
      400
    );
  }
  return round2(num);
}

function parseOptionalCampanhaId(raw) {
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }
  const validated = validateCampanhaId(raw);
  if (!validated) {
    throw createServiceError(
      'ID da campanha inválido. Use apenas letras, números, hífens e underscores (máx. 60 caracteres).',
      400
    );
  }
  return validated;
}

function parseGoalOrder(val) {
  if (val === undefined || val === null || val === '') {
    return 0;
  }
  const num = typeof val === 'string' ? parseInt(val.trim(), 10) : Number(val);
  if (!Number.isInteger(num) || num < -9999 || num > 9999) {
    throw createServiceError('Ordem da meta deve ser um número inteiro entre -9999 e 9999.', 400);
  }
  return num;
}

function parseGoalId(val) {
  const num = typeof val === 'string' && /^\d+$/.test(val.trim())
    ? parseInt(val.trim(), 10)
    : typeof val === 'number'
      ? val
      : NaN;
  if (!Number.isInteger(num) || num <= 0) {
    throw createServiceError('ID da meta inválido.', 400);
  }
  return num;
}

function validateGoalDates(dataInicioRaw, dataFimRaw) {
  let dataInicio = null;
  if (dataInicioRaw !== undefined && dataInicioRaw !== null && String(dataInicioRaw).trim() !== '') {
    dataInicio = validateCalendarDate(String(dataInicioRaw));
    if (!dataInicio) {
      throw createServiceError('Data inicial inválida. Use o formato YYYY-MM-DD.', 400);
    }
  }

  let dataFim = null;
  if (dataFimRaw !== undefined && dataFimRaw !== null && String(dataFimRaw).trim() !== '') {
    dataFim = validateCalendarDate(String(dataFimRaw));
    if (!dataFim) {
      throw createServiceError('Data limite inválida. Use o formato YYYY-MM-DD.', 400);
    }
  }

  if (dataInicio && dataFim && dataFim < dataInicio) {
    throw createServiceError('A data limite deve ser igual ou posterior à data inicial.', 400);
  }

  return { dataInicio, dataFim };
}

function formatGoalRow(row, { isPublic = false } = {}) {
  const valorMeta = round2(row.valor_meta);
  const valorInicial = round2(row.valor_inicial);
  const valorOnline = round2(row.valor_arrecadado_online);
  const valorArrecadado = round2(valorInicial + valorOnline);
  const valorFaltante = round2(Math.max(0, valorMeta - valorArrecadado));
  const percentual = valorMeta > 0 ? round2((valorArrecadado / valorMeta) * 100) : 0;
  const percentualBarra = Math.min(100, Math.max(0, percentual));

  const formatted = {
    id: parseInt(row.id, 10),
    slug: row.slug,
    titulo: row.titulo,
    descricao: row.descricao || null,
    valor_meta: valorMeta,
    valor_inicial: valorInicial,
    valor_arrecadado_online: valorOnline,
    valor_arrecadado: valorArrecadado,
    valor_faltante: valorFaltante,
    percentual,
    percentual_barra: percentualBarra,
    atingida: valorArrecadado >= valorMeta,
    total_doacoes: parseInt(row.total_doacoes || 0, 10),
    total_doadores: parseInt(row.total_doadores || 0, 10),
    campanha_id: row.campanha_id || null,
    data_inicio: row.data_inicio || null,
    data_fim: row.data_fim || null,
    ordem: parseInt(row.ordem || 0, 10),
    destaque: Boolean(row.destaque),
    ativa: Boolean(row.ativa),
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em
  };

  if (!isPublic) {
    formatted.atualizado_por = row.atualizado_por || null;
  }

  return formatted;
}

/**
 * Garante a criação idempotente da tabela metas_doacao e seus índices.
 */
async function ensureGoalsTable() {
  if (ensureGoalsTablePromise) {
    return ensureGoalsTablePromise;
  }

  ensureGoalsTablePromise = (async () => {
    if (!sql) {
      throw new Error('Conexão com banco de dados não inicializada.');
    }

    await sql`
      CREATE TABLE IF NOT EXISTS metas_doacao (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(60) UNIQUE NOT NULL,
        titulo VARCHAR(150) NOT NULL,
        descricao TEXT,
        valor_meta DECIMAL(12, 2) NOT NULL,
        valor_inicial DECIMAL(12, 2) NOT NULL DEFAULT 0,
        campanha_id VARCHAR(60),
        data_inicio DATE,
        data_fim DATE,
        ordem INTEGER NOT NULL DEFAULT 0,
        destaque BOOLEAN NOT NULL DEFAULT false,
        ativa BOOLEAN NOT NULL DEFAULT true,
        atualizado_por VARCHAR(255),
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT check_metas_valor_meta CHECK (valor_meta > 0),
        CONSTRAINT check_metas_valor_inicial CHECK (valor_inicial >= 0),
        CONSTRAINT check_metas_datas CHECK (data_inicio IS NULL OR data_fim IS NULL OR data_fim >= data_inicio)
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_metas_doacao_ativa ON metas_doacao(ativa)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_metas_doacao_campanha ON metas_doacao(campanha_id) WHERE campanha_id IS NOT NULL`;

    const colSizes = await sql`
      SELECT table_name, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('cobrancas', 'metas_doacao')
        AND column_name = 'campanha_id'
    `;
    for (const col of colSizes.rows || []) {
      const len = Number(col.character_maximum_length);
      if (len > 0 && len < 60) {
        if (col.table_name === 'cobrancas') {
          try {
            await sql`ALTER TABLE cobrancas ALTER COLUMN campanha_id TYPE VARCHAR(60)`;
          } catch (_) {
            // ignorar se cobrancas ainda não existir em ambiente isolado
          }
        } else if (col.table_name === 'metas_doacao') {
          await sql`ALTER TABLE metas_doacao ALTER COLUMN campanha_id TYPE VARCHAR(60)`;
        }
      }
    }
  })().catch((err) => {
    ensureGoalsTablePromise = null;
    throw err;
  });

  return ensureGoalsTablePromise;
}

async function getGoalById(id, { isPublic = false } = {}) {
  await ensureGoalsTable();
  const goalId = parseGoalId(id);

  const result = await sql`
    SELECT
      m.id,
      m.slug,
      m.titulo,
      m.descricao,
      m.valor_meta,
      m.valor_inicial,
      m.campanha_id,
      TO_CHAR(m.data_inicio, 'YYYY-MM-DD') AS data_inicio,
      TO_CHAR(m.data_fim, 'YYYY-MM-DD') AS data_fim,
      m.ordem,
      m.destaque,
      m.ativa,
      m.atualizado_por,
      m.criado_em,
      m.atualizado_em,
      COALESCE(agg.valor_arrecadado_online, 0) AS valor_arrecadado_online,
      COALESCE(agg.total_doacoes, 0)::int AS total_doacoes,
      COALESCE(agg.total_doadores, 0)::int AS total_doadores
    FROM metas_doacao m
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(t.valor), 0) AS valor_arrecadado_online,
        COUNT(*)::int AS total_doacoes,
        COUNT(DISTINCT t.doador_id)::int AS total_doadores
      FROM transacoes t
      JOIN cobrancas c ON c.txid = t.cobranca_txid
      WHERE t.status = 'CONFIRMADA'
        AND (
          LOWER(COALESCE(c.campanha_id, '')) = LOWER(m.slug)
          OR (m.campanha_id IS NOT NULL AND c.campanha_id = m.campanha_id)
        )
        AND (
          m.data_inicio IS NULL
          OR ((COALESCE(t.confirmado_em, t.criado_em) AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date >= m.data_inicio
        )
        AND (
          m.data_fim IS NULL
          OR ((COALESCE(t.confirmado_em, t.criado_em) AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date <= m.data_fim
        )
    ) agg ON true
    WHERE m.id = ${goalId}
    LIMIT 1
  `;

  if (!result.rows || result.rows.length === 0) {
    return null;
  }

  return formatGoalRow(result.rows[0], { isPublic });
}

async function listGoals({ includeInactive = false, campanhaId = '', onlyFeatured = false, isPublic = false } = {}) {
  await ensureGoalsTable();

  const includeAll = Boolean(includeInactive);
  const campaignFilter = typeof campanhaId === 'string' && campanhaId.trim() ? campanhaId.trim() : null;
  const featuredOnly = Boolean(onlyFeatured);

  const result = await sql`
    SELECT
      m.id,
      m.slug,
      m.titulo,
      m.descricao,
      m.valor_meta,
      m.valor_inicial,
      m.campanha_id,
      TO_CHAR(m.data_inicio, 'YYYY-MM-DD') AS data_inicio,
      TO_CHAR(m.data_fim, 'YYYY-MM-DD') AS data_fim,
      m.ordem,
      m.destaque,
      m.ativa,
      m.atualizado_por,
      m.criado_em,
      m.atualizado_em,
      COALESCE(agg.valor_arrecadado_online, 0) AS valor_arrecadado_online,
      COALESCE(agg.total_doacoes, 0)::int AS total_doacoes,
      COALESCE(agg.total_doadores, 0)::int AS total_doadores
    FROM metas_doacao m
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(t.valor), 0) AS valor_arrecadado_online,
        COUNT(*)::int AS total_doacoes,
        COUNT(DISTINCT t.doador_id)::int AS total_doadores
      FROM transacoes t
      JOIN cobrancas c ON c.txid = t.cobranca_txid
      WHERE t.status = 'CONFIRMADA'
        AND (
          LOWER(COALESCE(c.campanha_id, '')) = LOWER(m.slug)
          OR (m.campanha_id IS NOT NULL AND c.campanha_id = m.campanha_id)
        )
        AND (
          m.data_inicio IS NULL
          OR ((COALESCE(t.confirmado_em, t.criado_em) AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date >= m.data_inicio
        )
        AND (
          m.data_fim IS NULL
          OR ((COALESCE(t.confirmado_em, t.criado_em) AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date <= m.data_fim
        )
    ) agg ON true
    WHERE (${includeAll}::boolean = true OR m.ativa = true)
      AND (
        ${campaignFilter}::text IS NULL
        OR LOWER(m.slug) = LOWER(${campaignFilter})
        OR (m.campanha_id IS NOT NULL AND LOWER(m.campanha_id) = LOWER(${campaignFilter}))
      )
      AND (${featuredOnly}::boolean = false OR m.destaque = true)
    ORDER BY m.destaque DESC, m.ordem ASC, m.valor_meta ASC, m.id ASC
  `;

  return (result.rows || []).map((row) => formatGoalRow(row, { isPublic }));
}

async function getPublicGoalsPayload({ campanhaId = '', onlyFeatured = false } = {}) {
  const [metas, totalsRes] = await Promise.all([
    listGoals({ includeInactive: false, campanhaId, onlyFeatured, isPublic: true }),
    sql`
      SELECT
        COALESCE(SUM(valor), 0) AS total_arrecadado,
        COUNT(*)::int AS total_doacoes
      FROM transacoes
      WHERE status = 'CONFIRMADA'
    `
  ]);

  const totalRow = totalsRes.rows?.[0] || {};
  return {
    success: true,
    timestamp: new Date().toISOString(),
    resumo: {
      total_arrecadado_geral: round2(totalRow.total_arrecadado),
      total_doacoes_geral: parseInt(totalRow.total_doacoes || 0, 10),
      total_metas_ativas: metas.length,
      meta_principal: metas.find((m) => m.destaque) || metas[0] || null
    },
    metas
  };
}

async function getPublicGoalBySlug(slug) {
  await ensureGoalsTable();
  const cleanSlug = normalizeGoalSlug(slug);
  if (!cleanSlug) return null;

  const result = await sql`
    SELECT
      m.id,
      m.slug,
      m.titulo,
      m.descricao,
      m.valor_meta,
      m.valor_inicial,
      m.campanha_id,
      TO_CHAR(m.data_inicio, 'YYYY-MM-DD') AS data_inicio,
      TO_CHAR(m.data_fim, 'YYYY-MM-DD') AS data_fim,
      m.ordem,
      m.destaque,
      m.ativa,
      m.criado_em,
      m.atualizado_em,
      COALESCE(agg.valor_arrecadado_online, 0) AS valor_arrecadado_online,
      COALESCE(agg.total_doacoes, 0)::int AS total_doacoes,
      COALESCE(agg.total_doadores, 0)::int AS total_doadores
    FROM metas_doacao m
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(t.valor), 0) AS valor_arrecadado_online,
        COUNT(*)::int AS total_doacoes,
        COUNT(DISTINCT t.doador_id)::int AS total_doadores
      FROM transacoes t
      JOIN cobrancas c ON c.txid = t.cobranca_txid
      WHERE t.status = 'CONFIRMADA'
        AND (
          LOWER(COALESCE(c.campanha_id, '')) = LOWER(m.slug)
          OR (m.campanha_id IS NOT NULL AND c.campanha_id = m.campanha_id)
        )
        AND (
          m.data_inicio IS NULL
          OR ((COALESCE(t.confirmado_em, t.criado_em) AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date >= m.data_inicio
        )
        AND (
          m.data_fim IS NULL
          OR ((COALESCE(t.confirmado_em, t.criado_em) AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date <= m.data_fim
        )
    ) agg ON true
    WHERE m.slug = ${cleanSlug}
      AND m.ativa = true
    LIMIT 1
  `;

  if (!result.rows || result.rows.length === 0) {
    return null;
  }

  return formatGoalRow(result.rows[0], { isPublic: true });
}

async function createGoal(payload = {}, adminEmail = 'admin') {
  await ensureGoalsTable();

  const titulo = sanitizeString(typeof payload.titulo === 'string' ? payload.titulo.trim() : '').slice(0, 150);
  if (!titulo) {
    throw createServiceError('Título da meta é obrigatório.', 400);
  }

  const rawSlug = typeof payload.slug === 'string' && payload.slug.trim() ? payload.slug : slugifyGoalTitle(titulo);
  const slug = normalizeGoalSlug(rawSlug);
  if (!slug) {
    throw createServiceError('Slug da meta inválido. Use apenas letras minúsculas, números, "-" ou "_".', 400);
  }

  const descricao = typeof payload.descricao === 'string' && payload.descricao.trim()
    ? sanitizeString(payload.descricao.trim()).slice(0, 500)
    : null;
  const valorMeta = parseGoalAmount(payload.valor_meta ?? payload.valorMeta, {
    required: true,
    allowZero: false,
    fieldName: 'Valor da meta'
  });
  const valorInicial = parseGoalAmount(payload.valor_inicial ?? payload.valorInicial, {
    required: false,
    allowZero: true,
    fieldName: 'Valor inicial'
  });
  const campanhaId = parseOptionalCampanhaId(payload.campanha_id ?? payload.campanhaId);
  const { dataInicio, dataFim } = validateGoalDates(
    payload.data_inicio ?? payload.dataInicio,
    payload.data_fim ?? payload.dataFim
  );
  const ordem = parseGoalOrder(payload.ordem);
  const destaque = Boolean(payload.destaque);
  const ativa = payload.ativa !== false;
  const cleanAdmin = typeof adminEmail === 'string' && adminEmail.trim() ? adminEmail.trim().slice(0, 255) : 'admin';

  const existing = await sql`SELECT id FROM metas_doacao WHERE slug = ${slug} LIMIT 1`;
  if (existing.rows && existing.rows.length > 0) {
    throw createServiceError('Já existe uma meta cadastrada com este slug.', 409);
  }

  if (destaque) {
    await sql`UPDATE metas_doacao SET destaque = false WHERE destaque = true`;
  }

  const inserted = await sql`
    INSERT INTO metas_doacao (
      slug, titulo, descricao, valor_meta, valor_inicial,
      campanha_id, data_inicio, data_fim, ordem, destaque, ativa, atualizado_por
    )
    VALUES (
      ${slug}, ${titulo}, ${descricao}, ${valorMeta}, ${valorInicial},
      ${campanhaId}, ${dataInicio}::date, ${dataFim}::date, ${ordem}, ${destaque}, ${ativa}, ${cleanAdmin}
    )
    RETURNING id
  `;

  return getGoalById(inserted.rows[0].id, { isPublic: false });
}

async function updateGoal(id, payload = {}, adminEmail = 'admin') {
  await ensureGoalsTable();

  const goalId = parseGoalId(id);
  const existingRes = await sql`
    SELECT
      id, slug, titulo, descricao, valor_meta, valor_inicial, campanha_id,
      TO_CHAR(data_inicio, 'YYYY-MM-DD') AS data_inicio,
      TO_CHAR(data_fim, 'YYYY-MM-DD') AS data_fim,
      ordem, destaque, ativa
    FROM metas_doacao
    WHERE id = ${goalId}
    LIMIT 1
  `;
  if (!existingRes.rows || existingRes.rows.length === 0) {
    throw createServiceError('Meta não encontrada.', 404);
  }

  const current = existingRes.rows[0];

  const nextTitulo = payload.titulo !== undefined
    ? sanitizeString(typeof payload.titulo === 'string' ? payload.titulo.trim() : '').slice(0, 150)
    : current.titulo;
  if (!nextTitulo) {
    throw createServiceError('Título da meta é obrigatório.', 400);
  }

  const nextSlug = payload.slug !== undefined ? normalizeGoalSlug(payload.slug) : current.slug;
  if (!nextSlug) {
    throw createServiceError('Slug da meta inválido. Use apenas letras minúsculas, números, "-" ou "_".', 400);
  }

  if (nextSlug !== current.slug) {
    const slugConflict = await sql`
      SELECT id FROM metas_doacao WHERE slug = ${nextSlug} AND id <> ${goalId} LIMIT 1
    `;
    if (slugConflict.rows && slugConflict.rows.length > 0) {
      throw createServiceError('Já existe outra meta cadastrada com este slug.', 409);
    }
  }

  let nextDescricao = current.descricao;
  if (payload.descricao !== undefined) {
    nextDescricao = typeof payload.descricao === 'string' && payload.descricao.trim()
      ? sanitizeString(payload.descricao.trim()).slice(0, 500)
      : null;
  }

  const rawValorMeta = payload.valor_meta !== undefined ? payload.valor_meta : payload.valorMeta;
  const nextValorMeta = rawValorMeta !== undefined
    ? parseGoalAmount(rawValorMeta, { required: true, allowZero: false, fieldName: 'Valor da meta' })
    : round2(current.valor_meta);

  const rawValorInicial = payload.valor_inicial !== undefined ? payload.valor_inicial : payload.valorInicial;
  const nextValorInicial = rawValorInicial !== undefined
    ? parseGoalAmount(rawValorInicial, { required: false, allowZero: true, fieldName: 'Valor inicial' })
    : round2(current.valor_inicial);

  const rawCampanhaId = payload.campanha_id !== undefined ? payload.campanha_id : payload.campanhaId;
  const nextCampanhaId = rawCampanhaId !== undefined
    ? parseOptionalCampanhaId(rawCampanhaId)
    : current.campanha_id;

  const rawDataInicio = payload.data_inicio !== undefined ? payload.data_inicio : payload.dataInicio;
  const rawDataFim = payload.data_fim !== undefined ? payload.data_fim : payload.dataFim;
  const { dataInicio: nextDataInicio, dataFim: nextDataFim } = validateGoalDates(
    rawDataInicio !== undefined ? rawDataInicio : current.data_inicio,
    rawDataFim !== undefined ? rawDataFim : current.data_fim
  );

  const nextOrdem = payload.ordem !== undefined ? parseGoalOrder(payload.ordem) : parseInt(current.ordem || 0, 10);
  const nextDestaque = payload.destaque !== undefined ? Boolean(payload.destaque) : Boolean(current.destaque);
  const nextAtiva = payload.ativa !== undefined ? Boolean(payload.ativa) : Boolean(current.ativa);
  const cleanAdmin = typeof adminEmail === 'string' && adminEmail.trim() ? adminEmail.trim().slice(0, 255) : 'admin';

  if (nextDestaque) {
    await sql`UPDATE metas_doacao SET destaque = false WHERE id <> ${goalId} AND destaque = true`;
  }

  await sql`
    UPDATE metas_doacao
    SET
      slug = ${nextSlug},
      titulo = ${nextTitulo},
      descricao = ${nextDescricao},
      valor_meta = ${nextValorMeta},
      valor_inicial = ${nextValorInicial},
      campanha_id = ${nextCampanhaId},
      data_inicio = ${nextDataInicio}::date,
      data_fim = ${nextDataFim}::date,
      ordem = ${nextOrdem},
      destaque = ${nextDestaque},
      ativa = ${nextAtiva},
      atualizado_por = ${cleanAdmin},
      atualizado_em = CURRENT_TIMESTAMP
    WHERE id = ${goalId}
  `;

  if (nextSlug !== current.slug) {
    await sql`
      UPDATE cobrancas
      SET campanha_id = ${nextSlug}
      WHERE LOWER(COALESCE(campanha_id, '')) = LOWER(${current.slug})
    `;
  }

  return getGoalById(goalId, { isPublic: false });
}

async function deleteGoal(id) {
  await ensureGoalsTable();
  const goalId = parseGoalId(id);

  const deleted = await sql`
    DELETE FROM metas_doacao
    WHERE id = ${goalId}
    RETURNING id, slug
  `;
  if (!deleted.rows || deleted.rows.length === 0) {
    throw createServiceError('Meta não encontrada.', 404);
  }

  return {
    deleted: true,
    id: parseInt(deleted.rows[0].id, 10),
    slug: deleted.rows[0].slug
  };
}

/**
 * Retorna a meta principal ativa (destaque = true primeiro, senão a primeira ativa ordenada).
 * @returns {Promise<{id: number, slug: string, titulo: string, destaque: boolean}|null>}
 */
async function getActiveMainGoal() {
  await ensureGoalsTable();

  const result = await sql`
    SELECT id, slug, titulo, destaque, ativa
    FROM metas_doacao
    WHERE ativa = true
    ORDER BY destaque DESC, ordem ASC, valor_meta ASC, id ASC
    LIMIT 1
  `;

  if (!result.rows || result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: parseInt(row.id, 10),
    slug: row.slug,
    titulo: row.titulo,
    destaque: Boolean(row.destaque)
  };
}

/**
 * Lista os doadores com transações confirmadas vinculadas a uma meta.
 * @param {Object} [params]
 * @returns {Promise<{meta: Object, doadores: Array<Object>}|null>}
 */
async function listGoalDonors({ id = null, slug = null, isPublic = false, limit = 100, offset = 0 } = {}) {
  await ensureGoalsTable();

  let goal = null;
  if (isPublic) {
    goal = await getPublicGoalBySlug(slug);
  } else if (id !== null && id !== undefined && id !== '') {
    goal = await getGoalById(id, { isPublic: false });
  } else if (slug) {
    const cleanSlug = normalizeGoalSlug(slug);
    if (!cleanSlug) return null;
    const found = await sql`SELECT id FROM metas_doacao WHERE slug = ${cleanSlug} LIMIT 1`;
    if (found.rows && found.rows.length > 0) {
      goal = await getGoalById(found.rows[0].id, { isPublic: false });
    }
  }

  if (!goal) {
    return null;
  }

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 200);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);
  const campaignId = goal.campanha_id || null;
  const dataInicio = goal.data_inicio || null;
  const dataFim = goal.data_fim || null;

  if (isPublic) {
    const resPublic = await sql`
      SELECT
        d.id AS doador_id,
        d.nome,
        MAX(NULLIF(TRIM(d.mensagem), '')) AS mensagem,
        COALESCE(SUM(t.valor), 0) AS total_doado,
        COUNT(*)::int AS total_doacoes,
        MAX(COALESCE(t.confirmado_em, t.criado_em)) AS ultima_doacao_em
      FROM transacoes t
      JOIN cobrancas c ON c.txid = t.cobranca_txid
      JOIN doadores d ON d.id = t.doador_id
      WHERE t.status = 'CONFIRMADA'
        AND d.anonimo = false
        AND (
          LOWER(COALESCE(c.campanha_id, '')) = LOWER(${goal.slug})
          OR (${campaignId}::text IS NOT NULL AND c.campanha_id = ${campaignId})
        )
        AND (
          ${dataInicio}::date IS NULL
          OR ((COALESCE(t.confirmado_em, t.criado_em) AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date >= ${dataInicio}::date
        )
        AND (
          ${dataFim}::date IS NULL
          OR ((COALESCE(t.confirmado_em, t.criado_em) AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date <= ${dataFim}::date
        )
      GROUP BY d.id, d.nome
      ORDER BY ultima_doacao_em DESC, d.id DESC
      LIMIT ${safeLimit}
      OFFSET ${safeOffset}
    `;

    return {
      meta: {
        id: goal.id,
        slug: goal.slug,
        titulo: goal.titulo
      },
      doadores: (resPublic.rows || []).map((row) => ({
        nome: row.nome,
        mensagem: row.mensagem || null,
        total_doado: round2(row.total_doado),
        total_doacoes: parseInt(row.total_doacoes || 0, 10),
        ultima_doacao_em: row.ultima_doacao_em
      }))
    };
  }

  const resAdmin = await sql`
    SELECT
      d.id AS doador_id,
      COALESCE(d.anonimo, true) AS anonimo,
      CASE WHEN d.anonimo = false AND d.nome IS NOT NULL THEN d.nome ELSE 'Anônimo' END AS nome,
      CASE WHEN d.anonimo = false THEN d.whatsapp ELSE NULL END AS whatsapp,
      MAX(NULLIF(TRIM(d.mensagem), '')) AS mensagem,
      COALESCE(SUM(t.valor), 0) AS total_doado,
      COUNT(*)::int AS total_doacoes,
      MAX(COALESCE(t.confirmado_em, t.criado_em)) AS ultima_doacao_em,
      ARRAY_AGG(DISTINCT t.tipo_pagamento ORDER BY t.tipo_pagamento) AS metodos
    FROM transacoes t
    JOIN cobrancas c ON c.txid = t.cobranca_txid
    LEFT JOIN doadores d ON d.id = t.doador_id
    WHERE t.status = 'CONFIRMADA'
      AND (
        LOWER(COALESCE(c.campanha_id, '')) = LOWER(${goal.slug})
        OR (${campaignId}::text IS NOT NULL AND c.campanha_id = ${campaignId})
      )
      AND (
        ${dataInicio}::date IS NULL
        OR ((COALESCE(t.confirmado_em, t.criado_em) AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date >= ${dataInicio}::date
      )
      AND (
        ${dataFim}::date IS NULL
        OR ((COALESCE(t.confirmado_em, t.criado_em) AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date <= ${dataFim}::date
      )
    GROUP BY COALESCE(d.id::text, 'tx:' || t.id::text), d.id, d.anonimo, d.nome, d.whatsapp
    ORDER BY ultima_doacao_em DESC
    LIMIT ${safeLimit}
    OFFSET ${safeOffset}
  `;

  return {
    meta: goal,
    doadores: (resAdmin.rows || []).map((row) => ({
      doador_id: row.doador_id ? parseInt(row.doador_id, 10) : null,
      anonimo: Boolean(row.anonimo),
      nome: row.nome || 'Anônimo',
      whatsapp: row.whatsapp || null,
      mensagem: row.mensagem || null,
      total_doado: round2(row.total_doado),
      total_doacoes: parseInt(row.total_doacoes || 0, 10),
      ultima_doacao_em: row.ultima_doacao_em,
      metodos: Array.isArray(row.metodos)
        ? row.metodos.filter(Boolean)
        : typeof row.metodos === 'string'
          ? row.metodos.replace(/[{}]/g, '').split(',').filter(Boolean)
          : []
    }))
  };
}

module.exports = {
  ensureGoalsTable,
  listGoals,
  getPublicGoalsPayload,
  getPublicGoalBySlug,
  getActiveMainGoal,
  listGoalDonors,
  createGoal,
  updateGoal,
  deleteGoal
};
