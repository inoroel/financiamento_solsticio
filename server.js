// Servidor Express - Backend de Pagamentos (e-Rede + Stellar)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { testConnection, initializeDatabase, getDatabaseDiagnostics } = require('./config/database');
const paymentRoutes = require('./routes/paymentRoutes');
const { requestLogger, errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { helmetConfig } = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 3000;

// =================================================================
// TRUST PROXY - OBRIGATÓRIO PARA VERCEL E RATE LIMITING
// =================================================================
// Configura Express para confiar em proxies (Vercel, Cloudflare, etc)
// IMPORTANTE: Na Vercel, confiamos apenas no primeiro proxy (da própria Vercel)
// Isso é necessário para que express-rate-limit funcione corretamente
// e identifique corretamente o IP do cliente através do header X-Forwarded-For
// 
// trust proxy: 1 = confia apenas no primeiro proxy (Vercel)
// Isso previne que clientes maliciosos falsifiquem o header X-Forwarded-For
if (process.env.VERCEL || process.env.VERCEL_ENV) {
  // Na Vercel, confia apenas no primeiro proxy (da própria Vercel)
  app.set('trust proxy', 1);
} else {
  // Localmente ou em outros ambientes, pode confiar em todos os proxies
  app.set('trust proxy', true);
}

// =================================================================
// CORS - DEVE SER O PRIMEIRO MIDDLEWARE (antes de tudo)
// =================================================================
// Função para normalizar origem (remove barra final e converte para lowercase)
function normalizeOrigin(origin) {
  if (!origin) return null;
  return origin.trim().replace(/\/+$/, '').toLowerCase();
}

// Função para verificar origem permitida
function isOriginAllowed(origin) {
  // Permite requisições sem origin (ex: Postman, curl, mobile apps)
  if (!origin) {
    return true;
  }

  const normalizedOrigin = normalizeOrigin(origin);

  // SEMPRE permite origens da e-Rede (sandbox e produção) para callbacks 3DS
  // Essas são requisições POST vindas da e-Rede após autenticação 3DS
  const redeOrigins = [
    'https://sandbox-erede.useredecloud.com.br',
    'https://api.userede.com.br',
    'https://erede.useredecloud.com.br'
  ];
  
  if (redeOrigins.some(redeOrigin => normalizedOrigin.startsWith(normalizeOrigin(redeOrigin)))) {
    return true;
  }

  // Se ALLOWED_ORIGINS está configurado, usa APENAS a lista (não permite localhost automaticamente)
  if (process.env.ALLOWED_ORIGINS) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => normalizeOrigin(o)).filter(o => o);
    return allowedOrigins.includes(normalizedOrigin);
  } else {
    // Se ALLOWED_ORIGINS NÃO está configurado, permite localhost para desenvolvimento/testes
    if (normalizedOrigin.includes('localhost') || normalizedOrigin.includes('127.0.0.1')) {
      return true;
    } else if (process.env.NODE_ENV === 'production') {
      // Em produção sem ALLOWED_ORIGINS configurado, bloqueia outras origens
      return false;
    } else {
      // Em desenvolvimento (NODE_ENV !== 'production'), permite tudo
      return true;
    }
  }
}

// CORS configurado de forma segura
const corsOptions = {
  origin: function (origin, callback) {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️  CORS: Origem bloqueada: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Accept'],
  exposedHeaders: ['Content-Type', 'X-Request-Id'],
  preflightContinue: false
};

// Handler explícito para OPTIONS (preflight) - DEVE VIR ANTES DE TUDO
// Este handler precisa retornar imediatamente, sem passar por outros middlewares
// IMPORTANTE: Na Vercel, este handler precisa estar antes de qualquer outro middleware
app.use((req, res, next) => {
  // Intercepta OPTIONS antes de qualquer coisa
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin;
    
    // Para requisições OPTIONS (preflight), sempre retorna sucesso
    // A validação de origem será feita na requisição real (GET, POST, etc)
    // Isso evita problemas com CORS preflight na Vercel
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id, Accept');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 horas
    return res.status(200).end();
  }
  next();
});

// Aplica CORS para todas as rotas (para requisições não-OPTIONS)
app.use(cors(corsOptions));

// =================================================================
// MIDDLEWARES GLOBAIS DE SEGURANÇA
// =================================================================
// Helmet DEPOIS do CORS para não interferir nos headers CORS
app.use(helmetConfig); // Headers de segurança (XSS, clickjacking, etc)
app.use(express.json({ limit: '10kb' })); // Limita tamanho do JSON (previne DoS)
app.use(express.urlencoded({ extended: true, limit: '10kb' })); // Limita tamanho do URL encoded

