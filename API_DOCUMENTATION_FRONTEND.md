# 📚 Documentação da API - Financiamento Solstício

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Configuração Base](#configuração-base)
3. [Autenticação e Segurança](#autenticação-e-segurança)
4. [Endpoints da API](#endpoints-da-api)
5. [Fluxos de Pagamento](#fluxos-de-pagamento)
6. [Tratamento de 3DS](#tratamento-de-3ds)
7. [Webhooks](#webhooks)
8. [Códigos de Status e Erro](#códigos-de-status-e-erro)
9. [Exemplos de Integração](#exemplos-de-integração)
10. [FAQ e Troubleshooting](#faq-e-troubleshooting)

---

## 🎯 Visão Geral

A API de Financiamento Solstício permite processar pagamentos através de múltiplos métodos:

- **PIX**: Pagamentos instantâneos via QR Code
- **Cartão de Crédito**: Parcelamento em até 12x
- **Cartão de Débito**: Débito automático
- **Criptomoedas**: USDC e XLM via rede Stellar

### Características Principais

- ✅ Suporte a múltiplos métodos de pagamento
- ✅ Autenticação 3DS automática para cartões
- ✅ Webhooks para notificações de pagamento
- ✅ Rate limiting para segurança
- ✅ CORS configurável
- ✅ Validação completa de dados

---

## ⚙️ Configuração Base

### Base URL

```
Produção: https://financiamentosolsticio.vercel.app
Desenvolvimento: http://localhost:3000
```

### Headers Obrigatórios

Todas as requisições devem incluir:

```http
Content-Type: application/json
Accept: application/json
```

### CORS

A API suporta CORS configurável. Em produção, configure `ALLOWED_ORIGINS` no backend com os domínios permitidos.

**Importante**: Requisições OPTIONS (preflight) são tratadas automaticamente pelo backend.

---

## 🔐 Autenticação e Segurança

### Rate Limiting

A API implementa rate limiting para proteger contra abusos:

- **Criação de cobrança**: 10 requisições por IP a cada 15 minutos
- **Consulta de cobrança**: 30 requisições por IP a cada minuto
- **Webhooks**: 100 requisições por IP a cada minuto

**Resposta quando excedido (HTTP 429)**:
```json
{
  "error": "Muitas tentativas. Por favor, tente novamente em alguns minutos."
}
```

### Validação de Dados

Todos os dados enviados são validados no backend:

- Valores monetários: R$ 0,01 a R$ 100.000,00
- TXID: 26-35 caracteres alfanuméricos
- Nome: até 255 caracteres, apenas letras, números e espaços
- WhatsApp: 10-15 dígitos numéricos
- Campanha ID: até 50 caracteres alfanuméricos, hífens e underscores

---

## 📡 Endpoints da API

### 1. Criar Pagamento

**POST** `/api/gerar-pagamento`

Cria uma nova cobrança para pagamento via PIX, cartão ou criptomoeda.

#### Request Body

```typescript
{
  tipo_pagamento: "PIX" | "CREDITO" | "DEBITO" | "CRIPTO",
  valor: number, // R$ 0,01 a R$ 100.000,00 (opcional para CRIPTO)
  cid: string, // ID da campanha (até 50 caracteres)
  doador?: {
    nome?: string, // Obrigatório se anonimo = false
    whatsapp?: string, // Obrigatório se anonimo = false
    anonimo: boolean // true = doação anônima, false = identificada
  },
  cartao?: {
    // Opção 1: Token já gerado
    token: string,
    bandeira?: "visa" | "mastercard" | "elo"
  } | {
    // Opção 2: Dados do cartão (tokenização automática)
    cardNumber: string, // Número do cartão (sem espaços)
    cardholderName: string, // Nome do portador
    expirationMonth: number, // 1-12
    expirationYear: number, // Ex: 2025
    securityCode: string, // CVV
    email: string, // Email do portador
    bandeira?: "visa" | "mastercard" | "elo", // Opcional, detecta automaticamente
    kind?: "credit" | "debit"
  },
  parcelas?: number, // 1-12 (apenas para CREDITO)
  currency?: "USDC" | "XLM" // Apenas para CRIPTO (padrão: USDC)
}
```

#### Response - Sucesso (HTTP 200)

**PIX:**
```json
{
  "success": true,
  "txid": "solsticiocampanha011234567",
  "rede_tid": "12345678901234567890",
  "tipo_pagamento": "PIX",
  "valor": 100.50,
  "status": "AGUARDANDO",
  "brCode": "00020126580014BR.GOV.BCB.PIX...",
  "qrCodeImage": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "expiracao": 3600
}
```

**Cartão de Crédito/Débito (Aprovado):**
```json
{
  "success": true,
  "txid": "solsticiocampanha011234567",
  "rede_tid": "12345678901234567890",
  "tipo_pagamento": "CREDITO",
  "valor": 100.50,
  "status": "CONFIRMADA",
  "autorizacao": {
    "codigo": "123456",
    "status": "AUTORIZADA",
    "bandeira": "visa"
  },
  "parcelas": 3
}
```

**Cartão de Crédito/Débito (Requer 3DS):**
```json
{
  "success": true,
  "txid": "solsticiocampanha011234567",
  "rede_tid": "12345678901234567890",
  "tipo_pagamento": "CREDITO",
  "valor": 100.50,
  "status": "PENDENTE_3DS",
  "requires3DS": true,
  "threeDSecureUrl": "https://sandbox-erede.useredecloud.com.br/3ds/...",
  "threeDSecureDisplayMode": "popup",
  "autorizacao": {
    "codigo": null,
    "status": "PENDENTE_3DS",
    "bandeira": "visa"
  },
  "parcelas": 3
}
```

**Criptomoeda:**
```json
{
  "success": true,
  "txid": "solsticiocampanha011234567",
  "tipo_pagamento": "CRIPTO",
  "valor": 100.50,
  "status": "AGUARDANDO",
  "recipient_address": "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "memo": "solsticiocampanha011234567",
  "currency": "USDC",
  "network": "testnet",
  "horizon_url": "https://horizon-testnet.stellar.org",
  "stellar_uri": "web+stellar:pay?destination=G...&amount=100.5&asset_code=USDC&asset_issuer=GA5Z...&memo=solsticiocampanha011234567&memo_type=text",
  "stellar_uri_alt": "web+stellar:pay?destination=G...&amount=100.5&asset_code=USDC&asset_issuer=GA5Z...&memo=solsticiocampanha011234567",
  "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "qr_code_alt": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "qr_code_address": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "qr_code_memo": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

**⚠️ Nota Importante para USDC**: Se `currency` for `"USDC"`, o usuário **deve ter configurado a trustline para USDC** na sua carteira Stellar antes de enviar o pagamento. Sem a trustline, a transação falhará. Veja a seção [Configuração de Trustline para USDC](#-configuração-de-trustline-para-usdc) para instruções detalhadas.

#### Response - Erro (HTTP 400/500)

```json
{
  "error": "Mensagem de erro descritiva"
}
```

#### Exemplo de Requisição - PIX

```javascript
const response = await fetch('https://financiamentosolsticio.vercel.app/api/gerar-pagamento', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    tipo_pagamento: 'PIX',
    valor: 100.50,
    cid: 'campanha-01',
    doador: {
      nome: 'João Silva',
      whatsapp: '11987654321',
      anonimo: false
    }
  })
});

const data = await response.json();
```

#### Exemplo de Requisição - Cartão de Crédito

```javascript
const response = await fetch('https://financiamentosolsticio.vercel.app/api/gerar-pagamento', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    tipo_pagamento: 'CREDITO',
    valor: 100.50,
    cid: 'campanha-01',
    parcelas: 3,
    cartao: {
      cardNumber: '4111111111111111',
      cardholderName: 'JOAO SILVA',
      expirationMonth: 12,
      expirationYear: 2025,
      securityCode: '123',
      email: 'joao@example.com',
      bandeira: 'visa'
    },
    doador: {
      nome: 'João Silva',
      whatsapp: '11987654321',
      anonimo: false
    }
  })
});

const data = await response.json();

// Verifica se requer 3DS
if (data.requires3DS) {
  // Abre pop-up para autenticação 3DS
  const popup = window.open(
    data.threeDSecureUrl,
    '3DS Authentication',
    'width=500,height=600,scrollbars=yes,resizable=yes'
  );
  
  // Monitora fechamento do pop-up
  const checkInterval = setInterval(() => {
    if (popup.closed) {
      clearInterval(checkInterval);
      // Consulta status da transação
      checkTransactionStatus(data.txid);
    }
  }, 1000);
}
```

---

### 2. Consultar Cobrança por TXID

**GET** `/api/cobranca/txid/:txid`

Consulta o status de uma cobrança pelo TXID interno.

#### Response - Sucesso (HTTP 200)

```json
{
  "success": true,
  "txid": "solsticiocampanha011234567",
  "rede_tid": "12345678901234567890",
  "tipo_pagamento": "PIX",
  "status": "CONFIRMADA",
  "valor": 100.50,
  "brCode": "00020126580014BR.GOV.BCB.PIX...",
  "criadoEm": "2025-01-15T10:30:00.000Z",
  "atualizadoEm": "2025-01-15T10:35:00.000Z",
  "campanhaId": "campanha-01"
}
```

#### Response - Não Encontrado (HTTP 404)

```json
{
  "error": "Cobrança não encontrada."
}
```

#### Exemplo

```javascript
const txid = 'solsticiocampanha011234567';
const response = await fetch(
  `https://financiamentosolsticio.vercel.app/api/cobranca/txid/${txid}`
);
const data = await response.json();
```

---

### 3. Consultar Cobrança por TID (e-Rede)

**GET** `/api/cobranca/:tid`

Consulta o status de uma cobrança pelo Transaction ID da e-Rede.

#### Response

Mesmo formato da consulta por TXID.

---

### 4. Verificar Pagamento Stellar por Memo

**POST** `/api/check-payment-by-memo`

Verifica se existe um pagamento Stellar para um memo específico. Útil quando o usuário fecha a página antes da confirmação.

#### Request Body

```json
{
  "memo": "solsticiocampanha011234567"
}
```

#### Response - Sucesso (HTTP 200)

```json
{
  "success": true,
  "message": "Pagamento encontrado e confirmado com sucesso",
  "hash": "abc123def456...",
  "txid": "solsticiocampanha011234567",
  "valor": 100.50,
  "currency": "USDC",
  "created_at": "2025-01-15T10:30:00.000Z",
  "transacao": {
    "id": 123,
    "status": "CONFIRMADA",
    "confirmado_em": "2025-01-15T10:30:00.000Z"
  }
}
```

#### Response - Não Encontrado (HTTP 404)

```json
{
  "success": false,
  "message": "Pagamento não encontrado para este memo. Verifique se o pagamento foi realizado e aguarde alguns segundos.",
  "memo": "solsticiocampanha011234567"
}
```

#### Exemplo

```javascript
const response = await fetch(
  'https://financiamentosolsticio.vercel.app/api/check-payment-by-memo',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      memo: 'solsticiocampanha011234567'
    })
  }
);

