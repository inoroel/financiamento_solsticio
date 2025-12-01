#!/usr/bin/env node
// Script para executar init-db.sql na Vercel Postgres
// Uso: node scripts/executar-init-db.js
require('dotenv').config();
const { sql } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function executarInit() {
  try {
    console.log('📖 Lendo script init-db.sql...');
    const sqlScript = fs.readFileSync(
      path.join(__dirname, 'init-db.sql'),
      'utf8'
    );
    
    console.log('🚀 Executando script SQL...');
    await sql.query(sqlScript);
    
    console.log('✅ Script executado com sucesso!');
    console.log('✅ Tabelas criadas: cobrancas, doadores, transacoes');
    console.log('✅ Campos novos: provider, provider_tid, crypto_currency, crypto_address');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao executar script:', error.message);
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Tabelas já existem. Tudo OK!');
      process.exit(0);
    }
    console.error('💡 Verifique se POSTGRES_URL está configurada no .env');
    process.exit(1);
  }
}

executarInit();

