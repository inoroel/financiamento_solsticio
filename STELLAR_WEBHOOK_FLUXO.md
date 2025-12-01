# Fluxo de Confirmação de Pagamento Stellar

## 📋 Visão Geral

Este documento explica como funciona o fluxo de confirmação de pagamentos Stellar usando a abordagem **Frontend-First** (100% gratuita, sem serviços externos).

**Abordagem Implementada:**

1. **🎯 Frontend Detecta + Backend Valida** (Principal - Instantâneo)
   - Frontend monitora Stellar via SSE
   - Detecta pagamento em 3-5 segundos
   - Envia hash para backend validar
   - **Vantagem**: Gratuito, instantâneo, não precisa de serviços externos

2. **💾 Verificação Manual por Memo** (Fallback - Quando usuário fecha página)
   - Salva memo no localStorage
   - Usuário pode verificar manualmente ao voltar
   - Backend busca pagamento por memo na conta Stellar
   - **Vantagem**: Funciona mesmo se usuário fechar a página, 100% gratuito

**💡 Não precisa de Make.com ou serviços externos!** Tudo funciona no frontend + backend Vercel.

Veja também: [STELLAR_FRONTEND_DETECTION.md](./STELLAR_FRONTEND_DETECTION.md) para implementação frontend completa.

---

## 🔄 Fluxo Completo

### 1. **Criação da Cobrança** (`POST /api/gerar-pagamento`)

Quando um pagamento Stellar é solicitado:

```json
POST /api/gerar-pagamento
{
  "tipo_pagamento": "CRIPTO",
  "valor": 100.00,
  "currency": "USDC",  // ou "XLM"
  "cid": "campanha-123",
  "doador": {
    "nome": "João Silva",
    "whatsapp": "5511999999999",
    "anonimo": false
  }
}
```

**O que acontece:**
1. Sistema gera um `txid` único (ex: `solsticiocampanha1234567890`)
2. Cria um pagamento Stellar com:
   - `recipient_address`: Endereço da conta Stellar que receberá
   - `memo`: Usa o `txid` como memo (identificador único)
   - `currency`: USDC ou XLM
   - `amount_stroops`: Valor convertido para stroops
3. **Salva na tabela `cobrancas`** com:
   - `status = 'AGUARDANDO'`
   - `provider = 'STELLAR'`
   - `crypto_currency = 'USDC'` ou `'XLM'`
   - `crypto_address = recipient_address`
   - `dados_doador_temp = { nome, whatsapp, anonimo }` ⚠️ **Dados temporários, ainda não salvos em `doadores`**

**Resposta:**
```json
{
  "success": true,
  "txid": "solsticiocampanha1234567890",
  "recipient_address": "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "memo": "solsticiocampanha1234567890",
  "currency": "USDC",
  "valor": 100.00,
  "status": "AGUARDANDO",
  "network": "testnet"
}
```

---

### 2. **Pagamento Realizado na Rede Stellar**

O usuário envia USDC/XLM para o `recipient_address` com o `memo` especificado.

**Importante:** O memo é **obrigatório** para identificar qual cobrança foi paga!

---

### 3. **Detecção do Pagamento (Frontend + Verificação Manual)**

#### 3.1. Detecção Automática (Frontend)

O frontend monitora a conta Stellar via SSE e detecta automaticamente quando um pagamento é recebido. Veja [STELLAR_FRONTEND_DETECTION.md](./STELLAR_FRONTEND_DETECTION.md) para implementação completa.

#### 3.2. Verificação Manual (Fallback)

Se o usuário fechar a página antes da confirmação:

1. **Frontend salva memo no localStorage** quando gera a cobrança
2. **Ao voltar, verifica** se há pagamento pendente
3. **Mostra botão** "Já paguei, verificar agora"
4. **Chama** `POST /api/check-payment-by-memo` com o memo
5. **Backend busca** pagamento por memo na conta Stellar
6. **Processa confirmação** se encontrar

**Endpoint de Verificação Manual:**

```json
POST /api/check-payment-by-memo
{
  "memo": "solsticiocampanha1234567890"
}
```

**Resposta de Sucesso:**
```json
{
  "success": true,
  "message": "Pagamento encontrado e confirmado com sucesso",
  "hash": "abc123...",
  "txid": "solsticiocampanha1234567890",
  "valor": 100.00,
  "currency": "USDC"
}
```

**Resposta de Não Encontrado:**
```json
{
  "success": false,
  "message": "Pagamento não encontrado para este memo. Verifique se o pagamento foi realizado e aguarde alguns segundos."
}
```

---

### 4. **Processamento do Webhook** (`POST /api/webhook/stellar`)

Quando o Make.com envia o webhook:

#### 4.1. Validação
- ✅ Valida assinatura HMAC (se `STELLAR_WEBHOOK_SECRET` configurado)
- ✅ Extrai dados do payload

#### 4.2. Busca da Cobrança
- Busca na tabela `cobrancas` por:
  1. `txid` (se o memo corresponde ao txid)
  2. `provider_tid` (se não encontrou por txid)

