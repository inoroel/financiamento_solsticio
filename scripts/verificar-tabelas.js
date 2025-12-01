#!/usr/bin/env node
// Script para verificar se as tabelas foram criadas corretamente
// Uso: node scripts/verificar-tabelas.js
require('dotenv').config();
const { sql } = require('../config/database');

async function verificar() {
  try {
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
      console.log('  💡 Execute: node scripts/executar-init-db.js');
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
      console.log('  💡 Execute: node scripts/executar-init-db.js');
    } else {
      camposCobrancas.rows.forEach(row => {
        console.log(`  ✅ ${row.column_name} (${row.data_type})`);
      });
    }
    
    // Verificar constraints
    const constraints = await sql`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'cobrancas'
        AND constraint_type = 'CHECK'
    `;
    
    console.log('\n📋 Constraints em cobrancas:');
    constraints.rows.forEach(row => {
      console.log(`  ✅ ${row.constraint_name}`);
    });
    
    console.log('\n✅ Verificação concluída!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao verificar:', error.message);
    console.error('💡 Verifique se POSTGRES_URL está configurada no .env');
    process.exit(1);
  }
}

verificar();

