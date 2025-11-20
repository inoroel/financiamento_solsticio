# 🚀 Deploy na Vercel - Guia Completo

Este guia te ajudará a fazer o deploy do backend na Vercel e configurar tudo corretamente.

## 📋 Pré-requisitos

1. Conta na [Vercel](https://vercel.com)
2. Conta no [Portal Developers Itaú](https://devportal.itau.com.br) (já configurada)
3. Git instalado e repositório configurado

## 🔧 Passo 1: Preparar o Código

O código já está preparado para Vercel! Os arquivos necessários estão criados:

- ✅ `vercel.json` - Configuração do Vercel
- ✅ `server.js` - Servidor Express
- ✅ Código compatível com Vercel Postgres

## 📦 Passo 2: Conectar Repositório na Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login
2. Clique em **"Add New Project"**
3. Conecte seu repositório Git (GitHub, GitLab ou Bitbucket)
4. Selecione o repositório `financiamento_solsticio`

## ⚙️ Passo 3: Configurar Variáveis de Ambiente

Na tela de configuração do projeto, adicione as seguintes variáveis de ambiente:

### Itaú

```
ITAU_CLIENT_ID=seu_client_id_aqui
ITAU_CLIENT_SECRET=seu_client_secret_aqui
ITAU_API_KEY=seu_api_key_uuid_aqui
ITAU_CHAVE_PIX=sua_chave_pix_aqui
```

**Nota**: Obtenha essas credenciais no [Portal Developers Itaú](https://devportal.itau.com.br)

**URLs padrão** (já configuradas no código, mas podem ser sobrescritas):
```
ITAU_AUTH_URL=https://oauthd.itau/identity/connect/token
ITAU_API_BASE_URL=https://secure.api.itau/pix_recebimentos_conciliacoes_v2_ext/v2
```

### Segurança

```
NODE_ENV=production
WEBHOOK_SECRET=seu_secret_forte_aqui
ALLOWED_ORIGINS=https://seu-dominio-frontend.com
```

**Importante**:

- Gere um `WEBHOOK_SECRET` forte: `openssl rand -hex 32`
- Configure `ALLOWED_ORIGINS` com o domínio do seu frontend (separado por vírgula se houver múltiplos)

### Porta (opcional)

```
PORT=3000
```

A Vercel define automaticamente, mas pode ser útil para logs.

## 🗄️ Passo 4: Configurar Vercel Postgres

1. No dashboard do projeto Vercel, vá em **"Storage"**
2. Clique em **"Create Database"**
3. Selecione **"Postgres"**
4. Escolha o plano (Free tier disponível)
5. Dê um nome ao banco (ex: `financiamento-solsticio`)
6. Clique em **"Create"**

A Vercel configurará automaticamente as variáveis:

- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`

**Não precisa configurar manualmente!** A Vercel faz isso automaticamente.

## 🚀 Passo 5: Fazer o Deploy

1. Clique em **"Deploy"**
2. Aguarde o build completar (2-3 minutos)
3. Quando concluir, você terá uma URL: `https://seu-projeto.vercel.app`

## ✅ Passo 6: Verificar Deploy

### Teste Health Check

```bash
curl https://seu-projeto.vercel.app/health
```

Deve retornar:

```json
{
  "status": "healthy",
  "timestamp": "...",
  "database": "connected"
}
```

### Teste Criar Cobrança

```bash
curl -X POST https://seu-projeto.vercel.app/api/gerar-pix \
  -H "Content-Type: application/json" \
  -d '{
    "valor": 10.50,
    "cid": "01",
    "doador": {
      "nome": "Teste",
      "whatsapp": "5511999999999",
      "anonimo": false
    }
  }'
```

## 🔗 Passo 7: Configurar Webhook no Portal Itaú

1. Acesse o [Portal Developers Itaú](https://devportal.itau.com.br)
2. Vá em **"Minhas Aplicações"** → Sua aplicação
3. Configure o webhook:
   - **URL**: `https://seu-projeto.vercel.app/api/webhook/pix`
   - **Método**: POST
   - **Secret**: O mesmo valor de `WEBHOOK_SECRET` configurado na Vercel

## 📊 Passo 8: Monitorar Logs

Na Vercel, você pode ver os logs em tempo real:

1. Vá em **"Deployments"**
2. Clique no deployment mais recente
3. Aba **"Functions"** → `server.js`
4. Veja os logs em tempo real

## 🔍 Troubleshooting

### Erro: "Cannot find module '@vercel/postgres'"

- Verifique se `package.json` tem a dependência
- A Vercel instala automaticamente, mas pode precisar de rebuild

### Erro: "Database connection failed"

- Verifique se o Vercel Postgres está criado
- Verifique se as variáveis `POSTGRES_URL` estão configuradas (devem ser automáticas)
- Veja os logs para mais detalhes

### Erro: "WEBHOOK_SECRET not configured"

- Configure a variável `WEBHOOK_SECRET` nas configurações do projeto
- Em produção, isso é obrigatório

### Webhook não funciona

- Verifique se a URL está correta: `https://seu-projeto.vercel.app/api/webhook/pix`
- Verifique se o `WEBHOOK_SECRET` está configurado no Portal Itaú e na Vercel
- Veja os logs da Vercel para erros

### CORS bloqueando requisições

- Configure `ALLOWED_ORIGINS` com o domínio do frontend
- Em desenvolvimento, pode deixar vazio (mas não recomendado)

## 📝 Checklist de Deploy

- [ ] Código commitado e pushado no Git
- [ ] Projeto criado na Vercel
- [ ] Variáveis de ambiente configuradas
- [ ] Vercel Postgres criado
- [ ] Deploy realizado com sucesso
- [ ] Health check funcionando
- [ ] Teste de criação de cobrança funcionando
- [ ] Webhook configurado no Portal Itaú
- [ ] Logs sendo monitorados

## 🔄 Atualizações Futuras

Para atualizar o código:

1. Faça commit e push das mudanças
2. A Vercel detecta automaticamente e faz novo deploy
3. Ou faça deploy manual: `vercel --prod`

## 🛠️ Comandos Úteis

### Instalar Vercel CLI (opcional)

```bash
npm i -g vercel
```

### Deploy manual via CLI

```bash
vercel
```

### Ver logs via CLI

```bash
vercel logs
```

### Ver variáveis de ambiente

```bash
vercel env ls
```

## 📚 Próximos Passos

Após o deploy bem-sucedido:

1. ✅ Teste todos os endpoints
2. ✅ Configure o webhook no Portal Itaú
3. ✅ Teste o webhook com uma transação real
4. ✅ Monitore os logs
5. ✅ Integre com o frontend Svelte

## 🔐 Segurança em Produção

Lembre-se:

- ✅ `WEBHOOK_SECRET` configurado e forte
- ✅ `ALLOWED_ORIGINS` configurado com domínios permitidos
- ✅ `NODE_ENV=production`
- ✅ Logs não expõem dados sensíveis
- ✅ Rate limiting ativo
- ✅ Headers de segurança (Helmet) ativos
