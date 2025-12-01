#!/usr/bin/env node
// Script de diagnóstico para verificar configuração do banco
require('dotenv').config();

console.log('🔍 DIAGNÓSTICO DE CONFIGURAÇÃO DO BANCO\n');

// Verifica POSTGRES_URL
const postgresUrl = process.env.POSTGRES_URL;
if (!postgresUrl) {
  console.log('❌ POSTGRES_URL não está definida no .env');
  process.exit(1);
}

console.log('📋 POSTGRES_URL encontrada:');
console.log(`   ${postgresUrl.substring(0, 50)}...`);

// Verifica se contém "vercel"
const contemVercel = postgresUrl.includes('vercel') || postgresUrl.includes('vercel-storage');
console.log(`\n🔍 Contém "vercel" ou "vercel-storage": ${contemVercel ? '✅ SIM' : '❌ NÃO'}`);

// Verifica VERCEL env var
const vercelEnv = process.env.VERCEL;
console.log(`🔍 VERCEL env var: ${vercelEnv || 'não definida'}`);

// Lógica de detecção
const isVercel = vercelEnv === '1' || contemVercel;
const useLocalPg = !isVercel && postgresUrl && !contemVercel;

console.log(`\n📊 Resultado da detecção:`);
console.log(`   isVercel: ${isVercel}`);
console.log(`   useLocalPg: ${useLocalPg}`);
console.log(`   Tipo detectado: ${useLocalPg ? '⚠️  PostgreSQL Local' : '✅ Vercel Postgres'}`);

if (useLocalPg) {
  console.log('\n💡 SOLUÇÃO:');
  console.log('   Adicione no .env:');
  console.log('   VERCEL=1');
  console.log('\n   Ou certifique-se de que a URL contém "vercel" ou "vercel-storage"');
}

process.exit(0);

