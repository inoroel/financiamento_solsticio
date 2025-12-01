// Middleware de segurança
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

/**
 * Rate limiting para endpoints de criação de cobrança
 * Previne abuso e ataques de força bruta
 * 
 * IMPORTANTE: Com trust proxy: 1, o Express já extrai o IP correto do cliente
 * do header X-Forwarded-For, mas apenas do primeiro proxy (Vercel).
 * Isso previne que clientes falsifiquem o IP.
 */
const createChargeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 requisições por IP a cada 15 minutos
  message: {
    error: 'Muitas tentativas. Por favor, tente novamente em alguns minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Função customizada para obter o IP do cliente
  // Com trust proxy: 1, req.ip já contém o IP correto do cliente
  keyGenerator: (req) => {
    // req.ip já está correto quando trust proxy: 1 está configurado
    // e o primeiro proxy (Vercel) é confiável
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
  skip: (req) => {
    // Pula rate limiting para requisições OPTIONS (preflight)
    return req.method === 'OPTIONS';
  },
  handler: (req, res) => {
    // Retorna 429 (Too Many Requests) ao invés de 403
    res.status(429).json({
      error: 'Muitas tentativas. Por favor, tente novamente em alguns minutos.'
    });
  }
});

/**
 * Rate limiting para consulta de cobranças
 */
const consultChargeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 30, // máximo 30 requisições por IP a cada minuto
  message: {
    error: 'Muitas consultas. Por favor, tente novamente em alguns segundos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  }
});

/**
 * Rate limiting para webhook (mais permissivo, mas ainda protegido)
 */
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // máximo 100 requisições por IP a cada minuto (webhooks podem ser frequentes)
  message: {
    error: 'Muitas requisições de webhook.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  }
});

/**
 * Configuração do Helmet para headers de segurança
 * CSP desabilitado para APIs (não aplicável a JSON APIs)
 * IMPORTANTE: Não interfere com headers CORS
 */
const helmetConfig = helmet({
  contentSecurityPolicy: false, // Desabilita CSP para APIs (não necessário para JSON)
  crossOriginEmbedderPolicy: false, // Desabilita para APIs
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Permite recursos cross-origin
  crossOriginOpenerPolicy: false, // Não interfere com CORS
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

module.exports = {
  createChargeLimiter,
  consultChargeLimiter,
  webhookLimiter,
  helmetConfig
};

