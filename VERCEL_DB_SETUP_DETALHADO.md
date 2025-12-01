# 🗄️ Guia Detalhado: Configurar Banco na Vercel (Passo a Passo)

## 📍 Passo 1: Criar o Banco de Dados

1. Acesse [vercel.com/dashboard](https://vercel.com/dashboard)
2. Selecione seu projeto `financiamento_solsticio`
3. No menu lateral, clique em **Storage**
4. Clique no botão **Create Database** (ou **+ Create** se já houver outros bancos)
5. Selecione **Postgres**
6. Escolha:
   - **Plano**: Hobby (gratuito) ou Pro (pago)
   - **Região**: Escolha a mais próxima (ex: `São Paulo` ou `US East`)
   - **Nome**: `financiamento_solsticio_db` (ou qualquer nome)
7. Clique em **Create**

## 📋 Passo 2: ONDE Encontrar as Variáveis de Ambiente

**IMPORTANTE**: A Vercel adiciona as variáveis automaticamente, mas você precisa verificar se estão configuradas.

### Opção A: Após Criar o Banco (Tela de Confirmação)

Quando você cria o banco, a Vercel mostra uma tela com:
- ✅ "Database created successfully"
- 📋 **Variáveis de ambiente** (geralmente em um box destacado)

**Copie essas variáveis** - elas são algo como:
```
POSTGRES_URL=postgres://default:xxxxx@xxxxx.xxxxx.xxxxx.vercel-storage.com:5432/verceldb
POSTGRES_PRISMA_URL=postgres://default:xxxxx@xxxxx.xxxxx.xxxxx.vercel-storage.com:5432/verceldb?pgbouncer=true
POSTGRES_URL_NON_POOLING=postgres://default:xxxxx@xxxxx.xxxxx.xxxxx.vercel-storage.com:5432/verceldb
```

### Opção B: Na Aba Storage (Depois de Criado)

1. Na aba **Storage**, clique no banco que você acabou de criar
2. Vá para a aba **Settings** ou **.env.local**
3. Você verá as variáveis de ambiente listadas
4. **Copie todas as 3 variáveis**

### Opção C: Em Settings → Environment Variables

1. No dashboard da Vercel, vá para **Settings** (ícone de engrenagem)
2. Clique em **Environment Variables**
3. Procure por variáveis que começam com `POSTGRES_`
4. Se não existirem, você precisa adicioná-las manualmente (veja Passo 3)

## ⚙️ Passo 3: Configurar Variáveis de Ambiente

### Se as Variáveis JÁ EXISTEM (Vercel adicionou automaticamente):

✅ **Não precisa fazer nada!** Elas já estão configuradas.

### Se as Variáveis NÃO EXISTEM (Precisa adicionar manualmente):

1. No dashboard da Vercel, vá para **Settings** → **Environment Variables**
2. Clique em **Add New**
3. Adicione cada variável:

**Variável 1:**
- **Key**: `POSTGRES_URL`
- **Value**: Cole o valor que você copiou (começa com `postgres://`)
- **Environment**: Selecione **Production**, **Preview** e **Development** (ou apenas Production)
- Clique em **Save**

**Variável 2:**
- **Key**: `POSTGRES_PRISMA_URL`
- **Value**: Cole o valor que você copiou (tem `?pgbouncer=true` no final)
- **Environment**: Selecione **Production**, **Preview** e **Development**
- Clique em **Save**

**Variável 3:**
- **Key**: `POSTGRES_URL_NON_POOLING`
- **Value**: Cole o valor que você copiou (sem `?pgbouncer=true`)
- **Environment**: Selecione **Production**, **Preview** e **Development**
- Clique em **Save**

> 💡 **Dica**: Você pode encontrar essas variáveis na aba **Storage** → Seu banco → **Settings** ou **.env.local**

## 🗃️ Passo 4: Executar o Script SQL

### Método 1: Via SQL Editor da Vercel (RECOMENDADO)

1. Na aba **Storage**, clique no banco que você criou
2. Vá para a aba **Data** ou procure por **SQL Editor** / **Query**
3. Você verá um editor SQL
4. Abra o arquivo `scripts/init-db.sql` do seu projeto
5. **Copie TODO o conteúdo** do arquivo
6. **Cole no editor SQL da Vercel**
7. Clique em **Run** ou **Execute**

### Método 2: Via Deploy (Automático)

O código tenta inicializar automaticamente, mas pode falhar silenciosamente. Para garantir:

1. **Faça um deploy** (push para o repositório ou deploy manual)
2. **Verifique os logs**:
   - Vá para **Deployments**
   - Clique no último deploy
   - Vá para **Functions** → `server.js`
   - Procure por mensagens como:
     - ✅ `✅ Banco de dados inicializado com sucesso`
     - ❌ `❌ Erro ao inicializar banco de dados`

3. **Se não inicializou automaticamente**, use o Método 1 (SQL Editor)

### Método 3: Via Terminal Local (Se tiver psql)

```bash
# 1. Pegue a POSTGRES_URL das variáveis de ambiente da Vercel
# 2. Execute:
psql "POSTGRES_URL_AQUI" -f scripts/init-db.sql
```

## 🔍 Passo 5: Verificar se Funcionou

### Verificação 1: Via SQL Editor da Vercel

Execute estas queries no SQL Editor:

```sql
-- 1. Listar todas as tabelas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Resultado esperado:
-- cobrancas
-- doadores
-- transacoes
```

```sql
-- 2. Verificar campos novos na tabela cobrancas
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'cobrancas'
  AND column_name IN ('provider', 'provider_tid', 'crypto_currency', 'crypto_address')
ORDER BY ordinal_position;

-- Resultado esperado:
-- provider | character varying | 'REDE'::character varying
-- provider_tid | character varying | NULL
-- crypto_currency | character varying | NULL
-- crypto_address | character varying | NULL
```

```sql
-- 3. Verificar constraints
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'cobrancas'
  AND constraint_type = 'CHECK';

-- Deve ter:
-- check_tipo_pagamento
-- check_provider
```

### Verificação 2: Via Health Check

Após fazer deploy, teste:

```bash
curl https://seu-projeto.vercel.app/health
```

Resposta esperada:
```json
{
  "status": "healthy",
  "timestamp": "2024-...",
  "database": "connected"
}
```

Se retornar `"database": "disconnected"`, há um problema de conexão.

## ❌ Por que `initializeDatabase()` Não Executou?

Possíveis causas:

### 1. Erro Silencioso
O código pode ter falhado mas não mostrou erro. Verifique os logs do deploy.

### 2. Variáveis de Ambiente Não Configuradas
Se `POSTGRES_URL` não estiver configurada, o código não consegue conectar.

**Solução**: Configure as variáveis (Passo 3)

### 3. Cold Start (Primeira Execução)
Na Vercel, o servidor pode não ter executado ainda.

**Solução**: 
- Faça uma requisição para `/health`
- Ou aguarde alguns minutos e tente novamente

### 4. Erro no Script SQL
O script pode ter falhado por algum erro de sintaxe.

**Solução**: Execute manualmente via SQL Editor (Método 1)

### 5. Tabelas Já Existem
Se as tabelas já existiam, o código pode ter ignorado silenciosamente.

**Solução**: Verifique se as tabelas existem (Passo 5)

## 🐛 Troubleshooting Detalhado

### Problema: "Cannot find module '@vercel/postgres'"

**Solução**: 
```bash
npm install @vercel/postgres
```

### Problema: "relation already exists"

**Solução**: 
1. No SQL Editor, execute:
```sql
DROP TABLE IF EXISTS transacoes CASCADE;
DROP TABLE IF EXISTS cobrancas CASCADE;
DROP TABLE IF EXISTS doadores CASCADE;
```
2. Execute novamente o `init-db.sql`

### Problema: Variáveis não aparecem em Environment Variables

**Solução**:
1. Vá para **Storage** → Seu banco → **Settings**
2. Copie as variáveis de lá
3. Adicione manualmente em **Settings** → **Environment Variables**

### Problema: Health check retorna "disconnected"

**Solução**:
1. Verifique se `POSTGRES_URL` está configurada
2. Verifique se o banco está ativo na Vercel
3. Verifique os logs do deploy para erros de conexão

## 📸 Screenshots de Referência (Onde Encontrar)

### Onde Encontrar Variáveis Após Criar Banco:

1. **Tela de Confirmação**: Logo após criar, mostra as variáveis
2. **Storage → Seu Banco → Settings**: Aba com variáveis
3. **Storage → Seu Banco → .env.local**: Arquivo com variáveis

### Onde Executar SQL:

1. **Storage → Seu Banco → Data**: Aba com SQL Editor
2. **Storage → Seu Banco → Query**: Outro nome para SQL Editor

## ✅ Checklist Final

- [ ] Banco PostgreSQL criado na Vercel
- [ ] Variáveis de ambiente encontradas e copiadas
- [ ] Variáveis adicionadas em Settings → Environment Variables (se necessário)
- [ ] Script `init-db.sql` executado via SQL Editor
- [ ] Tabelas verificadas (cobrancas, doadores, transacoes)
- [ ] Campos novos verificados (provider, provider_tid, crypto_currency, crypto_address)
- [ ] Health check retorna `"database": "connected"`

## 🎯 Próximo Passo

Após confirmar que tudo está funcionando:

1. Configure as variáveis da e-Rede:
   - `REDE_PV`
   - `REDE_TOKEN`
   - `REDE_WEBHOOK_SECRET`
2. Faça um teste de criação de cobrança PIX
3. Verifique os logs para confirmar que está tudo OK

