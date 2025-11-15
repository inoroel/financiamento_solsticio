// Middleware de segurança
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

/**
 * Rate limiting para endpoints de criação de cobrança
 * Previne abuso e ataques de força bruta
 */
const createChargeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 requisições por IP a cada 15 minutos
  message: {
    error: 'Muitas tentativas. Por favor, tente novamente em alguns minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
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
});

/**
 * Configuração do Helmet para headers de segurança
 */
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
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

