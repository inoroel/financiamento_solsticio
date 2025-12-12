# Análise de Soluções - Problema de Conexão Prisma Accelerate

## Problema Identificado
- **Erro inicial**: `invalid_connection_string` - connection string meant for direct connection
- **Erro atual**: Timeout nas queries (5-8 segundos)
- **URL detectada**: Prisma Accelerate (`accelerate.prisma-data.net`)

---

## Soluções TENTADAS (e falharam)

### ❌ 1. Usar `@vercel/postgres.sql` com URL convertida
- **O que foi feito**: Converter `prisma+postgres://` para `postgres://` e usar `vercelPostgres.sql`
- **Resultado**: Erro `invalid_connection_string`
- **Por que falhou**: `@vercel/postgres.sql` cria pool automaticamente, mas Prisma Accelerate não aceita pooling adicional

### ❌ 2. Usar `createClient()` do `@vercel/postgres`
- **O que foi feito**: Usar `vercelPostgres.createClient({ connectionString })` e `client.sql`
- **Resultado**: Timeout nas queries (5-8 segundos)
- **Por que falhou**: `createClient()` pode não estar otimizado para Prisma Accelerate

### ✅ 3. Usar `pg` diretamente com Prisma Accelerate (MELHORADO)
- **O que foi feito**: 
  - Criar `Pool` do `pg` com a URL do Prisma Accelerate
  - **ADICIONADO**: Remover `pgbouncer=true` da URL (Prisma Accelerate já faz pooling)
  - **ADICIONADO**: Timeouts explícitos na URL (`connect_timeout=5&statement_timeout=5000`)
  - **ADICIONADO**: Verificar `POSTGRES_URL_NON_POOLING` se disponível
- **Resultado**: AINDA NÃO TESTADO em produção
- **Status**: Implementado com melhorias

---

## Soluções NÃO TENTADAS (ainda)

### 🔄 4. Usar `POSTGRES_URL_NON_POOLING` se disponível
- **O que fazer**: Verificar se existe `POSTGRES_URL_NON_POOLING` e usar ela diretamente
- **Por que pode funcionar**: Prisma Accelerate já faz pooling, não precisa de mais pooling
- **Status**: NÃO VERIFICADO se essa variável existe

### 🔄 5. Usar `@prisma/client` diretamente (se disponível)
- **O que fazer**: Se o projeto usa Prisma, usar `PrismaClient` diretamente
- **Por que pode funcionar**: Prisma Client é otimizado para Prisma Accelerate
- **Status**: NÃO VERIFICADO se Prisma está instalado/configurado

### 🔄 6. Verificar se há outra variável de ambiente disponível
- **O que fazer**: Listar TODAS as variáveis `POSTGRES*` e `DATABASE*` disponíveis
- **Por que pode funcionar**: Pode haver uma URL que funciona melhor
- **Status**: NÃO VERIFICADO todas as variáveis

### 🔄 7. Usar biblioteca HTTP direta (fetch/axios) para Prisma Accelerate
- **O que fazer**: Prisma Accelerate é um proxy HTTP, pode ser acessado via HTTP REST API
- **Por que pode funcionar**: Bypass completo de drivers PostgreSQL
- **Status**: NÃO TENTADO - requer mudança significativa no código

### 🔄 8. Verificar configuração SSL do Prisma Accelerate
- **O que fazer**: Testar diferentes configurações SSL (`require`, `prefer`, etc)
- **Por que pode funcionar**: SSL mal configurado pode causar timeouts
- **Status**: NÃO TESTADO diferentes configurações

### ✅ 9. Usar `pg` com configurações específicas para serverless
- **O que fazer**: 
  - `max: 1` ✅ (implementado)
  - `statement_timeout: 5000` ✅ (adicionado na URL)
  - `connect_timeout: 5` ✅ (adicionado na URL)
- **Por que pode funcionar**: Timeouts explícitos podem evitar travamentos
- **Status**: ✅ IMPLEMENTADO

### 🔄 10. Verificar se Prisma Accelerate está funcionando
- **O que fazer**: Testar conexão direta com `psql` ou cliente PostgreSQL
- **Por que pode funcionar**: Pode ser problema do serviço, não do código
- **Status**: NÃO TESTADO conexão direta

### 🔄 11. Usar `DATABASE_URL` ao invés de `POSTGRES_PRISMA_URL`
- **O que fazer**: Verificar se `DATABASE_URL` existe e usar ela
- **Por que pode funcionar**: Alguns serviços usam `DATABASE_URL` como padrão
- **Status**: NÃO VERIFICADO

### ✅ 12. Remover `pgbouncer=true` da URL antes de usar
- **O que fazer**: Se a URL tem `pgbouncer=true`, remover antes de passar para `pg`
- **Por que pode funcionar**: Prisma Accelerate não precisa de pgbouncer
- **Status**: ✅ IMPLEMENTADO - função `removePgbouncer()` criada e aplicada

---

## Próximos Passos Recomendados (em ordem de prioridade)

1. ✅ **ADICIONAR timeouts explícitos** - FEITO: `connect_timeout=5&statement_timeout=5000` na URL
2. ✅ **TESTAR remover `pgbouncer=true`** - FEITO: função `removePgbouncer()` implementada
3. ✅ **VERIFICAR se `POSTGRES_URL_NON_POOLING` existe** - FEITO: código verifica e usa se disponível
4. 🔄 **TESTAR conexão direta** - Usar `psql` ou cliente PostgreSQL para validar se Prisma Accelerate está funcionando
5. 🔄 **VERIFICAR variáveis de ambiente disponíveis** - Listar todas as `POSTGRES*` e `DATABASE*` em produção

---

## Observações Importantes

- **Prisma Accelerate é um proxy HTTP**: Não é um banco PostgreSQL tradicional
- **Funcionava até ontem**: Algo mudou (configuração, variável de ambiente, ou serviço)
- **Timeout de 5-8 segundos**: Indica que a conexão está sendo estabelecida, mas queries estão lentas
- **Serverless (Vercel)**: Limitações de cold start podem afetar conexões

---

## Código Atual (última tentativa)

```javascript
// Linha ~231-247: Usando pg diretamente com Prisma Accelerate (MELHORADO)
// Remove pgbouncer da URL (Prisma Accelerate já faz pooling)
let cleanUrl = removePgbouncer(convertedUrl);

// Adiciona timeouts na URL (PostgreSQL aceita como parâmetros de conexão)
const hasQuery = cleanUrl.includes('?');
cleanUrl += (hasQuery ? '&' : '?') + 'connect_timeout=5&statement_timeout=5000';

const { Pool } = require('pg');
pool = new Pool({
  connectionString: cleanUrl,
  ssl: { rejectUnauthorized: false },
  max: 1,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});
```

**✅ Configurações implementadas**:
- ✅ `statement_timeout=5000` (na URL)
- ✅ `connect_timeout=5` (na URL)
- ✅ `pgbouncer=true` removido da URL
- ✅ Verificação de `POSTGRES_URL_NON_POOLING`