const data = await response.json();
```

---

### 5. Confirmar Doação Stellar

**POST** `/api/confirm-donation`

Confirma um pagamento Stellar detectado pelo frontend (via SSE/WebSocket ou detecção manual).

#### Request Body

```json
{
  "hash": "abc123def456...", // Hash da transação Stellar (64 caracteres hexadecimais)
  "txid": "solsticiocampanha011234567" // Opcional, para validação extra
}
```

#### Response - Sucesso (HTTP 200)

```json
{
  "success": true,
  "message": "Pagamento confirmado com sucesso",
  "hash": "abc123def456...",
  "txid": "solsticiocampanha011234567",
  "valor": 100.50,
  "currency": "USDC",
  "transacao": {
    "id": 123,
    "status": "CONFIRMADA",
    "confirmado_em": "2025-01-15T10:30:00.000Z"
  }
}
```

#### Exemplo

```javascript
const response = await fetch(
  'https://financiamentosolsticio.vercel.app/api/confirm-donation',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      hash: 'abc123def456...',
      txid: 'solsticiocampanha011234567'
    })
  }
);

const data = await response.json();
```

---

### 6. Health Check

**GET** `/health`

Verifica o status da API e conexão com banco de dados.

#### Response

```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "database": "connected"
}
```

---

## 💳 Fluxos de Pagamento

### Fluxo PIX

1. **Frontend**: Envia requisição `POST /api/gerar-pagamento` com `tipo_pagamento: "PIX"`
2. **Backend**: Cria cobrança na e-Rede e retorna QR Code
3. **Frontend**: Exibe QR Code para o usuário escanear
4. **Usuário**: Escaneia QR Code e realiza pagamento
5. **Backend**: Recebe webhook da e-Rede confirmando pagamento
6. **Frontend**: Consulta status periodicamente ou recebe notificação

**Polling recomendado**: Consultar `/api/cobranca/txid/:txid` a cada 5-10 segundos até status mudar para `CONFIRMADA`.

### Fluxo Cartão de Crédito/Débito

1. **Frontend**: Envia requisição `POST /api/gerar-pagamento` com dados do cartão
2. **Backend**: 
   - Tokeniza cartão (se necessário)
   - Valida cartão (Zero Dollar, se necessário)
   - Cria transação na e-Rede
   - Retorna resposta
3. **Frontend**: 
   - Se `requires3DS: true`: Abre pop-up com `threeDSecureUrl`
   - Se aprovado imediatamente: Mostra confirmação
4. **Usuário**: Completa autenticação 3DS (se necessário)
5. **Backend**: Recebe callback 3DS e processa transação
6. **Frontend**: Consulta status ou recebe notificação

**Importante**: Para transações com 3DS, o frontend deve:
- Abrir pop-up com `window.open(threeDSecureUrl, ...)`
- Monitorar fechamento do pop-up
- Consultar status após fechamento

### Fluxo Criptomoeda (Stellar)

1. **Frontend**: Envia requisição `POST /api/gerar-pagamento` com `tipo_pagamento: "CRIPTO"`
2. **Backend**: Gera endereço Stellar, memo e QR Codes
3. **Frontend**: Exibe endereço, memo e QR Codes para o usuário
4. **Usuário**: 
   - **Se USDC**: Verifica se tem trustline configurada (se não tiver, configura antes de enviar)
   - Envia pagamento via carteira Stellar (Freighter, Lobstr, etc.)
5. **Frontend**: 
   - Opção 1: Monitora blockchain via SSE/WebSocket
   - Opção 2: Usuário clica "Já paguei, verificar agora"
6. **Backend**: Detecta pagamento na blockchain e processa
7. **Frontend**: Recebe confirmação

**Detecção de pagamento**:
- **Automática**: Frontend monitora blockchain via Horizon API ou serviço de monitoramento
- **Manual**: Usuário clica em botão e frontend chama `/api/check-payment-by-memo` ou `/api/confirm-donation`

**⚠️ Importante para USDC**: Antes de enviar pagamento em USDC, o usuário deve ter configurado a trustline para USDC na sua carteira. Sem a trustline, a transação falhará. Veja a seção [Configuração de Trustline para USDC](#-configuração-de-trustline-para-usdc) para mais detalhes.

---

## 🔗 Configuração de Trustline para USDC

### O que é Trustline?

Na rede Stellar, uma **trustline** (linha de confiança) é uma permissão que uma conta concede para manter e transacionar um ativo específico emitido por um determinado emissor. Diferente de XLM (a moeda nativa), ativos como USDC requerem que você configure uma trustline antes de poder receber ou enviar esse ativo.

### Por que é necessário?

- **XLM**: Não requer trustline (é a moeda nativa da rede Stellar)
- **USDC**: **Requer trustline** antes de poder receber ou enviar

Se um usuário tentar enviar USDC sem ter configurado a trustline, a transação falhará com erro.

### Informações do Emissor USDC

O USDC na rede Stellar é emitido pela **Circle**. Para configurar a trustline, você precisará das seguintes informações:

- **Asset Code**: `USDC`
- **Issuer Address**: `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`

### Requisitos

Antes de criar uma trustline, certifique-se de que:

1. **Sua conta Stellar tem XLM suficiente**: Cada trustline consome uma pequena reserva de XLM (aproximadamente 0.5 XLM) para manter a conta ativa na rede
2. **Sua carteira suporta trustlines**: A maioria das carteiras Stellar modernas suporta, mas verifique a documentação da sua carteira

### Como Configurar Trustline para USDC

#### Instruções Gerais (aplicável à maioria das carteiras)

1. **Abra sua carteira Stellar** (Freighter, Lobstr, Ledger Live, etc.)
2. **Navegue para a seção de ativos**:
   - Procure por "Assets", "Trustlines", "Add Asset" ou "Manage Assets"
3. **Adicione novo ativo**:
   - Clique em "Add Asset", "Add Trustline" ou botão similar
4. **Configure o USDC**:
   - **Opção A**: Busque por "USDC" na lista de ativos populares
   - **Opção B**: Insira manualmente:
     - **Asset Code**: `USDC`
     - **Issuer**: `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`
5. **Confirme a criação**:
   - Revise as informações e confirme a criação da trustline
   - A carteira pode solicitar confirmação adicional (assinatura de transação)
6. **Verifique**:
   - O USDC deve aparecer na lista de ativos da sua carteira
   - Você agora pode receber e enviar USDC

#### Carteiras Específicas

**Freighter (Extensão de Navegador)**:
1. Abra a extensão Freighter
2. Clique em "Assets" no menu
3. Clique em "Add Asset"
4. Busque por "USDC" ou insira o código e emissor manualmente
5. Confirme a transação

**Lobstr (Web/Mobile)**:
1. Abra o app Lobstr
2. Vá em "Assets" ou "Wallet"
3. Toque no botão "+" ou "Add Asset"
4. Selecione "USDC" da lista ou adicione manualmente
5. Confirme

**Ledger Live (Hardware Wallet)**:
1. Abra Ledger Live
2. Selecione sua conta Stellar
3. Vá em "Assets"
4. Clique em "Add Asset"
5. Busque "USDC" e adicione
6. Confirme no dispositivo Ledger

**Outras carteiras**: Siga o mesmo padrão - procure pela opção de adicionar ativos/trustlines e configure o USDC com o emissor da Circle.

### Aviso Importante para o Frontend

⚠️ **Recomendação**: Quando exibir informações de pagamento em USDC, adicione um aviso visual informando ao usuário que:

- A carteira precisa ter trustline configurada para USDC antes de enviar
- Se não tiver, a transação falhará
- XLM não requer trustline (alternativa mais simples para usuários iniciantes)

Exemplo de mensagem:
```
⚠️ Importante: Para enviar USDC, sua carteira precisa ter a trustline configurada. 
Se você ainda não configurou, adicione o ativo USDC na sua carteira antes de enviar.
Issuer: GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN
```

---

## 🔒 Tratamento de 3DS

### Quando 3DS é Requerido

- **Débito**: Sempre obrigatório
- **Crédito**: Pode ser requerido dependendo do cartão e valor

### Resposta com 3DS

Quando uma transação requer 3DS, a resposta inclui:

```json
{
  "requires3DS": true,
  "threeDSecureUrl": "https://sandbox-erede.useredecloud.com.br/3ds/...",
  "threeDSecureDisplayMode": "popup",
  "status": "PENDENTE_3DS"
}
```

### Implementação no Frontend

```javascript
// Após criar pagamento
if (data.requires3DS && data.threeDSecureUrl) {
  // Abre pop-up para autenticação 3DS
  const popup = window.open(
    data.threeDSecureUrl,
    '3DS Authentication',
    'width=500,height=600,scrollbars=yes,resizable=yes,centerscreen=yes'
  );
  
  // Monitora fechamento do pop-up
  const checkInterval = setInterval(() => {
    if (popup.closed) {
      clearInterval(checkInterval);
      // Aguarda 2 segundos para o callback processar
      setTimeout(() => {
        checkTransactionStatus(data.txid);
      }, 2000);
    }
  }, 1000);
  
  // Timeout de segurança (5 minutos)
  setTimeout(() => {
    if (!popup.closed) {
      popup.close();
      clearInterval(checkInterval);
      alert('Tempo de autenticação expirado. Tente novamente.');
    }
  }, 300000);
}

