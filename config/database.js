// Configuração do banco de dados PostgreSQL
// Suporta tanto @vercel/postgres (Vercel) quanto pg (PostgreSQL local)
require('dotenv').config();

let sql;
let dbType = 'vercel'; // 'vercel' ou 'local'
let pool = null;

// Ajuda a escolher e diagnosticar a URL de conexão
function isPooled(url = '') {
  return url.includes('pgbouncer=true');
}

function maskUrl(url = '') {
  try {
    const parsed = new URL(url);
    // mascara usuário/senha e mostra host + caminho
    return `${parsed.protocol}//****:****@${parsed.hostname}${parsed.port ? ':' + parsed.port : ''}${parsed.pathname}`;
  } catch (e) {
    return 'mascara indisponível';
  }
}

function logChosenUrl(label, url) {
  const pooled = isPooled(url);
  console.log(`🔎 DB URL escolhida: ${label}`);
  console.log(`   - pooled (pgbouncer=true): ${pooled ? 'SIM' : 'NÃO'}`);
  console.log(`   - host/path: ${maskUrl(url)}`);
  console.log(`   - tamanho: ${url ? url.length : 0}`);
  if (!pooled) {
    console.warn('⚠️  URL não tem pgbouncer=true (non-pooled) — pode travar em serverless.');
  }
}

function addPgbouncer(url = '') {
  if (!url) return url;
  if (url.includes('pgbouncer=true')) return url;
  const hasQuery = url.includes('?');
  return url + (hasQuery ? '&' : '?') + 'pgbouncer=true';
}

/**
 * Remove pgbouncer=true da URL (Prisma Accelerate não precisa)
 * @param {string} url - URL de conexão
 * @returns {string} URL sem pgbouncer
 */
function removePgbouncer(url = '') {
  if (!url) return url;
  // Remove pgbouncer=true e pgbouncer=false da query string
  return url
    .replace(/[?&]pgbouncer=true/gi, '')
    .replace(/[?&]pgbouncer=false/gi, '')
    .replace(/pgbouncer=true[&?]/gi, '')
    .replace(/pgbouncer=false[&?]/gi, '');
}

/**
 * Verifica se a URL é do Prisma Accelerate
 * @param {string} url - URL de conexão
 * @returns {boolean} true se for URL Prisma Accelerate
 */
function isPrismaAccelerateUrl(url = '') {
  if (!url) return false;
  return url.startsWith('prisma+postgres://') || url.includes('accelerate.prisma-data.net');
}

/**
 * Converte URL Prisma (prisma+postgres://) para formato PostgreSQL padrão
 * @param {string} url - URL de conexão
 * @returns {string} URL convertida
 */
function convertPrismaUrl(url = '') {
  if (!url) return url;
  // Se for URL Prisma, converte para postgres://
  if (url.startsWith('prisma+postgres://')) {
    return url.replace('prisma+postgres://', 'postgres://');
  }
  return url;
}

/**
 * Executa uma query com retry em caso de erro de conexão
 * @param {Function} queryFn - Função que executa a query
 * @param {number} maxRetries - Número máximo de tentativas (padrão: 3)
 * @returns {Promise<any>} Resultado da query
 */
