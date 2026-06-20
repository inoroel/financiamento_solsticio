// Middleware de autenticação JWT
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'bilheteria-secret-dev-only';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Gera um token JWT para um usuário
 * @param {Object} user - Dados do usuário
 * @returns {string} Token JWT
 */
function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            nome: user.nome
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

/**
 * Middleware para verificar token JWT
 * Adiciona req.user com os dados do usuário decodificado
 */
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            success: false,
            error: 'Token de autenticação não fornecido'
        });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({
            success: false,
            error: 'Token malformado'
        });
    }

    const token = parts[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expirado'
            });
        }
        return res.status(401).json({
            success: false,
            error: 'Token inválido'
        });
    }
}

/**
 * Middleware opcional de autenticação
 * Não bloqueia se não houver token, mas adiciona req.user se houver
 */
function optionalAuthMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return next();
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return next();
    }

    const token = parts[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
    } catch (error) {
        // Ignora erros de token - usuário não autenticado
    }

    next();
}

module.exports = {
    generateToken,
    authMiddleware,
    optionalAuthMiddleware,
    JWT_SECRET,
    JWT_EXPIRES_IN
};
