// Rewards service - tier-based donation rewards, inventory, and delivery tracking
const { sql } = require('../config/database');
const { sanitizeString } = require('../utils/validation');

const TIERS = {
  bronze: { min: parseFloat(process.env.REWARD_TIER_BRONZE) || 50, name: 'Bronze', color: '#CD7F32' },
  silver: { min: parseFloat(process.env.REWARD_TIER_SILVER) || 200, name: 'Silver', color: '#C0C0C0' },
  gold: { min: parseFloat(process.env.REWARD_TIER_GOLD) || 500, name: 'Gold', color: '#FFD700' },
  platinum: { min: parseFloat(process.env.REWARD_TIER_PLATINUM) || 1000, name: 'Platinum', color: '#E5E4E2' }
};

const DEFAULT_TIERS_SEED = [
  { slug: 'bronze', name: 'Bronze', min_amount: TIERS.bronze.min, color: TIERS.bronze.color, sort_order: 1 },
  { slug: 'silver', name: 'Silver', min_amount: TIERS.silver.min, color: TIERS.silver.color, sort_order: 2 },
  { slug: 'gold', name: 'Gold', min_amount: TIERS.gold.min, color: TIERS.gold.color, sort_order: 3 },
  { slug: 'platinum', name: 'Platinum', min_amount: TIERS.platinum.min, color: TIERS.platinum.color, sort_order: 4 }
];

const DEFAULT_REWARDS_BY_TIER = {
  bronze: [
    { id: 'bronze_1', name: 'Badge Bronze', description: 'Identificador de doador Bronze' },
    { id: 'bronze_2', name: 'Acesso ao Mural de Doadores', description: 'Seu nome no mural do festival' }
  ],
  silver: [
    { id: 'silver_1', name: 'Badge Prata', description: 'Identificador de doador Prata' },
    { id: 'silver_2', name: 'Camiseta Exclusiva', description: 'Camiseta do festival Solstício' },
    { id: 'silver_3', name: 'Early Access', description: 'Compra antecipada de ingressos' }
  ],
  gold: [
    { id: 'gold_1', name: 'Badge Ouro', description: 'Identificador de doador Ouro' },
    { id: 'gold_2', name: 'Meet & Greet', description: 'Encontro com artistas do festival' },
    { id: 'gold_3', name: 'VIP Pass', description: 'Área VIP com open bar' }
  ],
  platinum: [
    { id: 'platinum_1', name: 'Badge Platina', description: 'Identificador de doador Platina' },
    { id: 'platinum_2', name: 'Suite VIP', description: 'Acesso exclusivo backstage' },
    { id: 'platinum_3', name: 'Lote Garantido', description: 'Lote especial de ingressos vitalício' }
  ]
};

const SLUG_REGEX = /^[a-z0-9][a-z0-9_-]{0,48}$/;
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

let ensureRewardsTablesPromise = null;

function createServiceError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function slugifyText(text) {
  if (typeof text !== 'string') return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 49);
}

function normalizeSlug(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || !SLUG_REGEX.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function normalizeHexColor(raw) {
  if (raw === undefined || raw === null || raw === '') {
    return '#6b7280';
  }
  if (typeof raw !== 'string') {
    throw createServiceError('Cor inválida. Use o formato hexadecimal #RRGGBB.', 400);
  }
  const trimmed = raw.trim();
  if (!HEX_COLOR_REGEX.test(trimmed)) {
    throw createServiceError('Cor inválida. Use o formato hexadecimal #RRGGBB.', 400);
  }
  return trimmed.toLowerCase();
}

function validateCalendarDate(isoDate) {
  if (typeof isoDate !== 'string') return null;
  const trimmed = isoDate.trim();
  const match = trimmed.match(ISO_DATE_REGEX);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() + 1 !== month ||
    utcDate.getUTCDate() !== day
  ) {
    return null;
  }

  return trimmed;
}

function parseOptionalStock(val) {
  if (val === undefined || val === null || val === '') {
    return null;
  }
  let parsed;
  if (typeof val === 'number') {
    if (!Number.isInteger(val)) {
      throw createServiceError('Quantidade disponível deve ser um número inteiro maior ou igual a 0, ou vazio para ilimitada.', 400);
    }
    parsed = val;
  } else if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    if (!/^\d+$/.test(trimmed)) {
      throw createServiceError('Quantidade disponível deve ser um número inteiro maior ou igual a 0, ou vazio para ilimitada.', 400);
    }
    parsed = parseInt(trimmed, 10);
  } else {
    throw createServiceError('Quantidade disponível inválida.', 400);
  }

  if (parsed < 0 || parsed > 1000000) {
    throw createServiceError('Quantidade disponível deve estar entre 0 e 1.000.000.', 400);
  }
  return parsed;
}

