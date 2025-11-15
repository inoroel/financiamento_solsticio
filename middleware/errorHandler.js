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
    method: req.method
    // body removido por segurança
  });

  // Erros de validação
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Erro de validação',
      message: err.message
    });
  }

  // Erros de autenticação/autorização
  if (err.status === 401 || err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      error: 'Não autorizado'
    });
  }

  // Erro genérico
  res.status(err.status || 500).json({
    success: false,
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
}

/**
 * Middleware para rotas não encontradas
 */
function notFoundHandler(req, res) {
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

