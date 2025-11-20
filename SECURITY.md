# Segurança - Backend PIX Itaú

Este documento descreve as medidas de segurança implementadas no sistema de doações PIX.

## 🔒 Medidas de Segurança Implementadas

### 1. **Proteção contra SQL Injection**
- ✅ Uso de template literals do `@vercel/postgres` que protegem automaticamente contra SQL injection
- ✅ Todas as queries usam parâmetros preparados
- ✅ Nenhuma concatenação direta de strings em queries SQL

### 2. **Validação de Entrada Rigorosa**
- ✅ **Valor monetário**: Validado entre R$ 0,01 e R$ 100.000,00
- ✅ **TXID**: Validado como alfanumérico, 26-35 caracteres
- ✅ **Nome**: Sanitizado e validado (apenas letras, números, espaços e caracteres especiais seguros)
- ✅ **WhatsApp**: Validado como número (10-15 dígitos)
- ✅ **Campanha ID**: Validado (alfanumérico, hífens, underscores, máx. 50 caracteres)

### 3. **Rate Limiting**
- ✅ **Criação de cobrança**: Máximo 10 requisições por IP a cada 15 minutos
- ✅ **Consulta de cobrança**: Máximo 30 requisições por IP a cada minuto
- ✅ **Webhook**: Máximo 100 requisições por IP a cada minuto

### 4. **Headers de Segurança (Helmet)**
- ✅ Content Security Policy (CSP)
- ✅ HTTP Strict Transport Security (HSTS)
- ✅ Proteção contra XSS
- ✅ Proteção contra clickjacking
- ✅ Remoção de headers que expõem informações do servidor

### 5. **CORS Configurado**
- ✅ Em produção: Apenas origens permitidas (via `ALLOWED_ORIGINS`)
- ✅ Em desenvolvimento: Permissivo (apenas para testes)
- ✅ Credenciais configuradas corretamente

### 6. **Limites de Payload**
- ✅ JSON limitado a 10KB (previne DoS)
- ✅ URL encoded limitado a 10KB

### 7. **Validação de Webhook**
- ✅ Validação de assinatura HMAC (obrigatória em produção)
- ✅ Validação de TXID no webhook
- ✅ Validação de valor monetário no webhook
- ✅ Idempotência (evita processar o mesmo webhook múltiplas vezes)

### 8. **Sanitização de Dados**
- ✅ Nome sanitizado antes de usar em mensagens (prevenção XSS)
- ✅ Remoção de caracteres perigosos (`<`, `>`, `javascript:`, event handlers)
- ✅ Limitação de tamanho de mensagens

### 9. **Proteção de Logs**
- ✅ Logs não expõem dados sensíveis (body completo removido)
- ✅ Apenas informações necessárias são logadas
- ✅ Stack traces apenas em desenvolvimento

### 10. **Validação de URLs**
- ✅ TXID codificado com `encodeURIComponent` antes de usar em URLs
- ✅ Prevenção contra path traversal

### 11. **Controle de Transação**
- ✅ Dados do doador só são salvos após confirmação do pagamento
- ✅ Dados temporários armazenados de forma segura
- ✅ Idempotência no processamento de webhooks

## ⚠️ Configurações Necessárias

### Variáveis de Ambiente Obrigatórias (Produção)

```env
# Itaú
ITAU_CLIENT_ID=...
ITAU_CLIENT_SECRET=...
ITAU_API_KEY=...
ITAU_CHAVE_PIX=...

# Segurança
WEBHOOK_SECRET=seu_secret_forte_aqui  # OBRIGATÓRIO EM PRODUÇÃO
ALLOWED_ORIGINS=https://seu-dominio.com,https://www.seu-dominio.com  # OBRIGATÓRIO EM PRODUÇÃO
NODE_ENV=production
ITAU_REQUIRE_CLIENT_CERT=true  # se o Itaú exigir mTLS

# PostgreSQL
POSTGRES_URL=...
```

## 🚨 Checklist de Segurança para Produção

- [ ] `WEBHOOK_SECRET` configurado com valor forte e aleatório
- [ ] `ALLOWED_ORIGINS` configurado com domínios permitidos
- [ ] `NODE_ENV=production` definido
- [ ] Credenciais do Itaú configuradas corretamente
- [ ] Banco de dados com conexão segura (SSL/TLS)
- [ ] Logs não expõem dados sensíveis
- [ ] Rate limiting ativo
- [ ] Helmet configurado
- [ ] CORS restrito às origens permitidas

## 🔍 Monitoramento Recomendado

1. **Logs de Segurança**: Monitore tentativas de rate limiting
2. **Webhooks Inválidos**: Monitore webhooks rejeitados por assinatura inválida
3. **Validações Falhadas**: Monitore tentativas de entrada inválida
4. **Erros de Banco**: Monitore erros de conexão ou queries

## 📝 Notas Importantes

- O sistema usa `@vercel/postgres` que já protege contra SQL injection
- Todos os valores monetários são validados e arredondados para 2 casas decimais
- TXIDs são validados em todas as entradas (criação, consulta, webhook)
- Dados do doador são sanitizados antes de armazenar
- Logs são seguros e não expõem informações sensíveis

## 🛡️ Próximas Melhorias Recomendadas

1. Implementar autenticação JWT para endpoints administrativos
2. Adicionar monitoramento de anomalias (ex: muitas tentativas de criação)
3. Implementar WAF (Web Application Firewall) na Vercel
4. Adicionar alertas automáticos para tentativas de ataque
5. Implementar backup automático do banco de dados
6. Adicionar auditoria de ações críticas

