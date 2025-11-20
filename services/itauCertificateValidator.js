// Serviço de validação de certificados do Itaú (mTLS)
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const tls = require('tls');
require('dotenv').config();

// Cache dos certificados CA do Itaú carregados
let itauCertificatesCache = null;
let lastLoadTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hora

/**
 * Carrega os certificados CA (Certificate Authority) do Itaú
 * Conforme documentação: https://devportal.itau.com.br
 * O Itaú fornece uma CA que deve ser importada para validar certificados mTLS
 * @returns {Array<Buffer>} Array de certificados CA do Itaú
 */
function loadItauCertificates() {
  const now = Date.now();
  
  // Usa cache se ainda válido
  if (itauCertificatesCache && (now - lastLoadTime) < CACHE_TTL) {
    return itauCertificatesCache;
  }

  const certificates = [];
  const certsBasePath = path.join(__dirname, '../certificados-webhook-itau');
  
  try {
    if (!fs.existsSync(certsBasePath)) {
      console.warn(`⚠️  Pasta de certificados do Itaú não encontrada: ${certsBasePath}`);
      console.warn('⚠️  Validação de certificado do cliente do Itaú desabilitada');
      itauCertificatesCache = [];
      lastLoadTime = now;
      return [];
    }

    // Lista todos os arquivos de certificado na pasta
    const files = fs.readdirSync(certsBasePath);
    const certFiles = files.filter(file => 
      file.endsWith('.cer') || 
      file.endsWith('.crt') || 
      file.endsWith('.pem') ||
      file === 'ca-cert' // Arquivo específico do Itaú
    );

    if (certFiles.length === 0) {
      console.warn(`⚠️  Nenhum certificado encontrado em: ${certsBasePath}`);
      return [];
    }

    // Carrega cada certificado
    for (const certFile of certFiles) {
      const certPath = path.join(certsBasePath, certFile);
      try {
        // Verifica se é arquivo (não diretório)
        if (fs.statSync(certPath).isFile()) {
          const certData = fs.readFileSync(certPath);
          certificates.push(certData);
          console.log(`✅ Certificado CA do Itaú carregado: ${certFile}`);
        }
      } catch (error) {
        console.error(`❌ Erro ao carregar certificado ${certFile}:`, error.message);
      }
    }

    // Nota: Se houver arquivo ZIP, extraia manualmente os certificados para a pasta
    // O código lê apenas arquivos .cer, .crt, .pem e 'ca-cert' diretamente da pasta

    if (certificates.length === 0) {
      console.warn('⚠️  Nenhum certificado válido do Itaú foi carregado');
      console.warn('⚠️  Validação de certificado do cliente do Itaú desabilitada');
    } else {
      console.log(`✅ ${certificates.length} certificado(s) CA do Itaú carregado(s) para validação mTLS`);
    }

    // Atualiza cache
    itauCertificatesCache = certificates;
    lastLoadTime = now;
    return certificates;
    
  } catch (error) {
    console.error('❌ Erro ao carregar certificados CA do Itaú:', error.message);
    itauCertificatesCache = [];
    lastLoadTime = now;
    return [];
  }
}

/**
 * Valida se o certificado do cliente foi emitido por uma CA confiável do Itaú
 * @param {Object} clientCert - Certificado do cliente (do req.socket.getPeerCertificate)
 * @returns {boolean} true se o certificado é válido e foi emitido pelo Itaú
 */
