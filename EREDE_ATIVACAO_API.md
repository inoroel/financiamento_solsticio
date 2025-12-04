# e-Rede API - Aguardando Ativação

## Situação Atual

Você solicitou acesso à API da e-Rede hoje. É comum que haja um período de espera para ativação, especialmente para acesso à API de produção.

## O que pode estar acontecendo

### 1. **Período de Ativação**
- A e-Rede geralmente leva **24-48 horas** para ativar o acesso à API
- Durante esse período, mesmo com credenciais corretas, você pode receber erro 403 (CloudFront bloqueando)
- Isso é normal e esperado

### 2. **Ambiente Sandbox vs Produção**
- **Sandbox**: Geralmente ativado imediatamente ou em poucas horas
- **Produção**: Pode levar mais tempo (24-48h) e requer aprovação manual

### 3. **Whitelist de IPs**
- A e-Rede pode ter whitelist de IPs configurada no backend
- Isso não é configurável pelo usuário no portal
- É configurado pela equipe técnica da e-Rede

## Como verificar se está funcionando

### 1. **Verificar logs na Vercel**

Após fazer uma requisição, verifique os logs. Você deve ver:

```
🔐 Usando ambiente: sandbox (ou production)
🔐 API Base URL: https://sandbox-erede.useredecloud.com.br (ou produção)
🔐 PV configurado: Sim (primeiros 4 chars: ...)
🔐 TOKEN configurado: Sim (primeiros 4 chars: ...)
📤 Enviando requisição para: https://...
```

### 2. **Erros esperados durante ativação**

- **403 (CloudFront)**: Acesso ainda não ativado ou IP não autorizado
- **401 (Unauthorized)**: Credenciais incorretas ou não configuradas
- **200 (Success)**: ✅ API está funcionando!

### 3. **Testar com Sandbox primeiro**

Recomendamos testar primeiro com o ambiente **sandbox**:

1. Configure na Vercel:
   ```
   REDE_ENVIRONMENT=sandbox
   ```

2. Use credenciais de sandbox (geralmente fornecidas imediatamente)

3. Teste uma requisição PIX pequena (ex: R$ 0,10)

## Configuração na Vercel

### Variáveis de Ambiente Necessárias

```bash
# Ambiente (sandbox para testes, production para produção)
REDE_ENVIRONMENT=sandbox

# Credenciais (obter do portal e-Rede)
REDE_PV=seu_pv_aqui
REDE_TOKEN=seu_token_aqui

# Opcional: URL customizada (geralmente não necessário)
# REDE_API_BASE_URL=https://sandbox-erede.useredecloud.com.br
```

## Próximos Passos

### 1. **Aguardar Ativação (24-48h)**
- Verifique seu email para confirmação de ativação
- Entre em contato com suporte e-Rede se passar de 48h

### 2. **Testar com Sandbox**
- Configure `REDE_ENVIRONMENT=sandbox` na Vercel
- Use credenciais de sandbox
- Teste uma requisição pequena

### 3. **Verificar Status no Portal**
- Acesse o portal da e-Rede
- Verifique se há notificações sobre status da API
- Confirme se as credenciais estão corretas

### 4. **Contatar Suporte e-Rede**
Se após 48h ainda não funcionar, ou se receber erro 403 do CloudFront:

**Mensagem sugerida para o suporte:**

```
Olá,

Estou tentando usar a API e-Rede para criar cobranças PIX, mas estou recebendo erro 403 do CloudFront.

Detalhes:
- Ambiente: [PRODUÇÃO ou SANDBOX]
- PV: [primeiros 4 caracteres do seu PV]
- Plataforma: Vercel (IPs dinâmicos)
- Erro: "ERROR: The request could not be satisfied - Request blocked" (CloudFront)

A requisição está sendo bloqueada antes mesmo de chegar à API. Isso geralmente indica:
1. IPs da Vercel não estão na whitelist da e-Rede
2. API ainda não foi ativada para meu ambiente
3. Configuração adicional necessária na conta

Por favor, verifiquem:
- Se a API está ativada para meu PV no ambiente [PRODUÇÃO/SANDBOX]
- Se é necessário adicionar IPs da Vercel à whitelist (ou desabilitar whitelist)
- Se há alguma configuração adicional necessária

Agradeço a atenção.
```

**Informações que o suporte pode pedir:**
- PV completo (ou primeiros 4 caracteres)
- Ambiente (sandbox/production)
- Correlation ID dos logs (aparece nos logs da Vercel)
- URL da API sendo chamada (aparece nos logs)

## Logs de Diagnóstico

O código agora inclui logs detalhados que ajudam a identificar o problema:

- ✅ **Ambiente sendo usado** (sandbox/production)
- ✅ **URL da API** sendo chamada
- ✅ **Status das credenciais** (sem expor valores completos)
- ✅ **Correlation ID** para rastreamento
- ✅ **Diagnóstico específico para erro 403** (quando ocorre)

**Exemplo de log quando ocorre erro 403:**

```
🔍 DIAGNÓSTICO ERRO 403 CLOUDFRONT:
   - Ambiente: PRODUÇÃO
   - API Base URL: https://api.userede.com.br/erede
   - PV configurado: Sim
   - TOKEN configurado: Sim
   - Plataforma: Vercel (IPs dinâmicos)
   - Ação necessária: Contatar suporte e-Rede para whitelist de IPs
```

Esses logs aparecem automaticamente quando ocorre erro 403 e ajudam a diagnosticar o problema.

## Checklist

- [ ] Credenciais configuradas na Vercel (`REDE_PV` e `REDE_TOKEN`)
- [ ] Ambiente configurado (`REDE_ENVIRONMENT=sandbox` para testes)
- [ ] Aguardando ativação (24-48h)
- [ ] Verificando logs na Vercel após requisições
- [ ] Testando com sandbox primeiro
- [ ] Contatando suporte e-Rede se necessário

## Notas Importantes

1. **Não há whitelist configurável no portal** - Isso é normal, a whitelist é gerenciada pela e-Rede
2. **Erro 403 é esperado durante ativação** - Não é um problema do código
3. **Teste sempre com sandbox primeiro** - É mais rápido e seguro
4. **Logs ajudam a diagnosticar** - Verifique sempre os logs na Vercel

## Suporte

Se precisar de ajuda adicional:
- Suporte e-Rede: [contato do suporte]
- Documentação: [link da documentação]
- Portal: [link do portal]

