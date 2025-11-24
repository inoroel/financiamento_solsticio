<!-- 4465ff85-7209-493c-903d-0f013900df00 1ec79873-78c9-4026-9594-fa4e4afed383 -->
# Gap Analysis - Migração de Infraestrutura de Pagamentos

## 1. LIMPEZA - Código Legado a Remover

### 1.1 Arquivos de Serviço Itaú (OBSOLETOS)

- ❌ `services/pixService.js` - Serviço PIX Itaú (329 linhas)
- ❌ `services/webhookService.js` - Webhook handler Itaú (185 linhas)
- ❌ `services/itauCertificateValidator.js` - Validador mTLS Itaú (234 linhas)
- ❌ `routes/pixRoutes.js` - Rotas antigas Itaú (273 linhas) - **AINDA ESTÁ SENDO USADO?**

### 1.2 Arquivos de Configuração/Certificados

- ❌ `certificados-webhook-itau/` - Pasta completa com certificados Itaú
  - `ca_cert_952123c440.zip`
  - `ca-cert`
- ❌ `itau_ep9_gtw_pix_recebimentos_conciliacoes_v2_ext_3f4c8c6958.json` - Documentação Itaú (406KB)

### 1.3 Referências em Documentação

- ⚠️ `CERTIFICADO_WEBHOOK.md` - Menciona Itaú (manter apenas se for referência histórica)
- ⚠️ `VARIAVEIS_FALTANDO.md` - Pode conter referências Itaú
- ⚠️ Comentários em código mencionando "BB" (Banco do Brasil) - apenas histórico

### 1.4 Variáveis de Ambiente

- ❌ `ITAU_CLIENT_ID` (se ainda existir no .env)
- ❌ `ITAU_CLIENT_SECRET`
- ❌ `ITAU_API_KEY`
- ❌ `ITAU_CHAVE_PIX`
- ❌ `ITAU_AUTH_URL`
- ❌ `ITAU_API_BASE_URL`
- ❌ `ITAU_CERT_PATH`
- ❌ `ITAU_KEY_PATH`
- ❌ `ITAU_REQUIRE_CLIENT_CERT`
- ❌ `WEBHOOK_SECRET` (genérico, substituído por `REDE_WEBHOOK_SECRET`)

### 1.5 Imports/Requires no Código

- ⚠️ Verificar se `server.js` ainda importa `pixRoutes`
- ⚠️ Verificar se há outros arquivos importando serviços Itaú

---

## 2. DATABASE - Análise do Schema

### 2.1 ✅ O que JÁ EXISTE

- `tipo_pagamento` ENUM('PIX', 'CREDITO', 'DEBITO') - ✅ Suporta tipos
- `rede_tid` VARCHAR(100) - ✅ Transaction ID específico Rede
- `dados_pagamento` JSONB - ✅ Dados genéricos
- `bandeira_cartao` VARCHAR(50) - ✅ Para cartões
- `parcelas` INTEGER - ✅ Para crédito

### 2.2 ❌ O que FALTA

- **Campo `provider` ou `payment_provider`** VARCHAR(50)
  - Valores: 'REDE', 'ITAU', 'BINANCE_PAY'
  - Necessário para distinguir origem da transação
  - Deve ser adicionado em `cobrancas` e `transacoes`

- **Campo `provider_tid`** VARCHAR(100) (genérico)
  - Substitui ou complementa `rede_tid`
  - Armazena Transaction ID de qualquer provider
  - Exemplo: `rede_tid` pode ser migrado para `provider_tid` com `provider='REDE'`

- **Campo `crypto_currency`** VARCHAR(20) (para Binance Pay)
  - Valores: 'BTC', 'ETH', 'USDT', 'BNB', etc.
  - Apenas para transações cripto

- **Campo `crypto_address`** VARCHAR(255) (para Binance Pay)
  - Endereço da carteira cripto
  - Para pagamentos cripto

### 2.3 Migration Necessária

