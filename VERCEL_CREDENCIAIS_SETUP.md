# 🔐 Configuração de Credenciais na Vercel

## ⚠️ Erro: "Affiliation: Required parameter missing" (401)

Este erro indica que as credenciais da e-Rede (`REDE_PV` e `REDE_TOKEN`) não estão configuradas ou estão incorretas na Vercel.

## 📋 Como Configurar as Variáveis de Ambiente na Vercel

### 1. Acesse o Painel da Vercel

1. Vá para: https://vercel.com
2. Faça login na sua conta
3. Selecione o projeto `financiamento_solsticio` (ou o nome do seu projeto)

### 2. Configure as Variáveis de Ambiente

1. No menu do projeto, clique em **Settings**
2. No menu lateral, clique em **Environment Variables**
3. Adicione as seguintes variáveis:

#### Variáveis Obrigatórias para e-Rede:

| Variável | Valor | Onde Obter |
|----------|-------|------------|
| `REDE_PV` | Seu Ponto de Venda | https://developer.userede.com.br/e-rede → Sua conta → Credenciais |
| `REDE_TOKEN` | Seu Token | https://developer.userede.com.br/e-rede → Sua conta → Credenciais |
| `REDE_ENVIRONMENT` | `production` ou `sandbox` | Use `sandbox` para testes, `production` para produção |

#### Como Adicionar:

1. Clique em **Add New**
2. Digite o **Name** (ex: `REDE_PV`)
3. Digite o **Value** (seu valor real)
4. Selecione os **Environments** onde aplicar:
   - ✅ **Production** (para produção)
   - ✅ **Preview** (para preview deployments)
   - ✅ **Development** (para desenvolvimento local, se usar Vercel CLI)
5. Clique em **Save**

### 3. Redeploy Após Configurar

⚠️ **IMPORTANTE**: Após adicionar/modificar variáveis de ambiente, você precisa fazer um **redeploy**:

1. Vá para a aba **Deployments**
2. Clique nos **3 pontos** (⋯) do deployment mais recente
3. Selecione **Redeploy**
4. Aguarde o deploy completar

Ou simplesmente faça um novo commit e push para forçar um novo deploy.

## 🔍 Verificar se as Credenciais Estão Configuradas

### Opção 1: Via Painel Vercel
- Vá em **Settings** → **Environment Variables**
- Verifique se `REDE_PV` e `REDE_TOKEN` estão listadas

### Opção 2: Via API (Teste)
Após configurar e fazer redeploy, teste o endpoint:

```bash
curl https://financiamentosolsticio.vercel.app/api/gerar-pagamento \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "tipo_pagamento": "PIX",
    "valor": 10.50,
    "cid": "01"
  }'
```

Se as credenciais estiverem corretas, você receberá uma resposta com o QR Code PIX.
Se ainda houver erro 401, verifique:
- ✅ Os valores estão corretos (sem espaços extras)
- ✅ O ambiente está correto (`REDE_ENVIRONMENT`)
- ✅ Foi feito redeploy após configurar

## 🧪 Testando com Sandbox

Para testar sem usar credenciais de produção:

1. Configure `REDE_ENVIRONMENT=sandbox`
2. Use credenciais de **sandbox** da e-Rede
3. Faça redeploy
4. Teste novamente

## 📝 Notas Importantes

- ⚠️ **Nunca** commite credenciais no código ou no Git
- ⚠️ Use variáveis de ambiente **sempre**
- ⚠️ Credenciais de **sandbox** são diferentes de **production**
- ⚠️ Após mudar variáveis, **sempre** faça redeploy

## 🆘 Ainda com Problemas?

Se após configurar as credenciais e fazer redeploy ainda houver erro:

1. Verifique os logs da Vercel:
   - Vá em **Deployments** → Clique no deployment → **Functions** → Veja os logs
   
2. Verifique se as credenciais estão corretas:
   - Acesse https://developer.userede.com.br/e-rede
   - Vá em **Sua conta** → **Credenciais**
   - Confirme que está copiando os valores corretos

3. Verifique o ambiente:
   - Se está em produção, use `REDE_ENVIRONMENT=production`
   - Se está testando, use `REDE_ENVIRONMENT=sandbox`

