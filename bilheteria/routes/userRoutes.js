// Rotas da API de Usuários
const express = require('express');
const router = express.Router();
const { authLimiter, consultLimiter } = require('../middleware/security');
const { authMiddleware } = require('../middleware/auth');
const userService = require('../services/userService');
const { validateEmail, validateNome, validateCPF, validateTelefone } = require('../utils/validation');

/**
 * POST /api/usuarios/registro
 * Registra um novo usuário
 */
router.post('/registro', authLimiter, async (req, res) => {
    try {
        const { email, nome, cpf, telefone, senha } = req.body;

        // Validações
        const emailValidado = validateEmail(email);
        if (!emailValidado) {
            return res.status(400).json({ success: false, error: 'Email inválido' });
        }

        const nomeValidado = validateNome(nome);
        if (!nomeValidado) {
            return res.status(400).json({ success: false, error: 'Nome inválido' });
        }

        if (!senha || senha.length < 6) {
            return res.status(400).json({ success: false, error: 'Senha deve ter pelo menos 6 caracteres' });
        }

        const result = await userService.registerUser({
            email: emailValidado,
            nome: nomeValidado,
            cpf: cpf ? validateCPF(cpf) : null,
            telefone: telefone ? validateTelefone(telefone) : null,
            senha
        });

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.status(201).json({
            success: true,
            user: result.user,
            token: result.token
        });
    } catch (error) {
        console.error('❌ Erro no registro:', error.message);
        res.status(500).json({
            success: false,
            error: 'Erro ao registrar usuário'
        });
    }
});

/**
 * POST /api/usuarios/login
 * Autentica um usuário
 */
router.post('/login', authLimiter, async (req, res) => {
    try {
        const { email, senha } = req.body;

        const emailValidado = validateEmail(email);
        if (!emailValidado) {
            return res.status(400).json({ success: false, error: 'Email inválido' });
        }

        if (!senha) {
            return res.status(400).json({ success: false, error: 'Senha obrigatória' });
        }

        const result = await userService.loginUser(emailValidado, senha);

        if (!result.success) {
            return res.status(401).json(result);
        }

        res.json({
            success: true,
            user: result.user,
            token: result.token
        });
    } catch (error) {
        console.error('❌ Erro no login:', error.message);
        res.status(500).json({
            success: false,
            error: 'Erro ao autenticar'
        });
    }
});

/**
 * GET /api/usuarios/perfil
 * Retorna dados do usuário logado
 */
router.get('/perfil', authMiddleware, async (req, res) => {
    try {
        const user = await userService.getUserById(req.user.id);

        if (!user) {
            return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
        }

        res.json({
            success: true,
            user
        });
    } catch (error) {
        console.error('❌ Erro ao buscar perfil:', error.message);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar perfil'
        });
    }
});

/**
 * PUT /api/usuarios/perfil
 * Atualiza dados do usuário logado
 */
router.put('/perfil', authMiddleware, async (req, res) => {
    try {
        const { nome, cpf, telefone } = req.body;

        const nomeValidado = validateNome(nome);
        if (!nomeValidado) {
            return res.status(400).json({ success: false, error: 'Nome inválido' });
        }

        const user = await userService.updateUser(req.user.id, {
            nome: nomeValidado,
            cpf: cpf ? validateCPF(cpf) : null,
            telefone: telefone ? validateTelefone(telefone) : null
        });

        res.json({
            success: true,
            user
        });
    } catch (error) {
        console.error('❌ Erro ao atualizar perfil:', error.message);
        res.status(500).json({
            success: false,
            error: 'Erro ao atualizar perfil'
        });
    }
});

module.exports = router;
