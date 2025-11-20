-- Migration para suportar API e-Rede e múltiplos tipos de pagamento
-- Adiciona campos necessários para PIX, cartão de crédito e débito

-- Adiciona tipo de pagamento e campos da Rede na tabela cobrancas
ALTER TABLE cobrancas 
  ADD COLUMN IF NOT EXISTS tipo_pagamento VARCHAR(20) DEFAULT 'PIX',
  ADD COLUMN IF NOT EXISTS rede_tid VARCHAR(100),
  ADD COLUMN IF NOT EXISTS dados_pagamento JSONB;

-- Adiciona constraints para tipo_pagamento
ALTER TABLE cobrancas 
  DROP CONSTRAINT IF EXISTS check_tipo_pagamento;
  
ALTER TABLE cobrancas 
  ADD CONSTRAINT check_tipo_pagamento 
  CHECK (tipo_pagamento IN ('PIX', 'CREDITO', 'DEBITO'));

-- Atualiza cobranças existentes para tipo PIX (compatibilidade)
UPDATE cobrancas 
SET tipo_pagamento = 'PIX' 
WHERE tipo_pagamento IS NULL;

-- Adiciona tipo de pagamento e campos da Rede na tabela transacoes
ALTER TABLE transacoes 
  ADD COLUMN IF NOT EXISTS tipo_pagamento VARCHAR(20) DEFAULT 'PIX',
  ADD COLUMN IF NOT EXISTS rede_tid VARCHAR(100),
  ADD COLUMN IF NOT EXISTS bandeira_cartao VARCHAR(50),
  ADD COLUMN IF NOT EXISTS parcelas INTEGER;

-- Adiciona constraints para tipo_pagamento em transacoes
ALTER TABLE transacoes 
  DROP CONSTRAINT IF EXISTS check_tipo_pagamento_transacoes;
  
ALTER TABLE transacoes 
  ADD CONSTRAINT check_tipo_pagamento_transacoes 
  CHECK (tipo_pagamento IN ('PIX', 'CREDITO', 'DEBITO'));

-- Atualiza transações existentes para tipo PIX (compatibilidade)
UPDATE transacoes 
SET tipo_pagamento = 'PIX' 
WHERE tipo_pagamento IS NULL;

-- Cria índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_cobrancas_tipo_pagamento ON cobrancas(tipo_pagamento);
CREATE INDEX IF NOT EXISTS idx_cobrancas_rede_tid ON cobrancas(rede_tid) WHERE rede_tid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transacoes_tipo_pagamento ON transacoes(tipo_pagamento);
CREATE INDEX IF NOT EXISTS idx_transacoes_rede_tid ON transacoes(rede_tid) WHERE rede_tid IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN cobrancas.tipo_pagamento IS 'Tipo de pagamento: PIX, CREDITO ou DEBITO';
COMMENT ON COLUMN cobrancas.rede_tid IS 'Transaction ID da API e-Rede';
COMMENT ON COLUMN cobrancas.dados_pagamento IS 'Dados específicos do pagamento (ex: token do cartão, dados do cartão)';
COMMENT ON COLUMN transacoes.tipo_pagamento IS 'Tipo de pagamento: PIX, CREDITO ou DEBITO';
COMMENT ON COLUMN transacoes.rede_tid IS 'Transaction ID da API e-Rede';
COMMENT ON COLUMN transacoes.bandeira_cartao IS 'Bandeira do cartão (Visa, Mastercard, Elo, etc)';
COMMENT ON COLUMN transacoes.parcelas IS 'Número de parcelas (apenas para crédito)';