function parseMinAmount(val) {
  if (val === undefined || val === null || val === '') {
    throw createServiceError('Valor mínimo do tier é obrigatório.', 400);
  }
  const normalized = typeof val === 'string' ? val.trim().replace(',', '.') : val;
  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0 || num > 10000000) {
    throw createServiceError('Valor mínimo deve ser um número maior ou igual a 0.', 400);
  }
  return Math.round(num * 100) / 100;
}

function parseSortOrder(val) {
  if (val === undefined || val === null || val === '') {
    return 0;
  }
  const num = typeof val === 'string' ? parseInt(val.trim(), 10) : Number(val);
  if (!Number.isInteger(num) || num < -9999 || num > 9999) {
    throw createServiceError('Ordem do tier deve ser um número inteiro entre -9999 e 9999.', 400);
  }
  return num;
}

function parsePositiveInt(val, fieldName = 'ID') {
  const num = typeof val === 'string' && /^\d+$/.test(val.trim())
    ? parseInt(val.trim(), 10)
    : typeof val === 'number'
      ? val
      : NaN;
  if (!Number.isInteger(num) || num <= 0) {
    throw createServiceError(`${fieldName} inválido.`, 400);
  }
  return num;
}

function sanitizeOptionalText(val, maxLength = 500) {
  if (val === undefined || val === null) return null;
  if (typeof val !== 'string') {
    throw createServiceError('Texto inválido.', 400);
  }
  const cleaned = sanitizeString(val.trim());
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

/**
 * Garante a criação idempotente das tabelas de recompensas, tiers e entregas,
 * populando os dados iniciais apenas quando as tabelas estiverem vazias.
 */
async function ensureRewardsTables() {
  if (ensureRewardsTablesPromise) {
    return ensureRewardsTablesPromise;
  }

  ensureRewardsTablesPromise = (async () => {
    if (!sql) {
      throw new Error('Conexão com banco de dados não inicializada.');
    }

    await sql`
      CREATE TABLE IF NOT EXISTS reward_tiers (
        slug VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        min_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        color VARCHAR(20) NOT NULL DEFAULT '#6b7280',
        sort_order INTEGER NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT true,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT check_reward_tier_min_amount CHECK (min_amount >= 0)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS rewards (
        id SERIAL PRIMARY KEY,
        code VARCHAR(60) UNIQUE,
        tier_slug VARCHAR(50) NOT NULL REFERENCES reward_tiers(slug) ON UPDATE CASCADE ON DELETE RESTRICT,
        name VARCHAR(150) NOT NULL,
        description TEXT,
        quantidade_disponivel INTEGER,
        active BOOLEAN NOT NULL DEFAULT true,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT check_rewards_quantidade CHECK (quantidade_disponivel IS NULL OR quantidade_disponivel >= 0)
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_rewards_tier_slug ON rewards(tier_slug)`;

    await sql`
      CREATE TABLE IF NOT EXISTS reward_deliveries (
        id SERIAL PRIMARY KEY,
        reward_id INTEGER NOT NULL REFERENCES rewards(id) ON DELETE RESTRICT,
        doador_id INTEGER NOT NULL REFERENCES doadores(id) ON DELETE RESTRICT,
        quantidade INTEGER NOT NULL DEFAULT 1,
        data_entrega DATE NOT NULL,
        observacoes TEXT,
        registrado_por VARCHAR(255) NOT NULL,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT check_reward_delivery_qty CHECK (quantidade > 0)
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_reward_deliveries_reward_id ON reward_deliveries(reward_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_reward_deliveries_doador_id ON reward_deliveries(doador_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_reward_deliveries_data ON reward_deliveries(data_entrega DESC)`;

    const tierCountRes = await sql`SELECT COUNT(*)::int AS total FROM reward_tiers`;
    const tierCount = parseInt(tierCountRes.rows?.[0]?.total || 0, 10);
    if (tierCount === 0) {
      for (const t of DEFAULT_TIERS_SEED) {
        await sql`
          INSERT INTO reward_tiers (slug, name, min_amount, color, sort_order, active)
          VALUES (${t.slug}, ${t.name}, ${t.min_amount}, ${t.color}, ${t.sort_order}, true)
          ON CONFLICT (slug) DO NOTHING
        `;
      }
    }

    const rewardCountRes = await sql`SELECT COUNT(*)::int AS total FROM rewards`;
    const rewardCount = parseInt(rewardCountRes.rows?.[0]?.total || 0, 10);
    if (rewardCount === 0) {
      for (const [tierSlug, items] of Object.entries(DEFAULT_REWARDS_BY_TIER)) {
        for (const item of items) {
          await sql`
            INSERT INTO rewards (code, tier_slug, name, description, quantidade_disponivel, active)
            VALUES (${item.id}, ${tierSlug}, ${item.name}, ${item.description}, ${null}, true)
            ON CONFLICT (code) DO NOTHING
          `;
        }
      }
    }
  })().catch((err) => {
    ensureRewardsTablesPromise = null;
    throw err;
  });

  return ensureRewardsTablesPromise;
}

function getTier(value, tiersMap = TIERS) {
  const entries = Object.entries(tiersMap)
    .map(([slug, data]) => ({ slug, min: Number(data.min ?? data.min_amount ?? 0) }))
    .sort((a, b) => a.min - b.min);

  if (entries.length === 0) {
    return 'bronze';
  }

  let currentTier = entries[0].slug;
  for (const entry of entries) {
    if (value >= entry.min) currentTier = entry.slug;
    else break;
  }
  return currentTier;
}

function getNextTier(currentTier, tiersMap = TIERS) {
  const ordered = Object.entries(tiersMap)
    .map(([slug, data]) => ({ slug, min: Number(data.min ?? data.min_amount ?? 0) }))
    .sort((a, b) => a.min - b.min)
    .map((entry) => entry.slug);

  const idx = ordered.indexOf(currentTier);
  return idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;
}

function getTierProgress(value, tier, tiersMap = TIERS) {
  const nextTier = getNextTier(tier, tiersMap);
  if (!nextTier) return 100;
  const nextMin = Number(tiersMap[nextTier]?.min ?? 0);
  const currentMin = Number(tiersMap[tier]?.min ?? 0);
  if (nextMin <= currentMin) return 100;
  return Math.max(0, Math.min(100, Math.round(((value - currentMin) / (nextMin - currentMin)) * 100)));
}

async function calculateLifetimeDonations(email) {
  try {
    if (!sql) return 0;
    const result = await sql`
      SELECT SUM(t.valor) as total 
      FROM transacoes t
      JOIN doadores d ON t.doador_id = d.id
      WHERE d.whatsapp = ${email} AND t.status = 'CONFIRMADA'
    `;
    return parseFloat(result.rows[0]?.total || 0);
  } catch (error) {
    console.error('❌ Erro ao calcular doações vitalícias:', error.message);
    return 0;
  }
}

async function listRewardTiers({ includeInactive = true } = {}) {
  await ensureRewardsTables();

  const includeAll = Boolean(includeInactive);
  const result = await sql`
    SELECT
      rt.slug,
      rt.name,
      rt.min_amount,
      rt.color,
      rt.sort_order,
      rt.active,
      rt.criado_em,
      rt.atualizado_em,
      COALESCE(rc.rewards_count, 0)::int AS rewards_count
    FROM reward_tiers rt
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS rewards_count
      FROM rewards
      WHERE tier_slug = rt.slug
    ) rc ON true
    WHERE (${includeAll}::boolean = true OR rt.active = true)
    ORDER BY rt.min_amount ASC, rt.sort_order ASC, rt.slug ASC
  `;

  return (result.rows || []).map((row) => ({
    ...row,
    min_amount: parseFloat(row.min_amount),
    sort_order: parseInt(row.sort_order, 10) || 0,
    rewards_count: parseInt(row.rewards_count, 10) || 0
  }));
}

async function getTiersMap() {
  try {
    const rows = await listRewardTiers({ includeInactive: false });
    if (!rows || rows.length === 0) {
      return TIERS;
    }
    const map = {};
    for (const row of rows) {
      map[row.slug] = {
        min: parseFloat(row.min_amount),
        name: row.name,
        color: row.color,
        sort_order: row.sort_order,
        active: row.active
      };
    }
    return map;
  } catch (error) {
    console.warn('⚠️  Fallback para TIERS padrão:', error.message);
    return TIERS;
  }
}

async function createRewardTier({ slug, name, min_amount, color, sort_order, active = true }) {
  await ensureRewardsTables();

  const cleanName = sanitizeString(typeof name === 'string' ? name.trim() : '').slice(0, 100);
  if (!cleanName) {
    throw createServiceError('Nome do tier é obrigatório.', 400);
  }

  const candidateSlug = typeof slug === 'string' && slug.trim() ? slug : slugifyText(cleanName);
  const cleanSlug = normalizeSlug(candidateSlug);
  if (!cleanSlug) {
    throw createServiceError('Slug do tier inválido. Use apenas letras minúsculas, números, "-" ou "_".', 400);
  }

  const minVal = parseMinAmount(min_amount);
  const cleanColor = normalizeHexColor(color);
  const cleanSortOrder = parseSortOrder(sort_order);
  const isActive = active !== false;

  const existing = await sql`SELECT slug FROM reward_tiers WHERE slug = ${cleanSlug} LIMIT 1`;
  if (existing.rows && existing.rows.length > 0) {
    throw createServiceError('Já existe um tier cadastrado com este slug.', 409);
  }

  const inserted = await sql`
    INSERT INTO reward_tiers (slug, name, min_amount, color, sort_order, active)
    VALUES (${cleanSlug}, ${cleanName}, ${minVal}, ${cleanColor}, ${cleanSortOrder}, ${isActive})
    RETURNING slug, name, min_amount, color, sort_order, active, criado_em, atualizado_em
  `;

  const row = inserted.rows[0];
  return {
    ...row,
    min_amount: parseFloat(row.min_amount),
    sort_order: parseInt(row.sort_order, 10) || 0,
    rewards_count: 0
  };
}

async function updateRewardTier(slug, { name, min_amount, color, sort_order, active }) {
  await ensureRewardsTables();

  const cleanSlug = normalizeSlug(slug);
  if (!cleanSlug) {
    throw createServiceError('Slug do tier inválido.', 400);
  }

  const existingRes = await sql`
    SELECT slug, name, min_amount, color, sort_order, active
    FROM reward_tiers
    WHERE slug = ${cleanSlug}
    LIMIT 1
  `;
  if (!existingRes.rows || existingRes.rows.length === 0) {
    throw createServiceError('Tier não encontrado.', 404);
  }

  const current = existingRes.rows[0];
  const nextName = name !== undefined
    ? sanitizeString(typeof name === 'string' ? name.trim() : '').slice(0, 100)
    : current.name;
  if (!nextName) {
    throw createServiceError('Nome do tier é obrigatório.', 400);
  }

  const nextMin = min_amount !== undefined ? parseMinAmount(min_amount) : parseFloat(current.min_amount);
  const nextColor = color !== undefined ? normalizeHexColor(color) : current.color;
  const nextSort = sort_order !== undefined ? parseSortOrder(sort_order) : parseInt(current.sort_order, 10) || 0;
  const nextActive = active !== undefined ? Boolean(active) : current.active;

  const updated = await sql`
    UPDATE reward_tiers
    SET
      name = ${nextName},
      min_amount = ${nextMin},
      color = ${nextColor},
      sort_order = ${nextSort},
      active = ${nextActive},
      atualizado_em = CURRENT_TIMESTAMP
    WHERE slug = ${cleanSlug}
    RETURNING slug, name, min_amount, color, sort_order, active, criado_em, atualizado_em
  `;

  const countRes = await sql`
    SELECT COUNT(*)::int AS rewards_count FROM rewards WHERE tier_slug = ${cleanSlug}
  `;

  const row = updated.rows[0];
  return {
    ...row,
    min_amount: parseFloat(row.min_amount),
    sort_order: parseInt(row.sort_order, 10) || 0,
    rewards_count: parseInt(countRes.rows?.[0]?.rewards_count || 0, 10)
  };
}

async function deleteRewardTier(slug) {
  await ensureRewardsTables();

  const cleanSlug = normalizeSlug(slug);
  if (!cleanSlug) {
    throw createServiceError('Slug do tier inválido.', 400);
  }

  const existing = await sql`SELECT slug FROM reward_tiers WHERE slug = ${cleanSlug} LIMIT 1`;
  if (!existing.rows || existing.rows.length === 0) {
    throw createServiceError('Tier não encontrado.', 404);
  }

  const countRes = await sql`
    SELECT COUNT(*)::int AS total FROM rewards WHERE tier_slug = ${cleanSlug}
  `;
  const linkedCount = parseInt(countRes.rows?.[0]?.total || 0, 10);
  if (linkedCount > 0) {
    throw createServiceError('Não é possível excluir este tier pois existem recompensas vinculadas a ele.', 409);
  }

  await sql`DELETE FROM reward_tiers WHERE slug = ${cleanSlug}`;
  return { deleted: true, slug: cleanSlug };
}

async function getRewardByIdEnriched(rewardId) {
  const result = await sql`
    SELECT
      r.id,
      r.code,
      r.tier_slug,
      r.name,
      r.description,
      r.quantidade_disponivel,
      r.active,
      r.criado_em,
      r.atualizado_em,
      rt.name AS tier_name,
      rt.color AS tier_color,
      rt.min_amount AS tier_min_amount,
      COALESCE(d.quantidade_entregue, 0)::int AS quantidade_entregue
    FROM rewards r
    JOIN reward_tiers rt ON rt.slug = r.tier_slug
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(quantidade), 0)::int AS quantidade_entregue
      FROM reward_deliveries
      WHERE reward_id = r.id
    ) d ON true
    WHERE r.id = ${rewardId}
    LIMIT 1
  `;

  if (!result.rows || result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    ...row,
    tier_min_amount: parseFloat(row.tier_min_amount),
    quantidade_disponivel: row.quantidade_disponivel === null || row.quantidade_disponivel === undefined
      ? null
      : parseInt(row.quantidade_disponivel, 10),
    quantidade_entregue: parseInt(row.quantidade_entregue, 10) || 0
  };
}

async function listRewards({ tier = '', includeInactive = true } = {}) {
  await ensureRewardsTables();

  const tierFilter = typeof tier === 'string' && tier.trim() ? tier.trim().toLowerCase() : null;
  const includeAll = Boolean(includeInactive);

  const result = await sql`
    SELECT
      r.id,
      r.code,
      r.tier_slug,
      r.name,
      r.description,
      r.quantidade_disponivel,
      r.active,
      r.criado_em,
      r.atualizado_em,
      rt.name AS tier_name,
      rt.color AS tier_color,
      rt.min_amount AS tier_min_amount,
      COALESCE(d.quantidade_entregue, 0)::int AS quantidade_entregue
    FROM rewards r
    JOIN reward_tiers rt ON rt.slug = r.tier_slug
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(quantidade), 0)::int AS quantidade_entregue
      FROM reward_deliveries
      WHERE reward_id = r.id
    ) d ON true
    WHERE (${tierFilter}::text IS NULL OR r.tier_slug = ${tierFilter})
      AND (${includeAll}::boolean = true OR r.active = true)
    ORDER BY rt.min_amount ASC, rt.sort_order ASC, r.name ASC, r.id ASC
  `;

  return (result.rows || []).map((row) => ({
    ...row,
    tier_min_amount: parseFloat(row.tier_min_amount),
    quantidade_disponivel: row.quantidade_disponivel === null || row.quantidade_disponivel === undefined
      ? null
      : parseInt(row.quantidade_disponivel, 10),
    quantidade_entregue: parseInt(row.quantidade_entregue, 10) || 0
  }));
}

async function createReward({ tier_slug, name, description, quantidade_disponivel, active = true }) {
  await ensureRewardsTables();

  const cleanName = sanitizeString(typeof name === 'string' ? name.trim() : '').slice(0, 150);
  if (!cleanName) {
    throw createServiceError('Nome da recompensa é obrigatório.', 400);
  }

  const cleanTierSlug = normalizeSlug(tier_slug);
  if (!cleanTierSlug) {
    throw createServiceError('Tier da recompensa é obrigatório.', 400);
  }

  const tierExists = await sql`SELECT slug FROM reward_tiers WHERE slug = ${cleanTierSlug} LIMIT 1`;
  if (!tierExists.rows || tierExists.rows.length === 0) {
    throw createServiceError('Tier informado não existe.', 400);
  }

  const cleanDescription = sanitizeOptionalText(description, 500);
  const stock = parseOptionalStock(quantidade_disponivel);
  const isActive = active !== false;

  const inserted = await sql`
    INSERT INTO rewards (tier_slug, name, description, quantidade_disponivel, active)
    VALUES (${cleanTierSlug}, ${cleanName}, ${cleanDescription}, ${stock}, ${isActive})
    RETURNING id
  `;

  return getRewardByIdEnriched(inserted.rows[0].id);
}

async function updateReward(id, { tier_slug, name, description, quantidade_disponivel, active }) {
  await ensureRewardsTables();

  const rewardId = parsePositiveInt(id, 'ID da recompensa');
  const existingRes = await sql`
    SELECT id, tier_slug, name, description, quantidade_disponivel, active
    FROM rewards
    WHERE id = ${rewardId}
    LIMIT 1
  `;
  if (!existingRes.rows || existingRes.rows.length === 0) {
    throw createServiceError('Recompensa não encontrada.', 404);
  }

  const current = existingRes.rows[0];

  let nextTierSlug = current.tier_slug;
  if (tier_slug !== undefined) {
    nextTierSlug = normalizeSlug(tier_slug);
    if (!nextTierSlug) {
      throw createServiceError('Tier inválido.', 400);
    }
    const tierExists = await sql`SELECT slug FROM reward_tiers WHERE slug = ${nextTierSlug} LIMIT 1`;
    if (!tierExists.rows || tierExists.rows.length === 0) {
      throw createServiceError('Tier informado não existe.', 400);
    }
  }

  const nextName = name !== undefined
    ? sanitizeString(typeof name === 'string' ? name.trim() : '').slice(0, 150)
    : current.name;
  if (!nextName) {
    throw createServiceError('Nome da recompensa é obrigatório.', 400);
  }

  const nextDescription = description !== undefined
    ? sanitizeOptionalText(description, 500)
    : current.description;
  const nextStock = quantidade_disponivel !== undefined
    ? parseOptionalStock(quantidade_disponivel)
    : current.quantidade_disponivel;
  const nextActive = active !== undefined ? Boolean(active) : current.active;

  await sql`
    UPDATE rewards
    SET
      tier_slug = ${nextTierSlug},
      name = ${nextName},
      description = ${nextDescription},
      quantidade_disponivel = ${nextStock},
      active = ${nextActive},
      atualizado_em = CURRENT_TIMESTAMP
    WHERE id = ${rewardId}
  `;

  return getRewardByIdEnriched(rewardId);
}

async function deleteReward(id) {
  await ensureRewardsTables();

  const rewardId = parsePositiveInt(id, 'ID da recompensa');
  const existing = await sql`SELECT id FROM rewards WHERE id = ${rewardId} LIMIT 1`;
  if (!existing.rows || existing.rows.length === 0) {
    throw createServiceError('Recompensa não encontrada.', 404);
  }

  const deliveriesRes = await sql`
    SELECT COUNT(*)::int AS total FROM reward_deliveries WHERE reward_id = ${rewardId}
  `;
  const deliveriesCount = parseInt(deliveriesRes.rows?.[0]?.total || 0, 10);
  if (deliveriesCount > 0) {
    throw createServiceError(
      'Não é possível excluir esta recompensa pois já existem entregas registradas. Desative-a em vez de excluir.',
      409
    );
  }

  await sql`DELETE FROM rewards WHERE id = ${rewardId}`;
  return { deleted: true, id: rewardId };
}

async function listDonorsForRewards({ search = '', limit = 200 } = {}) {
  await ensureRewardsTables();

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500);
  const trimmed = typeof search === 'string' ? search.trim() : '';
  const searchTerm = trimmed ? `%${trimmed}%` : null;
  const exactId = /^\d+$/.test(trimmed) ? parseInt(trimmed, 10) : null;

  const result = await sql`
    SELECT
      d.id,
      d.nome,
      d.whatsapp,
      d.anonimo,
      d.criado_em,
      COALESCE(t.total_doado, 0) AS total_doado,
      COALESCE(rd.qtd_entregas, 0)::int AS qtd_entregas
    FROM doadores d
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(valor), 0) AS total_doado
      FROM transacoes
      WHERE doador_id = d.id AND status = 'CONFIRMADA'
    ) t ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(quantidade), 0)::int AS qtd_entregas
      FROM reward_deliveries
      WHERE doador_id = d.id
    ) rd ON true
    WHERE (
      ${searchTerm}::text IS NULL
      OR COALESCE(d.nome, '') ILIKE ${searchTerm}
      OR COALESCE(d.whatsapp, '') ILIKE ${searchTerm}
      OR (${exactId}::int IS NOT NULL AND d.id = ${exactId})
    )
    ORDER BY d.anonimo ASC, COALESCE(t.total_doado, 0) DESC, d.criado_em DESC
    LIMIT ${safeLimit}
  `;

  return (result.rows || []).map((row) => ({
    ...row,
    id: parseInt(row.id, 10),
    total_doado: parseFloat(row.total_doado || 0),
    qtd_entregas: parseInt(row.qtd_entregas || 0, 10)
  }));
}

