# 🔐 Validação de Certificado para Webhook - Itaú

## Qual certificado o Itaú valida?

O Itaú valida o **certificado apresentado pelo seu servidor (Vercel)** durante o handshake TLS. Esse certificado é emitido para `*.vercel.app` e está dentro da cadeia padrão da Let's Encrypt.  
Para evitar recusas, extraímos a cadeia completa e salvamos em `certificado-bb-vercel.pem` (nome antigo, mas a cadeia é a mesma do Itaú — renomeie se preferir).

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

O coração da validação está em `services/webhookService.js`.

```javascript
// Se ITAU_REQUIRE_CLIENT_CERT=true, rejeita requisições sem certificado válido
// A verificação acontece durante o handshake TLS e usamos os metadados expostos por req.socket
```

## Como habilitar mTLS do lado do Itaú

1. Solicite ao Itaú os certificados de cliente para o ambiente desejado.  
2. Salve-os em uma pasta segura (ex: `certificados-webhook-itau/ambiente/...`).  
3. Atualize a validação do `webhookService` para comparar o certificado recebido com os arquivos fornecidos.  
4. Ajuste as variáveis:
   ```bash
   ITAU_REQUIRE_CLIENT_CERT=true
   ```

> Ainda não recebemos os certificados oficiais do Itaú. Assim que forem disponibilizados, basta substituir os arquivos atuais (herdados do BB) pelos novos certificados do Itaú.

## Renovação do certificado da Vercel

A Vercel renova o certificado automaticamente (Let's Encrypt). Quando isso ocorrer:

1. Rode novamente `openssl s_client -connect <seu-domínio>:443 -showcerts </dev/null`.
2. Atualize o arquivo `certificado-bb-vercel.pem` (ou renomeie para `certificado-itau-vercel.pem` se preferir).
3. Envie a nova cadeia ao Itaú (Portal Developers → sua aplicação → certificados).

## Checklist rápido

- [ ] Cadeia `certificado-bb-vercel.pem` extraída e enviada ao Itaú  
- [ ] `WEBHOOK_SECRET` configurado (mesmo valor no portal do Itaú)  
- [ ] (Opcional) `ITAU_REQUIRE_CLIENT_CERT=true` e certificados do Itaú salvos localmente  
- [ ] Logs monitorados para tentativas inválidas  

## Referências úteis

- [Portal Developers Itaú](https://devportal.itau.com.br)  
- Ferramenta para extrair certificados: `openssl s_client -connect <domínio>:443 -showcerts </dev/null`  
- Doc oficial (quando disponibilizada pelo Itaú)  
