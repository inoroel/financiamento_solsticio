# 🧪 Guia de Teste Local

Este guia te ajudará a testar todas as funcionalidades do backend localmente antes de fazer deploy na Vercel.

## 🚀 Início Rápido

### 1. Inicie o servidor backend

```bash
npm start
```

Você deve ver:
```
📦 Usando PostgreSQL local (pg)
✅ Conexão com banco de dados local estabelecida
✅ Banco de dados inicializado com sucesso
✅ Servidor de doações PIX rodando!
📍 Porta: 3000
📁 Servindo arquivos estáticos da pasta public/
```

### 2. Abra o frontend de teste

Abra no navegador:
```
http://localhost:3000
```

## 🧪 Testes Disponíveis

### 1. Health Check
- Clique em **"Verificar Status do Servidor"**
- Deve mostrar: `Servidor healthy` e `Banco de dados: connected`

### 2. Criar Cobrança PIX

#### Teste 1: Doação Anônima
1. Marque **"Doação anônima"**
2. Preencha:
   - Valor: `10.50`
   - ID da Campanha: `01`
3. Clique em **"Criar Cobrança PIX"**
4. Deve aparecer:
   - ✅ Mensagem de sucesso
   - 📱 QR Code gerado
   - 📋 Código PIX para copiar

#### Teste 2: Doação Identificada
1. **Desmarque** "Doação anônima"
2. Preencha:
   - Valor: `25.00`
   - ID da Campanha: `01`
   - Nome: `João Silva`
   - WhatsApp: `5511999999999`
3. Clique em **"Criar Cobrança PIX"**
4. Deve funcionar igual ao teste 1

#### Teste 3: Validação de Erros
1. Tente criar sem valor → Deve mostrar erro
2. Tente criar identificado sem nome → Deve mostrar erro
3. Tente criar identificado sem WhatsApp → Deve mostrar erro
4. Tente criar com valor muito alto (>100000) → Deve mostrar erro

### 3. Consultar Cobrança

1. Após criar uma cobrança, o TXID é preenchido automaticamente
2. Clique em **"Consultar Status"**
3. Deve mostrar:
   - Status da cobrança
   - Valor
   - Data de criação
   - Se foi pago, informações do pagamento

## 🔍 Verificar no Banco de Dados

```bash
# Acesse o PostgreSQL
psql -d financiamento_solsticio

# Ver cobranças criadas
SELECT txid, valor, status, campanha_id, criado_em FROM cobrancas;

# Ver doadores (após webhook confirmar pagamento)
SELECT id, nome, whatsapp, anonimo, criado_em FROM doadores;

# Ver transações confirmadas
SELECT * FROM transacoes;
```

## 📱 Testar Pagamento Real

Para testar o pagamento real e o webhook:

1. **Crie uma cobrança** no frontend
2. **Escaneie o QR Code** com seu app de pagamento
3. **Faça o pagamento** (em homologação, use valores pequenos)
4. **Aguarde o webhook** (pode levar alguns segundos)
5. **Consulte a cobrança** novamente - deve mostrar status "CONFIRMADA"
6. **Verifique no banco** - deve ter registro na tabela `transacoes` e `doadores`

## 🐛 Troubleshooting

### Frontend não carrega
- Verifique se o servidor está rodando na porta 3000
- Verifique se a URL está correta: `http://localhost:3000`
- Veja os logs do servidor para erros

### Erro ao criar cobrança
- Verifique se as credenciais do BB estão corretas no `.env`
- Verifique os logs do servidor
- Teste o endpoint diretamente com curl:
  ```bash
  curl -X POST http://localhost:3000/api/gerar-pix \
    -H "Content-Type: application/json" \
    -d '{"valor": 10.50, "cid": "01"}'
  ```

### QR Code não aparece
- Verifique se há erros no console do navegador (F12)
- A biblioteca QRCode.js é carregada via CDN - precisa de internet
- Verifique se o `brCode` está sendo retornado pela API

### Banco de dados não conecta
- Verifique se o PostgreSQL está rodando
- Verifique a `POSTGRES_URL` no `.env`
- Execute: `npm run test-db`

## ✅ Checklist de Testes

Antes de fazer deploy na Vercel, certifique-se de que:

- [ ] Health check funciona
- [ ] Criar cobrança anônima funciona
- [ ] Criar cobrança identificada funciona
- [ ] Validações de erro funcionam
- [ ] QR Code é gerado corretamente
- [ ] Consultar cobrança funciona
- [ ] Pagamento real funciona (teste com valor pequeno)
- [ ] Webhook processa corretamente (verificar no banco)
- [ ] Dados do doador são salvos apenas após confirmação

## 🚀 Próximo Passo

Após testar tudo localmente:

1. ✅ Teste com ngrok (para webhook externo)
2. ✅ Deploy na Vercel
3. ✅ Teste final em produção