async function getDeliveryByIdEnriched(deliveryId) {
  const result = await sql`
    SELECT
      rd.id,
      rd.reward_id,
      rd.doador_id,
      rd.quantidade,
      TO_CHAR(rd.data_entrega, 'YYYY-MM-DD') AS data_entrega,
      rd.observacoes,
      rd.registrado_por,
      rd.criado_em,
      r.name AS reward_name,
      r.tier_slug,
      r.quantidade_disponivel AS reward_quantidade_disponivel,
      rt.name AS tier_name,
      rt.color AS tier_color,
      d.nome AS doador_nome,
      d.whatsapp AS doador_whatsapp,
      d.anonimo AS doador_anonimo
    FROM reward_deliveries rd
    JOIN rewards r ON r.id = rd.reward_id
    JOIN reward_tiers rt ON rt.slug = r.tier_slug
    JOIN doadores d ON d.id = rd.doador_id
    WHERE rd.id = ${deliveryId}
    LIMIT 1
  `;

  if (!result.rows || result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    ...row,
    id: parseInt(row.id, 10),
    reward_id: parseInt(row.reward_id, 10),
    doador_id: parseInt(row.doador_id, 10),
    quantidade: parseInt(row.quantidade, 10),
    reward_quantidade_disponivel: row.reward_quantidade_disponivel === null || row.reward_quantidade_disponivel === undefined
      ? null
      : parseInt(row.reward_quantidade_disponivel, 10)
  };
}