// Função para verificar status
async function checkTransactionStatus(txid) {
  const response = await fetch(
    `https://financiamentosolsticio.vercel.app/api/cobranca/txid/${txid}`
  );
  const data = await response.json();
  
  if (data.status === 'CONFIRMADA') {
    // Pagamento confirmado!
    showSuccessMessage();
  } else if (data.status === 'NEGADA') {
    // Pagamento negado
    showErrorMessage('Pagamento negado. Verifique os dados do cartão.');
  } else {
    // Ainda processando, tenta novamente em 2 segundos
    setTimeout(() => checkTransactionStatus(txid), 2000);
  }
}
```

### Importante sobre 3DS

- **Sempre use pop-up**: Iframe não funciona em sandbox da e-Rede
- **Monitorar fechamento**: O pop-up fecha automaticamente após autenticação
- **Polling após fechamento**: Consulte o status após o pop-up fechar
- **Timeout**: Implemente timeout para evitar pop-ups abertos indefinidamente

---

## 📨 Webhooks

### Configuração

Os webhooks são configurados no portal da e-Rede e Stellar (se usar serviço de monitoramento).

**URLs dos webhooks**:
- e-Rede: `https://financiamentosolsticio.vercel.app/api/webhook/pagamento`
- Stellar: `https://financiamentosolsticio.vercel.app/api/webhook/stellar`

