# 🔍 Memo Stellar: Como Funciona a Identificação de Transações

## ⚠️ Importante: O Memo SEMPRE é Incluído

**O memo é ESSENCIAL para identificar qual transação foi paga!**

## 📋 Diferença entre Memo e Memo Type

### Memo (Valor)
- **O que é**: O valor/texto do memo (ex: `solsticiocampanha018196488`)
- **Função**: Identificar qual cobrança foi paga
- **Obrigatório**: ✅ SIM - Sem o memo, não conseguimos identificar a transação
- **Sempre incluído**: ✅ SIM - Está presente em TODOS os QR codes

### Memo Type (Tipo)
- **O que é**: Uma dica sobre o tipo de memo (`text`, `hash`, `id`, `return`)
- **Função**: Ajudar a carteira a interpretar o memo
- **Obrigatório**: ❌ NÃO - É opcional
- **Problema**: Algumas carteiras (como Freighter) podem não reconhecer `memo_type=text`

## 🔄 Dois Formatos de QR Code

### QR Code Padrão (com memo_type)
```
web+stellar:pay?destination=...&amount=0.1&memo=solsticiocampanha018196488&memo_type=text
```
- ✅ Inclui o memo
- ✅ Inclui memo_type=text
- ✅ Compatível com a maioria das carteiras

### QR Code Alternativo (sem memo_type)
```
web+stellar:pay?destination=...&amount=0.1&memo=solsticiocampanha018196488
```
- ✅ Inclui o memo (ESSENCIAL!)
- ❌ Não inclui memo_type
- ✅ Melhor compatibilidade com Freighter

## ✅ Como Identificamos a Transação

O sistema identifica transações pelo **memo** (não pelo memo_type):

1. **Quando o pagamento é feito**:
   - A transação Stellar inclui o memo (mesmo sem memo_type)
   - O memo é o `txid` da cobrança (ex: `solsticiocampanha018196488`)

2. **Para identificar a transação**:
   - Buscamos na conta Stellar todas as transações recebidas
   - Verificamos o memo de cada transação
   - Quando encontramos um memo que corresponde ao `txid` da cobrança, identificamos o pagamento

3. **Código que faz isso**:
   ```javascript
   // services/stellarService.js - findPaymentByMemo()
   const transactionMemo = transaction.memo ? transaction.memo.toString() : null;
   if (transactionMemo === memo) {
     // ✅ Transação identificada!
   }
   ```

## 🎯 Resumo

- ✅ **O memo SEMPRE está presente** nos QR codes (padrão e alternativo)
- ✅ **O memo é o que identifica a transação** (não o memo_type)
- ✅ **O memo_type é apenas uma dica opcional** para a carteira
- ✅ **Mesmo sem memo_type, o Freighter deve incluir o memo na transação**

## 🔍 Verificação

Para verificar se o memo está sendo incluído:

1. Escaneie o QR code alternativo com o Freighter
2. Antes de confirmar, verifique se o campo "Memo" está preenchido
3. O memo deve mostrar: `solsticiocampanha018196488` (ou o txid da sua cobrança)
4. Se o memo estiver vazio, o Freighter não está lendo o QR code corretamente

## 🐛 Se o Memo Não Aparecer no Freighter

Se mesmo com o QR code alternativo o Freighter não mostrar o memo:

1. **Use o botão "Abrir na Carteira"** - Isso abre o URI diretamente
2. **Copie o URI manualmente** - Cole no Freighter
3. **Verifique a versão do Freighter** - Atualize para a mais recente
4. **Como fallback**: O usuário pode preencher o memo manualmente no Freighter

## 📝 Nota Técnica

O Stellar sempre inclui o memo na transação quando ele é especificado no URI SEP-7, mesmo sem `memo_type`. O `memo_type` é apenas uma conveniência para a carteira saber como interpretar o memo, mas não é obrigatório.