async function listRewardDeliveries({ rewardId, doadorId, search = '', from = '', to = '', limit = 50, offset = 0 } = {}) {
  await ensureRewardsTables();

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  const rewardIdFilter = rewardId !== undefined && rewardId !== null && rewardId !== ''
    ? parsePositiveInt(rewardId, 'reward_id')
    : null;
  const doadorIdFilter = doadorId !== undefined && doadorId !== null && doadorId !== ''
    ? parsePositiveInt(doadorId, 'doador_id')
    : null;

  let fromFilter = null;
  if (from && typeof from === 'string' && from.trim()) {
    fromFilter = validateCalendarDate(from);
    if (!fromFilter) throw createServiceError('Data inicial inválida. Use YYYY-MM-DD.', 400);
  }

  let toFilter = null;
  if (to && typeof to === 'string' && to.trim()) {
    toFilter = validateCalendarDate(to);
    if (!toFilter) throw createServiceError('Data final inválida. Use YYYY-MM-DD.', 400);
  }

  const searchTerm = typeof search === 'string' && search.trim() ? `%${search.trim()}%` : null;

  const result = await sql`
    SELECT
      rd.id,
      rd.reward_id,
      rd.doador_id,
      rd.quantidade,
      TO_CHAR(rd.data_entrega, 'YYYY-MM-DD') AS data_entrega,
      rd.observacoes,
      rd.registrado_por,
      rd.criado_em,
      r.name AS reward_name,
      r.tier_slug,
      rt.name AS tier_name,
      rt.color AS tier_color,
      d.nome AS doador_nome,
      d.whatsapp AS doador_whatsapp,
      d.anonimo AS doador_anonimo
    FROM reward_deliveries rd
    JOIN rewards r ON r.id = rd.reward_id
    JOIN reward_tiers rt ON rt.slug = r.tier_slug
    JOIN doadores d ON d.id = rd.doador_id
    WHERE (${rewardIdFilter}::int IS NULL OR rd.reward_id = ${rewardIdFilter})
      AND (${doadorIdFilter}::int IS NULL OR rd.doador_id = ${doadorIdFilter})
      AND (${fromFilter}::date IS NULL OR rd.data_entrega >= ${fromFilter}::date)
      AND (${toFilter}::date IS NULL OR rd.data_entrega <= ${toFilter}::date)
      AND (
        ${searchTerm}::text IS NULL
        OR COALESCE(d.nome, '') ILIKE ${searchTerm}
        OR COALESCE(d.whatsapp, '') ILIKE ${searchTerm}
        OR r.name ILIKE ${searchTerm}
        OR COALESCE(rd.observacoes, '') ILIKE ${searchTerm}
        OR rd.registrado_por ILIKE ${searchTerm}
      )
    ORDER BY rd.data_entrega DESC, rd.id DESC
    LIMIT ${safeLimit}
    OFFSET ${safeOffset}
  `;

  return (result.rows || []).map((row) => ({
    ...row,
    id: parseInt(row.id, 10),
    reward_id: parseInt(row.reward_id, 10),
    doador_id: parseInt(row.doador_id, 10),
    quantidade: parseInt(row.quantidade, 10)
  }));
}

