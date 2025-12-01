# 🔄 Mudança de URL do Projeto

## Nova URL

O projeto foi renomeado de `financiamentocoletivo.vercel.app` para:

**`https://financiamentosolsticio.vercel.app`**

## ✅ Arquivos Atualizados

### Documentação
- ✅ `env.template` - Exemplos de `ALLOWED_ORIGINS` atualizados
- ✅ `CHECKLIST_PRODUCAO.md` - URLs de exemplo atualizadas
- ✅ `VERCEL_CREDENCIAIS_SETUP.md` - URLs de exemplo atualizadas
- ✅ `VERCEL_DB_CONEXAO.md` - Nome do projeto e URLs atualizadas
- ✅ `FRONTEND_INTEGRATION_MANUAL.md` - URL de exemplo atualizada
- ✅ `COMO_RODAR_MOCK.md` - URL de exemplo atualizada
- ✅ `mock-pagamentos-solsticio/README.md` - URL de exemplo atualizada

## ⚙️ Configurações Necessárias

### 1. Variáveis de Ambiente na Vercel

Atualize `ALLOWED_ORIGINS` na Vercel se estiver configurado:

```
ALLOWED_ORIGINS=https://financiamentosolsticio.vercel.app
```

Ou, se tiver múltiplos domínios:

```
ALLOWED_ORIGINS=https://financiamentosolsticio.vercel.app,https://www.financiamentosolsticio.com
```

### 2. Webhook da e-Rede

Atualize a URL do webhook no portal da e-Rede:

**Nova URL do webhook:**
```
https://financiamentosolsticio.vercel.app/api/webhook/pagamento
```

### 3. Mock de Pagamentos (Frontend)

No projeto `mock-pagamentos-solsticio`, crie ou atualize o arquivo `.env.local`:

```bash
# .env.local
VITE_API_URL=https://financiamentosolsticio.vercel.app
```

### 4. Frontend de Produção

Se você tiver um frontend separado, atualize a variável de ambiente:

```bash
VITE_API_URL=https://financiamentosolsticio.vercel.app
```

## 🔍 Verificar se Está Funcionando

Teste o health check:

```bash
curl https://financiamentosolsticio.vercel.app/health
```

Deve retornar:
```json
{
  "status": "healthy",
  "timestamp": "...",
  "database": "connected"
}
```

## 📝 Notas

- A URL antiga (`financiamentocoletivo.vercel.app`) não funcionará mais
- Todos os webhooks precisam ser atualizados para a nova URL
- O frontend precisa ser atualizado para usar a nova URL
- CORS precisa permitir a nova URL (se `ALLOWED_ORIGINS` estiver configurado)

