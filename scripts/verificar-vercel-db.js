#!/usr/bin/env node
// Script para verificar se está conectado ao banco da Vercel
// Uso: node scripts/verificar-vercel-db.js
require('dotenv').config();
const { sql, dbType } = require('../config/database');

async function verificar() {
  try {
    console.log(`🔍 Tipo de conexão: ${dbType === 'vercel' ? '✅ Vercel Postgres' : '⚠️  PostgreSQL Local'}\n`);
    
    if (dbType !== 'vercel') {
      console.log('⚠️  ATENÇÃO: Você está conectado ao banco LOCAL, não ao da Vercel!');
      console.log('💡 Para verificar o banco da Vercel:');
      console.log('   1. Certifique-se de que POSTGRES_URL no .env aponta para a Vercel');
      console.log('   2. A URL deve conter "vercel" ou "vercel-storage"');
      console.log('   3. Ou defina VERCEL=1 no .env\n');
    }
    
    console.log('🔍 Verificando tabelas...\n');
    
    // Listar tabelas
    const tabelas = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    console.log('📋 Tabelas encontradas:');
    if (tabelas.rows.length === 0) {
      console.log('  ❌ Nenhuma tabela encontrada!');
      console.log('  💡 Execute: npm run init-db');
      process.exit(1);
    }
    
    tabelas.rows.forEach(row => {
      console.log(`  ✅ ${row.table_name}`);
    });
    
    // Verificar campos novos em cobrancas
    const camposCobrancas = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'cobrancas' 
        AND column_name IN ('provider', 'provider_tid', 'crypto_currency', 'crypto_address')
      ORDER BY column_name
    `;
    
    console.log('\n📋 Campos novos em cobrancas:');
    if (camposCobrancas.rows.length === 0) {
      console.log('  ❌ Campos novos não encontrados!');
      console.log('  💡 Execute: npm run init-db');
    } else {
      camposCobrancas.rows.forEach(row => {
        console.log(`  ✅ ${row.column_name} (${row.data_type})`);
      });
    }
    
    // Verificar constraints
    const constraints = await sql`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'cobrancas'
        AND constraint_type = 'CHECK'
    `;
    
    console.log('\n📋 Constraints em cobrancas:');
    const constraintNames = constraints.rows.map(r => r.constraint_name);
    if (constraintNames.includes('check_tipo_pagamento')) {
      console.log('  ✅ check_tipo_pagamento (inclui CRIPTO)');
    } else {
      console.log('  ❌ check_tipo_pagamento não encontrada');
    }
    if (constraintNames.includes('check_provider')) {
      console.log('  ✅ check_provider (valida REDE, STELLAR)');
    } else {
      console.log('  ❌ check_provider não encontrada');
    }
    
    // Verificar se está na Vercel
    if (dbType === 'vercel') {
      console.log('\n✅ Você está conectado ao banco da VERCEL!');
      console.log('✅ Tudo está configurado corretamente.');
    } else {
      console.log('\n⚠️  Você está conectado ao banco LOCAL.');
      console.log('💡 Para verificar o banco da Vercel:');
      console.log('   - Certifique-se de que POSTGRES_URL no .env aponta para a Vercel');
      console.log('   - A URL deve conter "vercel" ou "vercel-storage"');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao verificar:', error.message);
    console.error('💡 Verifique se POSTGRES_URL está configurada no .env');
    process.exit(1);
  }
}

verificar();