async function createRewardDelivery({ rewardId, doadorId, quantidade = 1, dataEntrega, observacoes, registradoPor }) {
  await ensureRewardsTables();

  const rId = parsePositiveInt(rewardId, 'Recompensa');
  const dId = parsePositiveInt(doadorId, 'Doador');

  const qty = parsePositiveInt(quantidade ?? 1, 'Quantidade');
  if (qty > 10000) {
    throw createServiceError('Quantidade por entrega não pode exceder 10.000.', 400);
  }

  const validDate = validateCalendarDate(dataEntrega);
  if (!validDate) {
    throw createServiceError('Data de entrega inválida. Use uma data real no formato YYYY-MM-DD.', 400);
  }

  const cleanObs = sanitizeOptionalText(observacoes, 500);
  const cleanAdmin = typeof registradoPor === 'string' && registradoPor.trim()
    ? registradoPor.trim().slice(0, 255)
    : 'admin';

  const donorCheck = await sql`
    SELECT id FROM doadores WHERE id = ${dId} LIMIT 1
  `;
  if (!donorCheck.rows || donorCheck.rows.length === 0) {
    throw createServiceError('Doador não encontrado na tabela doadores.', 404);
  }

  // Decremento atômico do estoque finito (impede saldo negativo em requisições concorrentes)
  const stockUpdate = await sql`
    UPDATE rewards
    SET
      quantidade_disponivel = CASE
        WHEN quantidade_disponivel IS NULL THEN NULL
        ELSE quantidade_disponivel - ${qty}
      END,
      atualizado_em = CURRENT_TIMESTAMP
    WHERE id = ${rId}
      AND (quantidade_disponivel IS NULL OR quantidade_disponivel >= ${qty})
    RETURNING id, name, tier_slug, quantidade_disponivel
  `;

  if (!stockUpdate.rows || stockUpdate.rows.length === 0) {
    const rewardCheck = await sql`
      SELECT id, quantidade_disponivel FROM rewards WHERE id = ${rId} LIMIT 1
    `;
    if (!rewardCheck.rows || rewardCheck.rows.length === 0) {
      throw createServiceError('Recompensa não encontrada.', 404);
    }
    const available = parseInt(rewardCheck.rows[0].quantidade_disponivel, 10);
    throw createServiceError(
      `Quantidade disponível insuficiente para esta recompensa (disponível: ${available}).`,
      409
    );
  }

  let insertedId;
  try {
    const inserted = await sql`
      INSERT INTO reward_deliveries (
        reward_id, doador_id, quantidade, data_entrega, observacoes, registrado_por
      )
      VALUES (
        ${rId}, ${dId}, ${qty}, ${validDate}::date, ${cleanObs}, ${cleanAdmin}
      )
      RETURNING id
    `;
    insertedId = inserted.rows[0].id;
  } catch (insertError) {
    // Compensação caso a inserção da entrega falhe após o decremento do estoque
    await sql`
      UPDATE rewards
      SET
        quantidade_disponivel = CASE
          WHEN quantidade_disponivel IS NULL THEN NULL
          ELSE quantidade_disponivel + ${qty}
        END,
        atualizado_em = CURRENT_TIMESTAMP
      WHERE id = ${rId}
    `.catch(() => {});
    throw insertError;
  }

  return getDeliveryByIdEnriched(insertedId);
}

