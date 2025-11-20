# 🌐 CORS e Webhooks - Explicação

## ❌ ALLOWED_ORIGINS NÃO Afeta Webhooks

**Resposta direta:** `ALLOWED_ORIGINS` **NÃO afeta** a resposta do webhook. Você **NÃO precisa** colocar os endereços do Itaú.

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
Itaú (Servidor) → Vercel (Servidor)
     ↓
NÃO passa pelo navegador
     ↓
CORS NÃO se aplica
```

## ✅ O que Protege o Webhook?

### 1. Validação mTLS (Certificado do Cliente)
- ✅ Valida que o certificado pertence ao Itaú (se configurado)
- ✅ Implementado em `services/webhookService.js` (validação mTLS configurável)
- ✅ Garante que apenas o Itaú pode acessar (quando habilitado)

### 2. Validação de Assinatura (HMAC)
- ✅ Valida assinatura do webhook com `WEBHOOK_SECRET`
- ✅ Implementado em `services/webhookService.js`
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
fetch('https://api.vercel.app/api/gerar-pix', {
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
- ❌ `secure.api.itau` (não é necessário)
- ❌ `oauthd.itau` (não é necessário)
- ❌ Qualquer endereço do Itaú (não é necessário)

### Proteção do Webhook (Separada)

```bash
# Validação mTLS (certificado do Itaú - se necessário)
ITAU_REQUIRE_CLIENT_CERT=true

# Validação de assinatura
WEBHOOK_SECRET=seu_secret_forte_aqui
```

## 📊 Resumo

| Tipo de Requisição | CORS Aplica? | Proteção Usada |
|-------------------|--------------|----------------|
| Frontend → Backend | ✅ Sim | `ALLOWED_ORIGINS` |
| Itaú → Webhook | ❌ Não | mTLS + Assinatura HMAC |

## ✅ Conclusão

1. **ALLOWED_ORIGINS** = Apenas domínios do seu frontend
2. **Webhook** = Protegido por mTLS (se configurado) + Assinatura HMAC (não precisa de CORS)
3. **Itaú não precisa** estar em `ALLOWED_ORIGINS`

## 🔧 Configuração Recomendada

```bash
# Para o seu frontend
ALLOWED_ORIGINS=https://financiamentocoletivo.vercel.app

# Para webhook (separado)
ITAU_REQUIRE_CLIENT_CERT=true  # Opcional, configure conforme documentação do Itaú
WEBHOOK_SECRET=seu_secret_forte_aqui
```

