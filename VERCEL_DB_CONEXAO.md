# 🔧 Corrigir Conexão com Banco de Dados na Vercel

## ✅ Status Atual
- ✅ Endpoints funcionando (`/health` responde)
- ❌ Banco de dados desconectado (`"database":"disconnected"`)

## 🔍 Diagnóstico

O erro `"database":"disconnected"` significa que:
1. As variáveis de ambiente do banco não estão configuradas, OU
2. O banco não foi criado na Vercel, OU
3. O banco foi criado mas as tabelas não foram inicializadas

## 📋 Passo a Passo para Corrigir

### 1. Verificar se o Banco Existe na Vercel

1. Acesse: https://vercel.com/dashboard
2. Selecione o projeto `financiamentocoletivo`
3. Vá em **Storage** (ou **Databases**)
4. Verifique se existe um banco Postgres criado

**Se NÃO existir:**
- Clique em **Create Database**
- Escolha **Postgres** (ou **Neon**, **Supabase**)
- Escolha o plano (Free funciona)
- Dê um nome: `financiamento-solsticio`
- Finalize a criação

### 2. Verificar Variáveis de Ambiente

1. No projeto na Vercel, vá em **Settings** → **Environment Variables**
2. Verifique se existem estas variáveis (a Vercel cria automaticamente ao criar o banco):
   - `POSTGRES_URL`
   - `POSTGRES_PRISMA_URL` (opcional)
   - `POSTGRES_URL_NON_POOLING` (opcional)

**Se NÃO existirem:**
- A Vercel cria automaticamente ao criar o banco
- Se não apareceram, recrie o banco ou verifique se está vinculado ao projeto

### 3. Inicializar o Banco (Criar Tabelas)

Após criar o banco e verificar as variáveis, você precisa executar o script de inicialização.

#### Opção A: Via Vercel SQL Editor (Recomendado)

1. No projeto na Vercel, vá em **Storage** → Selecione o banco
2. Clique em **SQL Editor** (ou **Query**)
3. Abra o arquivo `scripts/init-db.sql` do projeto
4. Copie TODO o conteúdo do arquivo
5. Cole no SQL Editor da Vercel
6. Execute (botão **Run** ou **Execute**)

#### Opção B: Via Script Local (se tiver acesso ao banco)

```bash
# No terminal local
npm run init-db
```

**Nota:** Isso só funciona se você tiver `POSTGRES_URL` configurado localmente apontando para o banco da Vercel.

#### Opção C: Via Vercel CLI

```bash
# Instalar Vercel CLI (se não tiver)
npm i -g vercel

# Fazer login
vercel login

# Linkar ao projeto
vercel link

# Executar script (se disponível)
vercel env pull .env.local
# Depois executar o script localmente
```

### 4. Verificar Conexão

Após inicializar o banco, teste novamente:

```bash
curl https://financiamentocoletivo.vercel.app/health
```

**Deve retornar:**
```json
{
  "status": "healthy",
  "timestamp": "...",
  "database": "connected"
}
```

## 🔄 Se Ainda Não Funcionar

### Verificar Logs do Deploy

1. Na Vercel, vá em **Deployments**
2. Clique no último deploy
3. Veja os **Build Logs**
4. Procure por erros relacionados a:
   - `POSTGRES_URL`
   - `@vercel/postgres`
   - `database connection`

### Verificar Variáveis de Ambiente no Deploy

1. No deploy, vá em **Settings** → **Environment Variables**
2. Verifique se as variáveis estão configuradas para **Production**
3. Se não estiverem, adicione:
   - `POSTGRES_URL` → valor do banco criado
   - `NODE_ENV` → `production`

### Testar Conexão Manualmente

Crie um endpoint de teste temporário:

```javascript
// Adicione em server.js (temporariamente)
app.get('/test-db', async (req, res) => {
  try {
    const { sql } = require('./config/database');
    const result = await sql`SELECT NOW() as current_time`;
    res.json({ 
      success: true, 
      time: result.rows[0].current_time,
      env: {
        hasPostgresUrl: !!process.env.POSTGRES_URL,
        postgresUrlLength: process.env.POSTGRES_URL?.length || 0
      }
    });
  } catch (error) {
    res.json({ 
      success: false, 
      error: error.message,
      env: {
        hasPostgresUrl: !!process.env.POSTGRES_URL,
        postgresUrlLength: process.env.POSTGRES_URL?.length || 0
      }
    });
  }
});
```

Depois teste:
```bash
curl https://financiamentocoletivo.vercel.app/test-db
```

## ✅ Checklist Final

- [ ] Banco Postgres criado na Vercel
- [ ] Variáveis `POSTGRES_URL` configuradas (automático ao criar banco)
- [ ] Tabelas criadas (executou `init-db.sql`)
- [ ] `/health` retorna `"database":"connected"`
- [ ] Endpoints de pagamento funcionando

## 🆘 Ainda com Problemas?

Se após seguir todos os passos ainda não funcionar:

1. **Verifique os logs do deploy** na Vercel
2. **Teste o endpoint `/test-db`** (se criou)
3. **Verifique se o banco está ativo** na dashboard da Vercel
4. **Tente recriar o banco** (último recurso)

