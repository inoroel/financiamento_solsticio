// Middleware de tratamento de erros e logging estruturado

/**
 * Middleware de logging de requisições
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  
  // Log da requisição (SEM dados sensíveis)
  // NUNCA logar dados completos do body em produção
  const logData = {
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    // Não logar body completo - pode conter dados sensíveis
    hasBody: req.method !== 'GET' && req.body && Object.keys(req.body).length > 0
  };
  
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, logData);

  // Intercepta o res.end para logar a resposta
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    originalEnd.apply(res, args);
  };

  next();
}

/**
 * Middleware de tratamento de erros
 */
function errorHandler(err, req, res, next) {
  // NUNCA logar body completo em produção - pode conter dados sensíveis
  console.error('❌ Erro capturado pelo middleware:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    origin: req.headers.origin
    // body removido por segurança
  });

  // IMPORTANTE: Adiciona headers CORS mesmo em caso de erro
  // Isso garante que o frontend receba a resposta mesmo quando há erro
  const origin = req.headers.origin;
  const isOriginAllowed = !process.env.ALLOWED_ORIGINS 
    ? (origin?.includes('localhost') || origin?.includes('127.0.0.1') || !origin)
    : process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).includes(origin || '');
  
  if (isOriginAllowed || !origin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Erros de validação
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Erro de validação',
      message: err.message
    });
  }

  // Erros de CORS - retorna 403 mas com mensagem clara
  if (err.message && (err.message.includes('CORS') || err.message.includes('Not allowed by CORS'))) {
    return res.status(403).json({
      success: false,
      error: 'Origem não permitida. Verifique a configuração de CORS.',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
      origin: req.headers.origin,
      allowedOrigins: process.env.ALLOWED_ORIGINS || 'localhost (padrão)'
    });
  }

  // Erros de autenticação/autorização
  if (err.status === 401 || err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      error: 'Não autorizado'
    });
  }

  // Erros de rate limiting (429)
  if (err.status === 429) {
    return res.status(429).json({
      success: false,
      error: err.message || 'Muitas requisições. Tente novamente mais tarde.'
    });
  }

  // Erro genérico
  res.status(err.status || 500).json({
    success: false,
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
}

/**
 * Middleware para rotas não encontradas
 */
function notFoundHandler(req, res) {
  // Adiciona headers CORS mesmo para 404
  const origin = req.headers.origin;
  const isOriginAllowed = !process.env.ALLOWED_ORIGINS 
    ? (origin?.includes('localhost') || origin?.includes('127.0.0.1') || !origin)
    : process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).includes(origin || '');
  
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

