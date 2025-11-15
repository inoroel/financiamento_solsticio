#!/usr/bin/env node
// Script para testar conexão com banco de dados
require('dotenv').config();
const { testConnection, initializeDatabase } = require('../config/database');

async function test() {
  console.log('🔌 Testando conexão com banco de dados...\n');
  
  const connected = await testConnection();
  
  if (connected) {
    console.log('\n📦 Inicializando banco de dados...\n');
    await initializeDatabase();
    console.log('\n✅ Tudo pronto! O banco de dados está configurado corretamente.');
  } else {
    console.log('\n❌ Falha na conexão. Verifique:');
    console.log('   1. PostgreSQL está rodando?');
    console.log('   2. POSTGRES_URL no .env está correto?');
    console.log('   3. Banco de dados existe? (CREATE DATABASE financiamento_solsticio)');
    process.exit(1);
  }
}

test().catch(error => {
  console.error('❌ Erro:', error.message);
  process.exit(1);
});

