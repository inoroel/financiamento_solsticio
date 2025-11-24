# 📋 Variáveis de Ambiente Faltantes na Vercel

> **⚠️ ATUALIZADO**: Este documento foi atualizado para refletir a migração para e-Rede.  
> Variáveis do Itaú foram removidas.

## ✅ Já Configuradas (se aplicável)

- `POSTGRES_URL` ✅
- `POSTGRES_PRISMA_DATABASE_URL` ✅
- `POSTGRES_DATABASE_URL` ✅
- `NODE_ENV` ✅

## ❌ Faltando (Obrigatórias)

### 1. REDE_PV
**Tipo:** Ponto de Venda (PV)  
**Onde encontrar:** [Plataforma e-Rede](https://developer.userede.com.br/e-rede) → Sua conta → Credenciais  
**Exemplo de formato:**
```
REDE_PV=seu_pv_aqui
```

### 2. REDE_TOKEN
**Tipo:** Token de autenticação  
**Onde encontrar:** [Plataforma e-Rede](https://developer.userede.com.br/e-rede) → Sua conta → Credenciais  
**Exemplo de formato:**
```
REDE_TOKEN=seu_token_aqui
```

### 3. REDE_WEBHOOK_SECRET
**Tipo:** Secret (gere um novo)  
**Como gerar:**
```bash
openssl rand -hex 32
```
**Exemplo de formato:**
```
REDE_WEBHOOK_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```
**Importante:** Use o mesmo valor configurado na plataforma e-Rede para o webhook.

## ⚙️ Opcionais (Recomendadas)

### 4. REDE_ENVIRONMENT
**Tipo:** String  
**Descrição:** Ambiente da API e-Rede  
**Valores possíveis:**
- `sandbox` (padrão) - Ambiente de testes
- `production` - Ambiente de produção
**Exemplo:**
```
REDE_ENVIRONMENT=sandbox
```

### 5. REDE_API_BASE_URL
**Tipo:** URL  
**Descrição:** URL base da API e-Rede (opcional, detecta automaticamente)  
**Valor padrão (já configurado no código):**
- **Produção:** `https://api.userede.com.br/erede`
- **Sandbox:** `https://api.userede.com.br/desenvolvedores`
**Nota:** Só configure se precisar usar uma URL diferente

### 6. REDE_WEBHOOK_IP_WHITELIST
**Tipo:** String (separado por vírgula)  
**Descrição:** IPs permitidos para webhooks da e-Rede (opcional)  
**Exemplo:**
```
REDE_WEBHOOK_IP_WHITELIST=192.168.1.1,10.0.0.0/8
```
**Nota:** Se não configurado, valida apenas assinatura HMAC

### 7. ALLOWED_ORIGINS
**Tipo:** String (separado por vírgula)  
**Descrição:** Domínios permitidos para CORS (apenas do seu frontend)  
**⚠️ IMPORTANTE:** CORS NÃO afeta webhooks! Você NÃO precisa colocar endereços da e-Rede aqui.  
**Exemplo com um domínio:**
```
ALLOWED_ORIGINS=https://financiamentocoletivo.vercel.app
```
**Exemplo com múltiplos domínios:**
```
ALLOWED_ORIGINS=https://financiamentocoletivo.vercel.app,https://www.financiamentocoletivo.com
```
**Para desenvolvimento local (temporário):**
```
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```
**Nota:** 
- Em produção, defina os domínios do seu frontend
- Webhooks são protegidos por IP Whitelist (opcional) + Assinatura HMAC (não precisam de CORS)
- NÃO inclua endereços da e-Rede (ex: `api.userede.com.br`)

### 8. PORT
**Tipo:** Number  
**Descrição:** Porta do servidor (geralmente não necessário na Vercel)  
**Exemplo:**
```
PORT=3000
```
**Nota:** A Vercel define automaticamente, mas pode ser útil para logs

## 📝 Checklist de Configuração

### Obrigatórias
- [ ] `REDE_PV` - Obter da plataforma e-Rede
- [ ] `REDE_TOKEN` - Obter da plataforma e-Rede
- [ ] `REDE_WEBHOOK_SECRET` - Gerar com `openssl rand -hex 32`

### Opcionais (Recomendadas)
- [ ] `REDE_ENVIRONMENT=sandbox` - Para desenvolvimento (ou `production` para produção)
- [ ] `REDE_WEBHOOK_IP_WHITELIST` - IPs da e-Rede (opcional, mas recomendado em produção)
- [ ] `ALLOWED_ORIGINS` - Domínios do frontend
- [ ] `PORT=3000` - Opcional (Vercel gerencia)

## 🔐 Segurança

**IMPORTANTE:**
- ✅ `REDE_PV` e `REDE_TOKEN` são sensíveis - não compartilhe
- ✅ `REDE_WEBHOOK_SECRET` deve ser único e forte
- ✅ Configure `ALLOWED_ORIGINS` em produção para segurança CORS
- ✅ Configure `REDE_WEBHOOK_IP_WHITELIST` em produção para validar origem dos webhooks
- ✅ Use `REDE_ENVIRONMENT=production` apenas em produção

## 📚 Onde Encontrar as Credenciais

1. **REDE_PV e REDE_TOKEN:**
   - [Plataforma e-Rede](https://developer.userede.com.br/e-rede) → Sua conta → Credenciais
   - Ou no painel administrativo da e-Rede

2. **REDE_WEBHOOK_SECRET:**
   - Gere você mesmo: `openssl rand -hex 32`
   - Configure o mesmo valor na plataforma e-Rede → Configurações de Webhook

3. **REDE_WEBHOOK_IP_WHITELIST:**
   - Consulte a documentação da e-Rede para obter os IPs de origem dos webhooks
   - Ou entre em contato com o suporte da e-Rede

## 🔗 Links Úteis

- [Documentação e-Rede](https://developer.userede.com.br/e-rede)
- [Manual de Integração e-Rede](https://developer.userede.com.br/files/erede/integration_manual.pdf)

## 🚀 Próximos Passos (Binance Pay)

Quando implementar Binance Pay, adicione também:
- `BINANCE_PAY_API_KEY`
- `BINANCE_PAY_SECRET_KEY`
- `BINANCE_PAY_ENVIRONMENT`
- `BINANCE_PAY_WEBHOOK_SECRET`
