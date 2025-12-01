// Configuração do banco de dados PostgreSQL
// Suporta tanto @vercel/postgres (Vercel) quanto pg (PostgreSQL local)
require('dotenv').config();

let sql;
let dbType = 'vercel'; // 'vercel' ou 'local'
let pool = null;

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
  // @vercel/postgres.sql precisa de POSTGRES_PRISMA_URL (com pooling)
  // Se não tiver, usa pg com POSTGRES_URL direta
  if (process.env.POSTGRES_PRISMA_URL) {
    // POSTGRES_PRISMA_URL tem pooling (pgbouncer=true) - funciona com @vercel/postgres
    // Temporariamente define POSTGRES_URL para POSTGRES_PRISMA_URL para @vercel/postgres usar
    const originalPostgresUrl = process.env.POSTGRES_URL;
    process.env.POSTGRES_URL = process.env.POSTGRES_PRISMA_URL;
    const vercelPostgres = require('@vercel/postgres');
    sql = vercelPostgres.sql;
    // Restaura POSTGRES_URL original se existia
    if (originalPostgresUrl) {
      process.env.POSTGRES_URL = originalPostgresUrl;
    } else {
      delete process.env.POSTGRES_URL;
    }
    dbType = 'vercel';
    if (process.env.NODE_ENV !== 'production') {
      console.log('📦 Usando Vercel Postgres com POSTGRES_PRISMA_URL (pooled)');
    }
  } else if (process.env.POSTGRES_URL) {
    // Se não tem POSTGRES_PRISMA_URL, usa pg com POSTGRES_URL direta
    // Isso funciona porque pg aceita URLs diretas
    try {
      const { Pool } = require('pg');
      pool = new Pool({
        connectionString: process.env.POSTGRES_URL,
        ssl: { rejectUnauthorized: false } // Vercel Postgres requer SSL
      });
      
      dbType = 'vercel';
      console.log('📦 Usando pg com POSTGRES_URL (fallback - POSTGRES_PRISMA_URL não configurada)');
      
      // Cria wrapper compatível com @vercel/postgres
      sql = function(strings, ...values) {
        if (arguments.length === 1 && typeof arguments[0] === 'string') {
          return pool.query(strings).then(result => ({ rows: result.rows }));
        }
        const text = strings.reduce((acc, str, i) => {
          return acc + str + (i < values.length ? `$${i + 1}` : '');
        }, '');
        return pool.query(text, values).then(result => ({ rows: result.rows }));
      };
      
      sql.query = async (queryText) => {
        if (typeof queryText === 'string') {
          const result = await pool.query(queryText);
          return { rows: result.rows };
        }
        throw new Error('Formato de query inválido');
      };
    } catch (error) {
      console.warn('⚠️  Erro ao usar pg, tentando @vercel/postgres:', error.message);
      // Fallback para @vercel/postgres (pode falhar, mas tenta)
      const vercelPostgres = require('@vercel/postgres');
      sql = vercelPostgres.sql;
      dbType = 'vercel';
    }
  } else {
    // Sem variáveis de ambiente, usa sql padrão
    const vercelPostgres = require('@vercel/postgres');
    sql = vercelPostgres.sql;
    dbType = 'vercel';
    console.warn('⚠️  POSTGRES_URL e POSTGRES_PRISMA_URL não configuradas');
  }
}

/**
 * Testa a conexão com o banco de dados
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

    const result = await sql`SELECT NOW() as current_time`;
    const currentTime = result.rows[0]?.current_time;
    console.log('✅ Conexão com banco de dados estabelecida:', currentTime);
    return { success: true, data: { currentTime } };
  } catch (error) {
    const errorMessage = error.message || String(error);
    console.error('❌ Erro ao conectar com banco de dados:', errorMessage);
    if (dbType === 'local') {
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
      hasPostgresPrismaUrl: !!process.env.POSTGRES_PRISMA_URL,
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
