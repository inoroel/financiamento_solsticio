# 🔍 Como Encontrar o SQL Editor na Vercel

Baseado na interface atual da Vercel, o SQL Editor pode estar em locais diferentes. Siga estas instruções:

## 📍 Opção 1: Via Aba "Data" ou "Query"

1. Na aba **Storage**, clique no banco **financiamento_solsticio**
2. Procure por uma das seguintes abas no topo da página do banco:
   - **"Data"** 
   - **"Query"**
   - **"SQL"**
   - **"Tables"**
3. Dentro dessa aba, procure por:
   - Um botão **"New Query"** ou **"Run Query"**
   - Um editor de texto/código
   - Um campo onde você pode digitar SQL

## 📍 Opção 2: Via Botão "Open in Prisma"

Se você vê o botão **"Open in Prisma"**:

1. Clique em **"Open in Prisma"**
2. Isso abre o Prisma Studio
3. No Prisma Studio, você pode executar queries SQL diretamente

## 📍 Opção 3: Via "Connect Project" → Prisma Studio

1. Clique em **"Connect Project"**
2. Siga as instruções para conectar
3. Isso pode abrir o Prisma Studio onde você pode executar SQL

## 📍 Opção 4: Usar Prisma Studio Localmente

Se não encontrar o SQL Editor na interface web:

1. **Instale o Prisma CLI** (se ainda não tiver):
   ```bash
   npm install -g prisma
   ```

2. **Configure o Prisma** no seu projeto:
   ```bash
   npx prisma init
   ```

3. **Crie um arquivo `prisma/schema.prisma`**:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("POSTGRES_URL")
   }
   ```

4. **Abra o Prisma Studio**:
   ```bash
   npx prisma studio
   ```

5. No Prisma Studio, você pode executar SQL via interface ou usar a aba "Raw SQL"

## 📍 Opção 5: Usar psql via Terminal (Mais Direto)

Se você tem acesso ao terminal e a `POSTGRES_URL`:

1. **Copie a `POSTGRES_URL`** da Vercel:
   - Na aba Storage → Seu banco → Settings
   - Ou em Settings → Environment Variables
   - Clique em "Show secret" para ver o valor completo

2. **Execute o script diretamente**:
   ```bash
   # No terminal, dentro da pasta do projeto
   psql "SUA_POSTGRES_URL_AQUI" -f scripts/init-db.sql
   ```

   Exemplo:
   ```bash
   psql "postgres://default:xxxxx@xxxxx.vercel-storage.com:5432/verceldb" -f scripts/init-db.sql
   ```

## 📍 Opção 6: Via Deploy + Logs (Verificar se Executou)

Se você já fez deploy e quer verificar se executou:

1. Vá para **Deployments** (no menu superior)
2. Clique no último deploy
3. Vá para **Functions** → `server.js`
4. Procure nos logs por:
   - `✅ Banco de dados inicializado com sucesso`
   - `❌ Erro ao inicializar banco de dados`

Se não apareceu, significa que não executou automaticamente.

## 🎯 Solução Mais Simples: Usar psql Localmente

**Esta é a forma mais garantida de executar o script:**

### Passo 1: Obter a POSTGRES_URL

1. Na Vercel, vá para **Storage** → Seu banco
2. Clique em **Settings** (ou procure por variáveis de ambiente)
3. Encontre `POSTGRES_URL`
4. Clique em **"Show secret"** (ícone de olho 👁️)
5. **Copie o valor completo** (começa com `postgres://`)

### Passo 2: Executar o Script

No terminal, dentro da pasta do projeto:

```bash
# Substitua SUA_POSTGRES_URL pelo valor que você copiou
psql "SUA_POSTGRES_URL" -f scripts/init-db.sql
```

**Exemplo completo:**
```bash
psql "postgres://default:abc123@ep-xxx-xxx.us-east-1.postgres.vercel-storage.com:5432/verceldb" -f scripts/init-db.sql
```

### Passo 3: Verificar

Execute esta query para verificar se funcionou:

```bash
psql "SUA_POSTGRES_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
```

Deve retornar:
```
 table_name
------------
 cobrancas
 doadores
 transacoes
```

## 🔧 Se Não Tem psql Instalado

### macOS:
```bash
brew install postgresql
```

### Linux:
```bash
sudo apt-get install postgresql-client
# ou
sudo yum install postgresql
```

### Windows:
Baixe do site oficial: https://www.postgresql.org/download/windows/

## ✅ Alternativa: Criar Script Node.js Temporário

Se não conseguir usar psql, crie um script temporário:

1. **Crie `scripts/run-init-db.js`**:
```javascript
require('dotenv').config();
const { sql } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runInit() {
  try {
    const sqlScript = fs.readFileSync(
      path.join(__dirname, 'init-db.sql'),
      'utf8'
    );
    
    await sql.query(sqlScript);
    console.log('✅ Script executado com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

runInit();
```

2. **Execute**:
```bash
node scripts/run-init-db.js
```

3. **Delete o arquivo** após usar (é temporário)

## 🎯 Recomendação Final

**Use a Opção 5 (psql via terminal)** - é a forma mais direta e confiável. Você vê os erros imediatamente e tem controle total.

Se precisar de ajuda para instalar o psql ou executar o comando, me avise!

