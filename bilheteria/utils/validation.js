// Utilitários de validação e sanitização para Bilheteria

/**
 * Valida e sanitiza valor monetário
 */
function validateValor(valor, min = 0.01, max = 100000) {
    const numValor = typeof valor === 'string' ? parseFloat(valor) : Number(valor);
    if (isNaN(numValor) || !isFinite(numValor)) return null;
    if (numValor < min || numValor > max) return null;
    return Math.round(numValor * 100) / 100;
}

/**
 * Valida e sanitiza nome
 */
function validateNome(nome, maxLength = 255) {
    if (!nome || typeof nome !== 'string') return null;
    const sanitized = nome.trim().replace(/\s+/g, ' ');
    if (sanitized.length === 0 || sanitized.length > maxLength) return null;
    const safeRegex = /^[a-zA-ZÀ-ÿ0-9\s\.\-\']+$/;
    if (!safeRegex.test(sanitized)) return null;
    return sanitized;
}

/**
 * Valida email
 */
function validateEmail(email) {
    if (!email || typeof email !== 'string') return null;
    const trimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed) || trimmed.length > 255) return null;
    return trimmed;
}

/**
 * Valida CPF (formato e dígitos verificadores)
 */
function validateCPF(cpf) {
    if (!cpf || typeof cpf !== 'string') return null;
    const cleaned = cpf.replace(/[^\d]/g, '');
    if (cleaned.length !== 11) return null;

    // Verifica CPFs inválidos conhecidos
    if (/^(\d)\1{10}$/.test(cleaned)) return null;

    // Validação dos dígitos verificadores
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(cleaned[i]) * (10 - i);
    }
    let d1 = 11 - (sum % 11);
    if (d1 >= 10) d1 = 0;
    if (parseInt(cleaned[9]) !== d1) return null;

    sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += parseInt(cleaned[i]) * (11 - i);
    }
    let d2 = 11 - (sum % 11);
    if (d2 >= 10) d2 = 0;
    if (parseInt(cleaned[10]) !== d2) return null;

    return cleaned;
}

/**
 * Valida telefone
 */
function validateTelefone(telefone) {
    if (!telefone || typeof telefone !== 'string') return null;
    const cleaned = telefone.replace(/[\s\(\)\-\.]/g, '');
    if (cleaned.length < 10 || cleaned.length > 15) return null;
    if (!/^[0-9]+$/.test(cleaned)) return null;
    return cleaned;
}

/**
 * Valida slug de evento
 */
function validateSlug(slug) {
    if (!slug || typeof slug !== 'string') return null;
    const trimmed = slug.trim().toLowerCase();
    if (trimmed.length === 0 || trimmed.length > 100) return null;
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(trimmed)) return null;
    return trimmed;
}

/**
 * Gera um código único para pedido (SOL-XXXXXX)
 */
function generateOrderCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'SOL-';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

/**
 * Gera um código único para ingresso (30 chars para QR Code)
 */
function generateTicketCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 30; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

/**
 * Sanitiza string para prevenir XSS
 */
function sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/[<>]/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '');
}

/**
 * Valida inteiro positivo
 */
function validatePositiveInt(value, max = 100) {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1 || num > max) return null;
    return num;
}

/**
 * Gera slug a partir de um título
 */
function generateSlug(title) {
    if (!title || typeof title !== 'string') return null;
    return title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 100);
}

module.exports = {
    validateValor,
    validateNome,
    validateEmail,
    validateCPF,
    validateTelefone,
    validateSlug,
    generateOrderCode,
    generateTicketCode,
    sanitizeString,
    validatePositiveInt,
    generateSlug
};
