// Middleware de segurança para Bilheteria
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Rate limiting para criação de pedidos
const createOrderLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
    skip: (req) => req.method === 'OPTIONS'
});

// Rate limiting para listagem de eventos
const listEventsLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 60,
    message: { error: 'Muitas requisições. Tente novamente em alguns segundos.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown'
});

// Rate limiting para consultas
const consultLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 30,
    message: { error: 'Muitas consultas. Tente novamente em alguns segundos.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown'
});

// Rate limiting para webhook
const webhookLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
    message: { error: 'Muitas requisições de webhook.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown'
});

// Rate limiting para autenticação
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown'
});

// Configuração do Helmet
const helmetConfig = helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: false,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
});

module.exports = {
    createOrderLimiter,
    listEventsLimiter,
    consultLimiter,
    webhookLimiter,
    authLimiter,
    helmetConfig
};
