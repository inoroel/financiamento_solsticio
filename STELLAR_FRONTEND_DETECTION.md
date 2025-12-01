# Detecção de Pagamento Stellar via Frontend (SSE)

## 🎯 Solução Otimizada: Frontend Detecta + Backend Valida

Esta é a solução **mais eficiente e gratuita** para detectar pagamentos Stellar. O frontend monitora a rede Stellar em tempo real e notifica o backend quando detecta um pagamento.

---

## 🔄 Fluxo Completo

### 1. **Criação da Cobrança** (Igual ao fluxo anterior)

```json
POST /api/gerar-pagamento
{
  "tipo_pagamento": "CRIPTO",
  "valor": 100.00,
  "currency": "USDC",
  "cid": "campanha-123",
  "doador": { ... }
}
```

**Resposta:**
```json
{
  "success": true,
  "txid": "solsticiocampanha1234567890",
  "recipient_address": "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "memo": "solsticiocampanha1234567890",
  "currency": "USDC",
  "valor": 100.00,
  "status": "AGUARDANDO"
}
```

---

### 2. **Frontend Monitora Pagamento (SSE/WebSocket)**

O frontend (Svelte) usa **Server-Sent Events (SSE)** ou **WebSocket** para monitorar a conta Stellar em tempo real.

#### Exemplo com SSE (Stellar Horizon)

```javascript
// frontend/src/lib/stellarMonitor.js
import { Server } from '@stellar/stellar-sdk';

const HORIZON_URL = 'https://horizon-testnet.stellar.org'; // ou mainnet
const RECIPIENT_ADDRESS = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'; // Sua conta

export function monitorStellarPayment(txid, onPaymentDetected) {
  const server = new Server(HORIZON_URL);
  
  // Cursor inicial (ledger atual)
  let cursor = 'now';
  
  // Abre stream de pagamentos
  const stream = server
    .payments()
    .forAccount(RECIPIENT_ADDRESS)
    .cursor(cursor)
    .stream({
      onmessage: async (payment) => {
        // Verifica se é um pagamento recebido
        if (payment.type === 'payment' && payment.to === RECIPIENT_ADDRESS) {
          try {
            // Busca a transação completa para obter o memo
            const transaction = await server
              .transactions()
              .transaction(payment.transaction_hash)
              .call();
            
            const memo = transaction.memo ? transaction.memo.toString() : null;
            
            // Verifica se o memo corresponde ao txid esperado
            if (memo === txid && payment.transaction_successful) {
              // Determina moeda
              let currency = 'XLM';
              if (payment.asset_type !== 'native') {
                currency = payment.asset_code; // USDC, etc
              }
              
              // Chama callback com dados do pagamento
              onPaymentDetected({
                hash: payment.transaction_hash,
                memo: memo,
                currency: currency,
                valor: parseFloat(payment.amount),
                from: payment.from,
                to: payment.to,
                created_at: payment.created_at
              });
              
              // Fecha o stream após detectar
              stream();
            }
          } catch (error) {
            console.error('Erro ao processar pagamento:', error);
          }
        }
      },
      onerror: (error) => {
        console.error('Erro no stream Stellar:', error);
        // Reconecta após 5 segundos
        setTimeout(() => {
          monitorStellarPayment(txid, onPaymentDetected);
        }, 5000);
      }
    });
  
  return stream; // Retorna para poder fechar manualmente
}
```

#### Exemplo de Uso no Componente Svelte

```svelte
<!-- frontend/src/routes/pagamento-stellar.svelte -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { monitorStellarPayment } from '$lib/stellarMonitor';
  
  let txid = 'solsticiocampanha1234567890';
  let status = 'AGUARDANDO';
  let stream = null;
  
  function handlePaymentDetected(payment) {
    console.log('💰 Pagamento detectado!', payment);
    
    // Envia hash para backend confirmar
    fetch('/api/confirm-donation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hash: payment.hash,
        txid: txid
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        status = 'CONFIRMADA';
        // Redireciona ou mostra mensagem de sucesso
        alert('Pagamento confirmado! Obrigado pela doação!');
      } else {
        console.error('Erro ao confirmar:', data.error);
      }
    })
    .catch(error => {
      console.error('Erro na requisição:', error);
    });
  }
  
  onMount(() => {
    // Inicia monitoramento quando componente monta
    stream = monitorStellarPayment(txid, handlePaymentDetected);
  });
  
  onDestroy(() => {
    // Fecha stream quando componente desmonta
    if (stream) {
      stream();
    }
  });
</script>

<div class="payment-status">
  <p>Status: {status}</p>
  {#if status === 'AGUARDANDO'}
    <p>⏳ Aguardando pagamento... Mantenha esta página aberta.</p>
  {/if}
</div>
```