### Webhook e-Rede

O backend recebe notificações da e-Rede quando:
- PIX é pago
- Transação de cartão é autorizada/capturada
- Status de transação muda

**Formato do webhook** (exemplo):
```json
{
  "transaction": {
    "tid": "12345678901234567890",
    "reference": "solsticiocampanha011234567",
    "amount": "10050",
    "status": "Approved",
    "returnCode": "00",
    "returnMessage": "Transação aprovada"
  }
}
```

### Webhook Stellar

O backend recebe notificações de serviços de monitoramento Stellar quando:
- Pagamento é detectado na blockchain
- Transação é confirmada

**Formato do webhook** (exemplo):
```json
{
  "hash": "abc123def456...",
  "memo": "solsticiocampanha011234567",
  "currency": "USDC",
  "valor": 100.50,
  "successful": true,
  "created_at": "2025-01-15T10:30:00.000Z"
}
```

### Ação do Frontend

O frontend **não precisa** processar webhooks diretamente. O backend processa automaticamente e atualiza o status da cobrança.

**Recomendação**: Use polling para verificar status após criar pagamento:

```javascript
async function pollPaymentStatus(txid, maxAttempts = 60) {
  let attempts = 0;
  
  const interval = setInterval(async () => {
    attempts++;
    
    const response = await fetch(
      `https://financiamentosolsticio.vercel.app/api/cobranca/txid/${txid}`
    );
    const data = await response.json();
    
    if (data.status === 'CONFIRMADA') {
      clearInterval(interval);
      showSuccessMessage();
    } else if (data.status === 'NEGADA') {
      clearInterval(interval);
      showErrorMessage();
    } else if (attempts >= maxAttempts) {
      clearInterval(interval);
      showTimeoutMessage();
    }
  }, 5000); // Consulta a cada 5 segundos
}
```

---

## 📊 Códigos de Status e Erro

### Status de Cobrança

- `AGUARDANDO`: Cobrança criada, aguardando pagamento
- `PENDENTE_3DS`: Transação criada, aguardando autenticação 3DS
- `CONFIRMADA`: Pagamento confirmado e processado
- `NEGADA`: Pagamento negado ou falhou
- `CANCELADA`: Cobrança cancelada/estornada

### Códigos HTTP

- `200`: Sucesso
- `400`: Erro de validação (dados inválidos)
- `401`: Não autorizado (erro de segurança)
- `403`: Acesso negado (CORS ou IP bloqueado)
- `404`: Recurso não encontrado
- `409`: Conflito (TXID já existe)
- `422`: Erro de processamento (ex: cancelamento falhou)
- `429`: Rate limit excedido
- `500`: Erro interno do servidor
- `503`: Serviço indisponível (banco de dados desconectado)

### Mensagens de Erro Comuns

| Erro | Causa | Solução |
|------|-------|---------|
| `Tipo de pagamento inválido` | `tipo_pagamento` não é PIX, CREDITO, DEBITO ou CRIPTO | Verifique o valor enviado |
| `Valor inválido` | Valor fora do range (R$ 0,01 - R$ 100.000,00) | Ajuste o valor |
| `Dados do cartão inválidos` | Token ou dados do cartão incompletos | Verifique os campos obrigatórios |
| `Cartão não passou na validação Zero Dollar` | Cartão inválido ou bloqueado | Verifique com o banco emissor |
| `Transação requer autenticação 3DS` | Cartão requer 3DS (normal para débito) | Abra pop-up com `threeDSecureUrl` |
| `Cobrança não encontrada` | TXID não existe no banco | Verifique o TXID |
| `Muitas tentativas` | Rate limit excedido | Aguarde alguns minutos |

---

## 💻 Exemplos de Integração

### Exemplo Completo - PIX

```javascript
async function processarPagamentoPIX(valor, campanhaId, doador) {
  try {
    // 1. Criar cobrança
    const response = await fetch(
      'https://financiamentosolsticio.vercel.app/api/gerar-pagamento',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tipo_pagamento: 'PIX',
          valor: valor,
          cid: campanhaId,
          doador: doador
        })
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao criar cobrança');
    }
    
    const data = await response.json();
    
    // 2. Exibir QR Code
    if (data.qrCodeImage) {
      document.getElementById('qr-code').src = data.qrCodeImage;
    } else if (data.brCode) {
      // Gera QR Code localmente se não recebeu imagem
      generateQRCode(data.brCode);
    }
    
    // 3. Monitorar status
    pollPaymentStatus(data.txid);
    
    return data;
  } catch (error) {
    console.error('Erro ao processar pagamento PIX:', error);
    throw error;
  }
}

