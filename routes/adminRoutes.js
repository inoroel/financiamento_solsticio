// Rotas administrativas protegidas por Google OAuth + lista de admins autorizados
const express = require('express');
const router = express.Router();
const { requireAdmin, requireRootAdmin } = require('../middleware/authMiddleware');
const { adminActionLimiter } = require('../middleware/security');
const {
  ROOT_ADMIN_EMAIL,
  listTransactionsForAdmin,
  listEstornos,
  listAdmins,
  addAdmin,
  removeAdmin
} = require('../services/adminService');
const {
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
} = require('../services/rewardsService');

function handleServiceError(res, error, fallbackMessage) {
  if (error && error.status && error.status < 500) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(`❌ ${fallbackMessage}:`, error?.message || error);
  return res.status(500).json({ error: fallbackMessage });
}

// Todas as rotas abaixo exigem sessão administrativa válida
router.use(requireAdmin);

/**
 * GET /api/admin/transacoes
 * Lista cobranças/transações da e-Rede para consulta e estorno.
 */
router.get('/transacoes', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim().slice(0, 30) : '';

    if (page < 1) {
      return res.status(400).json({ error: 'Parâmetro page deve ser maior que 0.' });
    }
    if (limit < 1 || limit > 100) {
      return res.status(400).json({ error: 'Parâmetro limit deve estar entre 1 e 100.' });
    }

    const offset = (page - 1) * limit;
    const data = await listTransactionsForAdmin({ search, status, limit, offset });

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('❌ Erro ao listar transações para admin:', error.message);
    return res.status(500).json({ error: 'Erro ao carregar transações.' });
  }
});

/**
 * GET /api/admin/estornos
 * Lista o log de auditoria de estornos executados.
 */
router.get('/estornos', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 30;

    if (page < 1) {
      return res.status(400).json({ error: 'Parâmetro page deve ser maior que 0.' });
    }
    if (limit < 1 || limit > 100) {
      return res.status(400).json({ error: 'Parâmetro limit deve estar entre 1 e 100.' });
    }

    const offset = (page - 1) * limit;
    const data = await listEstornos(limit, offset);

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('❌ Erro ao listar histórico de estornos:', error.message);
    return res.status(500).json({ error: 'Erro ao carregar histórico de estornos.' });
  }
});

/**
 * GET /api/admin/admins
 * Lista os e-mails cadastrados como administradores.
 */
router.get('/admins', async (req, res) => {
  try {
    const admins = await listAdmins();
    return res.status(200).json({
      admins,
      rootEmail: ROOT_ADMIN_EMAIL
    });
  } catch (error) {
    console.error('❌ Erro ao listar administradores:', error.message);
    return res.status(500).json({ error: 'Erro ao listar administradores.' });
  }
});

/**
 * POST /api/admin/admins
 * Cadastra um novo e-mail de administrador (restrito ao root).
 * Body: { email: string }
 */
router.post('/admins', adminActionLimiter, requireRootAdmin, async (req, res) => {
  try {
    const { email } = req.body || {};
    const admin = await addAdmin(email, req.user.email);
    console.log(`✅ Admin cadastrado por ${req.user.email}: ${admin.email}`);
    return res.status(201).json({ admin });
  } catch (error) {
    if (error.status && error.status < 500) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('❌ Erro ao cadastrar administrador:', error.message);
    return res.status(500).json({ error: 'Erro ao cadastrar administrador.' });
  }
});

/**
 * DELETE /api/admin/admins/:email
 * Remove um e-mail de administrador (restrito ao root).
 */
router.delete('/admins/:email', adminActionLimiter, requireRootAdmin, async (req, res) => {
  let targetEmail;
  try {
    targetEmail = decodeURIComponent(req.params.email || '');
  } catch (_) {
    return res.status(400).json({ error: 'E-mail inválido na URL.' });
  }

  try {
    const result = await removeAdmin(targetEmail);
    console.log(`🗑️  Admin removido por ${req.user.email}: ${result.email}`);
    return res.status(200).json({
      removed: result.removed,
      email: result.email,
      inEnvList: result.inEnvList
    });
  } catch (error) {
    return handleServiceError(res, error, 'Erro ao remover administrador.');
  }
});

// =================================================================
// TIERS DE RECOMPENSA
// =================================================================

/**
 * GET /api/admin/rewards/tiers
 */
router.get('/rewards/tiers', async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive !== 'false';
    const data = await listRewardTiers({ includeInactive });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleServiceError(res, error, 'Erro ao listar tiers de recompensa.');
  }
});

/**
 * POST /api/admin/rewards/tiers
 */
router.post('/rewards/tiers', adminActionLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const tier = await createRewardTier({
      slug: body.slug,
      name: body.name,
      min_amount: body.min_amount ?? body.minAmount,
      color: body.color,
      sort_order: body.sort_order ?? body.sortOrder,
      active: body.active
    });
    return res.status(201).json({ success: true, tier });
  } catch (error) {
    return handleServiceError(res, error, 'Erro ao cadastrar tier de recompensa.');
  }
});

/**
 * PUT /api/admin/rewards/tiers/:slug
 */