---

### 3. **Backend Valida e Confirma** (`POST /api/confirm-donation`)

Quando o frontend detecta o pagamento, ele envia o hash para o backend:

```json
POST /api/confirm-donation
{
  "hash": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
  "txid": "solsticiocampanha1234567890"  // Opcional, para validação extra
}
```

**O que o backend faz:**

1. ✅ **Valida o hash** (formato correto)
2. ✅ **Consulta a Stellar** para verificar se a transação existe e é válida
3. ✅ **Valida se foi bem-sucedida** (transaction_successful = true)
4. ✅ **Processa a confirmação** usando a mesma lógica do webhook
5. ✅ **Retorna sucesso** com dados da transação

**Resposta de Sucesso:**
```json
{
  "success": true,
  "message": "Pagamento confirmado com sucesso",
  "hash": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
  "txid": "solsticiocampanha1234567890",
  "valor": 100.00,
  "currency": "USDC",
  "transacao": {
    "id": 1,
    "status": "CONFIRMADA",
    "confirmado_em": "2025-01-15T10:30:00Z"
  }
}
```

**Resposta de Erro:**
```json
{
  "error": "Transação não encontrada na rede Stellar",
  "hash": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
}
```

---

## ✅ Vantagens desta Abordagem

1. **🚀 Instantâneo**: Detecção em 3-5 segundos após o pagamento
2. **💰 Gratuito**: Não precisa de Make.com ou serviços externos
3. **⚡ Eficiente**: Não faz polling no servidor
4. **🔒 Seguro**: Backend valida sempre (não confia apenas no frontend)
5. **📊 Idempotente**: Se o frontend enviar múltiplas vezes, não processa duplicado
6. **🎯 Preciso**: Valida na Stellar antes de confirmar

---

## ⚠️ Limitações e Soluções

### Limitação 1: Usuário fecha a página antes do pagamento

**Problema:** Se o usuário fechar a página antes de fazer o pagamento, o frontend não detecta.

**Solução Híbrida:**
- **Frontend detecta** quando possível (maioria dos casos)
- **Webhook/Make.com** como fallback para casos onde o usuário fechou a página
- Backend processa ambos (idempotência garante que não duplica)

### Limitação 2: Múltiplas abas abertas

**Problema:** Se o usuário tiver múltiplas abas, todas podem detectar e enviar.

**Solução:** Backend já tem idempotência - se o hash já foi processado, retorna sucesso sem processar novamente.

---

## 🔧 Implementação Completa

### Backend (Já Implementado ✅)

O endpoint `/api/confirm-donation` já está implementado e:
- Valida o hash
- Consulta a Stellar
- Processa a confirmação
- Retorna sucesso/erro

### Frontend (Precisa Implementar)

Você precisa implementar no frontend:

1. **Monitoramento SSE/WebSocket** (código acima)
2. **Chamada para `/api/confirm-donation`** quando detectar
3. **UI de feedback** para o usuário

---

## 📝 Exemplo Completo de Integração