```sql
-- Adicionar provider
ALTER TABLE cobrancas ADD COLUMN provider VARCHAR(50) DEFAULT 'REDE';
ALTER TABLE transacoes ADD COLUMN provider VARCHAR(50) DEFAULT 'REDE';

-- Adicionar provider_tid genérico
ALTER TABLE cobrancas ADD COLUMN provider_tid VARCHAR(100);
ALTER TABLE transacoes ADD COLUMN provider_tid VARCHAR(100);

-- Adicionar campos cripto
ALTER TABLE cobrancas ADD COLUMN crypto_currency VARCHAR(20);
ALTER TABLE cobrancas ADD COLUMN crypto_address VARCHAR(255);
ALTER TABLE transacoes ADD COLUMN crypto_currency VARCHAR(20);
ALTER TABLE transacoes ADD COLUMN crypto_address VARCHAR(255);

-- Migrar dados existentes
UPDATE cobrancas SET provider = 'REDE', provider_tid = rede_tid WHERE rede_tid IS NOT NULL;
UPDATE transacoes SET provider = 'REDE', provider_tid = rede_tid WHERE rede_tid IS NOT NULL;
```

---

## 3. NOVAS INTEGRAÇÕES

### 3.1 API e-Rede (PIX/Cartão) - ✅ JÁ IMPLEMENTADO

**Status**: ✅ COMPLETO

**Arquivos existentes**:

- ✅ `services/redeService.js` - Serviço completo
  - `createPixCharge()` - PIX QR Code
  - `createCreditCardTransaction()` - Cartão crédito
  - `createDebitCardTransaction()` - Cartão débito
  - `consultTransaction()` - Consulta
- ✅ `services/redeWebhookService.js` - Webhook handler
  - Validação IP whitelist
  - Validação HMAC
  - Processamento de webhooks
- ✅ `routes/paymentRoutes.js` - Rotas unificadas
  - `POST /api/gerar-pagamento`
  - `GET /api/cobranca/:tid`
  - `POST /api/webhook/pagamento`

**Ação necessária**:

- ⚠️ Apenas garantir que está sendo usado (remover código Itaú)

---

### 3.2 Binance Pay API - ❌ NÃO EXISTE

**Status**: ❌ PRECISA CRIAR DO ZERO

**Arquivos a criar**:

1. **`services/binancePayService.js`** (NOVO)

   - Autenticação Binance Pay (API Key + Secret)
   - `createCryptoPayment()` - Criar ordem de pagamento cripto
   - `consultPayment()` - Consultar status
   - `getSupportedCurrencies()` - Listar moedas suportadas

2. **`services/binancePayWebhookService.js`** (NOVO)

   - Validação de assinatura Binance Pay
   - Processamento de webhooks cripto
   - Validação de IP (se aplicável)

3. **Atualizar `routes/paymentRoutes.js`**

   - Adicionar suporte a `tipo_pagamento: 'CRIPTO'`
   - Adicionar endpoint `POST /api/webhook/binance-pay`

4. **Variáveis de ambiente** (adicionar ao `env.template`)
   ```
   BINANCE_PAY_API_KEY=seu_api_key
   BINANCE_PAY_SECRET_KEY=seu_secret_key
   BINANCE_PAY_ENVIRONMENT=sandbox|production
   BINANCE_PAY_WEBHOOK_SECRET=secret_para_validacao
   ```


**Documentação de referência**:

- Binance Pay API: https://developers.binance.com/docs/binance-pay/api-overview

---

## 4. WEBHOOKS - Análise de Endpoints

### 4.1 ✅ O que JÁ EXISTE

**Estrutura Vercel**:

- ✅ `vercel.json` configurado corretamente
  - Todas as rotas → `server.js`
  - Serverless Functions funcionando

**Endpoints atuais**:

- ✅ `POST /api/webhook/pagamento` - e-Rede (PIX/Cartão)
  - Implementado em `routes/paymentRoutes.js`
  - Validação IP + HMAC
  - Processamento completo

### 4.2 ❌ O que FALTA

**Binance Pay Webhook**:

- ❌ `POST /api/webhook/binance-pay` - **NÃO EXISTE**
  - Precisa criar handler específico
  - Validação de assinatura Binance Pay
  - Processamento de transações cripto

**Estrutura recomendada**:

```javascript
// routes/paymentRoutes.js
router.post('/webhook/binance-pay', webhookLimiter, async (req, res) => {
  // Validação Binance Pay
  // Processamento cripto
});
```

### 4.3 ⚠️ Considerações Vercel

**Serverless Functions**:

