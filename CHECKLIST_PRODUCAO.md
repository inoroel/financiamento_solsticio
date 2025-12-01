# ✅ Checklist de Produção - Financiamento Solstício

Este documento lista todas as configurações necessárias para colocar o sistema em produção na Vercel.

## 🔐 Variáveis de Ambiente Obrigatórias

### e-Rede (Obrigatórias)

- [ ] **REDE_PV** - Ponto de Venda da e-Rede
  - Onde obter: https://developer.userede.com.br/e-rede → Sua conta → Credenciais
  
- [ ] **REDE_TOKEN** - Token de autenticação da e-Rede
  - Onde obter: https://developer.userede.com.br/e-rede → Sua conta → Credenciais
  
- [ ] **REDE_WEBHOOK_SECRET** - Secret para validação de webhooks (OPCIONAL)
  - Como gerar: `openssl rand -hex 32`
  - ⚠️ NOTA: A e-Rede NÃO permite configurar secret no portal de webhooks
  - ⚠️ Este secret só será usado se a e-Rede enviar assinatura no header (pode não acontecer)
  - ⚠️ A segurança principal é via IP Whitelist (REDE_WEBHOOK_IP_WHITELIST)
  
- [ ] **REDE_ENVIRONMENT** - Ambiente da API
  - Valor: `production` (não use `sandbox` em produção!)

### Banco de Dados (Configurado Automaticamente pela Vercel)

- [x] **POSTGRES_URL** - Configurado automaticamente ao criar o banco na Vercel
- [x] **POSTGRES_PRISMA_URL** - Configurado automaticamente
- [x] **POSTGRES_URL_NON_POOLING** - Configurado automaticamente

### Servidor

- [ ] **NODE_ENV** - Ambiente Node.js
  - Valor: `production`

- [ ] **ALLOWED_ORIGINS** - Domínios permitidos para CORS
  - Exemplo: `https://seu-dominio.com,https://www.seu-dominio.com`
  - ⚠️ Configure apenas os domínios do seu frontend
  - ⚠️ NÃO inclua endereços da e-Rede ou Stellar

### Stellar (Obrigatórias para Pagamentos Cripto)

- [ ] **STELLAR_SECRET_KEY** - Chave secreta da conta Stellar que receberá pagamentos
- [ ] **STELLAR_NETWORK** - `public` para produção (ou `testnet` para testes)
- [ ] **STELLAR_WEBHOOK_SECRET** - Secret para webhooks (gerar com `openssl rand -hex 32`)

## 🔒 Variáveis de Ambiente Opcionais (Recomendadas)

- [ ] **REDE_WEBHOOK_IP_WHITELIST** - IPs permitidos para webhooks (RECOMENDADO EM PRODUÇÃO)
  - ⚠️ PRINCIPAL MÉTODO DE SEGURANÇA (a e-Rede não permite configurar secret no portal)
  - Exemplo: `192.168.1.1,10.0.0.0/8`
  - Consulte a documentação da e-Rede para obter os IPs de origem dos webhooks
  - Se não configurado, webhooks de qualquer IP serão aceitos (apenas em desenvolvimento)

- [ ] **PORT** - Porta do servidor (opcional, Vercel define automaticamente)

## 🗄️ Configuração do Banco de Dados

### 1. Criar Banco na Vercel

1. Acesse o dashboard do projeto na Vercel
2. Vá em **Storage** → **Create Database**
3. Escolha **Postgres** (ou Prisma Postgres, Neon, Supabase)
4. Escolha o plano **Free** (se disponível)
5. Dê um nome: `financiamento-solsticio`
6. Finalize a criação

