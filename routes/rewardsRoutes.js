// Rotas de rewards (sistema de recompensas por doações)
const express = require('express');
const router = express.Router();
const { getRewardsStatus, getAvailableRewards, TIERS } = require('../services/rewardsService');
const { requireAuth } = require('../middleware/authMiddleware');

/**
 * GET /api/rewards/status?email=...
 * Retorna o status de recompensas do doador
 * Requer autenticação
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Email é obrigatório' });
    }

    const status = await getRewardsStatus(email);
    return res.status(200).json(status);
  } catch (error) {
    console.error('❌ Erro ao buscar status de rewards:', error.message);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/rewards/tiers
 * Retorna todos os tiers com seus limites
 * Público
 */
router.get('/tiers', (req, res) => {
  return res.status(200).json({ tiers: TIERS });
});

/**
 * GET /api/rewards/available?tier=...
 * Retorna as recompensas disponíveis para um tier específico
 * Requer autenticação
 */
router.get('/available', requireAuth, (req, res) => {
  try {
    const { tier } = req.query;

    if (!tier) {
      return res.status(400).json({ error: 'Tier é obrigatório' });
    }

    const validTiers = ['bronze', 'silver', 'gold', 'platinum'];
    const tierLower = tier.toLowerCase();

    if (!validTiers.includes(tierLower)) {
      return res.status(400).json({ error: 'Tier inválido. Valores válidos: bronze, silver, gold, platinum' });
    }

    const rewards = getAvailableRewards(tierLower);
    return res.status(200).json({ tier: tierLower, rewards });
  } catch (error) {
    console.error('❌ Erro ao buscar recompensas:', error.message);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;