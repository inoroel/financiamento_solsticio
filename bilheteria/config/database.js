// Configuração do banco de dados PostgreSQL para Bilheteria
require('dotenv').config();

let sql;
let dbType = 'vercel';
let pool = null;

function maskUrl(url = '') {
    try {
        const parsed = new URL(url);
        return `${parsed.protocol}//****:****@${parsed.hostname}${parsed.port ? ':' + parsed.port : ''}${parsed.pathname}`;
    } catch (e) {
        return 'url inválida';
    }
}

async function executeWithRetry(queryFn, maxRetries = 3) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await queryFn();
        } catch (error) {
            lastError = error;
            const errorMessage = error.message || String(error);
            const isConnectionError = errorMessage.includes('Connection terminated') ||
                errorMessage.includes('ECONNRESET') ||
                errorMessage.includes('ETIMEDOUT');

            if (isConnectionError && attempt < maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                console.warn(`⚠️  Erro de conexão (tentativa ${attempt}/${maxRetries}), tentando em ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}

// Detecta ambiente
const postgresUrl = process.env.POSTGRES_URL || '';
const isVercel = process.env.VERCEL === '1' || postgresUrl.includes('neon.tech');
const useLocalPg = !isVercel && postgresUrl && !postgresUrl.includes('neon.tech');

if (useLocalPg) {
    try {
        const { Pool } = require('pg');
        pool = new Pool({
            connectionString: process.env.POSTGRES_URL,
            ssl: false
        });
        dbType = 'local';
        console.log('📦 Usando PostgreSQL local');

        sql = function (strings, ...values) {
            if (arguments.length === 1 && typeof arguments[0] === 'string') {
                return pool.query(arguments[0]).then(result => ({ rows: result.rows }));
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
        console.warn('⚠️  Erro ao carregar pg:', error.message);
        const vercelPostgres = require('@vercel/postgres');
        sql = vercelPostgres.sql;
        dbType = 'vercel';
    }
} else {
    try {
        const { Pool } = require('pg');
        pool = new Pool({
            connectionString: process.env.POSTGRES_URL,
            ssl: { rejectUnauthorized: false },
            max: 1,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        });
        dbType = 'vercel';
        console.log('📦 Usando PostgreSQL Vercel/Neon');

        sql = function (strings, ...values) {
            return executeWithRetry(async () => {
                if (arguments.length === 1 && typeof arguments[0] === 'string') {
                    const result = await pool.query(arguments[0]);
                    return { rows: result.rows };
                }
                const text = strings.reduce((acc, str, i) => {
                    return acc + str + (i < values.length ? `$${i + 1}` : '');
                }, '');
                const result = await pool.query(text, values);
                return { rows: result.rows };
            });
        };

        sql.query = async (queryText) => {
            return executeWithRetry(async () => {
                if (typeof queryText === 'string') {
                    const result = await pool.query(queryText);
                    return { rows: result.rows };
                }
                throw new Error('Formato de query inválido');
            });
        };
    } catch (error) {
        console.error('❌ Erro ao configurar Pool:', error.message);
        throw error;
    }
}

async function testConnection() {
    try {
        if (!sql) {
            return { success: false, error: 'sql não definido' };
        }
        const result = await executeWithRetry(async () => {
            return await sql`SELECT NOW() as current_time`;
        }, 3);
        console.log('✅ Conexão com banco estabelecida:', result.rows[0]?.current_time);
        return { success: true, data: { currentTime: result.rows[0]?.current_time } };
    } catch (error) {
        console.error('❌ Erro de conexão:', error.message);
        return { success: false, error: error.message };
    }
}

async function initializeDatabase() {
    try {
        const fs = require('fs');
        const path = require('path');
        const sqlScript = fs.readFileSync(
            path.join(__dirname, '../scripts/init-db.sql'),
            'utf8'
        );

        if (dbType === 'local') {
            const lines = sqlScript.split('\n');
            let currentCommand = '';
            const commands = [];

            for (const line of lines) {
                const cleanLine = line.split('--')[0].trim();
                if (cleanLine) {
                    currentCommand += cleanLine + ' ';
                    if (cleanLine.endsWith(';')) {
                        commands.push(currentCommand.trim());
                        currentCommand = '';
                    }
                }
            }
            if (currentCommand.trim()) {
                commands.push(currentCommand.trim());
            }

            for (const command of commands) {
                if (command && !command.match(/^\s*$/)) {
                    try {
                        await pool.query(command);
                    } catch (error) {
                        if (!error.message.includes('already exists') && !error.message.includes('duplicate')) {
                            throw error;
                        }
                    }
                }
            }
        } else {
            await sql.query(sqlScript);
        }

        console.log('✅ Banco de dados inicializado');
        return true;
    } catch (error) {
        if (error.message.includes('already exists')) {
            console.log('ℹ️  Tabelas já existem');
            return true;
        }
        console.error('❌ Erro ao inicializar banco:', error.message);
        return false;
    }
}

module.exports = {
    sql,
    testConnection,
    initializeDatabase,
    dbType
};
