# 🔐 Como Criar uma Conta Stellar Permanente para Produção

## ⚠️ Importante: Chaves Temporárias vs Permanentes

As chaves geradas em **https://lab.stellar.org/** são **TEMPORÁRIAS** e expiram após algum tempo. 

**Para produção (mainnet), você DEVE usar uma conta permanente!**

## 🎯 Opções para Criar Conta Permanente

### Opção 1: Usar uma Wallet Stellar (Recomendado)

#### Wallets Recomendadas:
- **Freighter** (Recomendado) - Extensão de navegador, muito fácil de usar
  - Chrome/Edge: https://freighter.app
  - Firefox: https://freighter.app
  - Permite criar contas permanentes facilmente
  - Interface simples e segura
- **StellarX** - https://stellarx.com
- **Lobstr** - https://lobstr.co
- **Stellar Desktop Client** - https://www.stellar.org/developers/guides/get-started/create-account.html

#### Passos (usando Freighter):
1. Instale a extensão Freighter no seu navegador:
   - Chrome/Edge: https://chrome.google.com/webstore/detail/freighter/bcacfldlkkdoghmkkekeijmbdamhmbj
   - Firefox: https://addons.mozilla.org/en-US/firefox/addon/freighter/
2. Abra a extensão e crie uma nova conta
3. ⚠️ **IMPORTANTE**: Anote a **frase de recuperação** (seed phrase) - você precisará dela para recuperar a conta

4. ⚠️ **IMPORTANTE**: O Freighter **NÃO permite exportar a chave secreta diretamente** por questões de segurança.

5. Para obter a chave secreta, você precisa usar a **frase de recuperação** (seed phrase):
   - **Recomendado**: Use o script incluído no projeto:
     ```bash
     npm install bip39 ed25519-hd-key --save-dev
     node scripts/gerar-chave-stellar.js
     ```
   - Veja instruções detalhadas em: `STELLAR_OBTER_CHAVE_FREIGHTER.md`

6. A **chave pública** (Public Key) geralmente está visível na tela principal do Freighter - começa com `G`

7. ⚠️ **IMPORTANTE**: Guarde a chave secreta e a frase de recuperação em local seguro - se perder, não há como recuperar!

**Alternativa**: Se preferir uma wallet que mostre a chave secreta diretamente, use:
- **StellarX** - https://stellarx.com
- **Lobstr** - https://lobstr.co
- **Stellar Desktop Client**

#### Passos (outras wallets):
1. Baixe e instale uma wallet Stellar
2. Crie uma nova conta
3. Anote a **chave secreta** (Secret Key) - começa com `S`
4. Anote a **chave pública** (Public Key) - começa com `G`
5. ⚠️ **IMPORTANTE**: Guarde a chave secreta em local seguro - se perder, não há como recuperar!

### Opção 2: Gerar Chaves com Stellar SDK

Você pode gerar um par de chaves permanente usando o Stellar SDK:

```javascript
const StellarSdk = require('@stellar/stellar-sdk');
const pair = StellarSdk.Keypair.random();

console.log('Secret Key:', pair.secret());
console.log('Public Key:', pair.publicKey());
```

⚠️ **IMPORTANTE**: Guarde essas chaves em local seguro!

### Opção 3: Usar Exchange ou Serviço de Custódia

Para maior segurança, você pode usar:
- **Anchors** (ex: Circle, AnchorUSD)
- **Exchanges** que suportam Stellar
- **Serviços de custódia** para empresas

## 🌐 Testnet vs Mainnet

### Testnet (Para Testes)

Para testes, você pode usar o Stellar Lab temporariamente:
- **URL**: https://laboratory.stellar.org/#account-creator?network=test
- ⚠️ As chaves são temporárias, mas servem para testes
- Configure `STELLAR_NETWORK=testnet` no `.env`

### Mainnet (Para Produção)

Para produção, você **DEVE** usar uma conta permanente:
- Crie usando uma wallet ou SDK
- Configure `STELLAR_NETWORK=public` no `.env`
- ⚠️ **NUNCA** use chaves temporárias do Stellar Lab em produção!

## 📝 Configuração no Projeto

Após obter a chave secreta permanente:

1. **Configure no `.env` local** (para testes):
```env
STELLAR_SECRET_KEY=SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
STELLAR_NETWORK=testnet  # ou 'public' para produção
```

2. **Configure na Vercel** (para produção):
   - Vá em **Settings** → **Environment Variables**
   - Adicione `STELLAR_SECRET_KEY` com sua chave permanente
   - Adicione `STELLAR_NETWORK=public`
   - ⚠️ **NUNCA** commite a chave secreta no Git!

## 🔒 Segurança

### Boas Práticas:
- ✅ Use uma conta separada para receber pagamentos (não use sua conta pessoal)
- ✅ Guarde a chave secreta em local seguro (gerenciador de senhas, cofre)
- ✅ Use variáveis de ambiente, nunca hardcode no código
- ✅ Configure trustlines apenas para assets que você precisa (ex: USDC)
- ✅ Monitore a conta regularmente

### O que NÃO fazer:
- ❌ NUNCA compartilhe a chave secreta publicamente
- ❌ NUNCA commite a chave secreta no Git
- ❌ NUNCA use chaves temporárias do Stellar Lab em produção
- ❌ NUNCA use a mesma conta para desenvolvimento e produção

## 🧪 Testando a Conta

Após criar a conta, teste se está funcionando:

```bash
# Teste local
curl http://localhost:3000/api/gerar-pagamento \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "tipo_pagamento": "CRIPTO",
    "valor": 0.5,
    "currency": "XLM",
    "cid": "1"
  }'
```

## 📚 Recursos

- **Freighter Wallet**: https://freighter.app (Recomendado - extensão de navegador)
- **Stellar Docs**: https://developers.stellar.org/docs
- **Stellar Lab**: https://lab.stellar.org/ (apenas para testes!)
- **Stellar Network**: https://www.stellar.org/
- **Wallets**: https://www.stellar.org/ecosystem/wallets

## ❓ FAQ

**P: Posso usar a mesma conta para testnet e mainnet?**
R: Não, são redes separadas. Você precisa criar contas diferentes.

**P: O que acontece se eu perder a chave secreta?**
R: Você perderá acesso permanente à conta. Não há como recuperar. Guarde em local seguro!

**P: Preciso de XLM na conta para receber USDC?**
R: Sim, você precisa de XLM para pagar taxas de transação (reserve amount). Recomendado: pelo menos 1-2 XLM.

**P: Como adiciono trustline para USDC?**
R: Use uma wallet ou o Stellar SDK para adicionar trustline para o asset USDC (issuer: GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN).

