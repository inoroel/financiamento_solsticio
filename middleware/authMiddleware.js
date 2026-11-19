// Auth middleware - JWT verification + Google Admin authorization
const {
  ADMIN_COOKIE_NAME,
  verifyJWT,
  verifyAdminJWT,
  parseCookies
} = require('../services/authService');
const { getAdminRecord, isRootAdmin } = require('../services/adminService');

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

/**
 * Exige sessão administrativa válida autenticada via Google + e-mail cadastrado como admin.
 * Suporta Bearer token ou cookie HttpOnly (com proteção anti-CSRF em métodos mutáveis).
 */
async function requireAdmin(req, res, next) {
  let token = null;
  let usedCookie = false;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies[ADMIN_COOKIE_NAME]) {
      token = cookies[ADMIN_COOKIE_NAME];
      usedCookie = true;
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Autenticação de administrador obrigatória.' });
  }

  const method = (req.method || 'GET').toUpperCase();
  if (usedCookie && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    if (req.get('x-admin-request') !== '1') {
      return res.status(403).json({ error: 'Requisição bloqueada pela proteção CSRF.' });
    }
  }

  let decoded;
  try {
    decoded = verifyAdminJWT(token);
  } catch (err) {
    return res.status(401).json({ error: 'Sessão expirada ou inválida. Faça login novamente com o Google.' });
  }

  try {
    const adminRecord = await getAdminRecord(decoded.email);
    if (!adminRecord || !adminRecord.active) {
      return res.status(403).json({ error: 'Acesso negado. Este e-mail não possui permissão de administrador.' });
    }

    req.user = {
      email: adminRecord.email,
      role: adminRecord.role,
      isRoot: adminRecord.role === 'root',
      name: decoded.name || '',
      picture: decoded.picture || '',
      authProvider: 'google'
    };

    return next();
  } catch (err) {
    console.error('❌ Erro ao verificar permissão de administrador:', err.message);
    return res.status(500).json({ error: 'Erro interno ao validar permissões administrativas.' });
  }
}

/**
 * Restringe a rota exclusivamente ao administrador root.
 */
function requireRootAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'root' || !isRootAdmin(req.user.email)) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador root.' });
  }
  return next();
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireAdmin,
  requireRootAdmin
};