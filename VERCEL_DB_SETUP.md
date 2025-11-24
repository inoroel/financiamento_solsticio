# 🗄️ Guia: Recriar Banco de Dados na Vercel

Este guia te ajudará a recriar o banco de dados PostgreSQL na Vercel do zero com todos os novos campos para suportar múltiplos providers de pagamento.

## 📋 Pré-requisitos

- Acesso ao dashboard da Vercel
- Projeto já conectado na Vercel
- Acesso à aba Storage do projeto

## 🔄 Passo a Passo

### 1. Acessar o Dashboard da Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login
2. Selecione seu projeto `financiamento_solsticio`
3. Vá para a aba **Storage** (no menu lateral)

### 2. Deletar o Banco de Dados Existente (se houver)

1. Na aba **Storage**, encontre o banco PostgreSQL existente
2. Clique nos **3 pontos** (⋯) ao lado do banco
3. Selecione **Delete** ou **Remove**
4. Confirme a exclusão

> ⚠️ **ATENÇÃO**: Isso apagará TODOS os dados. Como você mencionou que não há dados ainda, está seguro.

### 3. Criar Novo Banco de Dados

1. Na aba **Storage**, clique em **Create Database**
2. Selecione **Postgres**
3. Escolha o plano (Hobby/Pro conforme necessário)
4. Selecione a região (recomendado: mais próxima do Brasil)
5. Dê um nome ao banco (ex: `financiamento_solsticio_db`)
6. Clique em **Create**

### 4. Obter as Variáveis de Ambiente

Após criar o banco, a Vercel mostrará as variáveis de ambiente. Você precisará de:

- `POSTGRES_URL` - URL completa de conexão
- `POSTGRES_PRISMA_URL` - URL com pooling (opcional, mas recomendado)
- `POSTGRES_URL_NON_POOLING` - URL sem pooling

**Copie essas variáveis** - você precisará delas no próximo passo.

### 5. Configurar Variáveis de Ambiente

1. No dashboard da Vercel, vá para **Settings** → **Environment Variables**
2. Adicione/atualize as seguintes variáveis:

```
POSTGRES_URL=postgresql://user:password@host:port/database
POSTGRES_PRISMA_URL=postgresql://user:password@host:port/database?pgbouncer=true
POSTGRES_URL_NON_POOLING=postgresql://user:password@host:port/database
```

> 💡 **Dica**: A Vercel pode já ter adicionado essas variáveis automaticamente. Verifique se estão presentes.

### 6. Executar o Script de Inicialização

Você tem duas opções:

#### Opção A: Via Vercel Dashboard (SQL Editor)

1. Na aba **Storage**, clique no banco criado
2. Vá para a aba **Data** ou **SQL Editor**
3. Copie o conteúdo completo do arquivo `scripts/init-db.sql`
4. Cole no editor SQL
5. Execute o script

#### Opção B: Via Deploy Automático

O código já está configurado para inicializar automaticamente na primeira execução:

1. Faça um deploy (push para o repositório ou deploy manual)
2. O servidor executará `initializeDatabase()` automaticamente
3. Verifique os logs do deploy para confirmar

#### Opção C: Via psql (Local)

Se você tem acesso via `psql`:

```bash
# Conecte usando a POSTGRES_URL
psql $POSTGRES_URL -f scripts/init-db.sql
```

### 7. Verificar a Criação

Após executar o script, verifique se as tabelas foram criadas:

**Via SQL Editor na Vercel:**
```sql
-- Listar todas as tabelas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Verificar estrutura da tabela cobrancas
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'cobrancas'
ORDER BY ordinal_position;

-- Verificar estrutura da tabela transacoes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'transacoes'
ORDER BY ordinal_position;
```

**Resultado esperado:**

Tabelas criadas:
- ✅ `cobrancas`
- ✅ `doadores`
- ✅ `transacoes`

Campos em `cobrancas`:
- ✅ `provider` (VARCHAR, DEFAULT 'REDE')
- ✅ `provider_tid` (VARCHAR)
- ✅ `crypto_currency` (VARCHAR)
- ✅ `crypto_address` (VARCHAR)
- ✅ `tipo_pagamento` (VARCHAR, CHECK IN ('PIX', 'CREDITO', 'DEBITO', 'CRIPTO'))

Campos em `transacoes`:
- ✅ `provider` (VARCHAR, DEFAULT 'REDE')
- ✅ `provider_tid` (VARCHAR)
- ✅ `crypto_currency` (VARCHAR)
- ✅ `crypto_address` (VARCHAR)
- ✅ `tipo_pagamento` (VARCHAR, CHECK IN ('PIX', 'CREDITO', 'DEBITO', 'CRIPTO'))

### 8. Testar a Conexão

Após o deploy, teste o endpoint de health check:

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

## ✅ Checklist Final

- [ ] Banco de dados deletado (se existia)
- [ ] Novo banco PostgreSQL criado na Vercel
- [ ] Variáveis de ambiente configuradas (`POSTGRES_URL`, etc)
- [ ] Script `init-db.sql` executado
- [ ] Tabelas criadas e verificadas
- [ ] Campos novos presentes (`provider`, `provider_tid`, `crypto_currency`, `crypto_address`)
- [ ] Constraints verificadas (tipo_pagamento inclui 'CRIPTO', provider válido)
- [ ] Health check retorna `"database": "connected"`

## 🐛 Troubleshooting

### Erro: "relation already exists"
- Significa que as tabelas já existem
- Execute: `DROP TABLE IF EXISTS transacoes, cobrancas, doadores CASCADE;`
- Depois execute novamente o `init-db.sql`

### Erro: "permission denied"
- Verifique se a variável `POSTGRES_URL` está correta
- Certifique-se de que o usuário tem permissões de criação de tabelas

### Erro: "connection refused"
- Verifique se o banco está ativo na Vercel
- Confirme que as variáveis de ambiente estão configuradas
- Verifique se o IP não está bloqueado (geralmente não é necessário na Vercel)

### Tabelas não aparecem
- Verifique se executou o script completo
- Confirme que não houve erros no log
- Execute as queries de verificação acima

## 📚 Próximos Passos

Após criar o banco com sucesso:

1. ✅ Configure as variáveis da e-Rede (`REDE_PV`, `REDE_TOKEN`, etc)
2. ✅ Teste a criação de uma cobrança PIX
3. ✅ Implemente Binance Pay (Fase 3)
4. ✅ Configure webhooks na plataforma e-Rede

## 🔗 Links Úteis

- [Documentação Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
- [Dashboard Vercel](https://vercel.com/dashboard)
- Script de inicialização: `scripts/init-db.sql`

