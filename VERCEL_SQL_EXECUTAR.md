# 🚀 Como Executar o Script SQL na Vercel (2025)

> ⚠️ **IMPORTANTE**: A Vercel descontinuou o SQL Editor em janeiro de 2025.  
> Use uma das alternativas abaixo.

## ✅ Solução 1: Script Node.js (MAIS FÁCIL - Recomendado)

Crie um script que executa o SQL usando o próprio código do projeto:

### Passo 1: Criar o Script

Crie o arquivo `scripts/executar-init-db.js`:

```javascript
#!/usr/bin/env node
// Script para executar init-db.sql na Vercel Postgres
require('dotenv').config();
const { sql } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function executarInit() {
  try {
    console.log('📖 Lendo script init-db.sql...');
    const sqlScript = fs.readFileSync(
      path.join(__dirname, 'init-db.sql'),
      'utf8'
    );
    
    console.log('🚀 Executando script SQL...');
    await sql.query(sqlScript);
    
    console.log('✅ Script executado com sucesso!');
    console.log('✅ Tabelas criadas: cobrancas, doadores, transacoes');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao executar script:', error.message);
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Tabelas já existem. Tudo OK!');
      process.exit(0);
    }
    process.exit(1);
  }
}

executarInit();
```

### Passo 2: Executar Localmente

**IMPORTANTE**: Configure a `POSTGRES_URL` da Vercel no seu `.env` local primeiro!

1. **Copie a POSTGRES_URL da Vercel**:
   - Vá para **Storage** → Seu banco → **Settings**
   - Ou **Settings** → **Environment Variables**
   - Clique em **"Show secret"** 👁️
   - Copie o valor de `POSTGRES_URL`

2. **Adicione no seu `.env` local**:
   ```bash
   POSTGRES_URL=postgres://default:xxxxx@xxxxx.vercel-storage.com:5432/verceldb
   ```

3. **Execute o script**:
   ```bash
   node scripts/executar-init-db.js
   ```

### Passo 3: Verificar

Execute para verificar se funcionou:

```bash
node scripts/test-db-connection.js
```

Ou crie um script de verificação:

```bash
node -e "require('dotenv').config(); require('./config/database').testConnection().then(r => console.log(r ? '✅ Conectado' : '❌ Erro')).catch(e => console.error(e))"
```

---

## ✅ Solução 2: Via psql (Terminal)

Se você tem `psql` instalado:

### Passo 1: Obter POSTGRES_URL

1. Na Vercel: **Storage** → Seu banco → **Settings**
2. Clique em **"Show secret"** 👁️ na variável `POSTGRES_URL`
3. **Copie o valor completo**

### Passo 2: Executar

```bash
# No terminal, dentro da pasta do projeto
psql "SUA_POSTGRES_URL_AQUI" -f scripts/init-db.sql
```

**Exemplo:**
```bash
psql "postgres://default:abc123@ep-xxx.us-east-1.postgres.vercel-storage.com:5432/verceldb" -f scripts/init-db.sql
```

### Instalar psql (se não tiver)

**macOS:**
```bash
brew install postgresql
```

**Linux:**
```bash
sudo apt-get install postgresql-client
```

**Windows:**
Baixe: https://www.postgresql.org/download/windows/

---

## ✅ Solução 3: Via Neon Console (Interface Web)

A Vercel Postgres usa Neon por trás. Você pode acessar o console do Neon:

1. Na Vercel, vá para **Storage** → Seu banco
2. Procure por um link **"Open in Neon"** ou **"Neon Console"**
3. Ou acesse diretamente: https://console.neon.tech
4. Faça login com a mesma conta da Vercel
5. No Neon Console, você terá acesso a um SQL Editor
6. Cole o conteúdo de `scripts/init-db.sql` e execute

---

## ✅ Solução 4: Via Deploy + Forçar Inicialização

Modifique temporariamente o código para forçar a inicialização:

### Passo 1: Modificar `server.js` temporariamente

Adicione no início do arquivo (após os requires):

```javascript
// TEMPORÁRIO: Forçar inicialização
if (process.env.FORCE_INIT_DB === 'true') {
  const { initializeDatabase } = require('./config/database');
  initializeDatabase().then(() => {
    console.log('✅ Inicialização forçada concluída');
    process.exit(0);
  }).catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
  });
}
```

### Passo 2: Adicionar Variável de Ambiente

Na Vercel:
1. **Settings** → **Environment Variables**
2. Adicione: `FORCE_INIT_DB=true`
3. Faça um **deploy**

### Passo 3: Verificar Logs

1. Vá para **Deployments** → Último deploy → **Logs**
2. Procure por: `✅ Banco de dados inicializado com sucesso`

### Passo 4: Remover Código Temporário

Após confirmar que funcionou, remova o código temporário e a variável `FORCE_INIT_DB`.

---

## 🎯 Recomendação: Use a Solução 1 (Script Node.js)

É a mais simples e não requer instalação de ferramentas externas. Você só precisa:

1. ✅ Copiar `POSTGRES_URL` da Vercel
2. ✅ Adicionar no `.env` local
3. ✅ Executar `node scripts/executar-init-db.js`

---

## 🔍 Como Obter a POSTGRES_URL da Vercel

### Método 1: Storage → Settings

1. **Storage** → Clique no banco `financiamento_solsticio`
2. Procure por **"Settings"** ou **".env.local"**
3. Encontre `POSTGRES_URL`
4. Clique em **"Show secret"** 👁️
5. Copie o valor

### Método 2: Settings → Environment Variables

1. **Settings** → **Environment Variables**
2. Procure por `POSTGRES_URL`
3. Clique no valor (ou em "Show")
4. Copie

### Método 3: Quickstart (Tela Inicial do Banco)

1. Na tela inicial do banco (onde você vê "Quickstart")
2. Na aba **".env.local"**
3. Clique em **"Show secret"** 👁️
4. Copie o valor de `POSTGRES_URL`

---

## ✅ Verificação Final

Após executar qualquer método, verifique:

```bash
# Usando o script de teste
node scripts/test-db-connection.js
```

Ou crie um script de verificação rápida:

```javascript
// scripts/verificar-tabelas.js
require('dotenv').config();
const { sql } = require('../config/database');

async function verificar() {
  const result = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;
  
  console.log('📋 Tabelas encontradas:');
  result.rows.forEach(row => {
    console.log(`  ✅ ${row.table_name}`);
  });
  
  // Verificar campos novos
  const campos = await sql`
    SELECT column_name 
    FROM information_schema.columns
    WHERE table_name = 'cobrancas' 
      AND column_name IN ('provider', 'provider_tid', 'crypto_currency', 'crypto_address')
  `;
  
  console.log('\n📋 Campos novos em cobrancas:');
  campos.rows.forEach(row => {
    console.log(`  ✅ ${row.column_name}`);
  });
}

verificar().catch(console.error);
```

Execute:
```bash
node scripts/verificar-tabelas.js
```

---

## 🆘 Precisa de Ajuda?

Se nenhuma solução funcionar, me avise e eu ajudo a debugar o problema específico!

