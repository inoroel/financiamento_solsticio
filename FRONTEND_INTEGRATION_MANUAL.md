# 🧩 Manual de Integração Frontend ↔ Backend

## 1. Visão Geral da Arquitetura

- **Backend** (este repositório):
  - `POST /api/gerar-pagamento` → cria cobranças (PIX, crédito, débito, cripto)
  - `GET /api/cobranca/:tid` e `GET /api/cobranca/txid/:txid` → consulta cobranças
  - `POST /api/webhook/pagamento` → webhook e-Rede (PIX/cartão)
  - `POST /api/confirm-donation` → confirmação Stellar (hash detectado no frontend)
  - `POST /api/check-payment-by-memo` → verificação por memo (quando usuário fecha página)
  - `POST /api/webhook/stellar` → opcional (se algum serviço externo de monitoramento for usado)
  - `POST /api/validar-cartao` → validação Zero Dollar de cartão
  - `POST /api/cancelar-cobranca` → cancelamento/estorno

- **Frontend** (Svelte/React/etc):
  - Consome os endpoints acima.
  - Gera UI para PIX, Cartão e Cripto.
  - Para Stellar:
    - Monitora a conta via stream (SSE/WebSocket) enquanto a página está aberta.
    - Salva o `memo/txid` no `localStorage` para fallback.
    - Oferece botão “Já paguei, verificar agora”.

---

## 2. Configuração Base do Frontend

Defina as URLs do backend (exemplo em SvelteKit/Vite):

```ts
// src/lib/config.ts
export const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3000';
```

No `.env` do frontend:

```bash
VITE_API_URL=https://financiamentosolsticio.vercel.app
VITE_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
VITE_STELLAR_RECIPIENT_ADDRESS=GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

## 3. Fluxo PIX (e-Rede)

### 3.1 Criar cobrança PIX

**Request:**

```http
POST /api/gerar-pagamento
Content-Type: application/json
```

```json
{
  "tipo_pagamento": "PIX",
  "valor": 10.50,
  "cid": "campanha-01",
  "doador": {
    "anonimo": true
  }
}
```

**Response (exemplo):**

```json
{
  "success": true,
  "txid": "solsticiocampanha01XXXXXXX",
  "tipo_pagamento": "PIX",
  "valor": 10.5,
  "status": "AGUARDANDO",
  "brCode": "00020126...",
  "expiracao": 3600
}
```

### 3.2 Integração no frontend

- Mostrar QR Code a partir de `brCode`.
- Opcional: botão “Copiar código PIX”.
- Exibir contagem regressiva com base em `expiracao`.

Exemplo (Svelte pseudo‑código):

```svelte
<script lang="ts">
  import { API_URL } from '$lib/config';

  let valor = 10.5;
  let cid = 'campanha-01';
  let pixData: any = null;

  async function criarPix() {
    const res = await fetch(`${API_URL}/api/gerar-pagamento`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo_pagamento: 'PIX',
        valor,
        cid,
        doador: { anonimo: true }
      })
    });
    pixData = await res.json();
  }
</script>

