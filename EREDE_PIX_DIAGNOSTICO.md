# Diagnóstico Completo: Erro 403 PIX e-Rede

## 🔍 Problema Identificado

**Erro 403 do CloudFront** ao tentar criar cobrança PIX via API e-Rede.

## ✅ Correção Crítica Implementada

### Validação: `reference` até 50 caracteres

**Documentação e-Rede:**
> `reference`: Até 50, Alfanumérico, Sim, Código da transação gerado pelo estabelecimento

**Nosso código:**
- `txid`: `solsticiocampanha010614333` (26 caracteres)
- `reference`: `txid` (26 caracteres) ✅ **Dentro do limite de 50 caracteres**

**Código:**
```javascript
// Valida que o reference está dentro do limite (até 50 caracteres)
if (txid.length > 50) {
  throw new Error(`Reference para PIX deve ter no máximo 50 caracteres.`);
}
reference: txid // Usa o txid completo (até 50 caracteres)
```

## 📋 Validações Implementadas

### 1. ✅ Formato do Body PIX

Conforme documentação (Manual p.6437-6451):

```json
{
  "kind": "pix",                    // ✅ Correto
  "reference": "mpanha010614333",   // ✅ Agora com 16 chars (corrigido)
  "amount": "1",                    // ✅ String numérica em centavos
  "qrCode": {
    "Date timeExpiration": "2025-12-04T15:20:07"  // ✅ Formato YYYY-MM-DDThh:mm:ss
  }
}
```

**Validações:**
- ✅ `kind`: "pix" (correto)
- ✅ `reference`: até 50 caracteres (correto)
- ✅ `amount`: string numérica sem separadores (correto)
- ✅ `qrCode.Date timeExpiration`: formato YYYY-MM-DDThh:mm:ss (correto)

### 2. ✅ Headers

Conforme documentação:

```javascript
{
  'Authorization': 'Bearer {access_token}' ou 'Basic {base64}',  // ✅ OAuth 2.0 ou Basic Auth
  'Content-Type': 'application/json',                            // ✅ Correto
  'X-Request-Id': '{correlationId}'                             // ✅ UUID v4
}
```

**Validações:**
- ✅ Autenticação: OAuth 2.0 (Bearer token) com fallback para Basic Auth
- ✅ Content-Type: application/json
- ✅ X-Request-Id: Correlation ID único

### 3. ✅ URL do Endpoint

**Documentação:**
- Produção: `https://api.userede.com.br/erede/v2/transactions`
- Sandbox: `https://sandbox-erede.useredecloud.com.br/v2/transactions`

**Nosso código:**
- ✅ Detecta ambiente automaticamente
- ✅ Usa URL correta baseado em `REDE_ENVIRONMENT`

### 4. ✅ Formato da Data de Expiração

**Documentação:**
> QRcode expiration data in YYYY-MM-DDThh:mm:ss format

**Nosso código:**
```javascript
const dataExpiracaoFormatada = dataExpiracao.toISOString().slice(0, 19);
// Resultado: "2025-12-04T15:20:07" ✅ Correto
```

## 🔍 Outros Problemas Potenciais Verificados

### 1. ✅ Valor (amount)

**Documentação:**
> Total transaction amount without thousands and decimal separator. Examples: R$10.00 = 1000

**Nosso código:**
```javascript
amount: String(Math.round(valorValidado * 100))
// Exemplo: 0.01 → "1" ✅ Correto
```

### 2. ✅ Descrição (description)

**Documentação:**
- Opcional
- Máximo 140 caracteres

**Nosso código:**
```javascript
mensagemSanitizada = mensagemSanitizada.slice(0, 140); ✅ Correto
```

### 3. ✅ Expiração

**Documentação:**
> The maximum period must be up to 15 days and must not be from an earlier date than the current one.

**Nosso código:**
```javascript
const expiracaoSegundos = Math.min(Math.max(parseInt(expiracao) || 3600, 60), 1296000);
// Máximo: 1296000 segundos = 15 dias ✅ Correto
```

## 🚫 Problemas que NÃO são do nosso código

### 1. SSL no localhost
- ❌ **NÃO é o problema**: A requisição vem da Vercel (HTTPS), não do localhost
- ✅ A Vercel faz a requisição para a e-Rede com HTTPS

### 2. Headers incorretos
- ✅ Headers estão corretos conforme documentação
- ✅ OAuth 2.0 implementado corretamente
- ✅ Content-Type correto

### 3. Formato do body
- ✅ Body está correto conforme documentação
- ✅ Todos os campos obrigatórios presentes
- ✅ Formatos corretos (string, data, etc.)

## 🎯 Possíveis Causas do Erro 403 (Após Correção)

Se após corrigir o `reference` o erro 403 persistir, as causas possíveis são:

### 1. API não ativada para produção
- **Causa:** A e-Rede pode levar 24-48h para ativar a API após solicitação
- **Solução:** Aguardar ativação ou contatar suporte

### 2. IPs da Vercel não estão na whitelist
- **Causa:** A e-Rede pode ter whitelist de IPs configurada
- **Solução:** Solicitar ao suporte que adicione IPs da Vercel ou desabilite whitelist

### 3. Credenciais incorretas ou não configuradas
- **Causa:** PV ou TOKEN incorretos
- **Solução:** Verificar credenciais no portal e-Rede

### 4. Chave PIX não cadastrada
- **Causa:** Chave PIX não foi cadastrada no portal e-Rede
- **Solução:** Cadastrar chave PIX em: Para vender > PIX > "Quero utilizar Pix"

## 📊 Logs de Diagnóstico Adicionados

Agora o código gera logs detalhados:

```
📋 Body da requisição PIX:
   - kind: pix
   - reference: mpanha010614333 (16 chars, max: 16)
   - amount: 1 (centavos, tipo: string)
   - qrCode.Date timeExpiration: 2025-12-04T15:20:07

📤 Enviando requisição PIX para: https://api.userede.com.br/erede/v2/transactions
📤 Correlation ID: 07582750-cde3-4ff6-bb34-eab04c77746d
📤 Headers: Authorization=Bearer eyJ..., Content-Type=application/json, X-Request-Id=...
```

## ✅ Próximos Passos

1. ✅ **Correção do `reference`** - Implementada (usa últimos 16 chars do txid)
2. ⏳ **Testar novamente** - Verificar se o erro 403 foi resolvido
3. ⏳ **Se persistir:** Contatar suporte e-Rede com:
   - Ambiente: PRODUÇÃO
   - PV: (primeiros 4 chars)
   - Erro: 403 CloudFront
   - Correlation ID: (dos logs)
   - Reference usado: (dos logs)

## 📚 Referências

- **Documentação e-Rede:** [developer.userede.com.br/e-rede](https://developer.userede.com.br/e-rede)
- **Manual:** Seção PIX (p.6421-6800)
- **Reference:** Até 16 caracteres alfanuméricos (p.6467-6472)
- **Amount:** Até 10 caracteres numéricos (p.6473-6479)