#### 4.3. Verificação de Idempotência
- Verifica se já existe transação confirmada com o mesmo `provider_tid` (hash)
- Se já existe, retorna sucesso sem processar novamente

#### 4.4. Processamento (`processConfirmedTransaction`)

**Passo 1:** Recupera dados do doador temporários
- Lê `dados_doador_temp` da cobrança

**Passo 2:** Cria registro na tabela `doadores`
- Se `anonimo = false`: cria com `nome` e `whatsapp`
- Se `anonimo = true`: cria apenas com `anonimo = true`
- ⚠️ **IMPORTANTE:** Dados do doador só são salvos APÓS confirmação do pagamento!

**Passo 3:** Cria registro na tabela `transacoes`
```sql
INSERT INTO transacoes (
  cobranca_txid,        -- txid da cobrança
  doador_id,            -- ID do doador criado
  valor,                 -- Valor do pagamento
  status,                -- 'CONFIRMADA'
  tipo_pagamento,        -- 'CRIPTO'
  provider,              -- 'STELLAR'
  provider_tid,          -- hash da transação
  crypto_currency,       -- 'USDC' ou 'XLM'
  crypto_address,        -- endereço que recebeu
  confirmado_em,         -- timestamp
  dados_webhook          -- JSON completo do webhook
)
```

**Passo 4:** Atualiza a cobrança
```sql
UPDATE cobrancas SET
  status = 'CONFIRMADA',
  provider_tid = hash,
  crypto_currency = 'USDC',
  crypto_address = recipient_address,
  dados_doador_temp = NULL  -- Remove dados temporários
WHERE txid = ?
```

---

## 📊 Estrutura dos Dados no Banco

### Tabela `cobrancas` (ANTES do webhook)
```sql
txid: "solsticiocampanha1234567890"
status: "AGUARDANDO"
provider: "STELLAR"
crypto_currency: "USDC"
crypto_address: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
dados_doador_temp: {"nome": "João", "whatsapp": "5511999999999", "anonimo": false}
```

### Tabela `cobrancas` (DEPOIS do webhook)
```sql
txid: "solsticiocampanha1234567890"
status: "CONFIRMADA"  ✅ Atualizado
provider: "STELLAR"
provider_tid: "abc123def456..."  ✅ Hash da transação
crypto_currency: "USDC"
crypto_address: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
dados_doador_temp: NULL  ✅ Removido
```

### Tabela `doadores` (CRIADO no webhook)
```sql
id: 1
nome: "João Silva"  ✅ Salvo apenas após confirmação
whatsapp: "5511999999999"  ✅ Salvo apenas após confirmação
anonimo: false
criado_em: "2025-01-XX..."
```

### Tabela `transacoes` (CRIADO no webhook)
```sql
id: 1
cobranca_txid: "solsticiocampanha1234567890"
doador_id: 1  ✅ Link para doador
valor: 100.00
status: "CONFIRMADA"
tipo_pagamento: "CRIPTO"
provider: "STELLAR"
provider_tid: "abc123def456..."  ✅ Hash da transação
crypto_currency: "USDC"
crypto_address: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
confirmado_em: "2025-01-XX..."
dados_webhook: {"hash": "...", "memo": "...", ...}  ✅ JSON completo
```

**Nota:** O `campanha_id` está disponível através do JOIN com `cobrancas`:
```sql
SELECT t.*, c.campanha_id 
FROM transacoes t 
LEFT JOIN cobrancas c ON t.cobranca_txid = c.txid
WHERE t.id = 1;
```

---

## 🔧 Configuração no Make.com

### Cenário Completo

1. **Trigger:** Stellar → Watch Payments
   - Account: `GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`
   - Asset: `USDC` (ou `XLM`)
   - Watch for: `Payments received`

2. **Filtro (Opcional):** Filtrar apenas pagamentos com memo
   - Condition: `memo` is not empty

3. **Módulo HTTP:** Make a webhook request
   - **URL:** `https://seu-dominio.vercel.app/api/webhook/stellar`
   - **Method:** `POST`
   - **Headers:**
     ```
     Content-Type: application/json
     x-signature: {{hmac_sha256(JSON.stringify(body), "seu_secret")}}
     ```
   - **Body (JSON):**
     ```json
     {
       "hash": "{{transaction.hash}}",
       "memo": "{{transaction.memo}}",
       "currency": "{{if(asset_code == 'native', 'XLM', asset_code)}}",
       "valor": "{{amount}}",
       "from": "{{source_account}}",
       "to": "{{destination_account}}",
       "created_at": "{{created_at}}",
       "successful": true,
       "transaction_successful": true
     }
     ```

### Assinatura HMAC (Opcional mas Recomendado)

Para gerar a assinatura no Make.com:

1. Use o módulo "Tools" → "Hash"
2. Algorithm: `HMAC-SHA256`
3. Text: `{{JSON.stringify(body)}}`
4. Key: `{{STELLAR_WEBHOOK_SECRET}}`

Ou use uma função JavaScript:
```javascript
{{hmac_sha256(JSON.stringify(body), "seu_secret_aqui")}}
```

