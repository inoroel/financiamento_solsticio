// Rewards service - tier-based donation rewards
const { sql } = require('../config/database');

const TIERS = {
  bronze: { min: parseFloat(process.env.REWARD_TIER_BRONZE) || 50, name: 'Bronze', color: '#CD7F32' },
  silver: { min: parseFloat(process.env.REWARD_TIER_SILVER) || 200, name: 'Silver', color: '#C0C0C0' },
  gold: { min: parseFloat(process.env.REWARD_TIER_GOLD) || 500, name: 'Gold', color: '#FFD700' },
  platinum: { min: parseFloat(process.env.REWARD_TIER_PLATINUM) || 1000, name: 'Platinum', color: '#E5E4E2' }
};

function getTier(value) {
  const tiers = ['bronze', 'silver', 'gold', 'platinum'];
  let currentTier = 'bronze';
  for (const t of tiers) {
    if (value >= TIERS[t].min) currentTier = t;
    else break;
  }
  return currentTier;
}

function getNextTier(currentTier) {
  const tierOrder = ['bronze', 'silver', 'gold', 'platinum'];
  const idx = tierOrder.indexOf(currentTier);
  return idx < tierOrder.length - 1 ? tierOrder[idx + 1] : null;
}

function getTierProgress(value, tier) {
  const nextTier = getNextTier(tier);
  if (!nextTier) return 100;
  const nextMin = TIERS[nextTier].min;
  const currentMin = TIERS[tier].min;
  return Math.min(100, Math.round(((value - currentMin) / (nextMin - currentMin)) * 100));
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

async function getRewardsStatus(email) {
  const lifetime = await calculateLifetimeDonations(email);
  const tier = getTier(lifetime);
  const nextTier = getNextTier(tier);
  const nextMin = nextTier ? TIERS[nextTier].min : null;
  const remaining = nextMin ? nextMin - lifetime : 0;
  return { 
    email, 
    lifetime, 
    tier, 
    nextTier, 
    nextMin, 
    remaining, 
    progress: getTierProgress(lifetime, tier), 
    tiers: TIERS 
  };
}

async function trackDonation(email, value, txid) {
  // Future: record donation event, check for tier upgrade, send notification
  console.log(`[Rewards] Tracking donation: ${email} - R$${value} - txid: ${txid}`);
}

function getAvailableRewards(tier) {
  const rewards = {
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
  return rewards[tier] || [];
}

module.exports = { getRewardsStatus, trackDonation, getAvailableRewards, TIERS, getTier };