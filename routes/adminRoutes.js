// Rotas administrativas protegidas por Google OAuth + lista de admins autorizados
const express = require('express');
const router = express.Router();
const { requireAdmin, requireAdminOrRoot, requireTabAccess } = require('../middleware/authMiddleware');
const { adminActionLimiter } = require('../middleware/security');
const {
  ROOT_ADMIN_EMAIL,
  OPERATIONAL_TABS,
  listTransactionsForAdmin,
  listEstornos,
  listAdmins,
  addAdmin,
  updateAdmin,
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
const {
  listGoals,
  createGoal,
  updateGoal,
  deleteGoal
} = require('../services/goalsService');

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
router.get('/transacoes', requireTabAccess('estornos'), async (req, res) => {
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
router.get('/estornos', requireTabAccess('estornos'), async (req, res) => {
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
 * Lista os usuários e administradores cadastrados (restrito a admin e root).
 */
router.get('/admins', requireAdminOrRoot, async (req, res) => {
  try {
    const admins = await listAdmins();
    return res.status(200).json({
      admins,
      rootEmail: ROOT_ADMIN_EMAIL,
      availableTabs: OPERATIONAL_TABS
    });
  } catch (error) {
    console.error('❌ Erro ao listar administradores:', error.message);
    return res.status(500).json({ error: 'Erro ao listar usuários.' });
  }
});

/**
 * POST /api/admin/admins
 * Cadastra um novo usuário ou administrador com permissões por aba.
 * Body: { email: string, role?: 'user'|'admin', allowedTabs?: string[] }
 */
router.post('/admins', adminActionLimiter, requireAdminOrRoot, async (req, res) => {
  try {
    const body = req.body || {};
    const admin = await addAdmin(body.email, req.user.email, {
      role: body.role || 'user',
      allowedTabs: body.allowed_tabs ?? body.allowedTabs,
      actor: req.user
    });
    console.log(`✅ Usuário cadastrado por ${req.user.email}: ${admin.email} (${admin.role})`);
    return res.status(201).json({ admin });
  } catch (error) {
    return handleServiceError(res, error, 'Erro ao cadastrar usuário.');
  }
});

/**
 * PUT /api/admin/admins/:email
 * Atualiza perfil e abas permitidas de um usuário ou administrador.
 * Body: { role?: 'user'|'admin', allowedTabs?: string[] }
 */
router.put('/admins/:email', adminActionLimiter, requireAdminOrRoot, async (req, res) => {
  let targetEmail;
  try {
    targetEmail = decodeURIComponent(req.params.email || '');
  } catch (_) {
    return res.status(400).json({ error: 'E-mail inválido na URL.' });
  }

  try {
    const body = req.body || {};
    const admin = await updateAdmin(targetEmail, req.user, {
      role: body.role,
      allowedTabs: body.allowed_tabs ?? body.allowedTabs
    });
    console.log(`✏️  Usuário atualizado por ${req.user.email}: ${admin.email} (${admin.role})`);
    return res.status(200).json({ admin });
  } catch (error) {
    return handleServiceError(res, error, 'Erro ao atualizar permissões do usuário.');
  }
});

/**
 * DELETE /api/admin/admins/:email
 * Remove um usuário ou administrador (admin comum só remove 'user'; apenas root remove 'admin').
 */
router.delete('/admins/:email', adminActionLimiter, requireAdminOrRoot, async (req, res) => {
  let targetEmail;
  try {
    targetEmail = decodeURIComponent(req.params.email || '');
  } catch (_) {
    return res.status(400).json({ error: 'E-mail inválido na URL.' });
  }

  try {
    const result = await removeAdmin(targetEmail, req.user);
    console.log(`🗑️  Usuário removido por ${req.user.email}: ${result.email}`);
    return res.status(200).json({
      removed: result.removed,
      email: result.email,
      inEnvList: result.inEnvList
    });
  } catch (error) {
    return handleServiceError(res, error, 'Erro ao remover usuário.');
  }
});

// =================================================================
// TIERS DE RECOMPENSA
// =================================================================
router.use('/rewards', requireTabAccess('recompensas'));
router.use('/doadores', requireTabAccess('recompensas'));

/**
 * GET /api/admin/rewards/tiers
 */
router.get('/rewards/tiers', requireTabAccess('recompensas'), async (req, res) => {
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

// =================================================================
// METAS DE DOAÇÃO
// =================================================================
router.use('/metas', requireTabAccess('metas'));

/**
 * GET /api/admin/metas
 */
router.get('/metas', requireTabAccess('metas'), async (req, res) => {
  try {
    const data = await listGoals({ includeInactive: true, isPublic: false });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleServiceError(res, error, 'Erro ao listar metas de doação.');
  }
});

/**
 * POST /api/admin/metas
 */
router.post('/metas', adminActionLimiter, async (req, res) => {
  try {
    const meta = await createGoal(req.body || {}, req.user.email);
    return res.status(201).json({ success: true, meta });
  } catch (error) {
    return handleServiceError(res, error, 'Erro ao cadastrar meta de doação.');
  }
});

/**
 * PUT /api/admin/metas/:id
 */
router.put('/metas/:id', adminActionLimiter, async (req, res) => {
  try {
    const meta = await updateGoal(req.params.id, req.body || {}, req.user.email);
    return res.status(200).json({ success: true, meta });
  } catch (error) {
    return handleServiceError(res, error, 'Erro ao atualizar meta de doação.');
  }
});

/**
 * DELETE /api/admin/metas/:id
 */
router.delete('/metas/:id', adminActionLimiter, async (req, res) => {
  try {
    const result = await deleteGoal(req.params.id);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return handleServiceError(res, error, 'Erro ao excluir meta de doação.');
  }
});

module.exports = router;
