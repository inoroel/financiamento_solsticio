// Servidor Express - Backend PIX BB
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { testConnection, initializeDatabase } = require('./config/database');
const pixRoutes = require('./routes/pixRoutes');
const { requestLogger, errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { helmetConfig } = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 3000;

// =================================================================
// MIDDLEWARES GLOBAIS DE SEGURANÇA
// =================================================================
app.use(helmetConfig); // Headers de segurança (XSS, clickjacking, etc)
app.use(express.json({ limit: '10kb' })); // Limita tamanho do JSON (previne DoS)
app.use(express.urlencoded({ extended: true, limit: '10kb' })); // Limita tamanho do URL encoded

// CORS configurado de forma segura
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : (process.env.NODE_ENV === 'production' ? false : '*'), // Em produção, deve especificar origens
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.use(requestLogger); // Logging de requisições

// =================================================================
// ROTAS
// =================================================================
app.use('/api', pixRoutes);

// Rota de health check
app.get('/health', async (req, res) => {
  const dbStatus = await testConnection();
  res.status(dbStatus ? 200 : 503).json({
    status: dbStatus ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    database: dbStatus ? 'connected' : 'disconnected'
  });
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
    const dbConnected = await testConnection();
    
    if (dbConnected) {
      // Inicializa o banco (cria tabelas se não existirem)
      console.log('📦 Inicializando banco de dados...');
      await initializeDatabase();
    } else {
      console.warn('⚠️  Banco de dados não conectado. O servidor continuará, mas algumas funcionalidades podem não funcionar.');
    }

    // Na Vercel, não precisa fazer listen - ela gerencia isso
    // Em desenvolvimento local, fazemos listen normalmente
    if (process.env.VERCEL !== '1') {
      app.listen(PORT, () => {
        console.log('\n✅ Servidor de doações PIX rodando!');
        console.log(`📍 Porta: ${PORT}`);
        console.log(`🌐 Ambiente: ${process.env.NODE_ENV || 'development'}`);
        console.log('\n📋 Endpoints disponíveis:');
        console.log(`   POST   http://localhost:${PORT}/api/gerar-pix`);
        console.log(`   GET    http://localhost:${PORT}/api/cobranca/:txid`);
        console.log(`   POST   http://localhost:${PORT}/api/webhook/pix`);
        console.log(`   GET    http://localhost:${PORT}/health\n`);
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

// Exporta o app para Vercel (serverless function)
module.exports = app;

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

module.exports = app;
