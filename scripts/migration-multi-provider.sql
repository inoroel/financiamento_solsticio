-- Migration para suportar múltiplos providers de pagamento (e-Rede, Itaú, Binance Pay)
-- Adiciona campos necessários para distinguir entre diferentes providers e suportar cripto

-- =================================================================
-- TABELA: cobrancas
-- =================================================================

-- Adiciona campo provider (REDE, ITAU, BINANCE_PAY)
ALTER TABLE cobrancas 
  ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'REDE';

-- Adiciona campo provider_tid genérico (substitui/complementa rede_tid)
ALTER TABLE cobrancas 
  ADD COLUMN IF NOT EXISTS provider_tid VARCHAR(100);

-- Adiciona campos para pagamentos cripto (Binance Pay)
ALTER TABLE cobrancas 
  ADD COLUMN IF NOT EXISTS crypto_currency VARCHAR(20),
  ADD COLUMN IF NOT EXISTS crypto_address VARCHAR(255);

-- Migra dados existentes: rede_tid → provider_tid com provider='REDE'
UPDATE cobrancas 
SET provider = 'REDE', provider_tid = rede_tid 
WHERE rede_tid IS NOT NULL AND provider_tid IS NULL;

-- Atualiza constraint para incluir CRIPTO no tipo_pagamento
ALTER TABLE cobrancas 
  DROP CONSTRAINT IF EXISTS check_tipo_pagamento;
  
ALTER TABLE cobrancas 
  ADD CONSTRAINT check_tipo_pagamento 
  CHECK (tipo_pagamento IN ('PIX', 'CREDITO', 'DEBITO', 'CRIPTO'));

-- Adiciona constraint para provider
ALTER TABLE cobrancas 
  DROP CONSTRAINT IF EXISTS check_provider;
  
ALTER TABLE cobrancas 
  ADD CONSTRAINT check_provider 
  CHECK (provider IN ('REDE', 'ITAU', 'BINANCE_PAY'));

-- =================================================================
-- TABELA: transacoes
-- =================================================================

-- Adiciona campo provider (REDE, ITAU, BINANCE_PAY)
ALTER TABLE transacoes 
  ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'REDE';

-- Adiciona campo provider_tid genérico (substitui/complementa rede_tid)
ALTER TABLE transacoes 
  ADD COLUMN IF NOT EXISTS provider_tid VARCHAR(100);

-- Adiciona campos para pagamentos cripto (Binance Pay)
ALTER TABLE transacoes 
  ADD COLUMN IF NOT EXISTS crypto_currency VARCHAR(20),
  ADD COLUMN IF NOT EXISTS crypto_address VARCHAR(255);

-- Migra dados existentes: rede_tid → provider_tid com provider='REDE'
UPDATE transacoes 
SET provider = 'REDE', provider_tid = rede_tid 
WHERE rede_tid IS NOT NULL AND provider_tid IS NULL;

-- Atualiza constraint para incluir CRIPTO no tipo_pagamento
ALTER TABLE transacoes 
  DROP CONSTRAINT IF EXISTS check_tipo_pagamento_transacoes;
  
ALTER TABLE transacoes 
  ADD CONSTRAINT check_tipo_pagamento_transacoes 
  CHECK (tipo_pagamento IN ('PIX', 'CREDITO', 'DEBITO', 'CRIPTO'));

-- Adiciona constraint para provider
ALTER TABLE transacoes 
  DROP CONSTRAINT IF EXISTS check_provider_transacoes;
  
ALTER TABLE transacoes 
  ADD CONSTRAINT check_provider_transacoes 
  CHECK (provider IN ('REDE', 'ITAU', 'BINANCE_PAY'));

-- =================================================================
-- ÍNDICES
-- =================================================================

-- Índices para provider
CREATE INDEX IF NOT EXISTS idx_cobrancas_provider ON cobrancas(provider);
CREATE INDEX IF NOT EXISTS idx_cobrancas_provider_tid ON cobrancas(provider_tid) WHERE provider_tid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transacoes_provider ON transacoes(provider);
CREATE INDEX IF NOT EXISTS idx_transacoes_provider_tid ON transacoes(provider_tid) WHERE provider_tid IS NOT NULL;

-- Índices para campos cripto
CREATE INDEX IF NOT EXISTS idx_cobrancas_crypto_currency ON cobrancas(crypto_currency) WHERE crypto_currency IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transacoes_crypto_currency ON transacoes(crypto_currency) WHERE crypto_currency IS NOT NULL;

-- =================================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =================================================================

COMMENT ON COLUMN cobrancas.provider IS 'Provider de pagamento: REDE, ITAU ou BINANCE_PAY';
COMMENT ON COLUMN cobrancas.provider_tid IS 'Transaction ID genérico do provider (substitui/complementa rede_tid)';
COMMENT ON COLUMN cobrancas.crypto_currency IS 'Moeda cripto para pagamentos Binance Pay (BTC, ETH, USDT, etc)';
COMMENT ON COLUMN cobrancas.crypto_address IS 'Endereço da carteira cripto para pagamentos Binance Pay';

COMMENT ON COLUMN transacoes.provider IS 'Provider de pagamento: REDE, ITAU ou BINANCE_PAY';
COMMENT ON COLUMN transacoes.provider_tid IS 'Transaction ID genérico do provider (substitui/complementa rede_tid)';
COMMENT ON COLUMN transacoes.crypto_currency IS 'Moeda cripto para pagamentos Binance Pay (BTC, ETH, USDT, etc)';
COMMENT ON COLUMN transacoes.crypto_address IS 'Endereço da carteira cripto para pagamentos Binance Pay';

