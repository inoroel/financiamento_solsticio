// Rotas de autenticação
const express = require('express');
const router = express.Router();
const { getTeamEmails, verifyPassword, generateJWT } = require('../services/authService');
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
router.get('/me', require('../middleware/authMiddleware').requireAuth, (req, res) => {
  return res.status(200).json({
    email: req.user.email,
    role: req.user.role
  });
});

module.exports = router;