async function updateRewardDelivery(id, { dataEntrega, observacoes }) {
  await ensureRewardsTables();

  const deliveryId = parsePositiveInt(id, 'ID da entrega');
  const existing = await sql`
    SELECT id, TO_CHAR(data_entrega, 'YYYY-MM-DD') AS data_entrega, observacoes
    FROM reward_deliveries
    WHERE id = ${deliveryId}
    LIMIT 1
  `;
  if (!existing.rows || existing.rows.length === 0) {
    throw createServiceError('Entrega não encontrada.', 404);
  }

  const current = existing.rows[0];
  let nextDate = current.data_entrega;
  if (dataEntrega !== undefined) {
    nextDate = validateCalendarDate(dataEntrega);
    if (!nextDate) {
      throw createServiceError('Data de entrega inválida. Use uma data real no formato YYYY-MM-DD.', 400);
    }
  }

  const nextObs = observacoes !== undefined ? sanitizeOptionalText(observacoes, 500) : current.observacoes;

  await sql`
    UPDATE reward_deliveries
    SET data_entrega = ${nextDate}::date, observacoes = ${nextObs}
    WHERE id = ${deliveryId}
  `;

  return getDeliveryByIdEnriched(deliveryId);
}

async function deleteRewardDelivery(id) {
  await ensureRewardsTables();

  const deliveryId = parsePositiveInt(id, 'ID da entrega');
  const deleted = await sql`
    DELETE FROM reward_deliveries
    WHERE id = ${deliveryId}
    RETURNING id, reward_id, quantidade
  `;

  if (!deleted.rows || deleted.rows.length === 0) {
    throw createServiceError('Entrega não encontrada.', 404);
  }

  const row = deleted.rows[0];
  const qty = parseInt(row.quantidade, 10);

  await sql`
    UPDATE rewards
    SET
      quantidade_disponivel = CASE
        WHEN quantidade_disponivel IS NULL THEN NULL
        ELSE quantidade_disponivel + ${qty}
      END,
      atualizado_em = CURRENT_TIMESTAMP
    WHERE id = ${row.reward_id}
  `;

  return {
    deleted: true,
    id: parseInt(row.id, 10),
    reward_id: parseInt(row.reward_id, 10),
    quantidade_restaurada: qty
  };
}