{#if !pixData}
  <button on:click={criarPix}>Gerar PIX</button>
{:else}
  <p>TXID: {pixData.txid}</p>
  <p>Status: {pixData.status}</p>
  <p>Código PIX:</p>
  <textarea readonly>{pixData.brCode}</textarea>
{/if}
```

O status final será confirmado via webhook da e-Rede → backend → banco.
O frontend pode consultar periodicamente o endpoint de consulta por `txid`:

```http
GET /api/cobranca/txid/{txid}
```

---

## 4. Fluxo Cartão (Crédito/Débito e-Rede)

### 4.1 Premissa

O backend espera um **`token` de cartão** já tokenizado. A tokenização (captura de número, validade, CVV) deve ser feita:
- Em um fluxo seguro no frontend (ex.: iframe/tokenização oferecida pela e-Rede).
- Ou via SDK de cartão, **nunca** enviando dados “crus” para o backend.

### 4.2 Criar cobrança de crédito

**Request:**

```http
POST /api/gerar-pagamento
Content-Type: application/json
```

```json
{
  "tipo_pagamento": "CREDITO",
  "valor": 100.0,
  "cid": "campanha-02",
  "doador": {
    "anonimo": false,
    "nome": "Nome do Doador",
    "whatsapp": "5511999999999"
  },
  "cartao": {
    "token": "TOKEN_DO_CARTAO",
    "bandeira": "visa"
  },
  "parcelas": 1
}
```

**Regras importantes:**
- Se `anonimo === false`: **nome e whatsapp são obrigatórios** e validados.
- `parcelas` entre 1 e 12.
- O backend executa **Zero Dollar Authorization** antes da transação real.

**Response (exemplo):**

```json
{
  "success": true,
  "txid": "solsticiocampanha02XXXXXXX",
  "tipo_pagamento": "CREDITO",
  "status": "CONFIRMADA",
  "valor": 100,
  "autorizacao": {
    "codigo": "123456",
    "status": "AUTORIZADA",
    "bandeira": "visa"
  },
  "parcelas": 1
}
```

### 4.3 Débito

Similar ao crédito, com `tipo_pagamento: "DEBITO"` e sem `parcelas`.

---

## 5. Fluxo Stellar – Página Aberta (Detecção Automática)

### 5.1 Criar cobrança cripto

**Request:**

```http
POST /api/gerar-pagamento
Content-Type: application/json
```

```json
{
  "tipo_pagamento": "CRIPTO",
  "valor": 5.0,
  "currency": "USDC",
  "cid": "campanha-03",
  "doador": {
    "anonimo": false,
    "nome": "Doador Cripto",
    "whatsapp": "5511999999999"
  }
}
```

**Response:**

```json
{
  "success": true,
  "txid": "solsticiocampanha03XXXXXXX",
  "tipo_pagamento": "CRIPTO",
  "status": "AGUARDANDO",
  "valor": 5,
  "currency": "USDC",
  "recipient_address": "GXXXXXXXXXXXXXXXX...",
  "memo": "solsticiocampanha03XXXXXXX",
  "network": "testnet",
  "horizon_url": "https://horizon-testnet.stellar.org"
}
```

**O frontend deve:**
- Exibir `recipient_address`, `memo`, `valor` e `currency`.
- Exibir instruções claras:
  - “Envie 5 USDC para este endereço com este MEMO”.
  - “Mantenha esta página aberta até a confirmação (3–5s)”.
- **Salvar a cobrança no `localStorage`** para fallback:

```ts
localStorage.setItem(
  'pending_stellar_payment',
  JSON.stringify({
    txid: data.txid,
    memo: data.memo,
    recipient_address: data.recipient_address,
    currency: data.currency,
    valor: data.valor,
    created_at: new Date().toISOString()
  })
);
```

### 5.2 Monitorar pagamentos Stellar via stream

```ts
// src/lib/stellarMonitor.ts
import { Server } from '@stellar/stellar-sdk';
import { API_URL } from './config';

const HORIZON_URL =
  import.meta.env.VITE_STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
const RECIPIENT_ADDRESS =
  import.meta.env.VITE_STELLAR_RECIPIENT_ADDRESS || 'G...SUA_CONTA...';

export function monitorStellarPayment(
  txid: string,
  onConfirmed: (data: any) => void,
  onError?: (e: any) => void
) {
  const server = new Server(HORIZON_URL);
  let cursor = 'now';

  const stream = server
    .payments()
    .forAccount(RECIPIENT_ADDRESS)
    .cursor(cursor)
    .stream({
      onmessage: async (payment) => {
        if (payment.type === 'payment' && payment.to === RECIPIENT_ADDRESS) {
          try {
            const transaction = await server
              .transactions()
              .transaction(payment.transaction_hash)
              .call();

            const memo = transaction.memo ? transaction.memo.toString() : null;

            if (memo === txid && payment.transaction_successful) {
              const currency =
                payment.asset_type === 'native'
                  ? 'XLM'
                  : payment.asset_code;

              const paymentData = {
                hash: payment.transaction_hash,
                memo,
                currency,
                valor: parseFloat(payment.amount),
                from: payment.from,
                to: payment.to,
                created_at: payment.created_at
              };

              // Confirma no backend
              const res = await fetch(`${API_URL}/api/confirm-donation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hash: paymentData.hash, txid })
              });

              const data = await res.json();
              if (data.success) {
                localStorage.removeItem('pending_stellar_payment');
                onConfirmed({ payment: paymentData, backend: data });
                stream(); // encerra stream
              }
            }
          } catch (e) {
            console.error('Erro ao processar pagamento Stellar:', e);
            onError && onError(e);
          }
        }
      },
      onerror: (e) => {
        console.error('Erro no stream Stellar:', e);
        onError && onError(e);
      }
    });

  return () => stream(); // função para parar o stream
}
```

### 5.3 Uso em componente Svelte/React

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { monitorStellarPayment } from '$lib/stellarMonitor';

  export let txid: string;
  let status = 'AGUARDANDO';
  let stopStream: () => void;

  onMount(() => {
    stopStream = monitorStellarPayment(
      txid,
      (data) => {
        status = 'CONFIRMADA';
        alert('Pagamento confirmado! Obrigado pela doação.');
      },
      (err) => {
        console.error(err);
      }
    );
  });

  onDestroy(() => {
    if (stopStream) stopStream();
  });
</script>

<p>Status do pagamento: {status}</p>
<p>Mantenha esta página aberta até a confirmação.</p>
```

---

## 6. Fluxo Stellar – Página Fechada (Verificação por Memo)

Ao carregar a página (ex.: `/doacao`), verifique se há pagamento pendente:

```ts
import { onMount } from 'svelte';

let pendingPayment: any = null;

onMount(() => {
  const stored = localStorage.getItem('pending_stellar_payment');
  if (stored) {
    const payment = JSON.parse(stored);
    // opcional: descartar se muito antigo (ex.: >24h)
    pendingPayment = payment;
  }
});
```

Botão “Já paguei, verificar agora”:

```ts
async function checkPaymentManually() {
  if (!pendingPayment) return;

  const res = await fetch(`${API_URL}/api/check-payment-by-memo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memo: pendingPayment.memo || pendingPayment.txid })
  });

  const data = await res.json();
  if (data.success) {
    localStorage.removeItem('pending_stellar_payment');
    alert('Pagamento confirmado! Obrigado pela doação.');
  } else {
    alert(data.message || 'Pagamento não encontrado. Tente novamente em alguns segundos.');
  }
}
```

Exemplo Svelte:

```svelte
{#if pendingPayment}
  <div class="pending-stellar">
    <p>⚠️ Encontramos uma doação cripto pendente.</p>
    <p>Memo: {pendingPayment.memo}</p>
    <p>Valor: {pendingPayment.valor} {pendingPayment.currency}</p>
    <button on:click={checkPaymentManually}>
      Já paguei, verificar agora
    </button>
  </div>
{/if}
```

---

## 7. Boas Práticas para o Time de Frontend

- **Nunca** enviar número de cartão/validade/CVV para o backend:
  - Sempre tokenizar no frontend (via SDK/iframe da adquirente).
- Tratar todos os endpoints como **sensíveis**:
  - Validar respostas, exibir mensagens claras ao usuário.
  - Logar erros no frontend apenas de forma genérica (sem dados sensíveis).
- Para Stellar:
  - Sempre usar o `memo` fornecido pelo backend **sem alterar**.
  - Sempre mandar `hash` para `/api/confirm-donation` após detectar no stream.
  - Usar `localStorage` para garantir que um pagamento não se perca se a aba for fechada.

---

## 8. Resumo Rápido por Tipo de Pagamento

### PIX
- `POST /api/gerar-pagamento` com `tipo_pagamento = 'PIX'`.
- Mostrar `brCode` e esperar confirmação via webhook.
- Pode consultar status via `GET /api/cobranca/txid/{txid}`.

### Cartão (Crédito/Débito)
- `POST /api/gerar-pagamento` com `tipo_pagamento = 'CREDITO' | 'DEBITO'`.
- Enviar apenas `token` de cartão.
- Mostrar status de autorização retornado pelo backend.

### Cripto (Stellar: USDC/XLM)
- `POST /api/gerar-pagamento` com `tipo_pagamento = 'CRIPTO'` e `currency`.
- Exibir `recipient_address`, `memo`, `valor`.
- Monitorar via stream e chamar `/api/confirm-donation` com `hash`.
- Se usuário fechar página, oferecer botão que chama `/api/check-payment-by-memo`.

---

## 9. Onde Consultar Mais Detalhes

- `STELLAR_FRONTEND_DETECTION.md` — Detalhes de stream/SSE e exemplos ampliados.
- `STELLAR_WEBHOOK_FLUXO.md` — Fluxo completo de confirmação e dados gravados no banco.
- `CHECKLIST_PRODUCAO.md` — Variáveis de ambiente e validações para produção.


