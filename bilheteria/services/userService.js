// Serviço de operações de Usuários
const { sql } = require('../config/database');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../middleware/auth');

const SALT_ROUNDS = 10;

/**
 * Registra um novo usuário
 */
async function registerUser(userData) {
    try {
        const { email, nome, cpf, telefone, senha } = userData;

        // Verifica se email já existe
        const existing = await sql`
      SELECT id FROM usuarios WHERE email = ${email}
    `;

        if (existing.rows.length > 0) {
            return { success: false, error: 'Email já cadastrado' };
        }

        // Hash da senha
        const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);

        // Cria usuário
        const result = await sql`
      INSERT INTO usuarios (email, nome, cpf, telefone, senha_hash)
      VALUES (${email}, ${nome}, ${cpf || null}, ${telefone || null}, ${senhaHash})
      RETURNING id, email, nome, cpf, telefone, criado_em
    `;

        const user = result.rows[0];
        const token = generateToken(user);

        return { success: true, user, token };
    } catch (error) {
        console.error('❌ Erro ao registrar usuário:', error.message);
        throw error;
    }
}

/**
 * Autentica um usuário
 */
async function loginUser(email, senha) {
    try {
        const result = await sql`
      SELECT id, email, nome, cpf, telefone, senha_hash, criado_em
      FROM usuarios
      WHERE email = ${email}
    `;

        if (result.rows.length === 0) {
            return { success: false, error: 'Email ou senha incorretos' };
        }

        const user = result.rows[0];

        // Verifica senha
        const senhaValida = await bcrypt.compare(senha, user.senha_hash);
        if (!senhaValida) {
            return { success: false, error: 'Email ou senha incorretos' };
        }

        // Remove senha do retorno
        delete user.senha_hash;

        const token = generateToken(user);

        return { success: true, user, token };
    } catch (error) {
        console.error('❌ Erro no login:', error.message);
        throw error;
    }
}

/**
 * Busca usuário por ID
 */
async function getUserById(id) {
    try {
        const result = await sql`
      SELECT id, email, nome, cpf, telefone, criado_em
      FROM usuarios
      WHERE id = ${id}
    `;
        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ Erro ao buscar usuário:', error.message);
        throw error;
    }
}

/**
 * Busca usuário por email
 */
async function getUserByEmail(email) {
    try {
        const result = await sql`
      SELECT id, email, nome, cpf, telefone, criado_em
      FROM usuarios
      WHERE email = ${email}
    `;
        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ Erro ao buscar usuário:', error.message);
        throw error;
    }
}

/**
 * Atualiza dados do usuário
 */
async function updateUser(id, userData) {
    try {
        const { nome, cpf, telefone } = userData;

        const result = await sql`
      UPDATE usuarios 
      SET nome = ${nome}, cpf = ${cpf || null}, telefone = ${telefone || null}
      WHERE id = ${id}
      RETURNING id, email, nome, cpf, telefone, criado_em
    `;

        return result.rows[0];
    } catch (error) {
        console.error('❌ Erro ao atualizar usuário:', error.message);
        throw error;
    }
}

module.exports = {
    registerUser,
    loginUser,
    getUserById,
    getUserByEmail,
    updateUser
};
