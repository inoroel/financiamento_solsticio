# Financiamento Solstício

API backend para financiamento coletivo do Festival Solstício.

## 🎯 Meios de Pagamento Suportados

- **e-Rede**: PIX, Cartão de Crédito e Débito
- **Stellar**: USDC e XLM (criptomoedas)

## 🚀 Início Rápido

1. Clone o repositório
2. Copie `env.template` para `.env` e configure as variáveis
3. Execute `npm install`
4. Execute `npm run init-db` para criar o banco de dados
5. Execute `npm start` para iniciar o servidor

## 📚 Documentação

- `CHECKLIST_PRODUCAO.md` - Checklist completo para produção
- `STELLAR_FRONTEND_DETECTION.md` - Guia de detecção de pagamentos Stellar
- `STELLAR_WEBHOOK_FLUXO.md` - Fluxo completo de pagamentos Stellar
- `FRONTEND_INTEGRATION_MANUAL.md` - Manual completo de integração frontend ↔ backend
- `env.template` - Template de variáveis de ambiente

## 🔧 Scripts Disponíveis

- `npm start` - Inicia o servidor
- `npm run init-db` - Inicializa o banco de dados
- `npm run verificar-db` - Verifica estrutura do banco
- `npm run verificar-vercel` - Verifica banco da Vercel