async function getRewardsStatus(email) {
  const [lifetime, tiersMap] = await Promise.all([
    calculateLifetimeDonations(email),
    getTiersMap()
  ]);
  const tier = getTier(lifetime, tiersMap);
  const nextTier = getNextTier(tier, tiersMap);
  const nextMin = nextTier ? tiersMap[nextTier].min : null;
  const remaining = nextMin ? Math.max(0, nextMin - lifetime) : 0;
  return {
    email,
    lifetime,
    tier,
    nextTier,
    nextMin,
    remaining,
    progress: getTierProgress(lifetime, tier, tiersMap),
    tiers: tiersMap
  };
}

async function trackDonation(email, value, txid) {
  console.log(`[Rewards] Tracking donation: ${email} - R$${value} - txid: ${txid}`);
}

function getAvailableRewards(tier) {
  return DEFAULT_REWARDS_BY_TIER[tier] || [];
}

async function getAvailableRewardsAsync(tier) {
  try {
    const cleanTier = typeof tier === 'string' ? tier.trim().toLowerCase() : '';
    const rows = await listRewards({ tier: cleanTier, includeInactive: false });
    return rows.map((row) => ({
      id: row.code || String(row.id),
      reward_id: row.id,
      name: row.name,
      description: row.description || '',
      quantidade_disponivel: row.quantidade_disponivel
    }));
  } catch (error) {
    console.warn('⚠️  Fallback para getAvailableRewards padrão:', error.message);
    return getAvailableRewards(tier);
  }
}

module.exports = {
  TIERS,
  getTier,
  getRewardsStatus,
  trackDonation,
  getAvailableRewards,
  getAvailableRewardsAsync,
  getTiersMap,
  ensureRewardsTables,
  validateCalendarDate,
  listRewardTiers,
  createRewardTier,
  updateRewardTier,
  deleteRewardTier,
  listRewards,
  createReward,
  updateReward,
  deleteReward,
  listDonorsForRewards,
  listRewardDeliveries,
  createRewardDelivery,
  updateRewardDelivery,
  deleteRewardDelivery
};
