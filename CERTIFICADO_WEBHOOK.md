# 🔐 Validação de Certificado para Webhook - e-Rede

> **⚠️ OBSOLETO**: Este documento refere-se à integração antiga com Itaú que foi removida.  
> A validação atual está implementada em `services/redeWebhookService.js` para e-Rede.

## Qual certificado a e-Rede valida?

A e-Rede valida o **certificado apresentado pelo seu servidor (Vercel)** durante o handshake TLS. Esse certificado é emitido para `*.vercel.app` e está dentro da cadeia padrão da Let's Encrypt.

## Como funciona o fluxo TLS

```
Itaú → HTTPS Request → Vercel Server
                    ↓
              Vercel apresenta o certificado do servidor (*.vercel.app)
                    ↓
              Itaú valida usando a cadeia enviada previamente
                    ↓
              Conexão estabelecida se válido
```

1. Gere/exporte a cadeia executando `openssl s_client -connect <seu-domínio>:443 -showcerts </dev/null`.
2. Envie o conteúdo (na ordem servidor → intermediário → raiz) para o Portal Developers Itaú.
3. O Itaú valida cada requisição HTTPS comparando com essa cadeia.

## Implementação atual no código

- ✅ Validação de assinatura HMAC (`WEBHOOK_SECRET`)  
- ✅ Logs mínimos sem dados sensíveis  
- ✅ Validação opcional de certificado de cliente (mTLS) via `ITAU_REQUIRE_CLIENT_CERT`  
- ✅ Sanitização/validação completa do payload do webhook

A validação atual está implementada em `services/redeWebhookService.js` (e-Rede).

```javascript
// Se ITAU_REQUIRE_CLIENT_CERT=true, rejeita requisições sem certificado válido
// A verificação acontece durante o handshake TLS e usamos os metadados expostos por req.socket
```

## Como habilitar validação de webhook e-Rede

1. Configure o `REDE_WEBHOOK_SECRET` na plataforma e-Rede e no seu `.env`.  
2. (Opcional) Configure `REDE_WEBHOOK_IP_WHITELIST` com os IPs da e-Rede.  
3. A validação está implementada em `services/redeWebhookService.js` com:
   - Validação de assinatura HMAC
   - Validação de IP whitelist (opcional)

## Renovação do certificado da Vercel

A Vercel renova o certificado automaticamente (Let's Encrypt). Quando isso ocorrer:

1. Rode novamente `openssl s_client -connect <seu-domínio>:443 -showcerts </dev/null`.
2. Atualize o arquivo `certificado-bb-vercel.pem` (ou renomeie para `certificado-itau-vercel.pem` se preferir).
3. Envie a nova cadeia ao Itaú (Portal Developers → sua aplicação → certificados).

## Checklist rápido (e-Rede)

- [ ] `REDE_WEBHOOK_SECRET` configurado (mesmo valor na plataforma e-Rede)  
- [ ] (Opcional) `REDE_WEBHOOK_IP_WHITELIST` configurado com IPs da e-Rede  
- [ ] Logs monitorados para tentativas inválidas  

## Referências úteis

- [Documentação e-Rede](https://developer.userede.com.br/e-rede)  
- Validação implementada em `services/redeWebhookService.js`  