✅ A Vercel configura automaticamente:
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`

### 2. Executar Script de Inicialização

Execute o script de inicialização do banco:

```bash
npm run init-db
```

Ou manualmente:

```bash
node scripts/executar-init-db.js
```

### 3. Verificar Schema

O banco será criado do zero com o schema correto. Não são necessárias migrações.

### 4. Verificar Schema

Verifique se o schema está correto:

```bash
npm run verificar-vercel
```

## 🌐 Configuração de Webhooks

### e-Rede

1. Acesse a plataforma e-Rede → Configurações de Webhook / Criar Notificação Automática
2. Configure a URL do webhook: `https://seu-projeto.vercel.app/api/webhook/pagamento`
3. ⚠️ NOTA: A e-Rede NÃO permite configurar secret no portal
4. ⚠️ Configure o tipo de evento (ex: "Estorno", "Pagamento confirmado", etc.)
5. ⚠️ Configure `REDE_WEBHOOK_IP_WHITELIST` com os IPs da e-Rede (principal método de segurança)
4. (Opcional) Configure IP Whitelist se disponível

### Stellar

Stellar não requer configuração de webhook externa. O sistema usa detecção via frontend (SSE) e verificação manual por memo.

## 🚀 Deploy na Vercel

### 1. Conectar Repositório

1. Acesse [vercel.com](https://vercel.com) e faça login
2. Clique em **"Add New Project"**
3. Conecte seu repositório Git
4. Selecione o repositório `financiamento_solsticio`

### 2. Configurar Variáveis de Ambiente

Na tela de configuração do projeto, adicione todas as variáveis listadas acima.

**Dica**: Você pode adicionar variáveis depois do deploy em **Settings** → **Environment Variables**.

### 3. Deploy

1. Clique em **"Deploy"**
2. Aguarde 2-3 minutos
3. ✅ Pronto! Você terá uma URL: `https://seu-projeto.vercel.app`

## ✅ Verificações Pós-Deploy

### 1. Health Check

Teste o endpoint de health check:

```bash
curl https://seu-projeto.vercel.app/health
```

Deve retornar:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "database": "connected"
}
```

### 2. Testar Criação de Cobrança PIX

```bash
curl -X POST https://seu-projeto.vercel.app/api/gerar-pagamento \
  -H "Content-Type: application/json" \
  -d '{
    "valor": 10.00,
    "tipo_pagamento": "PIX"
  }'
```

### 3. Verificar Logs

Acesse **Vercel Dashboard** → **Deployments** → **Functions** → **Logs** para verificar se há erros.

## 🔍 Troubleshooting

### Banco de Dados Não Conecta

- Verifique se `POSTGRES_URL` está configurado na Vercel
- Execute `npm run verificar-vercel` localmente (com `POSTGRES_URL` da Vercel no `.env`)

### Webhooks Não Funcionam

- Verifique se `REDE_WEBHOOK_SECRET` está configurado corretamente
- Verifique se a URL do webhook está correta na plataforma e-Rede
- Verifique os logs da Vercel para ver erros de validação

### CORS Errors

- Verifique se `ALLOWED_ORIGINS` está configurado com os domínios corretos do frontend
- Não inclua endereços da e-Rede ou Stellar no `ALLOWED_ORIGINS`

## 📚 Documentação Adicional

- `env.template` - Template completo de variáveis de ambiente
- `STELLAR_FRONTEND_DETECTION.md` - Guia de detecção de pagamentos Stellar
- `STELLAR_WEBHOOK_FLUXO.md` - Fluxo completo de pagamentos Stellar
- `SECURITY.md` - Boas práticas de segurança

## 🎯 Resumo Rápido

1. ✅ Criar banco na Vercel (Storage → Create Database)
2. ✅ Configurar variáveis de ambiente (Settings → Environment Variables)
3. ✅ Executar `npm run init-db` (ou `node scripts/executar-init-db.js`)
4. ✅ Configurar webhooks na plataforma e-Rede
5. ✅ Fazer deploy
6. ✅ Testar endpoints e verificar logs

---

**Última atualização**: 2025-01-15
**Status**: ✅ Pronto para produção (e-Rede + Stellar implementados)

