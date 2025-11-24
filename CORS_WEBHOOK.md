# 🌐 CORS e Webhooks - Explicação

## ❌ ALLOWED_ORIGINS NÃO Afeta Webhooks

**Resposta direta:** `ALLOWED_ORIGINS` **NÃO afeta** a resposta do webhook. Você **NÃO precisa** colocar os endereços dos provedores de pagamento (e-Rede, Binance Pay, etc).

## 🔍 Por Quê?

### CORS é para Navegadores (Browsers)

CORS (Cross-Origin Resource Sharing) é um mecanismo de segurança do **navegador** que controla quais origens podem fazer requisições de um site para outro.

```
Frontend (Navegador) → Backend API
     ↓
CORS verifica se a origem do frontend está em ALLOWED_ORIGINS
     ↓
Se permitido: requisição passa
Se não: navegador bloqueia
```

### Webhooks são Servidor-para-Servidor

Webhooks são requisições **servidor-para-servidor**, não passam pelo navegador:

```
e-Rede/Binance Pay (Servidor) → Vercel (Servidor)
     ↓
NÃO passa pelo navegador
     ↓
CORS NÃO se aplica
```

## ✅ O que Protege o Webhook?

### 1. Validação de IP Whitelist (Opcional)
- ✅ Valida que o IP pertence à whitelist configurada
- ✅ Implementado em `services/redeWebhookService.js`
- ✅ Garante que apenas IPs autorizados podem acessar

### 2. Validação de Assinatura (HMAC)
- ✅ Valida assinatura do webhook com `REDE_WEBHOOK_SECRET` (e-Rede)
- ✅ Implementado em `services/redeWebhookService.js`
- ✅ Garante integridade dos dados

### 3. Rate Limiting
- ✅ Limita requisições por IP
- ✅ Previne ataques de força bruta

## 📋 O que ALLOWED_ORIGINS Faz?

`ALLOWED_ORIGINS` controla apenas requisições do **seu frontend** para o backend:

### Exemplo de Uso

**Frontend em:** `https://meu-site.com`

**Backend em:** `https://api.vercel.app`

Quando o frontend faz uma requisição:
```javascript
// No navegador
fetch('https://api.vercel.app/api/gerar-pagamento', {
  method: 'POST',
  // ...
})
```

O navegador verifica:
- ✅ Origem: `https://meu-site.com`
- ✅ Permitido em `ALLOWED_ORIGINS`? → Se sim, permite
- ❌ Não permitido? → Navegador bloqueia

## 🔐 Configuração Correta

### ALLOWED_ORIGINS (Apenas Frontend)

```bash
# Domínios do SEU frontend
ALLOWED_ORIGINS=https://meu-site.com,https://www.meu-site.com
```

**NÃO inclua:**
- ❌ `api.userede.com.br` (não é necessário)
- ❌ `bpay.binanceapi.com` (não é necessário)
- ❌ Qualquer endereço dos provedores de pagamento (não é necessário)

### Proteção do Webhook (Separada)

```bash
# Validação de IP (opcional - e-Rede)
REDE_WEBHOOK_IP_WHITELIST=192.168.1.1,10.0.0.0/8

# Validação de assinatura (e-Rede)
REDE_WEBHOOK_SECRET=seu_secret_forte_aqui

# Validação de assinatura (Binance Pay - quando implementado)
BINANCE_PAY_WEBHOOK_SECRET=seu_secret_forte_aqui
```

## 📊 Resumo

| Tipo de Requisição | CORS Aplica? | Proteção Usada |
|-------------------|--------------|----------------|
| Frontend → Backend | ✅ Sim | `ALLOWED_ORIGINS` |
| e-Rede → Webhook | ❌ Não | IP Whitelist + Assinatura HMAC |
| Binance Pay → Webhook | ❌ Não | Assinatura HMAC |

## ✅ Conclusão

1. **ALLOWED_ORIGINS** = Apenas domínios do seu frontend
2. **Webhook** = Protegido por IP Whitelist (opcional) + Assinatura HMAC (não precisa de CORS)
3. **Provedores de pagamento não precisam** estar em `ALLOWED_ORIGINS`

## 🔧 Configuração Recomendada

```bash
# Para o seu frontend
ALLOWED_ORIGINS=https://financiamentocoletivo.vercel.app

# Para webhook (separado)
REDE_WEBHOOK_SECRET=seu_secret_forte_aqui  # e-Rede
REDE_WEBHOOK_IP_WHITELIST=192.168.1.1  # Opcional - IPs da e-Rede
```

