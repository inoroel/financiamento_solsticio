# 🔧 Correção do Deploy na Vercel

## Problema
Os endpoints não estavam sendo criados corretamente na Vercel, resultando em erro "Rota não encontrada".

## Solução Implementada

### 1. Criado handler em `api/index.js`
A Vercel precisa de um handler na pasta `api/` para serverless functions. O arquivo `api/index.js` foi criado para exportar o app Express.

### 2. Ajustado `vercel.json`
O arquivo `vercel.json` foi atualizado para usar `rewrites` ao invés de `routes`, roteando todas as requisições para `/api/index`.

## Estrutura Final

```
financiamento_solsticio/
├── api/
│   └── index.js          # Handler para Vercel (exporta o app Express)
├── server.js             # App Express principal
├── vercel.json           # Configuração da Vercel
└── ...
```

## Como Funciona

1. **Vercel recebe requisição** → `https://seu-projeto.vercel.app/api/gerar-pagamento`
2. **vercel.json** → Roteia para `/api/index`
3. **api/index.js** → Exporta o app Express do `server.js`
4. **server.js** → Processa a requisição e retorna resposta

## Próximos Passos

1. **Commit e Push:**
   ```bash
   git add api/index.js vercel.json
   git commit -m "fix: ajustar estrutura para Vercel serverless functions"
   git push
   ```

2. **Aguardar Deploy:**
   - A Vercel vai fazer deploy automaticamente
   - Verifique os logs do deploy na dashboard

3. **Testar Endpoints:**
   - `GET https://seu-projeto.vercel.app/health`
   - `POST https://seu-projeto.vercel.app/api/gerar-pagamento`

## Verificação

Após o deploy, teste:

```bash
# Health check
curl https://seu-projeto.vercel.app/health

# Deve retornar:
# {"status":"healthy","timestamp":"...","database":"connected"}
```

## Troubleshooting

**Se ainda não funcionar:**

1. Verifique se `api/index.js` existe e exporta o app corretamente
2. Verifique se `vercel.json` está correto
3. Verifique os logs do deploy na Vercel
4. Tente remover o `vercel.json` e deixar a Vercel detectar automaticamente (ela detecta Express)

**Alternativa (se ainda não funcionar):**

Remova o `vercel.json` completamente e deixe a Vercel detectar automaticamente. Ela deve detectar Express e criar as rotas automaticamente.

