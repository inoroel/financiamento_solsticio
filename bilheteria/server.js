// Servidor Express - Bilheteria Virtual Solstício
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { testConnection, initializeDatabase } = require('./config/database');
const eventRoutes = require('./routes/eventRoutes');
const orderRoutes = require('./routes/orderRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const userRoutes = require('./routes/userRoutes');
const { requestLogger, errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { helmetConfig } = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy para Vercel
if (process.env.VERCEL || process.env.VERCEL_ENV) {
    app.set('trust proxy', 1);
} else {
    app.set('trust proxy', true);
}

// CORS
function normalizeOrigin(origin) {
    if (!origin) return null;
    return origin.trim().replace(/\/+$/, '').toLowerCase();
}

function isOriginAllowed(origin) {
    if (!origin) return true;
    const normalizedOrigin = normalizeOrigin(origin);

    if (process.env.ALLOWED_ORIGINS) {
        const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => normalizeOrigin(o)).filter(o => o);
        return allowedOrigins.includes(normalizedOrigin);
    } else {
        if (normalizedOrigin.includes('localhost') || normalizedOrigin.includes('127.0.0.1')) {
            return true;
        } else if (process.env.NODE_ENV === 'production') {
            return false;
        } else {
            return true;
        }
    }
}

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
    exposedHeaders: ['Content-Type', 'X-Request-Id']
};

// OPTIONS handler
app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
        const origin = req.headers.origin;
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id, Accept');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Max-Age', '86400');
        return res.status(200).end();
    }
    next();
});

app.use(cors(corsOptions));

// Middlewares
app.use(helmetConfig);
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(requestLogger);

// Arquivos estáticos
if (process.env.NODE_ENV !== 'production' || process.env.SERVE_FRONTEND === 'true') {
    app.use(express.static('public'));
    console.log('📁 Servindo arquivos estáticos da pasta public/');
}

// Rota raiz
app.get('/', (req, res) => {
    res.sendFile('index.html', { root: 'public' }, (err) => {
        if (err) {
            res.status(200).json({
                message: 'API Bilheteria Solstício',
                status: 'online',
                endpoints: {
                    eventos: '/api/eventos',
                    pedidos: '/api/pedidos',
                    ingressos: '/api/ingressos',
                    usuarios: '/api/usuarios',
                    health: '/health'
                },
                timestamp: new Date().toISOString()
            });
        }
    });
});

// Rotas da API
app.use('/api/eventos', eventRoutes);
app.use('/api/pedidos', orderRoutes);
app.use('/api/ingressos', ticketRoutes);
app.use('/api/usuarios', userRoutes);

// Health check
app.get('/health', async (req, res) => {
    const dbTest = await testConnection();
    res.status(dbTest.success ? 200 : 503).json({
        status: dbTest.success ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        database: dbTest.success ? 'connected' : 'disconnected'
    });
});

// Robots.txt
app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send('User-agent: *\nDisallow: /api/\n');
});

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Inicialização
async function startServer() {
    try {
        console.log('🎫 Bilheteria Solstício - Iniciando...');
        console.log('🔌 Testando conexão com banco de dados...');
        const dbTest = await testConnection();

        if (dbTest.success) {
            console.log('📦 Inicializando banco de dados...');
            await initializeDatabase();
        } else {
            console.warn('⚠️  Banco não conectado:', dbTest.error);
        }

        if (process.env.VERCEL !== '1') {
            app.listen(PORT, () => {
                console.log('\n✅ Servidor de bilheteria rodando!');
                console.log(`📍 Porta: ${PORT}`);
                console.log(`🌐 Ambiente: ${process.env.NODE_ENV || 'development'}`);
                console.log('\n📋 Endpoints disponíveis:');
                console.log(`   GET    http://localhost:${PORT}/api/eventos`);
                console.log(`   GET    http://localhost:${PORT}/api/eventos/:slug`);
                console.log(`   POST   http://localhost:${PORT}/api/pedidos`);
                console.log(`   GET    http://localhost:${PORT}/api/pedidos/:codigo`);
                console.log(`   POST   http://localhost:${PORT}/api/pedidos/:codigo/pagar`);
                console.log(`   GET    http://localhost:${PORT}/api/ingressos/:codigo`);
                console.log(`   POST   http://localhost:${PORT}/api/ingressos/:codigo/checkin`);
                console.log(`   POST   http://localhost:${PORT}/api/usuarios/registro`);
                console.log(`   POST   http://localhost:${PORT}/api/usuarios/login`);
                console.log(`   GET    http://localhost:${PORT}/health\n`);
            });
        } else {
            console.log('\n✅ Servidor configurado para Vercel');
        }
    } catch (error) {
        console.error('❌ Erro ao iniciar:', error.message);
        if (process.env.VERCEL !== '1') {
            process.exit(1);
        }
    }
}

if (process.env.VERCEL !== '1') {
    startServer();
} else {
    startServer().catch(console.error);
}

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    if (process.env.VERCEL !== '1') {
        process.exit(1);
    }
});

module.exports = app;