router.put('/rewards/tiers/:slug', adminActionLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const tier = await updateRewardTier(req.params.slug, {
      name: body.name,
      min_amount: body.min_amount ?? body.minAmount,
      color: body.color,
      sort_order: body.sort_order ?? body.sortOrder,
      active: body.active
    });
    return res.status(200).json({ success: true, tier });
  } catch (error) {
    return handleServiceError(res, error, 'Erro ao atualizar tier de recompensa.');
  }
});

/**
 * DELETE /api/admin/rewards/tiers/:slug
 */
router.delete('/rewards/tiers/:slug', adminActionLimiter, async (req, res) => {
  try {
    const result = await deleteRewardTier(req.params.slug);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return handleServiceError(res, error, 'Erro ao excluir tier de recompensa.');
  }
});

// =================================================================
// RECOMPENSAS E ESTOQUE
// =================================================================

/**
 * GET /api/admin/rewards
 */
router.get('/rewards', async (req, res) => {
  try {
    const tier = typeof req.query.tier === 'string' ? req.query.tier.trim() : '';
    const includeInactive = req.query.includeInactive !== 'false';
    const data = await listRewards({ tier, includeInactive });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleServiceError(res, error, 'Erro ao listar recompensas.');
  }
});

/**
 * POST /api/admin/rewards
 */
router.post('/rewards', adminActionLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const reward = await createReward({
      tier_slug: body.tier_slug ?? body.tierSlug,
      name: body.name,
      description: body.description,
      quantidade_disponivel: body.quantidade_disponivel ?? body.quantidadeDisponivel,
      active: body.active
    });
    return res.status(201).json({ success: true, reward });
  } catch (error) {
    return handleServiceError(res, error, 'Erro ao cadastrar recompensa.');
  }
});

/**
 * PUT /api/admin/rewards/:id
 */
router.put('/rewards/:id', adminActionLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const reward = await updateReward(req.params.id, {
      tier_slug: body.tier_slug ?? body.tierSlug,
      name: body.name,
      description: body.description,
      quantidade_disponivel: body.quantidade_disponivel ?? body.quantidadeDisponivel,
      active: body.active
    });
    return res.status(200).json({ success: true, reward });
  } catch (error) {
    return handleServiceError(res, error, 'Erro ao atualizar recompensa.');
  }
});

/**
 * DELETE /api/admin/rewards/:id
 */
router.delete('/rewards/:id', adminActionLimiter, async (req, res) => {
  try {
    const result = await deleteReward(req.params.id);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return handleServiceError(res, error, 'Erro ao excluir recompensa.');
  }
});

// =================================================================
// DOADORES (RECIPIENTES) E CONTROLE DE ENTREGAS
// =================================================================

/**
 * GET /api/admin/doadores
 */
router.get('/doadores', async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    const limit = parseInt(req.query.limit, 10) || 200;
    const data = await listDonorsForRewards({ search, limit });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleServiceError(res, error, 'Erro ao listar doadores.');
  }
});

/**
 * GET /api/admin/rewards/deliveries
 */
router.get('/rewards/deliveries', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;

    if (page < 1) {
      return res.status(400).json({ error: 'Parâmetro page deve ser maior que 0.' });
    }
    if (limit < 1 || limit > 100) {
      return res.status(400).json({ error: 'Parâmetro limit deve estar entre 1 e 100.' });
    }

    const offset = (page - 1) * limit;
    const data = await listRewardDeliveries({
      rewardId: req.query.reward_id ?? req.query.rewardId,
      doadorId: req.query.doador_id ?? req.query.doadorId,
      search: typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '',
      from: typeof req.query.from === 'string' ? req.query.from.trim() : '',
      to: typeof req.query.to === 'string' ? req.query.to.trim() : '',
      limit,
      offset
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleServiceError(res, error, 'Erro ao listar entregas de recompensas.');
  }
});

/**
 * POST /api/admin/rewards/deliveries
 */
router.post('/rewards/deliveries', adminActionLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const delivery = await createRewardDelivery({
      rewardId: body.reward_id ?? body.rewardId,
      doadorId: body.doador_id ?? body.doadorId,
      quantidade: body.quantidade ?? 1,
      dataEntrega: body.data_entrega ?? body.dataEntrega,
      observacoes: body.observacoes,
      registradoPor: req.user.email
    });

    return res.status(201).json({ success: true, delivery });
  } catch (error) {
    return handleServiceError(res, error, 'Erro ao registrar entrega de recompensa.');
  }
});

/**
 * PATCH /api/admin/rewards/deliveries/:id
 */
router.patch('/rewards/deliveries/:id', adminActionLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const delivery = await updateRewardDelivery(req.params.id, {
      dataEntrega: body.data_entrega ?? body.dataEntrega,
      observacoes: body.observacoes
    });
    return res.status(200).json({ success: true, delivery });
  } catch (error) {
    return handleServiceError(res, error, 'Erro ao atualizar entrega de recompensa.');
  }
});

/**
 * DELETE /api/admin/rewards/deliveries/:id
 */
router.delete('/rewards/deliveries/:id', adminActionLimiter, async (req, res) => {
  try {
    const result = await deleteRewardDelivery(req.params.id);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return handleServiceError(res, error, 'Erro ao excluir entrega de recompensa.');
  }
});

module.exports = router;
