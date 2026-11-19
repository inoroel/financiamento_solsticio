// Auth service - JWT + team password validation + admin Google session
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const ADMIN_COOKIE_NAME = 'solsticio_admin_session';

function getTeamEmails() {
  const env = process.env.TEAM_EMAILS || '';
  return env.split(',').map((e) => e.trim().toLowerCase()).filter((e) => e);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function generateJWT(payload, expiresIn = '24h') {
  return jwt.sign(payload, process.env.TEAM_JWT_SECRET, { expiresIn, algorithm: 'HS256' });
}

function verifyJWT(token) {
  return jwt.verify(token, process.env.TEAM_JWT_SECRET, { algorithms: ['HS256'] });
}

/**
 * Retorna o segredo usado para assinar sessões JWT de administração.
 * Falha de forma fechada se nenhum segredo estiver configurado.
 * @returns {string}
 */
function getAdminJwtSecret() {
  const secret = (process.env.ADMIN_JWT_SECRET || process.env.TEAM_JWT_SECRET || '').trim();
  if (!secret) {
    throw new Error('Segredo JWT administrativo não configurado (ADMIN_JWT_SECRET / TEAM_JWT_SECRET).');
  }
  return secret;
}

/**
 * Gera JWT de sessão administrativa após validação Google OAuth.
 * @param {Object} payload
 * @param {string} [expiresIn='8h']
 * @returns {string}
 */
function generateAdminJWT(payload, expiresIn = '8h') {
  const secret = getAdminJwtSecret();
  const claims = {
    email: String(payload.email || '').trim().toLowerCase(),
    name: payload.name || '',
    picture: payload.picture || '',
    role: payload.role,
    authProvider: 'google',
    scope: 'admin'
  };
  return jwt.sign(claims, secret, { expiresIn, algorithm: 'HS256' });
}

/**
 * Valida JWT de sessão administrativa, exigindo escopo admin e provedor Google.
 * Impede que tokens de equipe (/api/auth/login) sejam reutilizados em rotas administrativas.
 * @param {string} token
 * @returns {Object}
 */
function verifyAdminJWT(token) {
  const secret = getAdminJwtSecret();
  const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
  if (
    !decoded ||
    decoded.scope !== 'admin' ||
    decoded.authProvider !== 'google' ||
    !['root', 'admin', 'user'].includes(decoded.role) ||
    typeof decoded.email !== 'string' ||
    !decoded.email.trim()
  ) {
    throw new Error('Escopo administrativo inválido');
  }
  return decoded;
}

/**
 * Faz parse do header Cookie sem dependências externas.
 * @param {string} [cookieHeader]
 * @returns {Record<string, string>}
 */
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return cookies;
  }

  for (const part of cookieHeader.split(';')) {
    const eqIndex = part.indexOf('=');
    if (eqIndex <= 0) continue;
    const name = part.slice(0, eqIndex).trim();
    const rawValue = part.slice(eqIndex + 1).trim();
    if (!name) continue;
    try {
      cookies[name] = decodeURIComponent(rawValue);
    } catch (_) {
      cookies[name] = rawValue;
    }
  }
  return cookies;
}

function isSecureCookieEnvironment() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
}

/**
 * Monta o header Set-Cookie seguro para a sessão administrativa.
 * @param {string} token
 * @param {number} [maxAgeSeconds=28800]
 * @returns {string}
 */
function buildAdminCookieHeader(token, maxAgeSeconds = 8 * 60 * 60) {
  const parts = [
    `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Strict',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`
  ];
  if (isSecureCookieEnvironment()) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

/**
 * Monta o header Set-Cookie para encerrar a sessão administrativa.
 * @returns {string}
 */
function buildClearAdminCookieHeader() {
  const parts = [
    `${ADMIN_COOKIE_NAME}=`,
    'HttpOnly',
    'Path=/',
    'SameSite=Strict',
    'Max-Age=0'
  ];
  if (isSecureCookieEnvironment()) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

module.exports = {
  ADMIN_COOKIE_NAME,
  getTeamEmails,
  verifyPassword,
  generateJWT,
  verifyJWT,
  getAdminJwtSecret,
  generateAdminJWT,
  verifyAdminJWT,
  parseCookies,
  buildAdminCookieHeader,
  buildClearAdminCookieHeader
};