```javascript
// frontend/src/lib/stellarPayment.js

import { Server } from '@stellar/stellar-sdk';

const HORIZON_URL = import.meta.env.VITE_STELLAR_HORIZON_URL || 
  'https://horizon-testnet.stellar.org';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export class StellarPaymentMonitor {
  constructor(recipientAddress) {
    this.server = new Server(HORIZON_URL);
    this.recipientAddress = recipientAddress;
    this.stream = null;
  }

  /**
   * Monitora pagamento para um txid específico
   * @param {string} txid - TXID da cobrança (memo esperado)
   * @param {Function} onDetected - Callback quando pagamento detectado
   * @param {Function} onError - Callback de erro
   */
  monitor(txid, onDetected, onError) {
    let cursor = 'now';
    
    this.stream = this.server
      .payments()
      .forAccount(this.recipientAddress)
      .cursor(cursor)
      .stream({
        onmessage: async (payment) => {
          if (payment.type === 'payment' && 
              payment.to === this.recipientAddress &&
              payment.transaction_successful) {
            
            try {
              const transaction = await this.server
                .transactions()
                .transaction(payment.transaction_hash)
                .call();
              
              const memo = transaction.memo ? transaction.memo.toString() : null;
              
              if (memo === txid) {
                const currency = payment.asset_type === 'native' 
                  ? 'XLM' 
                  : payment.asset_code;
                
                const paymentData = {
                  hash: payment.transaction_hash,
                  memo: memo,
                  currency: currency,
                  valor: parseFloat(payment.amount),
                  from: payment.from,
                  to: payment.to,
                  created_at: payment.created_at
                };
                
                // Confirma no backend
                const confirmed = await this.confirmPayment(paymentData.hash, txid);
                
                if (confirmed) {
                  onDetected(paymentData);
                  this.stop(); // Para de monitorar após confirmar
                }
              }
            } catch (error) {
              console.error('Erro ao processar pagamento:', error);
              if (onError) onError(error);
            }
          }
        },
        onerror: (error) => {
          console.error('Erro no stream:', error);
          if (onError) onError(error);
          // Reconecta após 5 segundos
          setTimeout(() => {
            this.monitor(txid, onDetected, onError);
          }, 5000);
        }
      });
  }

  /**
   * Confirma pagamento no backend
   */
  async confirmPayment(hash, txid) {
    try {
      const response = await fetch(`${API_URL}/api/confirm-donation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash, txid })
      });
      
      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error('Erro ao confirmar pagamento:', error);
      return false;
    }
  }

  /**
   * Para o monitoramento
   */
  stop() {
    if (this.stream) {
      this.stream();
      this.stream = null;
    }
  }
}
```

---

## 🎯 Resumo do Fluxo

```
1. Usuário solicita pagamento → POST /api/gerar-pagamento
   ↓
2. Frontend recebe txid e recipient_address
   ↓
3. Frontend inicia monitoramento SSE da conta Stellar
   ↓
4. Usuário faz pagamento na carteira Stellar
   ↓
5. Frontend detecta pagamento (3-5 segundos)
   ↓
6. Frontend envia hash → POST /api/confirm-donation
   ↓
7. Backend valida na Stellar e processa
   ↓
8. ✅ Pagamento confirmado instantaneamente!
```

---

## 🔄 Solução Completa: Frontend + Verificação Manual

Para máxima confiabilidade, use **ambas as abordagens**:

1. **Frontend detecta** (maioria dos casos, instantâneo)
2. **Verificação manual por memo** (casos onde usuário fechou página)

O backend já tem idempotência, então não há risco de processar duas vezes!

### Verificação Manual (Quando Usuário Fecha Página)

Se o usuário fechar a página antes da confirmação, implemente:

1. **Salvar memo no localStorage** quando gerar a cobrança
2. **Ao voltar, verificar** se há memo pendente no localStorage
3. **Mostrar botão** "Já paguei, verificar agora"
4. **Chamar** `/api/check-payment-by-memo` com o memo

Veja exemplo completo abaixo.

---

## 📌 Checklist de Implementação

- [x] Backend: Endpoint `/api/confirm-donation` criado
- [x] Backend: Endpoint `/api/check-payment-by-memo` criado
- [ ] Frontend: Monitoramento SSE implementado
- [ ] Frontend: Chamada para `/api/confirm-donation` implementada
- [ ] Frontend: Salvar memo no localStorage
- [ ] Frontend: Verificar memo pendente ao carregar página
- [ ] Frontend: Botão "Já paguei, verificar agora"
- [ ] Frontend: UI de feedback implementada
- [ ] Frontend: Aviso "Mantenha esta página aberta"
- [ ] Testes: Validar detecção em tempo real

---

## 💾 Implementação: LocalStorage + Verificação Manual

### 1. Salvar Memo no LocalStorage

Quando gerar a cobrança, salve o memo:

```javascript
// Após receber resposta de /api/gerar-pagamento
const response = await fetch('/api/gerar-pagamento', { ... });
const data = await response.json();