---

## 📝 Formato Esperado do Webhook

### Payload Mínimo Obrigatório

```json
{
  "hash": "abc123def456...",  // OBRIGATÓRIO: Hash da transação
  "valor": 100.00,             // OBRIGATÓRIO: Valor em unidades (não stroops)
  "currency": "USDC"          // OBRIGATÓRIO: "USDC" ou "XLM"
}
```

### Payload Completo Recomendado

```json
{
  "hash": "abc123def456...",
  "memo": "solsticiocampanha1234567890",
  "currency": "USDC",
  "valor": 100.00,
  "from": "GYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY",
  "to": "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "created_at": "2025-01-15T10:30:00Z",
  "successful": true,
  "transaction_successful": true
}
```

**Nota sobre `campanha_id` (cid):**
- O `campanha_id` **NÃO precisa** ser enviado no webhook
- Ele já está salvo na tabela `cobrancas` quando a cobrança é criada
- O sistema busca a cobrança pelo `memo` (txid) e obtém o `campanha_id` automaticamente
- O `campanha_id` está disponível para tracking através do JOIN entre `transacoes` e `cobrancas`

### Campos Aceitos (Todos Opcionais exceto hash, valor, currency)

- `hash` / `transaction_hash` - Hash da transação Stellar
- `memo` / `transaction_memo` - Memo da transação (usado como txid)
- `currency` / `asset_code` - Código do asset ("USDC" ou "XLM")
- `valor` / `amount` - Valor em unidades (não stroops)
- `from` / `source_account` - Conta que enviou
- `to` / `destination_account` - Conta que recebeu
- `created_at` / `timestamp` - Data/hora da transação
- `successful` / `transaction_successful` - Se a transação foi bem-sucedida

---

## ✅ Resposta do Webhook

### Sucesso (200 OK)
```json
{
  "success": true,
  "message": "Webhook processado com sucesso",
  "hash": "abc123def456..."
}
```

### Erro de Validação (400 Bad Request)
```json
{
  "success": false,
  "error": "Dados do webhook inválidos ou hash não encontrado"
}
```

### Erro de Segurança (401 Unauthorized)
```json
{
  "success": false,
  "error": "Assinatura do webhook inválida"
}
```

---

## 🔍 Troubleshooting

### Problema: Webhook não encontra a cobrança

**Causa:** O memo não corresponde ao txid

**Solução:**
- Certifique-se de que o Make.com está enviando o `memo` correto
- O memo deve ser exatamente o `txid` retornado na criação da cobrança

### Problema: Dados do doador não são salvos

**Causa:** `dados_doador_temp` não existe na cobrança

**Solução:**
- Verifique se a cobrança foi criada com dados do doador
- O webhook só salva doador se houver `dados_doador_temp` na cobrança

### Problema: Como fazer tracking por campanha?

**Solução:**
- O `campanha_id` (cid) já está salvo na tabela `cobrancas` quando a cobrança é criada
- Não é necessário enviar no webhook
- Para consultar transações por campanha:
  ```sql
  SELECT t.*, c.campanha_id 
  FROM transacoes t 
  LEFT JOIN cobrancas c ON t.cobranca_txid = c.txid
  WHERE c.campanha_id = 'sua-campanha-id';
  ```
- As funções `getTransacao()`, `getTransacaoByRedeTid()` e `getTransacaoByProviderTid()` já retornam o `campanha_id` no resultado

### Problema: Transação duplicada

**Causa:** Webhook enviado múltiplas vezes

**Solução:**
- O sistema já tem proteção de idempotência
- Verifica se já existe transação com o mesmo `provider_tid` (hash)
- Se já existe, retorna sucesso sem processar novamente

---

## 📌 Checklist de Configuração

- [ ] Conta Stellar criada e configurada
- [ ] Trustline para USDC adicionada (se usar USDC)
- [ ] `STELLAR_SECRET_KEY` configurada no `.env`
- [ ] `STELLAR_WEBHOOK_SECRET` configurada no `.env`
- [ ] Make.com configurado para monitorar pagamentos
- [ ] Webhook do Make.com apontando para `/api/webhook/stellar`
- [ ] Payload do webhook no formato correto
- [ ] Assinatura HMAC configurada (recomendado)

---

## 🎯 Resumo do Fluxo

```
1. Cliente solicita pagamento → POST /api/gerar-pagamento
   ↓
2. Sistema cria cobrança com status AGUARDANDO
   ↓
3. Cliente envia USDC/XLM para recipient_address com memo
   ↓
4. Make.com detecta pagamento na rede Stellar
   ↓
5. Make.com envia webhook → POST /api/webhook/stellar
   ↓
6. Sistema valida webhook e busca cobrança por memo/txid
   ↓
7. Sistema cria doador na tabela doadores
   ↓
8. Sistema cria transação na tabela transacoes
   ↓
9. Sistema atualiza cobrança: status = CONFIRMADA, remove dados temporários
   ↓
10. ✅ Pagamento confirmado e processado!
```