app.use(requestLogger); // Logging de requisições

// =================================================================
// SERVE ARQUIVOS ESTÁTICOS (Frontend de teste)
// =================================================================
// Na Vercel, arquivos estáticos são servidos diretamente pelo vercel.json
// Localmente, servimos via Express
if (process.env.NODE_ENV !== 'production' || process.env.SERVE_FRONTEND === 'true') {
  app.use(express.static('public'));
  console.log('📁 Servindo arquivos estáticos da pasta public/');
}

// Rota para servir index.html na raiz (quando não servido estaticamente)
app.get('/', (req, res) => {
  res.sendFile('index.html', { root: 'public' }, (err) => {
    if (err) {
      // Se não encontrar index.html, retorna status de saúde da API
      res.status(200).json({
        message: 'API Financiamento Solstício',
        status: 'online',
        endpoints: {
          health: '/health',
          testDb: '/test-db',
          api: '/api'
        },
        timestamp: new Date().toISOString()
      });
    }
  });
});

// =================================================================
// ROTAS
// =================================================================
app.use('/api', paymentRoutes);

// Rota de health check
app.get('/health', async (req, res) => {
  const dbTest = await testConnection();
  const dbStatus = dbTest.success;
  res.status(dbStatus ? 200 : 503).json({
    status: dbStatus ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    database: dbStatus ? 'connected' : 'disconnected'
  });
});

// Rota de diagnóstico detalhado do banco de dados
app.get('/test-db', async (req, res) => {
  try {
    const diagnostics = await getDatabaseDiagnostics();
    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      diagnostics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Rota para robots.txt (evita 404 em crawlers)
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send('User-agent: *\nDisallow: /\n');
});

// =================================================================
// MIDDLEWARES DE ERRO (devem ser os últimos)
// =================================================================
app.use(notFoundHandler); // Rota não encontrada
app.use(errorHandler); // Tratamento de erros

// =================================================================
// INICIALIZAÇÃO DO SERVIDOR
// =================================================================
async function startServer() {
  try {
    // Testa conexão com banco de dados
    console.log('🔌 Testando conexão com banco de dados...');
    const dbTest = await testConnection();
    const dbConnected = dbTest.success;
    
    if (dbConnected) {
      // Inicializa o banco (cria tabelas se não existirem)
      console.log('📦 Inicializando banco de dados...');
      await initializeDatabase();
    } else {
      console.warn('⚠️  Banco de dados não conectado. O servidor continuará, mas algumas funcionalidades podem não funcionar.');
      if (dbTest.error) {
        console.warn('⚠️  Erro de conexão:', dbTest.error);
      }
    }

    // Na Vercel, não precisa fazer listen - ela gerencia isso
    // Em desenvolvimento local, fazemos listen normalmente
    if (process.env.VERCEL !== '1') {
      app.listen(PORT, () => {
        console.log('\n✅ Servidor de pagamentos rodando!');
        console.log(`📍 Porta: ${PORT}`);
        console.log(`🌐 Ambiente: ${process.env.NODE_ENV || 'development'}`);
        console.log('\n📋 Endpoints disponíveis:');
        console.log(`   POST   http://localhost:${PORT}/api/gerar-pagamento`);
        console.log(`   GET    http://localhost:${PORT}/api/cobranca/:tid`);
        console.log(`   GET    http://localhost:${PORT}/api/cobranca/txid/:txid`);
        console.log(`   POST   http://localhost:${PORT}/api/webhook/pagamento`);
        console.log(`   POST   http://localhost:${PORT}/api/confirm-donation`);
        console.log(`   POST   http://localhost:${PORT}/api/check-payment-by-memo`);
        console.log(`   POST   http://localhost:${PORT}/api/webhook/stellar`);
        console.log(`   GET    http://localhost:${PORT}/health`);
        console.log(`   GET    http://localhost:${PORT}/test-db\n`);
      });
    } else {
      console.log('\n✅ Servidor configurado para Vercel');
      console.log(`🌐 Ambiente: ${process.env.NODE_ENV || 'production'}`);
    }
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error.message);
    if (process.env.VERCEL !== '1') {
      process.exit(1);
    }
  }
}

// Inicia o servidor apenas se não estiver na Vercel
// Na Vercel, o handler é exportado e chamado automaticamente
if (process.env.VERCEL !== '1') {
  startServer();
} else {
  // Na Vercel, inicializa o banco uma vez (cold start)
  startServer().catch(console.error);
}

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  if (process.env.VERCEL !== '1') {
    process.exit(1);
  }
});

// Exporta o app para Vercel (serverless function)
module.exports = app;
