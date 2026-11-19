// Rotas de autenticação (equipe + Google Admin OAuth)
const express = require('express');
const router = express.Router();
const {
  getTeamEmails,
  verifyPassword,
  generateJWT,
  generateAdminJWT,
  buildAdminCookieHeader,
  buildClearAdminCookieHeader
} = require('../services/authService');
const { getGoogleClientId, verifyGoogleIdToken } = require('../services/googleAuthService');
const { getAdminRecord } = require('../services/adminService');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const { consultChargeLimiter } = require('../middleware/security');

/**
 * POST /api/auth/login
 * Autentica um membro da equipe
 * Body: { email, password }
 */
router.post('/login', consultChargeLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validação básica
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    // Verifica se o email está na lista de emails da equipe
    const teamEmails = getTeamEmails();
    if (!teamEmails.includes(email.toLowerCase())) {
      console.warn(`⚠️  Tentativa de login com email não autorizado: ${email}`);
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Verifica se TEAM_PASSWORD_HASH está configurado
    const passwordHash = process.env.TEAM_PASSWORD_HASH;
    if (!passwordHash) {
      console.error('❌ TEAM_PASSWORD_HASH não configurado');
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

    // Verifica a senha
    if (!verifyPassword(password, passwordHash)) {
      console.warn(`⚠️  Tentativa de login com senha incorreta para: ${email}`);
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Gera o JWT
    const token = generateJWT({ email: email.toLowerCase(), role: 'team' });

    console.log(`✅ Login bem-sucedido para: ${email}`);

    return res.status(200).json({
      token,
      user: {
        email: email.toLowerCase(),
        role: 'team'
      }
    });
  } catch (error) {
    console.error('❌ Erro no login:', error.message);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /api/auth/logout
 * Realiza logout (client-side token removal)
 */
router.post('/logout', (req, res) => {
  return res.status(200).json({ message: 'Logout realizado' });
});

/**
 * GET /api/auth/me
 * Retorna informações do usuário autenticado
 */
router.get('/me', requireAuth, (req, res) => {
  return res.status(200).json({
    email: req.user.email,
    role: req.user.role
  });
});

/**
 * GET /api/auth/google/config
 * Informa ao frontend administrativo o Client ID do Google OAuth (público).
 */
router.get('/google/config', (req, res) => {
  const clientId = getGoogleClientId();
  return res.status(200).json({
    enabled: Boolean(clientId),
    clientId: clientId || null
  });
});

/**
 * POST /api/auth/google
 * Autentica administrador via Google ID Token (Google Identity Services)
 * e emite sessão HttpOnly em cookie.
 * Body: { credential: string }
 */
router.post('/google', consultChargeLimiter, async (req, res) => {
  try {
    const { credential } = req.body || {};
    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({ error: 'Credencial do Google é obrigatória.' });
    }

    const googleUser = await verifyGoogleIdToken(credential);
    const adminRecord = await getAdminRecord(googleUser.email);

    if (!adminRecord || !adminRecord.active) {
      console.warn(`⚠️  Tentativa de login admin negada para: ${googleUser.email}`);
      return res.status(403).json({
        error: 'Acesso negado. Este e-mail não está cadastrado como administrador.'
      });
    }

    const sessionToken = generateAdminJWT({
      email: adminRecord.email,
      name: googleUser.name,
      picture: googleUser.picture,
      role: adminRecord.role
    });

    res.setHeader('Set-Cookie', buildAdminCookieHeader(sessionToken));
    console.log(`✅ Login admin Google bem-sucedido: ${adminRecord.email} (${adminRecord.role})`);

    return res.status(200).json({
      user: {
        email: adminRecord.email,
        name: googleUser.name,
        picture: googleUser.picture,
        role: adminRecord.role,
        isRoot: adminRecord.role === 'root'
      }
    });
  } catch (error) {
    if (error.code === 'GOOGLE_NOT_CONFIGURED' || error.code === 'GOOGLE_CERTS_INVALID') {
      return res.status(503).json({ error: error.message });
    }
    if (error.status === 401) {
      return res.status(401).json({ error: error.message });
    }
    console.error('❌ Erro no login admin Google:', error.message);
    return res.status(500).json({ error: 'Erro interno ao autenticar com o Google.' });
  }
});

/**
 * POST /api/auth/admin/logout
 * Encerra a sessão administrativa limpando o cookie HttpOnly.
 */
router.post('/admin/logout', (req, res) => {
  res.setHeader('Set-Cookie', buildClearAdminCookieHeader());
  return res.status(200).json({ message: 'Sessão administrativa encerrada.' });
});

/**
 * GET /api/auth/admin/me
 * Retorna os dados do administrador autenticado.
 */
router.get('/admin/me', requireAdmin, (req, res) => {
  return res.status(200).json({
    user: req.user
  });
});

module.exports = router;