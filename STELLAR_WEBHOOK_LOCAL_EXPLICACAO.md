# 🔄 Como Funciona o "Webhook Local" Stellar

## 📋 Conceito Importante

**Stellar NÃO tem webhooks nativos!** Por isso, usamos uma solução híbrida onde:
- O **frontend** monitora a rede Stellar em tempo real
- Quando detecta pagamento, **notifica o backend**
- O **backend valida** consultando a Stellar diretamente

---

## 🎯 Fluxo Completo (3 Cenários)

### Cenário 1: Detecção Automática (Frontend Monitora) ⚡

**Quando:** Usuário mantém a página aberta após fazer pagamento

```
┌─────────────┐
│   Usuário   │
│  (Navegador)│
└──────┬──────┘
       │
       │ 1. Solicita pagamento
       ▼
┌─────────────────┐
│  POST /api/     │
│  gerar-pagamento│
└──────┬──────────┘
       │
       │ 2. Retorna: txid, recipient_address, memo
       ▼
┌─────────────┐
│   Frontend   │
│  (Svelte)    │
└──────┬──────┘
       │
       │ 3. Inicia monitoramento SSE da conta Stellar
       │    (escuta pagamentos em tempo real)
       ▼
┌─────────────────┐
│  Rede Stellar   │
│  (Blockchain)   │
└──────┬──────────┘
       │
       │ 4. Usuário envia USDC/XLM com memo
       │    (via carteira Stellar)
       ▼
┌─────────────┐
│   Frontend   │
│  Detecta!   │
│  (3-5 seg)  │
└──────┬──────┘
       │
       │ 5. POST /api/confirm-donation
       │    { hash: "abc123...", txid: "..." }
       ▼
┌─────────────────┐
│    Backend      │
│  (Vercel API)   │
└──────┬──────────┘
       │
       │ 6. Valida na Stellar (consulta Horizon)
       │ 7. Processa confirmação
       │ 8. Salva no banco
       ▼
┌─────────────┐
│   Banco DB  │
│  (Postgres) │
└─────────────┘
```

**Vantagens:**
- ⚡ Instantâneo (3-5 segundos)
- 💰 Gratuito (não precisa de serviços externos)
- 🎯 Preciso (valida sempre na Stellar)

---

### Cenário 2: Verificação Manual (Usuário Fecha Página) 🔄

**Quando:** Usuário fecha a página antes da confirmação

```
┌─────────────┐
│   Usuário   │
│  (Navegador)│
└──────┬──────┘
       │
       │ 1. Solicita pagamento
       ▼
┌─────────────────┐
│  POST /api/     │
│  gerar-pagamento│
└──────┬──────────┘
       │
       │ 2. Retorna: txid, memo
       ▼
┌─────────────┐
│   Frontend   │
│  Salva memo  │
│  no localStorage
└──────┬──────┘
       │
       │ 3. Usuário fecha página
       │    (memo fica salvo no localStorage)
       │
       │ 4. Usuário faz pagamento na carteira Stellar
       │
       │ 5. Usuário volta ao site depois
       ▼
┌─────────────┐
│   Frontend   │
│  Verifica    │
│  localStorage│
└──────┬──────┘
       │
       │ 6. Mostra botão "Já paguei, verificar agora"
       │
       │ 7. POST /api/check-payment-by-memo
       │    { memo: "solsticiocampanha1234567890" }
       ▼
┌─────────────────┐
│    Backend      │
│  (Vercel API)   │
└──────┬──────────┘
       │
       │ 8. Busca nas últimas transações da conta Stellar
       │    (findPaymentByMemo)
       │
       │ 9. Se encontrar pagamento com esse memo:
       │    - Processa confirmação
       │    - Salva no banco
       ▼
┌─────────────┐
│   Banco DB  │
│  (Postgres) │
└─────────────┘
```

**Vantagens:**
- 🔄 Funciona mesmo se usuário fechar página
- 💾 Usa localStorage (persiste)
- 🎯 Backend busca ativamente na Stellar

---

### Cenário 3: Webhook Externo (Opcional) 📡

**Quando:** Se quiser usar um serviço externo (não recomendado, mas possível)

```
┌─────────────────┐
│  Serviço Externo │
│  (Make.com, etc) │
└──────┬───────────┘
       │
       │ Monitora conta Stellar
       │ Detecta pagamento
       │
       │ POST /api/webhook/stellar
       │ { hash, memo, currency, valor, ... }
       ▼
┌─────────────────┐
│    Backend      │
│  (Vercel API)   │
└──────┬──────────┘
       │
       │ Valida e processa
       ▼
┌─────────────┐
│   Banco DB  │
└─────────────┘
```

**Nota:** Este cenário não é necessário! Os cenários 1 e 2 já cobrem todos os casos.

---

## 🔍 Detalhamento Técnico

### 1. Endpoint `/api/confirm-donation` (Detecção Automática)

**O que faz:**
1. Recebe o `hash` da transação do frontend
2. **Valida consultando a Stellar** (não confia apenas no frontend!)
3. Verifica se a transação existe e foi bem-sucedida
4. Processa a confirmação (mesma lógica do webhook)

**Código:**
```javascript
POST /api/confirm-donation
{
  "hash": "a1b2c3d4e5f6...",  // Hash da transação Stellar
  "txid": "solsticiocampanha1234567890"  // Opcional, para validação extra
}
```

**Fluxo interno:**
```javascript
// 1. Valida hash
if (!hash || hash.length !== 64) {
  return error;
}

// 2. Consulta Stellar (validação real!)
const transaction = await consultStellarTransaction(hash);

// 3. Verifica se foi bem-sucedida
if (!transaction.successful) {
  return error;
}

// 4. Processa confirmação
await processWebhook(transactionData);
```

