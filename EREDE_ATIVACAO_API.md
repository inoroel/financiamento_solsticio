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
Se após 48h ainda não funcionar:
- Informe que solicitou acesso hoje
- Mencione que está recebendo erro 403 do CloudFront
- Pergunte sobre:
  - Status da ativação
  - Se há whitelist de IPs necessária
  - Se precisa de alguma configuração adicional

## Logs de Diagnóstico

O código agora inclui logs detalhados que ajudam a identificar o problema:

- ✅ **Ambiente sendo usado** (sandbox/production)
- ✅ **URL da API** sendo chamada
- ✅ **Status das credenciais** (sem expor valores completos)
- ✅ **Correlation ID** para rastreamento

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

