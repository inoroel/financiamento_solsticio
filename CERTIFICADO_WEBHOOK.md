# 🔐 Validação de Certificado para Webhook - Banco do Brasil

## Qual Certificado é Usado?

**Resposta:** O **primeiro certificado da cadeia** (certificado do servidor `*.vercel.app`) é usado pelo BB para validar a conexão TLS durante o handshake.

## Como Funciona a Validação

### 1. Durante o Handshake TLS

Quando o Banco do Brasil faz a requisição HTTPS para o webhook:

```
BB → HTTPS Request → Vercel Server
                    ↓
              Vercel apresenta o certificado do servidor (*.vercel.app)
                    ↓
              BB valida usando a cadeia completa enviada
                    ↓
              Conexão estabelecida se válido
```

### 2. Certificados na Cadeia

O arquivo `certificado-bb-vercel.pem` contém 3 certificados na ordem:

1. **Certificado do Servidor** (`*.vercel.app`) - **ESTE É O USADO**
   - Apresentado automaticamente pela Vercel
   - Validado pelo BB durante o handshake TLS
   - Validade: até 23/01/2026

2. **Certificado Intermediário** (`R13` - Let's Encrypt)
   - Usado para validar a confiança do certificado do servidor
   - Parte da cadeia de confiança

3. **Certificado Raiz** (`ISRG Root X1`)
   - Autoridade certificadora raiz
   - Usado para validar toda a cadeia

### 3. Implementação no Código

O código foi atualizado para:

- ✅ Validar certificado do cliente (mTLS) se o BB enviar
- ✅ Validar assinatura do webhook (HMAC)
- ✅ Logar informações de segurança (sem dados sensíveis)

**Arquivo:** `services/webhookService.js`

```javascript
// O BB valida o certificado do SERVIDOR durante o handshake TLS
// O certificado usado é o primeiro da cadeia (certificado do servidor *.vercel.app)
// A cadeia completa foi enviada ao BB para validação da confiança
```

## Fluxo Completo

1. **Você envia a cadeia completa ao BB**
   - Via Portal Developers BB
   - O BB armazena para validação

2. **BB faz requisição HTTPS para o webhook**
   - URL: `https://financiamentocoletivo.vercel.app/api/webhook/pix`
   - Vercel apresenta automaticamente o certificado do servidor

3. **BB valida o certificado**
   - Verifica se o certificado apresentado é o mesmo enviado
   - Valida a cadeia até a raiz usando os certificados intermediário e raiz
   - Se válido, estabelece a conexão TLS

4. **Webhook é processado**
   - Código valida assinatura (se configurado)
   - Processa a transação
   - Salva dados no banco

## Importante

- ✅ **Certificado do servidor** é apresentado automaticamente pela Vercel
- ✅ **Cadeia completa** foi enviada ao BB para validação
- ✅ **Validação TLS** acontece automaticamente durante o handshake
- ✅ **Código** valida assinatura adicional (HMAC) para segurança extra

## Renovação do Certificado

O certificado Let's Encrypt é renovado automaticamente pela Vercel. Quando isso acontecer:

1. A Vercel renova automaticamente
2. O novo certificado será apresentado nas próximas requisições
3. Você precisará enviar a nova cadeia ao BB apenas se:
   - O BB rejeitar conexões (improvável, pois a raiz é a mesma)
   - Houver mudança na cadeia de certificados

## Referências

- Documentação BB: https://apoio.developers.bb.com.br
- Certificado válido até: 23/01/2026
- Arquivo: `certificado-bb-vercel.pem`

