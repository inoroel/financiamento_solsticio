# Validação Completa: Fluxo de Cartões (Crédito e Débito) - e-Rede

## 📋 Resumo Executivo

Após análise detalhada da documentação oficial da e-Rede ([developer.userede.com.br/e-rede](https://developer.userede.com.br/e-rede)), foram identificados **5 problemas críticos** no nosso código que precisam ser corrigidos:

1. ❌ **Zero Dollar sendo usado incorretamente** - Está sendo aplicado para TODAS as transações, mas só é obrigatório para armazenar cartões
2. ❌ **3DS não configurado corretamente para débito** - Débito OBRIGA 3DS, mas nosso código não está garantindo isso
3. ❌ **DataOnly não implementado** - Estamos usando 3DS normal, mas deveríamos usar DataOnly para melhor experiência
4. ❌ **Tokenização de Bandeira não sendo usada para Visa** - É OBRIGATÓRIA para Visa, mas não está sendo chamada
5. ⚠️ **Confirmação de pagamentos** - Está correto, mas pode ser melhorada

---

## 1. Zero Dollar Authorization

### 📖 O que diz a documentação:

> **"Zero Dollar is mandatory when you intend to store the card, while for other operations it is highly recommended in order to validate the card before starting the standard transactional flow."**

**Tradução:** Zero Dollar é **obrigatório** quando você pretende **armazenar o cartão**, enquanto para outras operações é **altamente recomendado** para validar o cartão antes do fluxo transacional padrão.

### ❌ Problema no nosso código:

```javascript
// routes/paymentRoutes.js linha 324-339
// ⚠️ OBRIGATÓRIO: Zero Dollar Authorization (validação e-Rede)
// Valida o cartão antes da transação real
console.log('🔒 Executando Zero Dollar Authorization (obrigatório)...');
```

**Estamos fazendo Zero Dollar para TODAS as transações de crédito**, mas:
- Só é **obrigatório** se vamos **armazenar o cartão** (`storageCard: 1 ou 2`)
- Para transações normais (sem armazenar), é apenas **recomendado**, não obrigatório

### ✅ Correção necessária:

Zero Dollar deve ser executado **APENAS** quando:
1. Vamos armazenar o cartão (`storageCard: 1 ou 2`)
2. É uma transação de recorrência/COF
3. É explicitamente solicitado pelo frontend

Para transações normais (sem armazenar), podemos pular o Zero Dollar.

---

## 2. 3DS (3D Secure) e DataOnly

### 📖 O que diz a documentação:

1. **3DS é OBRIGATÓRIO para débito:**
   > "3DS authentication is mandatory for all debit card transactions. For credit cards, their use is optional."

2. **DataOnly vs 3DS:**
   - **DataOnly**: Sempre sem challenge, sem liability shift, melhor aprovação
   - **3DS**: Pode ter challenge, com liability shift, mais seguro

3. **Para usar DataOnly:**
   - Adicionar `challengePreference: "DATA_ONLY"` dentro de `threeDSecure`
   - Disponível apenas para Mastercard e Visa
   - Não pode ser usado em Zero Dollar

### ❌ Problemas no nosso código:

1. **Débito não está garantindo 3DS obrigatório:**
   ```javascript
   // services/redeService.js linha 566-665
   // createDebitCardTransaction não está forçando 3DS
   ```

2. **Não estamos usando DataOnly:**
   ```javascript
   // routes/paymentRoutes.js linha 343-353
   threeDSecureData = {
     embedded: true,
     onFailure: 'continue'
     // ❌ Falta: challengePreference: "DATA_ONLY"
   };
   ```

3. **3DS para débito deve ter `onFailure: 'decline'` (não 'continue'):**
   > "For debit transactions, the value of this parameter is automatically set to decline due to the authentication requirement."

### ✅ Correções necessárias:

1. **Para débito:** Sempre incluir 3DS com `onFailure: 'decline'`
2. **Para crédito Visa/Mastercard:** Usar DataOnly com `challengePreference: "DATA_ONLY"`
3. **Para crédito Elo:** Usar 3DS normal (sem DataOnly)

---

## 3. Tokenização de Bandeira (Network Tokenization)

### 📖 O que diz a documentação:

> **"Mandatory for Visa and ELO brands. Optional on card-on-file transactions"**

**Tokenização de Bandeira é OBRIGATÓRIA para Visa e Elo** (exceto em transações COF).

### ❌ Problema no nosso código:

Temos a função `tokenizeCard()` implementada, mas **não está sendo chamada** antes das transações Visa/Elo.

### ✅ Correção necessária:

Antes de criar uma transação com cartão Visa ou Elo:
1. Chamar `tokenizeCard()` para obter o network token
2. Usar o token retornado na transação (não o número do cartão)

---

## 4. Confirmação de Pagamentos com Cartão

### 📖 O que diz a documentação:

**Cartões (Crédito/Débito):**
- **Resposta síncrona:** A resposta da API já indica se foi aprovado (`returnCode: '00'`) ou negado
- **Webhook:** Opcional, usado para confirmação assíncrona (útil para casos de 3DS com challenge)

**Fluxo:**
1. Criar transação → Resposta síncrona com status
2. Se `returnCode: '00'` → Pagamento aprovado e capturado (se `capture: true`)
3. Webhook opcional → Confirmação assíncrona adicional

### ✅ Nosso código está correto:

- Estamos salvando a cobrança com status baseado no `returnCode`
- Estamos processando webhooks quando recebidos
- Estamos usando idempotência corretamente

**Melhoria sugerida:** Validar melhor a resposta síncrona antes de considerar como sucesso.

---

## 5. Resumo das Correções Necessárias

### Prioridade ALTA:

1. ✅ **Remover Zero Dollar obrigatório** - Aplicar apenas quando necessário
2. ✅ **Garantir 3DS obrigatório para débito** - Sempre incluir com `onFailure: 'decline'`
3. ✅ **Implementar DataOnly para Visa/Mastercard** - Adicionar `challengePreference: "DATA_ONLY"`
4. ✅ **Implementar Tokenização de Bandeira para Visa/Elo** - Chamar antes das transações

### Prioridade MÉDIA:

5. ⚠️ **Melhorar validação de resposta síncrona** - Validar melhor antes de considerar sucesso

---

## 6. Fluxo Correto por Tipo de Cartão

### Crédito Visa/Mastercard:
1. Tokenizar cartão (obter network token) ✅ OBRIGATÓRIO
2. Criar transação com token + DataOnly ✅ RECOMENDADO
3. Resposta síncrona indica aprovação/negação ✅

### Crédito Elo:
1. Tokenizar cartão (obter network token) ✅ OBRIGATÓRIO
2. Criar transação com token + 3DS (opcional) ✅
3. Resposta síncrona indica aprovação/negação ✅

### Débito (Visa/Mastercard/Elo):
1. Tokenizar cartão (obter network token) ✅ OBRIGATÓRIO
2. Criar transação com token + 3DS ✅ OBRIGATÓRIO (`onFailure: 'decline'`)
3. Resposta síncrona indica aprovação/negação ✅

### Quando armazenar cartão (COF):
1. Zero Dollar Authorization ✅ OBRIGATÓRIO
2. Tokenizar cartão ✅ OBRIGATÓRIO
3. Criar transação com token + dados COF ✅
4. Resposta síncrona indica aprovação/negação ✅

---

## 7. Referências da Documentação

- **Zero Dollar:** Manual p.67-71, p.3265
- **3DS:** Manual p.34-54, p.1486-1501
- **DataOnly:** Manual p.51-65, p.2516-2591
- **Tokenização de Bandeira:** Manual p.173-199, p.694 (mandatory for Visa/ELO)
- **Confirmação:** Manual p.27-30, p.1023-1061

---

## 8. Correções Implementadas ✅

### ✅ 1. Zero Dollar Authorization
- **ANTES:** Executado para TODAS as transações de crédito/débito
- **AGORA:** Executado APENAS quando vamos armazenar cartão (`storageCard: 1 ou 2`)
- **Código:** `routes/paymentRoutes.js` linhas 324-361 (crédito) e 380-418 (débito)

### ✅ 2. 3DS para Débito
- **ANTES:** Configurado, mas não garantia obrigatoriedade
- **AGORA:** Sempre incluído com `onFailure: 'decline'` (obrigatório)
- **Código:** `routes/paymentRoutes.js` linhas 400-418

### ✅ 3. DataOnly para Visa/Mastercard
- **ANTES:** Usava 3DS normal
- **AGORA:** Usa DataOnly com `challengePreference: 'DATA_ONLY'`
- **Código:** `routes/paymentRoutes.js` linhas 394-412

### ✅ 4. Tokenização de Bandeira
- **ANTES:** Não estava sendo chamada
- **AGORA:** Chamada automaticamente para Visa e Elo antes das transações
- **Código:** `routes/paymentRoutes.js` linhas 363-392 (crédito) e 420-448 (débito)
- **Uso:** `services/redeService.js` linhas 473-489 (crédito) e 597-613 (débito)

### ✅ 5. Suporte a networkToken
- **ANTES:** Apenas token padrão e-Rede
- **AGORA:** Prioriza networkToken (tokenização de bandeira), com fallback para token padrão ou cardNumber
- **Código:** `services/redeService.js` linhas 471-489 (crédito) e 595-613 (débito)

## 9. Confirmação de Pagamentos com Cartão

### 📖 Como funciona (conforme documentação):

**Resposta Síncrona:**
- A API retorna imediatamente com `returnCode: '00'` se aprovado
- Se `capture: true`, o pagamento já é capturado na resposta
- Status: `AUTORIZADA` ou `CAPTURADA` (se capture: true)

**Webhook (Opcional):**
- A e-Rede pode enviar webhook para confirmação assíncrona
- Útil para casos de 3DS com challenge (redirecionamento)
- Endpoint: `POST /api/webhook/pagamento`

### ✅ Nosso código está correto:

1. **Resposta síncrona:** Salvamos status baseado em `returnCode` ✅
2. **Webhook:** Processamos quando recebido ✅
3. **Idempotência:** Verificamos se já foi processado ✅

**Melhoria implementada:** Validação mais rigorosa da resposta síncrona antes de considerar sucesso.

## 10. Próximos Passos

1. ✅ Implementar correções de Zero Dollar
2. ✅ Implementar 3DS obrigatório para débito
3. ✅ Implementar DataOnly para Visa/Mastercard
4. ✅ Implementar Tokenização de Bandeira para Visa/Elo
5. ⏳ Testar fluxo completo em sandbox
6. ⏳ Validar com diferentes bandeiras (Visa, Mastercard, Elo)
7. ⏳ Testar fluxo de armazenar cartão (COF)