function pollPaymentStatus(txid) {
  let attempts = 0;
  const maxAttempts = 60; // 5 minutos (60 * 5 segundos)
  
  const interval = setInterval(async () => {
    attempts++;
    
    try {
      const response = await fetch(
        `https://financiamentosolsticio.vercel.app/api/cobranca/txid/${txid}`
      );
      const data = await response.json();
      
      if (data.status === 'CONFIRMADA') {
        clearInterval(interval);
        showSuccessMessage('Pagamento confirmado!');
      } else if (data.status === 'NEGADA') {
        clearInterval(interval);
        showErrorMessage('Pagamento negado.');
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        showTimeoutMessage('Tempo de espera expirado. Verifique o pagamento manualmente.');
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      if (attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }
  }, 5000); // Consulta a cada 5 segundos
}
```

### Exemplo Completo - Cartão de Crédito com 3DS

```javascript
async function processarPagamentoCartao(dadosCartao, valor, campanhaId, parcelas, doador) {
  try {
    // 1. Criar transação
    const response = await fetch(
      'https://financiamentosolsticio.vercel.app/api/gerar-pagamento',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tipo_pagamento: 'CREDITO',
          valor: valor,
          cid: campanhaId,
          parcelas: parcelas,
          cartao: dadosCartao,
          doador: doador
        })
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao processar pagamento');
    }
    
    const data = await response.json();
    
    // 2. Verificar se requer 3DS
    if (data.requires3DS && data.threeDSecureUrl) {
      return handle3DS(data);
    }
    
    // 3. Verificar status imediato
    if (data.autorizacao?.status === 'AUTORIZADA') {
      showSuccessMessage('Pagamento aprovado!');
      return data;
    } else {
      showErrorMessage('Pagamento negado. Verifique os dados do cartão.');
      return null;
    }
  } catch (error) {
    console.error('Erro ao processar pagamento:', error);
    throw error;
  }
}

