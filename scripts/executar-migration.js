#!/usr/bin/env node
// Script para executar uma migration SQL específica
// Uso: node scripts/executar-migration.js nome-do-arquivo.sql
require('dotenv').config();
const { sql } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function executarMigration() {
  try {
    // Pega o nome do arquivo de migration como argumento
    const migrationFile = process.argv[2];
    
    if (!migrationFile) {
      console.error('❌ Erro: Especifique o arquivo de migration');
      console.log('💡 Uso: node scripts/executar-migration.js nome-do-arquivo.sql');
      process.exit(1);
    }
    
    const migrationPath = path.join(__dirname, migrationFile);
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Erro: Arquivo não encontrado: ${migrationPath}`);
      process.exit(1);
    }
    
    console.log(`📖 Lendo migration: ${migrationFile}...`);
    const sqlScript = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🚀 Executando migration...');
    await sql.query(sqlScript);
    
    console.log('✅ Migration executada com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao executar migration:', error.message);
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Alguns objetos já existem. Tudo OK!');
      process.exit(0);
    }
    process.exit(1);
  }
}

executarMigration();

