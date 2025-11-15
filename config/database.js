// Configuração do banco de dados PostgreSQL
// Suporta tanto @vercel/postgres (Vercel) quanto pg (PostgreSQL local)
require('dotenv').config();

let sql;
let dbType = 'vercel'; // 'vercel' ou 'local'
let pool = null;

// Detecta qual driver usar baseado nas variáveis de ambiente
// Na Vercel, sempre usa @vercel/postgres
// Localmente, usa pg se POSTGRES_URL não contém 'vercel'
const isVercel = process.env.VERCEL === '1' || process.env.POSTGRES_URL?.includes('vercel');
const useLocalPg = !isVercel && process.env.POSTGRES_URL && !process.env.POSTGRES_URL.includes('vercel');

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
  const vercelPostgres = require('@vercel/postgres');
  sql = vercelPostgres.sql;
  dbType = 'vercel';
  if (process.env.NODE_ENV !== 'production') {
    console.log('📦 Usando Vercel Postgres (configure POSTGRES_URL para usar PostgreSQL local)');
  }
}

/**
 * Testa a conexão com o banco de dados
 */
async function testConnection() {
  try {
    const result = await sql`SELECT NOW() as current_time`;
    console.log('✅ Conexão com banco de dados estabelecida:', result.rows[0].current_time);
    return true;
  } catch (error) {
    console.error('❌ Erro ao conectar com banco de dados:', error.message);
    if (dbType === 'local') {
      console.error('💡 Verifique se o PostgreSQL está rodando e se as credenciais no .env estão corretas');
      console.error('💡 Teste a conexão: psql -d financiamento_solsticio');
    }
    return false;
  }
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
  dbType
};