if (data.success && data.txid) {
  // Salva no localStorage
  localStorage.setItem('pending_stellar_payment', JSON.stringify({
    txid: data.txid,
    memo: data.memo,
    recipient_address: data.recipient_address,
    currency: data.currency,
    valor: data.valor,
    created_at: new Date().toISOString()
  }));
}
```

### 2. Verificar ao Carregar Página

Ao carregar a página, verifique se há pagamento pendente:

```javascript
// No onMount do componente
onMount(() => {
  const pendingPayment = localStorage.getItem('pending_stellar_payment');
  
  if (pendingPayment) {
    const payment = JSON.parse(pendingPayment);
    
    // Verifica se já passou muito tempo (opcional: limpar após 24h)
    const createdAt = new Date(payment.created_at);
    const hoursAgo = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
    
    if (hoursAgo < 24) {
      // Mostra botão de verificação
      showVerificationButton(payment);
    } else {
      // Remove do localStorage se muito antigo
      localStorage.removeItem('pending_stellar_payment');
    }
  }
});
```

### 3. Botão "Já Paguei, Verificar Agora"

```javascript
async function checkPaymentManually(payment) {
  try {
    setLoading(true);
    
    const response = await fetch('/api/check-payment-by-memo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memo: payment.memo || payment.txid
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Pagamento encontrado e confirmado!
      localStorage.removeItem('pending_stellar_payment');
      showSuccessMessage('Pagamento confirmado! Obrigado pela doação!');
      // Redireciona ou atualiza UI
    } else {
      showErrorMessage(data.message || 'Pagamento não encontrado. Verifique se o pagamento foi realizado.');
    }
  } catch (error) {
    console.error('Erro ao verificar pagamento:', error);
    showErrorMessage('Erro ao verificar pagamento. Tente novamente.');
  } finally {
    setLoading(false);
  }
}
```

### 4. Componente Svelte Completo

```svelte
<script>
  import { onMount } from 'svelte';
  
  let pendingPayment = null;
  let checking = false;
  let status = 'AGUARDANDO';
  
  onMount(() => {
    // Verifica se há pagamento pendente
    const stored = localStorage.getItem('pending_stellar_payment');
    if (stored) {
      pendingPayment = JSON.parse(stored);
    }
  });
  
  async function checkPayment() {
    if (!pendingPayment) return;
    
    checking = true;
    try {
      const response = await fetch('/api/check-payment-by-memo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo: pendingPayment.memo || pendingPayment.txid })
      });
      
      const data = await response.json();
      
      if (data.success) {
        status = 'CONFIRMADA';
        localStorage.removeItem('pending_stellar_payment');
        alert('✅ Pagamento confirmado! Obrigado pela doação!');
      } else {
        alert('❌ ' + (data.message || 'Pagamento não encontrado'));
      }
    } catch (error) {
      alert('❌ Erro ao verificar. Tente novamente.');
    } finally {
      checking = false;
    }
  }
</script>

{#if pendingPayment && status === 'AGUARDANDO'}
  <div class="payment-pending">
    <p>⚠️ Você tem um pagamento pendente</p>
    <p>Memo: {pendingPayment.memo}</p>
    <p>Valor: {pendingPayment.valor} {pendingPayment.currency}</p>
    <button 
      on:click={checkPayment} 
      disabled={checking}
    >
      {checking ? 'Verificando...' : 'Já paguei, verificar agora'}
    </button>
  </div>
{/if}
```

## 🚀 Próximos Passos

1. Implementar monitoramento SSE no frontend Svelte
2. Implementar salvamento no localStorage
3. Implementar verificação manual ao carregar página
4. Adicionar aviso "Mantenha esta página aberta"
5. Testar com pagamento real em testnet
6. Deploy e monitorar em produção