async function executeWithRetry(queryFn, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await queryFn();
    } catch (error) {
      lastError = error;
      const errorMessage = error.message || String(error);
      
      // Verifica se é um erro de conexão que pode ser recuperado
      const isConnectionError = errorMessage.includes('Connection terminated') ||
                                errorMessage.includes('Connection closed') ||
                                errorMessage.includes('Connection ended') ||
                                errorMessage.includes('ECONNRESET') ||
                                errorMessage.includes('ETIMEDOUT') ||
                                error.code === 'ECONNRESET' ||
                                error.code === 'ETIMEDOUT';
      
      if (isConnectionError && attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
        console.warn(`⚠️  Erro de conexão (tentativa ${attempt}/${maxRetries}), tentando novamente em ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Se estiver usando pool, tenta reconectar
        if (pool && typeof pool.end === 'function') {
          // Não fecha o pool, apenas força uma nova conexão na próxima query
          // O pool já gerencia isso automaticamente
        }
        continue;
      }
      
      // Se não for erro de conexão ou já tentou todas as vezes, lança o erro
      throw error;
    }
  }
  
  throw lastError;
}

// Detecta qual driver usar baseado nas variáveis de ambiente
// Na Vercel, sempre usa @vercel/postgres
// Localmente, usa pg se POSTGRES_URL não contém 'vercel'
// Verifica múltiplas variações possíveis da URL da Vercel
const postgresUrl = process.env.POSTGRES_URL || '';
const prismaUrlRaw = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_PRISMA_DATABASE_URL || process.env.POSTGRES_DATABASE_URL || '';
const isVercelUrl = postgresUrl.includes('vercel') || 
                     postgresUrl.includes('vercel-storage') ||
                     postgresUrl.includes('neon.tech') ||
                     postgresUrl.includes('neon.tech/') ||
                     postgresUrl.includes('ep-') && postgresUrl.includes('.postgres') ||
                     prismaUrlRaw.includes('vercel') ||
                     prismaUrlRaw.includes('neon.tech');
const isVercel = process.env.VERCEL === '1' || isVercelUrl;
const useLocalPg = !isVercel && process.env.POSTGRES_URL && !isVercelUrl;

if (useLocalPg) {
  // Usa pg (PostgreSQL local) em desenvolvimento local
  try {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: process.env.POSTGRES_URL,
      ssl: false // Desabilita SSL para PostgreSQL local
    });
    
    dbType = 'local';
    console.log('📦 Usando PostgreSQL local (pg)');
    
    // Cria um wrapper compatível com @vercel/postgres
    // O @vercel/postgres usa template literals como função tag
    sql = function(strings, ...values) {
      // Se chamado sem template literal (string direta)
      if (arguments.length === 1 && typeof arguments[0] === 'string') {
        return pool.query(arguments[0]).then(result => ({ rows: result.rows }));
      }
      
      // Template literal - converte para query parametrizada
      const text = strings.reduce((acc, str, i) => {
        return acc + str + (i < values.length ? `$${i + 1}` : '');
      }, '');
      
      return pool.query(text, values).then(result => ({ rows: result.rows }));
    };
    
    // Adiciona método query para compatibilidade com sql.query()
    sql.query = async (queryText) => {
      if (typeof queryText === 'string') {
        const result = await pool.query(queryText);
        return { rows: result.rows };
      }
      // Se for objeto do @vercel/postgres (com .raw, .strings, .values)
      if (queryText && queryText.raw) {
        const text = queryText.strings.reduce((acc, str, i) => {
          return acc + str + (i < queryText.values.length ? `$${i + 1}` : '');
        }, '');
        const values = queryText.values || [];
        const result = await pool.query(text, values);
        return { rows: result.rows };
      }
      throw new Error('Formato de query inválido');
    };
    
  } catch (error) {
    console.warn('⚠️  Erro ao carregar pg, tentando @vercel/postgres:', error.message);
    console.warn('💡 Execute: npm install pg');
    // Fallback para @vercel/postgres
    const vercelPostgres = require('@vercel/postgres');
    sql = vercelPostgres.sql;
    dbType = 'vercel';
    console.log('📦 Usando Vercel Postgres');
  }
} else {
  // SOLUÇÃO SIMPLES: Verifica se URL tem pgbouncer=true
  // Se tiver, usa sql diretamente. Se não tiver, usa createClient()
  const postgresUrl = process.env.POSTGRES_URL || '';
  const hasPgbouncer = postgresUrl.includes('pgbouncer=true');
  
  const vercelPostgres = require('@vercel/postgres');
  
  if (hasPgbouncer) {
    // URL tem pgbouncer=true - usa sql diretamente
    const originalSql = vercelPostgres.sql;
    
    sql = function(strings, ...values) {
      return executeWithRetry(() => originalSql.apply(null, arguments));
    };
    
    sql.query = async (queryText) => {
      return executeWithRetry(async () => {
        if (typeof queryText === 'string') {
          return originalSql([queryText]);
        }
        if (queryText && queryText.raw) {
          return originalSql(queryText.strings, ...(queryText.values || []));
        }
        throw new Error('Formato de query inválido');
      });
    };
    
    console.log('📦 Usando @vercel/postgres.sql (pooled)');
  } else {
    // URL não tem pgbouncer=true - usa createClient()
    const client = vercelPostgres.createClient({
      connectionString: postgresUrl
    });
    const clientSql = client.sql;
    
    sql = function(strings, ...values) {
      return executeWithRetry(() => clientSql.apply(client, arguments));
    };
    
    sql.query = async (queryText) => {
      return executeWithRetry(async () => {
        if (typeof queryText === 'string') {
          return clientSql([queryText]);
        }
        if (queryText && queryText.raw) {
          return clientSql(queryText.strings, ...(queryText.values || []));
        }
        throw new Error('Formato de query inválido');
      });
    };
    
    console.log('📦 Usando @vercel/postgres.createClient() (direct)');
  }
  
  dbType = 'vercel';
}

/**
 * Testa a conexão com o banco de dados com retry
 * @returns {Promise<{success: boolean, error?: string, data?: any}>}
 */
async function testConnection() {
  try {
    // Verifica se sql está definido
    if (!sql) {
      const error = 'sql não está definido. Driver não foi inicializado corretamente.';
      console.error('❌ Erro ao conectar com banco de dados:', error);
      return { success: false, error };
    }

    // Usa retry para testar a conexão
    const result = await executeWithRetry(async () => {
      return await sql`SELECT NOW() as current_time`;
    }, 3);
    
    const currentTime = result.rows[0]?.current_time;
    console.log('✅ Conexão com banco de dados estabelecida:', currentTime);
    return { success: true, data: { currentTime } };
  } catch (error) {
    const errorMessage = error.message || String(error);
    console.error('❌ Erro ao conectar com banco de dados:', errorMessage);
    
    // Dicas específicas baseadas no tipo de erro
    if (errorMessage.includes('Connection terminated') || 
        errorMessage.includes('Connection closed') ||
        errorMessage.includes('ECONNRESET')) {
      console.error('💡 Erro: Conexão foi terminada inesperadamente');
      console.error('💡 Possíveis causas:');
      console.error('   - Timeout de conexão (verifique POSTGRES_PRISMA_URL para pooling)');
      console.error('   - Banco de dados não está acessível');
      console.error('   - Variáveis de ambiente incorretas');
      if (dbType === 'vercel') {
        console.error('💡 Na Vercel, use POSTGRES_PRISMA_DATABASE_URL ou POSTGRES_PRISMA_URL (com pgbouncer=true) para melhor performance');
      }
    } else if (dbType === 'local') {
      console.error('💡 Verifique se o PostgreSQL está rodando e se as credenciais no .env estão corretas');
      console.error('💡 Teste a conexão: psql -d financiamento_solsticio');
    }
    
    return { success: false, error: errorMessage, stack: error.stack };
  }
}

/**
 * Retorna informações detalhadas de diagnóstico sobre o banco de dados
 * @returns {Promise<Object>} Objeto com informações de diagnóstico
 */
async function getDatabaseDiagnostics() {
  const diagnostics = {
    // Informações sobre variáveis de ambiente
    environment: {
      hasPostgresUrl: !!process.env.POSTGRES_URL,
      postgresUrlLength: process.env.POSTGRES_URL?.length || 0,
      hasPostgresPrismaUrl: !!(process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_PRISMA_DATABASE_URL),
      hasPostgresDatabaseUrl: !!process.env.POSTGRES_DATABASE_URL,
      hasPostgresUrlNonPooling: !!process.env.POSTGRES_URL_NON_POOLING,
      vercelEnv: process.env.VERCEL === '1',
      nodeEnv: process.env.NODE_ENV || 'development',
      // Informações sobre a URL (sem expor credenciais)
      postgresUrlPreview: process.env.POSTGRES_URL 
        ? `${process.env.POSTGRES_URL.substring(0, 20)}...${process.env.POSTGRES_URL.substring(process.env.POSTGRES_URL.length - 10)}`
        : null
    },
    
    // Informações sobre o driver
    driver: {
      type: dbType,
      isVercelUrl: isVercelUrl,
      isVercel: isVercel,
      useLocalPg: useLocalPg,
      sqlDefined: typeof sql === 'function',
      poolDefined: !!pool
    },
    
    // Informações sobre módulos
    modules: {
      vercelPostgresLoaded: false,
      pgLoaded: false
    },
    
    // Teste de conexão
    connectionTest: null
  };

  // Verifica se os módulos estão carregados
  try {
    require.resolve('@vercel/postgres');
    diagnostics.modules.vercelPostgresLoaded = true;
  } catch (e) {
    diagnostics.modules.vercelPostgresLoaded = false;
  }

  try {
    require.resolve('pg');
    diagnostics.modules.pgLoaded = true;
  } catch (e) {
    diagnostics.modules.pgLoaded = false;
  }

  // Executa teste de conexão
  diagnostics.connectionTest = await testConnection();

  return diagnostics;
}

/**
 * Inicializa o banco de dados executando o script SQL
 */
async function initializeDatabase() {
  try {
    const fs = require('fs');
    const path = require('path');
    const sqlScript = fs.readFileSync(
      path.join(__dirname, '../scripts/init-db.sql'),
      'utf8'
    );
    
    if (dbType === 'local') {
      // Para PostgreSQL local, executa cada comando separadamente
      // Remove comentários e divide por ponto e vírgula
      const lines = sqlScript.split('\n');
      let currentCommand = '';
      const commands = [];
      
      for (const line of lines) {
        // Remove comentários de linha
        const cleanLine = line.split('--')[0].trim();
        if (cleanLine) {
          currentCommand += cleanLine + ' ';
          // Se termina com ;, é um comando completo
          if (cleanLine.endsWith(';')) {
            commands.push(currentCommand.trim());
            currentCommand = '';
          }
        }
      }
      
      // Adiciona último comando se não terminou com ;
      if (currentCommand.trim()) {
        commands.push(currentCommand.trim());
      }
      
      for (const command of commands) {
        if (command && !command.match(/^\s*$/)) {
          try {
            await pool.query(command);
          } catch (error) {
            // Ignora erros de "já existe"
            if (!error.message.includes('already exists') && 
                !error.message.includes('duplicate') &&
                !error.message.includes('does not exist')) {
              // Se não for erro de "já existe", relança
              if (!error.message.includes('relation') || !error.message.includes('already exists')) {
                throw error;
              }
            }
          }
        }
      }
    } else {
      // Para Vercel Postgres, executa o script completo
      await sql.query(sqlScript);
    }
    
    console.log('✅ Banco de dados inicializado com sucesso');
    return true;
  } catch (error) {
    // Se as tabelas já existem, não é um erro crítico
    if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      console.log('ℹ️  Tabelas já existem no banco de dados');
      return true;
    }
    console.error('❌ Erro ao inicializar banco de dados:', error.message);
    if (dbType === 'local') {
      console.error('💡 Tente executar o script manualmente: psql -d financiamento_solsticio -f scripts/init-db.sql');
    }
    return false;
  }
}

module.exports = {
  sql,
  testConnection,
  initializeDatabase,
  getDatabaseDiagnostics,
  dbType
};
