# Frontend de Teste - API PIX

Esta pasta contém um frontend básico em HTML/CSS/JavaScript para testar todas as funcionalidades do backend localmente.

## Como usar

1. **Inicie o servidor backend:**
   ```bash
   npm start
   ```

2. **Abra no navegador:**
   ```
   http://localhost:3000
   ```

   Ou abra diretamente o arquivo `index.html` no navegador (mas precisa ajustar a URL da API no código).

## Funcionalidades

- ✅ Criar cobrança PIX (anônima ou identificada)
- ✅ Visualizar QR Code gerado
- ✅ Consultar status de uma cobrança
- ✅ Health check do servidor
- ✅ Interface responsiva e moderna

## Notas

- Este frontend é apenas para testes locais
- Em produção, você usará o frontend Svelte
- A API está configurada para `http://localhost:3000`
- O QR Code é gerado usando a biblioteca QRCode.js (CDN)