---

### 2. Endpoint `/api/check-payment-by-memo` (Verificação Manual)

**O que faz:**
1. Recebe o `memo` (txid) da cobrança
2. **Busca nas últimas transações** da conta Stellar
3. Filtra por memo específico
4. Se encontrar, processa a confirmação

**Código:**
```javascript
POST /api/check-payment-by-memo
{
  "memo": "solsticiocampanha1234567890"
}
```

**Fluxo interno:**
```javascript
// 1. Busca pagamentos recebidos recentemente
const payments = await server
  .payments()
  .forAccount(publicKey)  // Sua conta Stellar
  .limit(100)  // Últimas 100 transações
  .order('desc')
  .call();

// 2. Itera e verifica memo
for (const payment of payments.records) {
  const transaction = await server
    .transactions()
    .transaction(payment.transaction_hash)
    .call();
  
  const memo = transaction.memo?.toString();
  
  // 3. Se memo corresponde, encontrou!
  if (memo === memoBuscado) {
    // Processa confirmação
    await processWebhook(paymentData);
  }
}
```

---

## 🔐 Segurança: Por Que É Seguro?

### ❓ "Mas o frontend pode mentir!"

**Resposta:** Não pode! O backend **sempre valida** na Stellar:

1. **Frontend detecta** → Envia hash
2. **Backend consulta Stellar** → Verifica se hash existe
3. **Backend valida** → Verifica se foi bem-sucedida
4. **Backend processa** → Só então salva no banco

**Se o frontend enviar um hash falso:**
- Backend consulta Stellar
- Stellar retorna "não encontrado"
- Backend rejeita
- ❌ Não salva no banco

**Se o frontend enviar hash de outra pessoa:**
- Backend consulta Stellar
- Verifica se o pagamento foi para sua conta
- Se não foi, rejeita
- ❌ Não salva no banco

---

## 📊 Comparação: Webhook Tradicional vs "Local"

| Aspecto | Webhook Tradicional | Solução "Local" |
|---------|---------------------|-----------------|
| **Quem detecta** | Serviço externo | Frontend do usuário |
| **Velocidade** | 5-30 segundos | 3-5 segundos ⚡ |
| **Custo** | Pode ser pago | 100% gratuito 💰 |
| **Confiabilidade** | Depende do serviço | Depende do usuário manter página |
| **Fallback** | Não tem | Verificação manual ✅ |
| **Validação** | Serviço externo | Backend valida sempre ✅ |

---

## 🎯 Resumo Visual

```
┌─────────────────────────────────────────────────────────┐
│                    FLUXO COMPLETO                        │
└─────────────────────────────────────────────────────────┘

1. Criação da Cobrança
   POST /api/gerar-pagamento
   ↓
   Retorna: txid, recipient_address, memo

2. Frontend Monitora (SSE)
   ┌─────────────────┐
   │  Frontend abre  │
   │  stream Stellar │
   │  (escuta pagamentos)│
   └─────────────────┘
   ↓
   Usuário paga na carteira Stellar
   ↓
   Frontend detecta (3-5 seg)
   ↓
   POST /api/confirm-donation { hash }
   ↓
   Backend valida na Stellar ✅
   ↓
   Backend processa e salva ✅

3. Se Usuário Fechar Página
   ┌─────────────────┐
   │  Memo salvo no  │
   │  localStorage   │
   └─────────────────┘
   ↓
   Usuário volta depois
   ↓
   Botão "Já paguei, verificar"
   ↓
   POST /api/check-payment-by-memo { memo }
   ↓
   Backend busca na Stellar ✅
   ↓
   Se encontrar, processa ✅
```

---

## ✅ Por Que É Seguro?

1. **Backend sempre valida**: Nunca confia apenas no frontend
2. **Consulta direta na Stellar**: Verifica na fonte
3. **Idempotência**: Não processa duplicado (verifica hash)
4. **Validação de conta**: Verifica se pagamento foi para sua conta
5. **Validação de sucesso**: Verifica se transação foi bem-sucedida

---

## 🚀 Implementação no Frontend

### Exemplo Mínimo

```javascript
// 1. Após criar cobrança, salva memo
localStorage.setItem('pending_payment', JSON.stringify({
  txid: data.txid,
  memo: data.memo
}));

// 2. Monitora Stellar (SSE)
const stream = server
  .payments()
  .forAccount(recipientAddress)
  .stream({
    onmessage: async (payment) => {
      if (payment.memo === txid) {
        // Envia para backend confirmar
        await fetch('/api/confirm-donation', {
          method: 'POST',
          body: JSON.stringify({ hash: payment.transaction_hash })
        });
      }
    }
  });

// 3. Se usuário voltar, verifica manualmente
const pending = localStorage.getItem('pending_payment');
if (pending) {
  // Mostra botão "Já paguei"
  // Ao clicar:
  await fetch('/api/check-payment-by-memo', {
    method: 'POST',
    body: JSON.stringify({ memo: pending.memo })
  });
}
```

---

## 📝 Resumo Final

**"Webhook Local" = Frontend Detecta + Backend Valida**

- ✅ Frontend monitora Stellar em tempo real
- ✅ Backend sempre valida consultando Stellar
- ✅ Fallback manual se usuário fechar página
- ✅ 100% gratuito, sem serviços externos
- ✅ Seguro (backend nunca confia só no frontend)

**Não é um webhook tradicional!** É uma solução inteligente que usa o frontend como "vigia" e o backend como "validador".