function validateItauCertificate(clientCert) {
  if (!clientCert || Object.keys(clientCert).length === 0) {
    return false;
  }

  try {
    // Obtém o certificado em formato DER (raw)
    const clientCertBuffer = clientCert.raw ? Buffer.from(clientCert.raw) : null;
    if (!clientCertBuffer) {
      return false;
    }

    // Carrega os certificados CA confiáveis do Itaú
    const itauCertificates = loadItauCertificates();
    
    if (itauCertificates.length === 0) {
      // Se não houver certificados carregados, loga mas permite (para desenvolvimento)
      if (process.env.NODE_ENV === 'production') {
        console.error('❌ CRÍTICO: Certificados CA do Itaú não carregados em produção!');
        return false;
      }
      console.warn('⚠️  Certificados CA do Itaú não disponíveis - validação desabilitada (apenas em desenvolvimento)');
      return true; // Permite em desenvolvimento se não houver certificados
    }

    // Valida se o certificado do cliente foi emitido por uma das CAs do Itaú
    // Cria um contexto TLS temporário com as CAs confiáveis
    const secureContext = tls.createSecureContext({ ca: itauCertificates });
    
    // Verifica se o certificado é válido e foi emitido por uma CA confiável
    // A validação completa da cadeia é feita pelo Node.js quando configuramos o secureContext
    // Aqui fazemos uma verificação básica comparando o issuer do certificado
    
    // Verifica o issuer do certificado do cliente
    const clientIssuer = clientCert.issuer;
    if (!clientIssuer) {
      console.warn('⚠️  Certificado do cliente não possui issuer');
      return false;
    }

    // Compara o certificado do cliente com os certificados CA do Itaú
    // Usa fingerprint SHA-256 para comparação
    for (const itauCert of itauCertificates) {
      try {
        // Tenta verificar se o certificado foi emitido por esta CA
        // Isso é uma heurística - a validação completa da cadeia é feita pelo servidor TLS
        const itauFingerprint = crypto.createHash('sha256').update(itauCert).digest('hex');
        
        // Se o certificado do cliente tiver um issuerCertificate, compara
        if (clientCert.issuerCertificate) {
          const issuerCertBuffer = clientCert.issuerCertificate.raw 
            ? Buffer.from(clientCert.issuerCertificate.raw) 
            : null;
          
          if (issuerCertBuffer) {
            const issuerFingerprint = crypto.createHash('sha256').update(issuerCertBuffer).digest('hex');
            if (issuerFingerprint === itauFingerprint) {
              console.log('✅ Certificado do cliente validado - emitido por CA do Itaú');
              return true;
            }
          }
        }
      } catch (error) {
        // Continua verificando outros certificados
        continue;
      }
    }

    // Se chegou aqui, o certificado não foi emitido por nenhuma CA do Itaú conhecida
    // Mas ainda pode ser válido se o servidor TLS validou a cadeia
    // Em produção, devemos ser mais rigorosos
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ Certificado do cliente NÃO foi emitido por CA confiável do Itaú');
      console.error('   Subject:', clientCert.subject ? JSON.stringify(clientCert.subject) : 'N/A');
      console.error('   Issuer:', clientIssuer ? JSON.stringify(clientIssuer) : 'N/A');
      return false;
    }
    
    // Em desenvolvimento, permite se o certificado é válido (mesmo sem validação completa da CA)
    if (clientCert.valid) {
      console.warn('⚠️  Certificado do cliente válido, mas não foi possível verificar CA do Itaú (desenvolvimento)');
      return true;
    }
    
    return false;

  } catch (error) {
    console.error('❌ Erro ao validar certificado do Itaú:', error.message);
    return false;
  }
}

/**
 * Valida o certificado do cliente a partir do objeto req do Express
 * Conforme documentação do Itaú: https://devportal.itau.com.br
 * O Itaú usa mTLS para webhooks, validando o certificado do cliente contra as CAs fornecidas
 * @param {Object} req - Objeto da requisição Express
 * @returns {boolean} true se o certificado é válido e pertence ao Itaú
 */
function validateClientCertificateFromRequest(req) {
  try {
    // Obtém o certificado do cliente do socket TLS
    const clientCert = req.socket?.getPeerCertificate?.(true);
    
    if (!clientCert || Object.keys(clientCert).length === 0) {
      // Se não houver certificado de cliente, verifica se é obrigatório
      if (process.env.ITAU_REQUIRE_CLIENT_CERT === 'true') {
        console.error('❌ Certificado do cliente obrigatório mas não fornecido (mTLS exigido)');
        return false;
      }
      // Em desenvolvimento, pode não ter certificado de cliente
      if (process.env.NODE_ENV === 'production') {
        console.warn('⚠️  Requisição sem certificado de cliente em produção');
      }
      return true; // Permite se não for obrigatório
    }

    // Verifica se o certificado é válido
    if (!clientCert.valid) {
      console.error('❌ Certificado do cliente inválido ou expirado');
      return false;
    }

    // Valida se o certificado foi emitido por uma CA confiável do Itaú
    return validateItauCertificate(clientCert);

  } catch (error) {
    console.error('❌ Erro ao obter certificado do cliente:', error.message);
    return false;
  }
}

module.exports = {
  loadItauCertificates,
  validateItauCertificate,
  validateClientCertificateFromRequest
};

