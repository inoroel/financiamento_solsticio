// Utilitários de validação e sanitização

/**
 * Valida e sanitiza valor monetário
 * @param {any} valor - Valor a ser validado
 * @param {number} min - Valor mínimo (padrão: 0.01)
 * @param {number} max - Valor máximo (padrão: 100000)
 * @returns {number|null} Valor validado ou null se inválido
 */
function validateValor(valor, min = 0.01, max = 100000) {
  // Converte para número
  const numValor = typeof valor === 'string' ? parseFloat(valor) : Number(valor);
  
  // Verifica se é um número válido
  if (isNaN(numValor) || !isFinite(numValor)) {
    return null;
  }
  
  // Verifica limites
  if (numValor < min || numValor > max) {
    return null;
  }
  
  // Arredonda para 2 casas decimais (padrão monetário)
  return Math.round(numValor * 100) / 100;
}

/**
 * Valida TXID (alfanumérico, 26-35 caracteres)
 * @param {string} txid - TXID a ser validado
 * @returns {boolean} true se válido
 */
function validateTxid(txid) {
  if (!txid || typeof txid !== 'string') {
    return false;
  }
  
  // Deve ter entre 26 e 35 caracteres
  if (txid.length < 26 || txid.length > 35) {
    return false;
  }
  
  // Deve ser alfanumérico apenas (letras e números)
  const alphanumericRegex = /^[a-zA-Z0-9]+$/;
  return alphanumericRegex.test(txid);
}

/**
 * Valida e sanitiza nome
 * @param {string} nome - Nome a ser validado
 * @param {number} maxLength - Tamanho máximo (padrão: 255)
 * @returns {string|null} Nome sanitizado ou null se inválido
 */
function validateNome(nome, maxLength = 255) {
  if (!nome || typeof nome !== 'string') {
    return null;
  }
  
  // Remove espaços extras e trim
  const sanitized = nome.trim().replace(/\s+/g, ' ');
  
  // Verifica se está vazio após sanitização
  if (sanitized.length === 0) {
    return null;
  }
  
  // Verifica tamanho máximo
  if (sanitized.length > maxLength) {
    return null;
  }
  
  // Permite apenas letras, números, espaços e alguns caracteres especiais comuns em nomes
  // Remove caracteres perigosos que podem ser usados em XSS
  const safeRegex = /^[a-zA-ZÀ-ÿ0-9\s\.\-\']+$/;
  if (!safeRegex.test(sanitized)) {
    return null;
  }
  
  return sanitized;
}

/**
 * Valida número de WhatsApp
 * @param {string} whatsapp - Número de WhatsApp a ser validado
 * @returns {string|null} WhatsApp sanitizado ou null se inválido
 */
function validateWhatsapp(whatsapp) {
  if (!whatsapp || typeof whatsapp !== 'string') {
    return null;
  }
  
  // Remove espaços, parênteses, hífens e outros caracteres
  const cleaned = whatsapp.replace(/[\s\(\)\-\.]/g, '');
  
  // Deve ter entre 10 e 15 dígitos (formato internacional)
  if (cleaned.length < 10 || cleaned.length > 15) {
    return null;
  }
  
  // Deve conter apenas números
  const numericRegex = /^[0-9]+$/;
  if (!numericRegex.test(cleaned)) {
    return null;
  }
  
  // Formata como string numérica limpa
  return cleaned;
}

/**
 * Valida ID de campanha
 * @param {any} cid - ID da campanha
 * @returns {string|null} CID validado ou null se inválido
 */
function validateCampanhaId(cid) {
  if (!cid) {
    return null;
  }
  
  // Converte para string
  const strCid = String(cid).trim();
  
  // Verifica tamanho (máximo 50 caracteres)
  if (strCid.length === 0 || strCid.length > 50) {
    return null;
  }
  
  // Permite apenas alfanuméricos, hífens e underscores
  const safeRegex = /^[a-zA-Z0-9_-]+$/;
  if (!safeRegex.test(strCid)) {
    return null;
  }
  
  return strCid;
}

/**
 * Sanitiza string para prevenir XSS
 * @param {string} str - String a ser sanitizada
 * @returns {string} String sanitizada
 */
function sanitizeString(str) {
  if (typeof str !== 'string') {
    return '';
  }
  
  return str
    .replace(/[<>]/g, '') // Remove < e >
    .replace(/javascript:/gi, '') // Remove javascript:
    .replace(/on\w+=/gi, ''); // Remove event handlers
}

module.exports = {
  validateValor,
  validateTxid,
  validateNome,
  validateWhatsapp,
  validateCampanhaId,
  sanitizeString
};

