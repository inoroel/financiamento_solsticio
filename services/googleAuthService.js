// Serviço de verificação criptográfica de Google ID Token (Google Identity Services)
const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const CERTS_TIMEOUT_MS = 8000;
const DEFAULT_MAX_AGE_SEC = 3600;
const MIN_MAX_AGE_SEC = 60;

let certsCache = {
  keys: null,
  expiresAt: 0
};

/**
 * Retorna o Client ID do Google OAuth configurado no ambiente.
 * @returns {string}
 */
function getGoogleClientId() {
  return (process.env.GOOGLE_CLIENT_ID || '').trim();
}

function createAuthError(message, code, status = 401) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function parseCacheMaxAge(cacheControlHeader) {
  if (!cacheControlHeader || typeof cacheControlHeader !== 'string') {
    return DEFAULT_MAX_AGE_SEC;
  }
  const match = cacheControlHeader.match(/max-age\s*=\s*(\d+)/i);
  if (!match) {
    return DEFAULT_MAX_AGE_SEC;
  }
  const parsed = parseInt(match[1], 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_AGE_SEC;
  }
  return Math.max(MIN_MAX_AGE_SEC, parsed);
}

/**
 * Busca e faz cache das chaves públicas JWK do Google.
 * @param {boolean} forceRefresh
 * @returns {Promise<Array<Object>>}
 */
async function getGoogleCerts(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && Array.isArray(certsCache.keys) && now < certsCache.expiresAt) {
    return certsCache.keys;
  }

  const response = await axios.get(GOOGLE_CERTS_URL, {
    timeout: CERTS_TIMEOUT_MS,
    headers: { Accept: 'application/json' }
  });

  const keys = response.data && Array.isArray(response.data.keys) ? response.data.keys : null;
  if (!keys || keys.length === 0) {
    throw createAuthError('Chaves públicas do Google indisponíveis.', 'GOOGLE_CERTS_INVALID', 503);
  }

  const maxAgeSec = parseCacheMaxAge(response.headers && response.headers['cache-control']);
  certsCache = {
    keys,
    expiresAt: Date.now() + maxAgeSec * 1000
  };

  return keys;
}

/**
 * Verifica criptograficamente um Google ID Token emitido pelo Google Identity Services.
 * @param {string} idToken
 * @param {Object} [options]
 * @param {Object|Array} [options.certsOverride] - JWKs para testes unitários locais
 * @returns {Promise<{email: string, name: string, picture: string, sub: string}>}
 */
async function verifyGoogleIdToken(idToken, { certsOverride } = {}) {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw createAuthError(
      'Login com Google não configurado no servidor (GOOGLE_CLIENT_ID ausente).',
      'GOOGLE_NOT_CONFIGURED',
      503
    );
  }

  if (!idToken || typeof idToken !== 'string' || idToken.split('.').length !== 3) {
    throw createAuthError('Token do Google inválido ou malformado.', 'INVALID_GOOGLE_TOKEN', 401);
  }

  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || !decoded.header || !decoded.payload) {
    throw createAuthError('Não foi possível decodificar o token do Google.', 'INVALID_GOOGLE_TOKEN', 401);
  }

  if (decoded.header.alg !== 'RS256' || typeof decoded.header.kid !== 'string' || !decoded.header.kid) {
    throw createAuthError('Cabeçalho do token do Google inválido.', 'INVALID_GOOGLE_TOKEN', 401);
  }

  const kid = decoded.header.kid;
  let jwk = null;

  if (certsOverride) {
    const overrideKeys = Array.isArray(certsOverride) ? certsOverride : certsOverride.keys;
    if (Array.isArray(overrideKeys)) {
      jwk = overrideKeys.find((key) => key && key.kid === kid) || null;
    }
  } else {
    let keys = await getGoogleCerts(false);
    jwk = keys.find((key) => key && key.kid === kid) || null;

    // Trata rotação de chaves públicas do Google com um único refresh forçado
    if (!jwk) {
      keys = await getGoogleCerts(true);
      jwk = keys.find((key) => key && key.kid === kid) || null;
    }
  }

  if (!jwk) {
    throw createAuthError('Chave de assinatura do Google não encontrada.', 'GOOGLE_KEY_NOT_FOUND', 401);
  }

  let publicKey;
  try {
    publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  } catch (err) {
    throw createAuthError('Chave pública JWK inválida.', 'INVALID_GOOGLE_KEY', 401);
  }

  let payload;
  try {
    payload = jwt.verify(idToken, publicKey, {
      algorithms: ['RS256'],
      audience: clientId,
      issuer: ['https://accounts.google.com', 'accounts.google.com']
    });
  } catch (err) {
    throw createAuthError('Token do Google expirado ou inválido.', 'INVALID_GOOGLE_TOKEN', 401);
  }

  if (payload.email_verified !== true || typeof payload.email !== 'string' || !payload.email.trim()) {
    throw createAuthError('O e-mail desta conta Google não está verificado.', 'EMAIL_NOT_VERIFIED', 401);
  }

  return {
    email: payload.email.trim().toLowerCase(),
    name: typeof payload.name === 'string' ? payload.name.trim() : '',
    picture: typeof payload.picture === 'string' ? payload.picture.trim() : '',
    sub: typeof payload.sub === 'string' ? payload.sub : ''
  };
}

module.exports = {
  getGoogleClientId,
  getGoogleCerts,
  verifyGoogleIdToken
};
