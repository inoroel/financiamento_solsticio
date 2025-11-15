# 🚀 Deploy Rápido na Vercel

Guia objetivo para fazer deploy do backend na Vercel em 5 minutos.

## ✅ Passo 1: Conectar Repositório

1. Acesse [vercel.com](https://vercel.com) e faça login
2. Clique em **"Add New Project"**
3. Conecte seu repositório Git
4. Selecione o repositório `financiamento_solsticio`

## ⚙️ Passo 2: Configurar Variáveis de Ambiente

Na tela de configuração, adicione estas variáveis (Settings → Environment Variables):

### Obrigatórias:
```
BB_CLIENT_ID=eyJpZCI6IjAzIiwiY29kaWdvUHVibGljYWRvciI6MCwiY29kaWdvU29mdHdhcmUiOjE2MDMzMSwic2VxdWVuY2lhbEluc3RhbGFjYW8iOjF9

BB_CLIENT_SECRET=eyJpZCI6ImZkNTZlZWQtNDVjMi00N2Y1LTgzY2QiLCJjb2RpZ29QdWJsaWNhZG9yIjowLCJjb2RpZ29Tb2Z0d2FyZSI6MTYwMzMxLCJzZXF1ZW5jaWFsSW5zdGFsYWNhbyI6MSwic2VxdWVuY2lhbENyZWRlbmNpYWwiOjEsImFtYmllbnRlIjoiaG9tb2xvZ2FjYW8iLCJpYXQiOjE3NjI4NzU5NjcxODh9

BB_DEV_APP_KEY=f20c4119840240ddb677505713b9be80

BB_CHAVE_PIX=solsticiodosom@gmail.com.br

BB_AUTH_URL=https://oauth.bb.com.br/oauth/token

BB_API_BASE_URL=https://api.bb.com.br

NODE_ENV=production

WEBHOOK_SECRET=seu_secret_forte_aqui
```

**Importante**: Gere um `WEBHOOK_SECRET` forte:
```bash
openssl rand -hex 32
```

### Opcionais (configure depois se necessário):
```
ALLOWED_ORIGINS=https://seu-frontend.com
```

## 🗄️ Passo 3: Criar Vercel Postgres

1. No dashboard do projeto, vá em **"Storage"**
2. Clique em **"Create Database"**
3. Selecione **"Postgres"**
4. Escolha o plano **Free**
5. Dê um nome: `financiamento-solsticio`
6. Clique em **"Create"**

✅ A Vercel configura automaticamente:
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`

**Não precisa configurar manualmente!**

## 🚀 Passo 4: Deploy

1. Clique em **"Deploy"**
2. Aguarde 2-3 minutos
3. ✅ Pronto! Você terá uma URL: `https://seu-projeto.vercel.app`

## 🧪 Passo 5: Testar

### No Frontend Local:

1. Abra `public/index.html` no navegador
2. No topo, selecione **"Vercel (Produção)"**
3. Digite a URL do seu projeto: `https://seu-projeto.vercel.app`
4. Clique em **"Testar Conexão"**
5. Deve mostrar: ✅ Conectado!

### Teste Direto:

```bash
curl https://seu-projeto.vercel.app/health
```

Deve retornar:
```json
{
  "status": "healthy",
  "database": "connected"
}
```

## 🔗 Passo 6: Configurar Webhook no Portal BB

1. Acesse [Portal Developers BB](https://developers.bb.com.br)
2. Vá em **"Minhas Aplicações"** → Sua aplicação
3. Configure webhook:
   - **URL**: `https://seu-projeto.vercel.app/api/webhook/pix`
   - **Secret**: O mesmo valor de `WEBHOOK_SECRET` configurado na Vercel

## 📝 Checklist Final

- [ ] Variáveis de ambiente configuradas
- [ ] Vercel Postgres criado
- [ ] Deploy realizado com sucesso
- [ ] Health check funcionando
- [ ] Frontend local conectado à Vercel
- [ ] Webhook configurado no Portal BB

## 🐛 Problemas Comuns

**Erro: "Database connection failed"**
- Aguarde alguns segundos após criar o Postgres
- Faça um novo deploy

**Erro: "WEBHOOK_SECRET not configured"**
- Configure a variável `WEBHOOK_SECRET` na Vercel

**CORS bloqueando**
- Configure `ALLOWED_ORIGINS` com o domínio do frontend
- Ou deixe vazio temporariamente para testes

## 🎉 Pronto!

Agora você pode:
- ✅ Testar o backend na Vercel usando o frontend local
- ✅ Verificar se tudo funciona antes de entregar para o designer
- ✅ Configurar o webhook e testar pagamentos reais

