// Middleware de tratamento de erros e logging

function requestLogger(req, res, next) {
    const start = Date.now();

    const logData = {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        hasBody: req.method !== 'GET' && req.body && Object.keys(req.body).length > 0
    };

    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, logData);

    const originalEnd = res.end;
    res.end = function (...args) {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
        originalEnd.apply(res, args);
    };

    next();
}

function errorHandler(err, req, res, next) {
    console.error('❌ Erro:', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        path: req.path,
        method: req.method
    });

    const origin = req.headers.origin;
    const normalizeOrigin = (orig) => orig?.trim().replace(/\/+$/, '').toLowerCase();
    const normalizedOrigin = normalizeOrigin(origin);
    const isOriginAllowed = !process.env.ALLOWED_ORIGINS
        ? (normalizedOrigin?.includes('localhost') || normalizedOrigin?.includes('127.0.0.1') || !origin)
        : process.env.ALLOWED_ORIGINS.split(',').map(o => normalizeOrigin(o)).filter(o => o).includes(normalizedOrigin);

    if (isOriginAllowed || !origin) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    if (err.name === 'ValidationError') {
        return res.status(400).json({ success: false, error: 'Erro de validação', message: err.message });
    }

    if (err.message?.includes('CORS')) {
        return res.status(403).json({ success: false, error: 'Origem não permitida' });
    }

    if (err.status === 401 || err.name === 'UnauthorizedError') {
        return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    if (err.status === 429) {
        return res.status(429).json({ success: false, error: err.message || 'Muitas requisições' });
    }

    res.status(err.status || 500).json({
        success: false,
        error: 'Erro interno do servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
}

function notFoundHandler(req, res) {
    const origin = req.headers.origin;
    const normalizeOrigin = (orig) => orig?.trim().replace(/\/+$/, '').toLowerCase();
    const normalizedOrigin = normalizeOrigin(origin);
    const isOriginAllowed = !process.env.ALLOWED_ORIGINS
        ? (normalizedOrigin?.includes('localhost') || normalizedOrigin?.includes('127.0.0.1') || !origin)
        : process.env.ALLOWED_ORIGINS.split(',').map(o => normalizeOrigin(o)).filter(o => o).includes(normalizedOrigin);

    if (isOriginAllowed || !origin) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    res.status(404).json({
        success: false,
        error: 'Rota não encontrada',
        path: req.path
    });
}

module.exports = {
    requestLogger,
    errorHandler,
    notFoundHandler
};