function handle3DS(data) {
  return new Promise((resolve, reject) => {
    // Abre pop-up para 3DS
    const popup = window.open(
      data.threeDSecureUrl,
      '3DS Authentication',
      'width=500,height=600,scrollbars=yes,resizable=yes,centerscreen=yes'
    );
    
    if (!popup) {
      reject(new Error('Pop-up bloqueado. Permita pop-ups para este site.'));
      return;
    }
    
    // Monitora fechamento do pop-up
    const checkInterval = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkInterval);
        
        // Aguarda processamento do callback
        setTimeout(async () => {
          try {
            const response = await fetch(
              `https://financiamentosolsticio.vercel.app/api/cobranca/txid/${data.txid}`
            );
            const statusData = await response.json();
            
            if (statusData.status === 'CONFIRMADA') {
              showSuccessMessage('Pagamento confirmado!');
              resolve(statusData);
            } else if (statusData.status === 'NEGADA') {
              showErrorMessage('Pagamento negado após autenticação 3DS.');
              reject(new Error('Pagamento negado'));
            } else {
              // Ainda processando, tenta novamente
              pollPaymentStatusAfter3DS(data.txid, resolve, reject);
            }
          } catch (error) {
            reject(error);
          }
        }, 2000);
      }
    }, 1000);
    
    // Timeout de segurança
    setTimeout(() => {
      if (!popup.closed) {
        popup.close();
        clearInterval(checkInterval);
        reject(new Error('Tempo de autenticação expirado.'));
      }
    }, 300000); // 5 minutos
  });
}

function pollPaymentStatusAfter3DS(txid, resolve, reject) {
  let attempts = 0;
  const maxAttempts = 30; // 2,5 minutos
  
  const interval = setInterval(async () => {
    attempts++;
    
    try {
      const response = await fetch(
        `https://financiamentosolsticio.vercel.app/api/cobranca/txid/${txid}`
      );
      const data = await response.json();
      
      if (data.status === 'CONFIRMADA') {
        clearInterval(interval);
        showSuccessMessage('Pagamento confirmado!');
        resolve(data);
      } else if (data.status === 'NEGADA') {
        clearInterval(interval);
        showErrorMessage('Pagamento negado.');
        reject(new Error('Pagamento negado'));
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        showTimeoutMessage('Aguardando confirmação do pagamento...');
        reject(new Error('Timeout aguardando confirmação'));
      }
    } catch (error) {
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        reject(error);
      }
    }
  }, 5000);
}
```

### Exemplo Completo - Criptomoeda (Stellar)

```javascript
async function processarPagamentoCripto(valor, campanhaId, currency, doador) {
  try {
    // 1. Criar pagamento
    const response = await fetch(
      'https://financiamentosolsticio.vercel.app/api/gerar-pagamento',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tipo_pagamento: 'CRIPTO',
          valor: valor, // Opcional - será obtido da blockchain
          cid: campanhaId,
          currency: currency || 'USDC',
          doador: doador
        })
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao criar pagamento');
    }
    
    const data = await response.json();
    
    // 2. Exibir informações de pagamento
    displayStellarPaymentInfo(data);
    
    // 3. Avisar sobre trustline se for USDC
    if (data.currency === 'USDC') {
      showTrustlineWarning();
    }
    
    // 4. Monitorar pagamento (opcional - pode ser manual)
    // Opção A: Monitoramento automático via Horizon API
    monitorStellarPayment(data.memo, data.recipient_address);
    
    // Opção B: Botão "Já paguei, verificar agora"
    setupManualVerificationButton(data.memo);
    
    return data;
  } catch (error) {
    console.error('Erro ao processar pagamento cripto:', error);
    throw error;
  }
}

