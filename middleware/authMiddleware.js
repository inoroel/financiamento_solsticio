// Auth middleware - JWT verification
const { verifyJWT } = require('../services/authService');

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  const token = authHeader.slice(7);
  try {
    req.user = verifyJWT(token);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      req.user = verifyJWT(authHeader.slice(7));
    } catch (_) { /* ignore */ }
  }
  next();
}

module.exports = { requireAuth, optionalAuth };