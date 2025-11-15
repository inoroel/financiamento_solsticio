// Serviço de validação de certificados do Banco do Brasil (mTLS)
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Cache dos certificados carregados
let bbCertificatesCache = null;
let lastLoadTime = 0;
const CACHE_TTL = 3600000; // 1 hora

/**
 * Carrega os certificados do BB baseado no ambiente e data atual
 * @returns {Array} Array de certificados (Buffer) do BB
 */
function loadBBCertificates() {
  const now = Date.now();
  
  // Usa cache se ainda válido
  if (bbCertificatesCache && (now - lastLoadTime) < CACHE_TTL) {
    return bbCertificatesCache;
  }

  const certificates = [];
  const isProduction = process.env.NODE_ENV === 'production' || process.env.BB_ENVIRONMENT === 'production';
  const certsBasePath = path.join(__dirname, '../certificados-webhook-bb');
  
  // Determina qual pasta usar baseado no ambiente
  const envFolder = isProduction ? 'producao' : 'sandbox';
  
  // Determina qual subpasta usar baseado na data atual
  const currentDate = new Date();
  const cutoffDate = isProduction 
    ? new Date('2025-02-24') // Apos 24-02-2025 para produção
    : new Date('2025-02-12'); // Apos 12-02-2025 para sandbox
  
  const dateFolder = currentDate >= cutoffDate ? 'Apos' : 'Ate';
  const dateSuffix = isProduction ? '24-02-2025' : '12-02-2025';
  const certsPath = path.join(certsBasePath, envFolder, `${dateFolder} ${dateSuffix}`);
  
  try {
    if (!fs.existsSync(certsPath)) {
      console.warn(`⚠️  Pasta de certificados não encontrada: ${certsPath}`);
      console.warn('⚠️  Validação de certificado do BB desabilitada');
      return [];
    }

    // Lista todos os arquivos de certificado na pasta
    const files = fs.readdirSync(certsPath);
    const certFiles = files.filter(file => 
      file.endsWith('.cer') || file.endsWith('.crt') || file.endsWith('.pem')
    );

    if (certFiles.length === 0) {
      console.warn(`⚠️  Nenhum certificado encontrado em: ${certsPath}`);
      return [];
    }

    // Carrega cada certificado
    for (const certFile of certFiles) {
      const certPath = path.join(certsPath, certFile);
      try {
        const certData = fs.readFileSync(certPath);
        certificates.push(certData);
        console.log(`✅ Certificado do BB carregado: ${certFile}`);
      } catch (error) {
        console.error(`❌ Erro ao carregar certificado ${certFile}:`, error.message);
      }
    }

    if (certificates.length === 0) {
      console.warn('⚠️  Nenhum certificado válido do BB foi carregado');
      return [];
    }

    // Atualiza cache
    bbCertificatesCache = certificates;
    lastLoadTime = now;
    
    console.log(`✅ ${certificates.length} certificado(s) do BB carregado(s) para validação mTLS`);
    return certificates;
    
  } catch (error) {
    console.error('❌ Erro ao carregar certificados do BB:', error.message);
    return [];
  }
}

/**
 * Valida se o certificado do cliente pertence ao Banco do Brasil
 * @param {Object} clientCert - Certificado do cliente (do req.socket.getPeerCertificate)
 * @returns {boolean} true se o certificado é do BB
 */
function validateBBCertificate(clientCert) {
  if (!clientCert || Object.keys(clientCert).length === 0) {
    return false;
  }

  try {
    // Obtém o certificado em formato DER (raw)
    const clientCertBuffer = clientCert.raw ? Buffer.from(clientCert.raw) : null;
    if (!clientCertBuffer) {
      return false;
    }

    // Carrega os certificados confiáveis do BB
    const bbCertificates = loadBBCertificates();
    
    if (bbCertificates.length === 0) {
      // Se não houver certificados carregados, loga mas permite (para desenvolvimento)
      if (process.env.NODE_ENV === 'production') {
        console.error('❌ CRÍTICO: Certificados do BB não carregados em produção!');
        return false;
      }
      console.warn('⚠️  Certificados do BB não disponíveis - validação desabilitada (apenas em desenvolvimento)');
      return true; // Permite em desenvolvimento se não houver certificados
    }

    // Compara o certificado do cliente com os certificados do BB
    for (const bbCert of bbCertificates) {
      try {
        // Compara os certificados byte a byte
        if (clientCertBuffer.equals(bbCert)) {
          console.log('✅ Certificado do cliente validado - pertence ao Banco do Brasil');
          return true;
        }

        // Também verifica usando fingerprint (mais robusto)
        const clientFingerprint = crypto.createHash('sha256').update(clientCertBuffer).digest('hex');
        const bbFingerprint = crypto.createHash('sha256').update(bbCert).digest('hex');
        
        if (clientFingerprint === bbFingerprint) {
          console.log('✅ Certificado do cliente validado (por fingerprint) - pertence ao Banco do Brasil');
          return true;
        }
      } catch (error) {
        // Continua verificando outros certificados
        continue;
      }
    }

    // Se chegou aqui, o certificado não corresponde a nenhum certificado do BB
    console.error('❌ Certificado do cliente NÃO pertence ao Banco do Brasil');
    console.error('   Subject:', clientCert.subject ? JSON.stringify(clientCert.subject) : 'N/A');
    console.error('   Issuer:', clientCert.issuer ? JSON.stringify(clientCert.issuer) : 'N/A');
    return false;

  } catch (error) {
    console.error('❌ Erro ao validar certificado do BB:', error.message);
    return false;
  }
}

/**
 * Valida o certificado do cliente a partir do objeto req do Express
 * @param {Object} req - Objeto da requisição Express
 * @returns {boolean} true se o certificado é válido e pertence ao BB
 */
function validateClientCertificateFromRequest(req) {
  try {
    // Obtém o certificado do cliente do socket TLS
    const clientCert = req.socket?.getPeerCertificate?.(true);
    
    if (!clientCert || Object.keys(clientCert).length === 0) {
      // Se não houver certificado de cliente, verifica se é obrigatório
      if (process.env.BB_REQUIRE_CLIENT_CERT === 'true') {
        console.error('❌ Certificado do cliente obrigatório mas não fornecido');
        return false;
      }
      // Em desenvolvimento, pode não ter certificado de cliente
      if (process.env.NODE_ENV === 'production') {
        console.warn('⚠️  Requisição sem certificado de cliente em produção');
      }
      return true; // Permite se não for obrigatório
    }

    // Valida se o certificado pertence ao BB
    return validateBBCertificate(clientCert);

  } catch (error) {
    console.error('❌ Erro ao obter certificado do cliente:', error.message);
    return false;
  }
}

module.exports = {
  loadBBCertificates,
  validateBBCertificate,
  validateClientCertificateFromRequest
};