function displayStellarPaymentInfo(data) {
  // Exibe endereço
  document.getElementById('stellar-address').textContent = data.recipient_address;
  
  // Exibe memo
  document.getElementById('stellar-memo').textContent = data.memo;
  
  // Exibe QR Codes
  if (data.qr_code) {
    document.getElementById('qr-code-uri').src = data.qr_code;
  }
  if (data.qr_code_address) {
    document.getElementById('qr-code-address').src = data.qr_code_address;
  }
  if (data.qr_code_memo) {
    document.getElementById('qr-code-memo').src = data.qr_code_memo;
  }
  
  // Botão para abrir carteira Stellar
  if (data.stellar_uri) {
    document.getElementById('open-wallet-btn').onclick = () => {
      window.location.href = data.stellar_uri;
    };
  }
}

// Função para exibir aviso sobre trustline USDC
function showTrustlineWarning() {
  const warningElement = document.getElementById('trustline-warning');
  if (warningElement) {
    warningElement.innerHTML = `
      <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 12px; margin: 16px 0;">
        <strong>⚠️ Importante - Trustline USDC:</strong>
        <p style="margin: 8px 0 0 0;">
          Para enviar USDC, sua carteira Stellar precisa ter a <strong>trustline configurada</strong> para USDC.
          Se você ainda não configurou, adicione o ativo USDC na sua carteira antes de enviar o pagamento.
        </p>
        <p style="margin: 8px 0 0 0; font-size: 0.9em;">
          <strong>Issuer:</strong> <code>GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN</code>
        </p>
        <p style="margin: 8px 0 0 0; font-size: 0.9em;">
          Sem a trustline, a transação falhará. Veja instruções detalhadas na documentação.
        </p>
      </div>
    `;
    warningElement.style.display = 'block';
  }
}

function setupManualVerificationButton(memo) {
  document.getElementById('verify-payment-btn').onclick = async () => {
    try {
      const response = await fetch(
        'https://financiamentosolsticio.vercel.app/api/check-payment-by-memo',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ memo })
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        showSuccessMessage('Pagamento confirmado!');
      } else {
        showErrorMessage(data.message || 'Pagamento não encontrado.');
      }
    } catch (error) {
      console.error('Erro ao verificar pagamento:', error);
      showErrorMessage('Erro ao verificar pagamento. Tente novamente.');
    }
  };
}

