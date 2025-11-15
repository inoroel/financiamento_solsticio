# 🚀 Guia de Setup Local - Backend PIX BB

Este guia te ajudará a configurar e rodar o backend localmente com PostgreSQL local, ainda no ambiente de **homologação** do Banco do Brasil.

## 📋 Pré-requisitos

1. **Node.js** (versão 18 ou superior)
2. **PostgreSQL** (versão 12 ou superior) instalado localmente
3. **npm** ou **yarn**

## 🔧 Passo 1: Instalar PostgreSQL

### macOS (via Homebrew)
```bash
brew install postgresql@14
brew services start postgresql@14
```

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### Windows
Baixe e instale do site oficial: https://www.postgresql.org/download/windows/

## 🗄️ Passo 2: Criar Banco de Dados Local

```bash
# Acesse o PostgreSQL
psql postgres

# Crie o banco de dados
CREATE DATABASE financiamento_solsticio;

# Crie um usuário (opcional, pode usar o usuário padrão 'postgres')
CREATE USER solsticio_user WITH PASSWORD 'sua_senha_segura';
GRANT ALL PRIVILEGES ON DATABASE financiamento_solsticio TO solsticio_user;

# Saia do psql
\q
```

## 📦 Passo 3: Instalar Dependências

```bash
# No diretório do projeto
npm install
```

## ⚙️ Passo 4: Configurar Variáveis de Ambiente

1. Copie o arquivo de template:
```bash
cp env.template .env
```

2. Edite o arquivo `.env` e configure:

```env
# PostgreSQL Local
POSTGRES_URL=postgresql://postgres:sua_senha@localhost:5432/financiamento_solsticio

# Ou se criou um usuário específico:
# POSTGRES_URL=postgresql://solsticio_user:sua_senha@localhost:5432/financiamento_solsticio

# As credenciais do BB já estão configuradas para homologação
# O WEBHOOK_SECRET pode ser qualquer valor em desenvolvimento local
```

**Importante**: 
- Substitua `sua_senha` pela senha do seu PostgreSQL
- Se estiver usando o usuário padrão `postgres` sem senha, use: `postgresql://postgres@localhost:5432/financiamento_solsticio`

## 🗃️ Passo 5: Inicializar o Banco de Dados

O banco será inicializado automaticamente quando você iniciar o servidor pela primeira vez. As tabelas serão criadas automaticamente.

Se quiser inicializar manualmente:

```bash
# Acesse o banco
psql -d financiamento_solsticio

# Execute o script de inicialização
\i scripts/init-db.sql

# Ou copie e cole o conteúdo do arquivo scripts/init-db.sql
```

## 🚀 Passo 6: Iniciar o Servidor

```bash
npm start
```

Ou para desenvolvimento com auto-reload (se tiver nodemon):

```bash
npm run dev
```

Você deve ver mensagens como:
```
📦 Usando PostgreSQL local (pg)
✅ Conexão com banco de dados local estabelecida
✅ Banco de dados inicializado com sucesso
✅ Servidor de doações PIX rodando!
📍 Porta: 3000
```

## 🧪 Passo 7: Testar a API

### Health Check
```bash
curl http://localhost:3000/health
```

### Criar uma Cobrança PIX
```bash
curl -X POST http://localhost:3000/api/gerar-pix \
  -H "Content-Type: application/json" \
  -d '{
    "valor": 10.50,
    "cid": "01",
    "doador": {
      "nome": "João Silva",
      "whatsapp": "5511999999999",
      "anonimo": false
    }
  }'
```

### Consultar Cobrança
```bash
curl http://localhost:3000/api/cobranca/solsticiocampanha01XXXXXXXXX
```

## 🔍 Verificar Dados no Banco

```bash
# Acesse o PostgreSQL
psql -d financiamento_solsticio

# Ver cobranças
SELECT * FROM cobrancas;

# Ver doadores
SELECT * FROM doadores;

# Ver transações
SELECT * FROM transacoes;
```

## 🐛 Troubleshooting

### Erro: "Cannot find module 'pg'"
```bash
npm install pg
```

### Erro: "password authentication failed"
- Verifique a senha no `.env`
- Teste a conexão: `psql -U postgres -d financiamento_solsticio`

### Erro: "database does not exist"
- Crie o banco: `CREATE DATABASE financiamento_solsticio;`

### Erro: "connection refused"
- Verifique se o PostgreSQL está rodando:
  - macOS: `brew services list`
  - Linux: `sudo systemctl status postgresql`
  - Windows: Verifique no Services

### Erro ao inicializar banco
- Execute manualmente o script `scripts/init-db.sql` no psql
- Verifique se tem permissões no banco

## 📝 Próximos Passos

Após testar localmente:

1. **Testar com ngrok** (para webhook):
   - Instale ngrok: `brew install ngrok` ou baixe de https://ngrok.com
   - Execute: `ngrok http 3000`
   - Configure a URL do ngrok no Portal Developers BB como webhook
   - Teste o webhook recebendo notificações reais

2. **Publicar na Vercel**:
   - Configure as variáveis de ambiente na Vercel
   - Conecte o Vercel Postgres
   - Faça o deploy
   - Teste em produção

## 🔐 Segurança em Desenvolvimento Local

- ✅ O `WEBHOOK_SECRET` pode ser qualquer valor em desenvolvimento
- ✅ O `ALLOWED_ORIGINS` pode ficar vazio (CORS permissivo)
- ✅ Credenciais do BB são de **homologação** (não são reais)
- ⚠️ **NUNCA** commite o arquivo `.env` no git

## 📚 Recursos Úteis

- [Documentação PostgreSQL](https://www.postgresql.org/docs/)
- [Documentação API PIX BB](https://publicador.developers.bb.com.br/bucket/Documentacao_API_Pix_v2_cob_4e4cde96c5.pdf)
- [Documentação ngrok](https://ngrok.com/docs)