- ✅ Endpoints funcionam em Vercel
- ⚠️ Timeout: 10s (Hobby), 60s (Pro)
- ⚠️ Webhooks devem responder rapidamente (< 5s ideal)
- ✅ Headers de segurança já implementados

**Recomendações**:

- Processar webhooks de forma assíncrona (se necessário)
- Retornar 200 OK imediatamente
- Processar em background (se timeout for risco)

---

## 5. PLANO DE AÇÃO - To-Do List

### FASE 1: LIMPEZA (Prioridade ALTA)

#### 1.1 Remover Código Itaú

- [ ] **DEL-001**: Deletar `services/pixService.js`
- [ ] **DEL-002**: Deletar `services/webhookService.js`
- [ ] **DEL-003**: Deletar `services/itauCertificateValidator.js`
- [ ] **DEL-004**: Verificar se `routes/pixRoutes.js` está sendo usado
  - Se não usado: deletar
  - Se usado: migrar para `paymentRoutes.js` ou marcar como deprecated
- [ ] **DEL-005**: Deletar pasta `certificados-webhook-itau/`
- [ ] **DEL-006**: Deletar `itau_ep9_gtw_pix_recebimentos_conciliacoes_v2_ext_3f4c8c6958.json`

#### 1.2 Limpar Imports

- [ ] **REF-001**: Verificar `server.js` - remover import de `pixRoutes` se existir
- [ ] **REF-002**: Buscar todos os `require('./services/pixService')` e remover
- [ ] **REF-003**: Buscar todos os `require('./services/webhookService')` e remover
- [ ] **REF-004**: Buscar todos os `require('./routes/pixRoutes')` e remover

#### 1.3 Limpar Variáveis de Ambiente

- [ ] **ENV-001**: Verificar `.env` local - remover variáveis Itaú
- [ ] **ENV-002**: Verificar Vercel Dashboard - remover variáveis Itaú
- [ ] **ENV-003**: Atualizar `env.template` se ainda tiver referências Itaú

---

### FASE 2: DATABASE (Prioridade ALTA)

#### 2.1 Criar Migration

- [ ] **DB-001**: Criar `scripts/migration-multi-provider.sql`
  - Adicionar campo `provider` em `cobrancas`
  - Adicionar campo `provider` em `transacoes`
  - Adicionar campo `provider_tid` em ambas tabelas
  - Adicionar campos cripto (`crypto_currency`, `crypto_address`)
  - Migrar dados existentes (`rede_tid` → `provider_tid` com `provider='REDE'`)

#### 2.2 Atualizar Constraints

- [ ] **DB-002**: Atualizar constraint `check_tipo_pagamento` para incluir 'CRIPTO'
- [ ] **DB-003**: Adicionar constraint para `provider` (valores válidos)
- [ ] **DB-004**: Criar índices para `provider` e `provider_tid`

#### 2.3 Atualizar Schema Inicial

- [ ] **DB-005**: Atualizar `scripts/init-db.sql` com novos campos
- [ ] **DB-006**: Testar migration em ambiente de desenvolvimento

---

### FASE 3: BINANCE PAY (Prioridade MÉDIA)

#### 3.1 Criar Serviço Binance Pay

- [ ] **BIN-001**: Criar `services/binancePayService.js`
  - Implementar autenticação (API Key + Secret)
  - Implementar `createCryptoPayment(orderId, amount, currency)`
  - Implementar `consultPayment(orderId)`
  - Implementar `getSupportedCurrencies()`
  - Tratamento de erros

#### 3.2 Criar Webhook Handler

- [ ] **BIN-002**: Criar `services/binancePayWebhookService.js`
  - Validação de assinatura Binance Pay
  - Extração de dados do webhook
  - Processamento de transações cripto
  - Integração com `dbService.processConfirmedTransaction()`

#### 3.3 Integrar nas Rotas

- [ ] **BIN-003**: Atualizar `routes/paymentRoutes.js`
  - Adicionar `tipo_pagamento: 'CRIPTO'` no endpoint `/gerar-pagamento`
  - Adicionar validação para dados cripto
  - Adicionar endpoint `POST /api/webhook/binance-pay`

#### 3.4 Atualizar Validações

- [ ] **BIN-004**: Atualizar `utils/validation.js`
  - Adicionar `validateCryptoCurrency(currency)`
  - Adicionar `validateCryptoAddress(address)`

#### 3.5 Atualizar dbService