// Monitoramento automático via Horizon API (opcional)
async function monitorStellarPayment(memo, recipientAddress) {
  const horizonUrl = 'https://horizon-testnet.stellar.org'; // ou mainnet
  let lastLedger = null;
  
  const interval = setInterval(async () => {
    try {
      // Busca pagamentos recentes
      const response = await fetch(
        `${horizonUrl}/accounts/${recipientAddress}/payments?order=desc&limit=10`
      );
      const data = await response.json();
      
      for (const payment of data.records) {
        if (payment.type === 'payment' && payment.to === recipientAddress) {
          // Busca transação para obter memo
          const txResponse = await fetch(
            `${horizonUrl}/transactions/${payment.transaction_hash}`
          );
          const txData = await txResponse.json();
          
          if (txData.memo && txData.memo === memo) {
            // Pagamento encontrado!
            clearInterval(interval);
            
            // Confirma no backend
            const confirmResponse = await fetch(
              'https://financiamentosolsticio.vercel.app/api/confirm-donation',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  hash: payment.transaction_hash,
                  txid: memo
                })
              }
            );
            
            const confirmData = await confirmResponse.json();
            if (confirmData.success) {
              showSuccessMessage('Pagamento confirmado!');
            }
          }
        }
      }
    } catch (error) {
      console.error('Erro ao monitorar pagamento:', error);
    }
  }, 10000); // Verifica a cada 10 segundos
  
  // Timeout de 10 minutos
  setTimeout(() => {
    clearInterval(interval);
  }, 600000);
}
```

---

## ❓ FAQ e Troubleshooting

### PIX

**Q: O QR Code não aparece. O que fazer?**
A: Verifique se `qrCodeImage` está presente na resposta. Se não estiver, use `brCode` para gerar QR Code localmente com uma biblioteca como `qrcode.js`.

**Q: Como saber quando o PIX foi pago?**
A: Use polling consultando `/api/cobranca/txid/:txid` a cada 5-10 segundos até o status mudar para `CONFIRMADA`.

**Q: O PIX expira?**
A: Sim, o padrão é 1 hora (3600 segundos). O tempo de expiração está em `expiracao` na resposta.

### Cartão de Crédito/Débito

**Q: O pop-up 3DS não abre. O que fazer?**
A: Verifique se pop-ups estão bloqueados no navegador. O pop-up é obrigatório para 3DS.

**Q: Como saber se o pagamento foi aprovado após 3DS?**
A: Após o pop-up fechar, consulte o status via `/api/cobranca/txid/:txid`. O status será `CONFIRMADA` se aprovado ou `NEGADA` se negado.

**Q: Posso usar iframe ao invés de pop-up para 3DS?**
A: Não. A e-Rede não suporta iframe em sandbox e recomenda pop-up em produção também.

**Q: O que significa "Cartão não passou na validação Zero Dollar"?**
A: O cartão foi rejeitado na validação prévia. Verifique com o banco emissor se o cartão está ativo e desbloqueado.

### Criptomoedas

**Q: Como o usuário paga com Stellar?**
A: O usuário pode:
1. Escanear o QR Code com uma carteira Stellar (Freighter, Lobstr, etc.)
2. Copiar o endereço e memo e enviar manualmente
3. Clicar no URI Stellar para abrir a carteira automaticamente

**Q: Preciso configurar algo na carteira para usar USDC?**
A: **Sim!** Para usar USDC na rede Stellar, você precisa configurar uma **trustline** antes de poder receber ou enviar USDC. 

**O que é trustline?** É uma permissão que sua conta Stellar concede para manter e transacionar o ativo USDC emitido pela Circle.

**Como configurar:**
1. Abra sua carteira Stellar (Freighter, Lobstr, Ledger Live, etc.)
2. Vá em "Assets" ou "Trustlines"
3. Clique em "Add Asset" ou "Add Trustline"
4. Busque por "USDC" ou insira manualmente:
   - **Asset Code**: `USDC`
   - **Issuer**: `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`
5. Confirme a criação da trustline
6. Verifique que USDC aparece na lista de ativos

**Importante:**
- Você precisa ter XLM na conta para criar a trustline (cerca de 0.5 XLM como reserva)
- Se tentar enviar USDC sem trustline configurada, a transação falhará
- XLM não requer trustline (é a moeda nativa)

Veja a seção [Configuração de Trustline para USDC](#-configuração-de-trustline-para-usdc) para instruções detalhadas.

**Q: Como detectar quando o pagamento foi feito?**
A: Duas opções:
1. **Automática**: Monitore a blockchain via Horizon API (exemplo acima)
2. **Manual**: Botão "Já paguei, verificar agora" que chama `/api/check-payment-by-memo`

**Q: O valor é obrigatório para CRIPTO?**
A: Não. Se não fornecido, o valor será obtido da blockchain quando o pagamento for confirmado.

**Q: Qual moeda usar: USDC ou XLM?**
A: USDC é mais estável (equivalente a USD). XLM é a moeda nativa da Stellar. Recomendamos USDC para doações, mas lembre-se que USDC requer trustline configurada, enquanto XLM não requer.

### Erros Comuns

**Q: Erro 403 (CORS)**
A: Verifique se o domínio do frontend está configurado em `ALLOWED_ORIGINS` no backend.

**Q: Erro 429 (Rate Limit)**
A: Aguarde alguns minutos antes de tentar novamente. O limite é 10 requisições por IP a cada 15 minutos para criação de cobrança.

**Q: Erro 500 (Erro Interno)**
A: Verifique os logs do backend. Pode ser problema de conexão com banco de dados ou API externa (e-Rede/Stellar).

**Q: TXID já existe (409)**
A: O TXID gerado já está em uso. Tente novamente (o backend gera um novo TXID automaticamente).

---

## 📞 Suporte

Para dúvidas ou problemas:

1. Verifique esta documentação
2. Consulte os logs do backend
3. Verifique a documentação da e-Rede: https://developer.userede.com.br/e-rede
4. Verifique a documentação Stellar: https://developers.stellar.org/

---

## 📝 Notas Importantes

### Segurança

- **Nunca** exponha credenciais (REDE_PV, REDE_TOKEN, STELLAR_SECRET_KEY) no frontend
- **Sempre** valide dados no frontend antes de enviar (mas o backend também valida)
- **Use HTTPS** em produção
- **Configure CORS** adequadamente em produção

### Performance

- **Polling**: Use intervalos de 5-10 segundos para não sobrecarregar o servidor
- **Timeout**: Implemente timeout para evitar polling infinito
- **Cache**: Cache o status da cobrança localmente para evitar requisições desnecessárias

### UX

- **Feedback visual**: Mostre claramente o status do pagamento
- **Mensagens de erro**: Exiba mensagens amigáveis ao usuário
- **Loading states**: Mostre indicadores de carregamento durante processamento
- **3DS pop-up**: Informe o usuário que um pop-up será aberto

---

**Última atualização**: Janeiro 2025
**Versão da API**: 1.0.0

