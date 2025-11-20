# 📋 Variáveis de Ambiente Faltantes na Vercel

## ✅ Já Configuradas (se aplicável)

- `POSTGRES_URL` ✅
- `POSTGRES_PRISMA_DATABASE_URL` ✅
- `POSTGRES_DATABASE_URL` ✅
- `NODE_ENV` ✅

## ❌ Faltando (Obrigatórias)

### 1. ITAU_CLIENT_ID
**Tipo:** Credencial OAuth2  
**Onde encontrar:** [Portal Developers Itaú](https://devportal.itau.com.br) → Sua aplicação → Credenciais  
**Exemplo de formato:**
```
ITAU_CLIENT_ID=seu_client_id_aqui
```

### 2. ITAU_CLIENT_SECRET
**Tipo:** Credencial OAuth2  
**Onde encontrar:** [Portal Developers Itaú](https://devportal.itau.com.br) → Sua aplicação → Credenciais  
**Exemplo de formato:**
```
ITAU_CLIENT_SECRET=seu_client_secret_aqui
```

### 3. ITAU_API_KEY
**Tipo:** UUID (chave da API)  
**Onde encontrar:** [Portal Developers Itaú](https://devportal.itau.com.br) → Sua aplicação → API Key  
**Exemplo de formato:**
```
ITAU_API_KEY=96decebf-5c47-4410-95bf-0c4b803e4bb2
```
**Nota:** Deve ser um UUID válido (formato: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

### 4. ITAU_CHAVE_PIX
**Tipo:** String  
**Onde encontrar:** [Portal Developers Itaú](https://devportal.itau.com.br) → Sua aplicação → Chave PIX  
**Descrição:** Pode ser CPF, CNPJ, Email, Telefone ou Chave Aleatória  
**Exemplo de formato:**
```
ITAU_CHAVE_PIX=60701190000104
```
ou
```
ITAU_CHAVE_PIX=seu-email@exemplo.com
```

### 5. WEBHOOK_SECRET
**Tipo:** Secret (gere um novo)  
**Como gerar:**
```bash
openssl rand -hex 32
```
**Exemplo de formato:**
```
WEBHOOK_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```
**Importante:** Use o mesmo valor configurado no Portal Developers Itaú para o webhook.

## ⚙️ Opcionais (Recomendadas)

### 6. ITAU_AUTH_URL
**Tipo:** URL  
**Descrição:** URL de autenticação OAuth2 do Itaú  
**Valor padrão (já configurado no código):**
- **Produção:** `https://sts.itau.com.br/api/oauth/token`
- **Sandbox:** `https://oauthd.itau/identity/connect/token`
**Nota:** O código detecta automaticamente o ambiente. Só configure se precisar usar uma URL diferente

### 7. ITAU_API_BASE_URL
**Tipo:** URL  
**Descrição:** URL base da API PIX do Itaú  
**Valor padrão (já configurado no código):**
```
ITAU_API_BASE_URL=https://secure.api.itau/pix_recebimentos_conciliacoes_v2_ext/v2
```
**Nota:** Só configure se precisar usar uma URL diferente (ex: ambiente de homologação)

### 8. ITAU_CERT_PATH
**Tipo:** Caminho de arquivo  
**Descrição:** Caminho para o certificado .crt gerado e assinado pelo Itaú (mTLS)  
**Obrigatório em produção:** Sim  
**Exemplo:**
```
ITAU_CERT_PATH=./certificados-itau/meu_certificado.crt
```
**Nota:** O certificado deve ser gerado conforme documentação do Itaú e enviado para validação

### 9. ITAU_KEY_PATH
**Tipo:** Caminho de arquivo  
**Descrição:** Caminho para a chave privada .key usada no certificado mTLS  
**Obrigatório em produção:** Sim  
**Exemplo:**
```
ITAU_KEY_PATH=./certificados-itau/minha_chave_privada.key
```
**Nota:** A chave privada deve ser mantida em segurança e nunca compartilhada

### 10. ITAU_REQUIRE_CLIENT_CERT
**Tipo:** Boolean  
**Descrição:** Exige certificado de cliente (mTLS) do Itaú  
**Valor recomendado em produção:**
```
ITAU_REQUIRE_CLIENT_CERT=true
```
**Valor para desenvolvimento:**
```
ITAU_REQUIRE_CLIENT_CERT=false
```
ou não defina (padrão: false)

**Nota:** Configure conforme a documentação do Itaú para webhooks.

### 11. ALLOWED_ORIGINS
**Tipo:** String (separado por vírgula)  
**Descrição:** Domínios permitidos para CORS (apenas do seu frontend)  
**⚠️ IMPORTANTE:** CORS NÃO afeta webhooks! Você NÃO precisa colocar endereços do Itaú aqui.  
**Exemplo com um domínio:**
```
ALLOWED_ORIGINS=https://financiamentocoletivo.vercel.app
```
**Exemplo com múltiplos domínios:**
```
ALLOWED_ORIGINS=https://financiamentocoletivo.vercel.app,https://www.financiamentocoletivo.com
```
**Para desenvolvimento local (temporário):**
```
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```
**Nota:** 
- Em produção, defina os domínios do seu frontend
- Webhooks são protegidos por mTLS (se configurado) + Assinatura HMAC (não precisam de CORS)
- NÃO inclua endereços do Itaú (ex: `secure.api.itau`)

### 12. PORT
**Tipo:** Number  
**Descrição:** Porta do servidor (geralmente não necessário na Vercel)  
**Exemplo:**
```
PORT=3000
```
**Nota:** A Vercel define automaticamente, mas pode ser útil para logs

## 📝 Checklist de Configuração

### Obrigatórias
- [ ] `ITAU_CLIENT_ID` - Obter do Portal Developers Itaú
- [ ] `ITAU_CLIENT_SECRET` - Obter do Portal Developers Itaú
- [ ] `ITAU_API_KEY` - Obter do Portal Developers Itaú (UUID)
- [ ] `ITAU_CHAVE_PIX` - Obter do Portal Developers Itaú
- [ ] `WEBHOOK_SECRET` - Gerar com `openssl rand -hex 32`
- [ ] `ITAU_CERT_PATH` - Caminho para certificado mTLS (obrigatório em produção)
- [ ] `ITAU_KEY_PATH` - Caminho para chave privada mTLS (obrigatório em produção)

### Opcionais (Recomendadas)
- [ ] `ITAU_REQUIRE_CLIENT_CERT=true` - Para produção (se necessário conforme documentação)
- [ ] `ALLOWED_ORIGINS` - Domínios do frontend
- [ ] `PORT=3000` - Opcional (Vercel gerencia)

## 🔐 Segurança

**IMPORTANTE:**
- ✅ `ITAU_CLIENT_ID` e `ITAU_CLIENT_SECRET` são sensíveis - não compartilhe
- ✅ `ITAU_API_KEY` é sensível - não compartilhe
- ✅ `ITAU_CERT_PATH` e `ITAU_KEY_PATH` são CRÍTICOS - nunca compartilhe, especialmente a chave privada
- ✅ `WEBHOOK_SECRET` deve ser único e forte
- ✅ Configure `ALLOWED_ORIGINS` em produção para segurança CORS
- ✅ Use `ITAU_REQUIRE_CLIENT_CERT=true` em produção para validar certificados do webhook
- ✅ O token do Itaú expira em 5 minutos (300 segundos) - o código renova automaticamente

## 📚 Onde Encontrar as Credenciais

1. **ITAU_CLIENT_ID e ITAU_CLIENT_SECRET:**
   - [Portal Developers Itaú](https://devportal.itau.com.br) → Sua aplicação → Credenciais OAuth2
   - Ou no arquivo de credenciais fornecido pelo Itaú

2. **ITAU_API_KEY:**
   - [Portal Developers Itaú](https://devportal.itau.com.br) → Sua aplicação → API Key
   - Deve ser um UUID no formato: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

3. **ITAU_CHAVE_PIX:**
   - [Portal Developers Itaú](https://devportal.itau.com.br) → Sua aplicação → Chave PIX
   - Pode ser CPF, CNPJ, Email, Telefone ou Chave Aleatória

4. **WEBHOOK_SECRET:**
   - Gere você mesmo: `openssl rand -hex 32`
   - Configure o mesmo valor no Portal Developers Itaú → Webhook

## 🔗 Links Úteis

- [Portal Developers Itaú](https://devportal.itau.com.br)
- [Documentação API PIX Itaú](https://devportal.itau.com.br/baas/#/catalog)
