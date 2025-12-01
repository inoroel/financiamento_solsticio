# 🔑 Como Obter a Chave Secreta do Freighter

## Método 1: Interface do Freighter (Pode não estar disponível)

⚠️ **IMPORTANTE**: O Freighter **NÃO permite exportar a chave secreta diretamente** por questões de segurança.

Se você encontrar uma opção (pode variar entre versões):
1. Abra a extensão Freighter no navegador
2. Clique no ícone de **engrenagem** (⚙️) ou **Settings**
3. Procure por uma das seguintes opções:
   - **"Show Secret Key"**
   - **"Reveal Secret Key"**
   - **"Export Keys"**
   - **"Advanced"** → **"Show Secret Key"**
   - **"Account"** → **"Show Secret Key"**

4. Se encontrar, você precisará:
   - Confirmar com sua senha do Freighter
   - Copiar a chave secreta (começa com `S`)

**Se não encontrar**, use o Método 2 abaixo (recomendado).

## Método 2: Usar a Frase de Recuperação (Seed Phrase)

Se não encontrar a opção de exportar a chave secreta diretamente, você pode usar a **frase de recuperação** (seed phrase) para gerar a chave secreta:

### Passo 1: Obter a Frase de Recuperação

1. Abra o Freighter
2. Vá em **Settings** ou **Advanced**
3. Procure por **"Backup"**, **"Recovery Phrase"**, ou **"Seed Phrase"**
4. Anote as 12 ou 24 palavras (em ordem!)

### Passo 2: Gerar Chave Secreta a partir da Seed Phrase

**Opção A: Usar o script incluído no projeto (Recomendado)**

O projeto já inclui um script pronto. Primeiro, instale as dependências necessárias:

```bash
npm install bip39 ed25519-hd-key --save-dev
```

Depois execute o script:

```bash
node scripts/gerar-chave-stellar.js
```

O script pedirá sua seed phrase de forma segura e gerará a chave secreta.

**Opção B: Usar o Stellar SDK diretamente**

Use o Stellar SDK para gerar a chave secreta:

```javascript
const StellarSdk = require('@stellar/stellar-sdk');
const bip39 = require('bip39');
const { derivePath } = require('ed25519-hd-key');

// Sua seed phrase (12 ou 24 palavras)
const seedPhrase = 'palavra1 palavra2 palavra3 ... palavra12';

// Converte seed phrase para seed
const seed = await bip39.mnemonicToSeed(seedPhrase);

// Deriva a chave usando o caminho BIP44 para Stellar
// Caminho: m/44'/148'/0' (Stellar usa coin type 148)
const derived = derivePath("m/44'/148'/0'", seed.toString('hex'));

// Cria o keypair a partir da chave derivada
const keypair = StellarSdk.Keypair.fromRawEd25519Seed(derived.key);

console.log('Secret Key:', keypair.secret());
console.log('Public Key:', keypair.publicKey());
```

**Ou use um script Node.js:**

Crie um arquivo `gerar-chave.js`:

```javascript
const StellarSdk = require('@stellar/stellar-sdk');

// Cole sua seed phrase aqui
const seedPhrase = 'SUA_SEED_PHRASE_AQUI';

try {
  const keypair = StellarSdk.Keypair.fromBip39Seed(
    seedPhrase,
    "m/44'/148'/0'"
  );
  
  console.log('\n✅ Chave gerada com sucesso!\n');
  console.log('Secret Key:', keypair.secret());
  console.log('Public Key:', keypair.publicKey());
  console.log('\n⚠️  Guarde a Secret Key em local seguro!\n');
} catch (error) {
  console.error('❌ Erro:', error.message);
  console.error('\nVerifique se a seed phrase está correta.');
}
```

Execute:
```bash
node gerar-chave.js
```

## Método 3: Usar Ferramenta Online (Cuidado!)

⚠️ **ATENÇÃO**: Use apenas se confiar 100% na ferramenta. Recomendado usar localmente.

- **Stellar Laboratory**: https://laboratory.stellar.org/#txbuilder?network=test
  - Vá em "Sign Transaction"
  - Use a opção de importar via seed phrase
  - Mas **NÃO** use para gerar chaves - apenas para verificar

## Método 4: Usar Outra Wallet

Se o Freighter não mostrar a chave secreta facilmente, você pode:

1. **Exportar a conta** do Freighter (se houver opção)
2. **Importar em outra wallet** que mostre a chave secreta:
   - StellarX
   - Lobstr
   - Stellar Desktop Client

## 🔒 Segurança

⚠️ **IMPORTANTE**:
- **NUNCA** compartilhe sua seed phrase ou chave secreta
- **NUNCA** digite sua seed phrase em sites não confiáveis
- **SEMPRE** use ferramentas locais quando possível
- Guarde a chave secreta em local seguro (gerenciador de senhas, cofre)

## ❓ Problemas Comuns

**P: Não encontro a opção "Show Secret Key" no Freighter**
R: A interface pode variar. Tente usar a seed phrase com o método 2 acima.

**P: A seed phrase não funciona**
R: Verifique se copiou todas as palavras na ordem correta, sem erros de digitação.

**P: Preciso da chave secreta para configurar no backend**
R: Sim, você precisa da chave secreta (começa com `S`) para configurar `STELLAR_SECRET_KEY` na Vercel.

**P: Posso usar a chave pública em vez da secreta?**
R: Não. A chave pública (começa com `G`) é apenas para receber pagamentos. A chave secreta é necessária para o backend verificar transações.

## 📚 Recursos

- **Freighter Docs**: https://freighter.app/docs
- **Stellar SDK Docs**: https://developers.stellar.org/docs
- **BIP39 Standard**: https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki

