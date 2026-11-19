// Rotas públicas independentes para leitura em tempo real das metas de doação
const express = require('express');
const router = express.Router();
const { consultChargeLimiter } = require('../middleware/security');
const { getPublicGoalsPayload, getPublicGoalBySlug, listGoalDonors } = require('../services/goalsService');

function setNoCacheHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
}

/**
 * GET /api/metas
 * Retorna todas as metas ativas com cálculo em tempo real a partir das transações confirmadas.
 * Query params opcionais:
 *   - campanha_id: filtra metas vinculadas à campanha informada
 *   - destaque=true: retorna apenas a meta em destaque
 */
router.get('/', consultChargeLimiter, async (req, res) => {
  setNoCacheHeaders(res);
  try {
    const campanhaId = typeof req.query.campanha_id === 'string' ? req.query.campanha_id.trim() : '';
    const onlyFeatured = req.query.destaque === 'true' || req.query.destaque === '1';
    const payload = await getPublicGoalsPayload({ campanhaId, onlyFeatured });
    return res.status(200).json(payload);
  } catch (error) {
    console.error('❌ Erro ao consultar metas públicas:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor ao consultar metas.'
    });
  }
});

/**
 * GET /api/metas/:slug/doadores
 * Retorna os doadores identificados com transações confirmadas vinculadas a esta meta.
 */
router.get('/:slug/doadores', consultChargeLimiter, async (req, res) => {
  setNoCacheHeaders(res);
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;

    if (page < 1) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro page deve ser maior que 0.'
      });
    }
    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro limit deve estar entre 1 e 100.'
      });
    }

    const offset = (page - 1) * limit;
    const result = await listGoalDonors({
      slug: req.params.slug,
      isPublic: true,
      limit,
      offset
    });
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Meta não encontrada.'
      });
    }

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      meta: result.meta,
      doadores: result.doadores
    });
  } catch (error) {
    console.error('❌ Erro ao consultar doadores da meta pública:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor ao consultar doadores da meta.'
    });
  }
});

/**
 * GET /api/metas/:slug
 * Retorna uma meta ativa específica pelo slug com cálculo em tempo real.
 */
router.get('/:slug', consultChargeLimiter, async (req, res) => {
  setNoCacheHeaders(res);
  try {
    const meta = await getPublicGoalBySlug(req.params.slug);
    if (!meta) {
      return res.status(404).json({
        success: false,
        error: 'Meta não encontrada.'
      });
    }
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      meta
    });
  } catch (error) {
    console.error('❌ Erro ao consultar meta pública por slug:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor ao consultar meta.'
    });
  }
});

module.exports = router;