- [ ] **BIN-005**: Atualizar `services/dbService.js`
  - Suportar campos cripto em `saveCobranca()`
  - Suportar campos cripto em `processConfirmedTransaction()`
  - Suportar `provider='BINANCE_PAY'`

#### 3.6 Variáveis de Ambiente

- [ ] **BIN-006**: Atualizar `env.template` com variáveis Binance Pay
- [ ] **BIN-007**: Documentar configuração Binance Pay

---

### FASE 4: TESTES E VALIDAÇÃO (Prioridade ALTA)

#### 4.1 Testes de Limpeza

- [ ] **TEST-001**: Executar aplicação após remoção de código Itaú
- [ ] **TEST-002**: Verificar que rotas antigas não quebram
- [ ] **TEST-003**: Testar webhook e-Rede ainda funciona

#### 4.2 Testes de Database

- [ ] **TEST-004**: Executar migration em ambiente de teste
- [ ] **TEST-005**: Verificar dados migrados corretamente
- [ ] **TEST-006**: Testar queries com novo campo `provider`

#### 4.3 Testes Binance Pay

- [ ] **TEST-007**: Testar criação de pagamento cripto (sandbox)
- [ ] **TEST-008**: Testar webhook Binance Pay (mock)
- [ ] **TEST-009**: Testar consulta de pagamento cripto

#### 4.4 Testes de Integração

- [ ] **TEST-010**: Testar fluxo completo PIX (Rede)
- [ ] **TEST-011**: Testar fluxo completo Cartão (Rede)
- [ ] **TEST-012**: Testar fluxo completo Cripto (Binance Pay)

---

### FASE 5: DOCUMENTAÇÃO (Prioridade BAIXA)

#### 5.1 Atualizar Documentação

- [ ] **DOC-001**: Atualizar `README.md` com novos providers
- [ ] **DOC-002**: Criar `BINANCE_PAY_SETUP.md` com guia de configuração
- [ ] **DOC-003**: Atualizar `env.template` com comentários explicativos
- [ ] **DOC-004**: Documentar endpoints de webhook na Vercel

#### 5.2 Limpar Documentação Antiga

- [ ] **DOC-005**: Atualizar ou remover `CERTIFICADO_WEBHOOK.md` (se só mencionar Itaú)
- [ ] **DOC-006**: Revisar outros arquivos `.md` para referências obsoletas

---

## 6. RESUMO EXECUTIVO

### Status Atual

- ✅ **e-Rede (PIX/Cartão)**: 100% implementado
- ❌ **Binance Pay (Cripto)**: 0% implementado
- ⚠️ **Código Itaú**: Ainda presente (precisa remover)
- ⚠️ **Database**: Precisa campo `provider` para multi-provider

### Prioridades

1. **ALTA**: Limpar código Itaú (risco de confusão)
2. **ALTA**: Adicionar campo `provider` no banco (fundamental)
3. **MÉDIA**: Implementar Binance Pay (nova funcionalidade)
4. **BAIXA**: Documentação (pode ser feita em paralelo)

### Estimativa de Esforço

- **Fase 1 (Limpeza)**: 2-4 horas
- **Fase 2 (Database)**: 2-3 horas
- **Fase 3 (Binance Pay)**: 8-12 horas
- **Fase 4 (Testes)**: 4-6 horas
- **Fase 5 (Documentação)**: 2-3 horas

**Total**: ~18-28 horas de desenvolvimento

### To-dos

- [x] Analisar código completo identificando erros de semântica, lógica e segurança
- [x] Corrigir erros de semântica e lógica identificados (pixService, webhookService, dbService, routes)
- [x] Corrigir vulnerabilidades de segurança (validação webhook, certificados, sanitização)
- [x] Criar migration para adicionar campos tipo_pagamento, rede_tid, dados_pagamento nas tabelas
- [x] Criar redeService.js com autenticação e métodos para PIX, crédito e débito
- [x] Criar redeWebhookService.js com validação de origem e processamento de webhooks
- [x] Criar/atualizar paymentRoutes.js com endpoints unificados para todos os tipos de pagamento
- [x] Atualizar dbService.js para suportar novos campos e tipos de pagamento
- [x] Atualizar env.template substituindo variáveis Itaú por variáveis Rede
- [x] Atualizar server.js para usar novas rotas e configurações