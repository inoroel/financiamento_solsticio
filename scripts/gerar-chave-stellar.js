#!/usr/bin/env node

/**
 * Script para gerar chave secreta Stellar a partir da seed phrase (BIP39)
 * 
 * Uso:
 *   node scripts/gerar-chave-stellar.js
 * 
 * O script pedirá a seed phrase de forma segura (sem mostrar na tela)
 * 
 * Dependências:
 *   npm install bip39 ed25519-hd-key
 */

const StellarSdk = require('@stellar/stellar-sdk');
const bip39 = require('bip39');
const { derivePath } = require('ed25519-hd-key');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('\n🔐 Gerador de Chave Secreta Stellar a partir de Seed Phrase\n');
  console.log('⚠️  Este script gera a chave secreta a partir da seed phrase do Freighter');
  console.log('⚠️  Mantenha a chave secreta segura!\n');

  try {
    // Pede a seed phrase
    const seedPhrase = await question('Digite sua seed phrase (12 ou 24 palavras): ');
    
    if (!seedPhrase || seedPhrase.trim().split(' ').length < 12) {
      console.error('\n❌ Seed phrase inválida. Deve ter pelo menos 12 palavras.\n');
      process.exit(1);
    }

    // Gera o keypair
    console.log('\n⏳ Gerando chave secreta...\n');
    
    // Valida a seed phrase
    if (!bip39.validateMnemonic(seedPhrase.trim())) {
      throw new Error('Seed phrase inválida. Verifique se todas as palavras estão corretas.');
    }

    // Converte seed phrase para seed (entropy)
    const seed = await bip39.mnemonicToSeed(seedPhrase.trim());
    
    // Deriva a chave usando o caminho BIP44 para Stellar
    // Caminho: m/44'/148'/0' (Stellar usa coin type 148)
    const derived = derivePath("m/44'/148'/0'", seed.toString('hex'));
    
    // A chave derivada já vem como Buffer de 32 bytes (formato correto para Ed25519)
    // Cria o keypair a partir da chave derivada
    const keypair = StellarSdk.Keypair.fromRawEd25519Seed(derived.key);

    // Mostra os resultados
    console.log('✅ Chave gerada com sucesso!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Public Key (chave pública - começa com G):');
    console.log(keypair.publicKey());
    console.log('\n🔑 Secret Key (chave secreta - começa com S):');
    console.log(keypair.secret());
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('⚠️  IMPORTANTE:');
    console.log('   1. Copie a Secret Key acima');
    console.log('   2. Configure na Vercel como STELLAR_SECRET_KEY');
    console.log('   3. NUNCA compartilhe ou commite esta chave no Git!');
    console.log('   4. Guarde em local seguro (gerenciador de senhas, cofre)\n');

  } catch (error) {
    console.error('\n❌ Erro ao gerar chave:', error.message);
    console.error('\nVerifique se:');
    console.error('   - A seed phrase está correta (todas as palavras na ordem)');
    console.error('   - Não há erros de digitação');
    console.error('   - A seed phrase tem 12 ou 24 palavras\n');
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();

