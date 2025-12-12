// Configuração do banco de dados PostgreSQL
// Suporta tanto @vercel/postgres (Vercel) quanto pg (PostgreSQL local)
require('dotenv').config();

let sql;
let dbType = 'vercel'; // 'vercel' ou 'local'
let pool = null;

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
const isVercelUrl = postgresUrl.includes('vercel') || 
                     postgresUrl.includes('vercel-storage') ||
                     postgresUrl.includes('neon.tech') ||
                     postgresUrl.includes('neon.tech/') ||
                     postgresUrl.includes('ep-') && postgresUrl.includes('.postgres');
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
  // Usa @vercel/postgres (padrão para Vercel)
  // @vercel/postgres.sql precisa de POSTGRES_PRISMA_URL ou POSTGRES_PRISMA_DATABASE_URL (com pooling)
  // A Vercel gera: POSTGRES_PRISMA_DATABASE_URL, POSTGRES_DATABASE_URL, POSTGRES_URL
  // Verifica múltiplas variações possíveis
  const prismaUrl = process.env.POSTGRES_PRISMA_URL || 
                    process.env.POSTGRES_PRISMA_DATABASE_URL ||
                    process.env.POSTGRES_DATABASE_URL;
  
  if (prismaUrl) {
    // URL com pooling (pgbouncer=true) - funciona com @vercel/postgres
    // Temporariamente define POSTGRES_URL para a URL com pooling para @vercel/postgres usar
    const originalPostgresUrl = process.env.POSTGRES_URL;
    process.env.POSTGRES_URL = prismaUrl;
    const vercelPostgres = require('@vercel/postgres');
    const originalSql = vercelPostgres.sql;
    
    // Wrapper com retry para @vercel/postgres
    // @vercel/postgres usa template literals como função tag
    sql = function(strings, ...values) {
      return executeWithRetry(() => originalSql.apply(null, arguments));
    };
    // Para compatibilidade com sql.query() usado em initializeDatabase
    sql.query = async (queryText) => {
      return executeWithRetry(async () => {
        if (typeof queryText === 'string') {
          // @vercel/postgres não tem método direto para strings, usa template literal
          // Mas precisamos escapar valores - para queries simples, funciona
          return originalSql([queryText]);
        }
        // Se for objeto do @vercel/postgres (com .raw, .strings, .values)
        if (queryText && queryText.raw) {
          return originalSql(queryText.strings, ...(queryText.values || []));
        }
        throw new Error('Formato de query inválido');
      });
    };
    
    // Restaura POSTGRES_URL original se existia
    if (originalPostgresUrl) {
      process.env.POSTGRES_URL = originalPostgresUrl;
    } else {
      delete process.env.POSTGRES_URL;
    }
    dbType = 'vercel';
    if (process.env.NODE_ENV !== 'production') {
      console.log('📦 Usando Vercel Postgres com URL pooled (POSTGRES_PRISMA_URL ou POSTGRES_PRISMA_DATABASE_URL)');
    }
  } else if (process.env.POSTGRES_URL) {
    // Se não tem POSTGRES_PRISMA_URL, usa createClient() do @vercel/postgres
    // createClient() aceita connection strings diretas (sem pooling)
    try {
      const { createClient } = require('@vercel/postgres');
      const client = createClient({
        connectionString: process.env.POSTGRES_URL
      });
      
      // Cria wrapper compatível com @vercel/postgres usando o client
      // @vercel/postgres usa template literals como função tag
      sql = function(strings, ...values) {
        return executeWithRetry(async () => {
          // Se chamado sem template literal (string direta)
          if (arguments.length === 1 && typeof arguments[0] === 'string') {
            const result = await client.query(arguments[0]);
            return { rows: result.rows };
          }
          
          // Template literal - converte para query parametrizada
          const text = strings.reduce((acc, str, i) => {
            return acc + str + (i < values.length ? `$${i + 1}` : '');
          }, '');
          
          const result = await client.query(text, values);
          return { rows: result.rows };
        });
      };
      
      sql.query = async (queryText) => {
        return executeWithRetry(async () => {
          if (typeof queryText === 'string') {
            const result = await client.query(queryText);
            return { rows: result.rows };
          }
          // Se for objeto do @vercel/postgres (com .raw, .strings, .values)
          if (queryText && queryText.raw) {
            const text = queryText.strings.reduce((acc, str, i) => {
              return acc + str + (i < queryText.values.length ? `$${i + 1}` : '');
            }, '');
            const values = queryText.values || [];
            const result = await client.query(text, values);
            return { rows: result.rows };
          }
          throw new Error('Formato de query inválido');
        });
      };
      
      dbType = 'vercel';
      if (process.env.NODE_ENV !== 'production') {
        console.log('📦 Usando @vercel/postgres createClient() com POSTGRES_URL (connection string direta)');
      }
    } catch (error) {
      console.warn('⚠️  Erro ao usar @vercel/postgres createClient(), tentando pg:', error.message);
      // Fallback para pg com POSTGRES_URL direta
      try {
        const { Pool } = require('pg');
        
        // Configuração otimizada para serverless (Vercel)
        const poolConfig = {
          connectionString: process.env.POSTGRES_URL,
          ssl: { rejectUnauthorized: false }, // Vercel Postgres requer SSL
          max: 1, // Máximo de 1 conexão por função serverless
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
          allowExitOnIdle: true
        };
        
        pool = new Pool(poolConfig);
        
        pool.on('error', (err) => {
          console.error('❌ Erro inesperado no pool de conexões:', err.message);
        });
        
        dbType = 'vercel';
        console.log('📦 Usando pg com POSTGRES_URL (fallback)');
        
        // Cria wrapper compatível com @vercel/postgres com retry
        sql = function(strings, ...values) {
          if (arguments.length === 1 && typeof arguments[0] === 'string') {
            return executeWithRetry(() => pool.query(arguments[0]).then(result => ({ rows: result.rows })));
          }
          const text = strings.reduce((acc, str, i) => {
            return acc + str + (i < values.length ? `$${i + 1}` : '');
          }, '');
          return executeWithRetry(() => pool.query(text, values).then(result => ({ rows: result.rows })));
        };
        
        sql.query = async (queryText) => {
          if (typeof queryText === 'string') {
            return executeWithRetry(() => pool.query(queryText).then(result => ({ rows: result.rows })));
          }
          throw new Error('Formato de query inválido');
        };
      } catch (pgError) {
        console.error('❌ Erro ao usar pg como fallback:', pgError.message);
        throw new Error('Não foi possível inicializar conexão com banco de dados');
      }
    }
  } else {
    // Sem variáveis de ambiente, usa sql padrão
    const vercelPostgres = require('@vercel/postgres');
    const originalSql = vercelPostgres.sql;
    
    // Wrapper com retry
    sql = function(strings, ...values) {
      return executeWithRetry(() => originalSql.apply(null, arguments));
    };
    sql.query = async (queryText) => {
      return executeWithRetry(async () => {
        if (typeof queryText === 'string') {
          // @vercel/postgres não tem método direto para strings, usa template literal
          return originalSql([queryText]);
        }
        if (queryText && queryText.raw) {
          return originalSql(queryText.strings, ...(queryText.values || []));
        }
        throw new Error('Formato de query inválido');
      });
    };
    
    dbType = 'vercel';
    console.warn('⚠️  POSTGRES_URL, POSTGRES_PRISMA_URL ou POSTGRES_PRISMA_DATABASE_URL não configuradas');
  }
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
