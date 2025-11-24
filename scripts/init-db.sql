-- Script de inicialização do banco de dados PostgreSQL
-- Compatível com Vercel Postgres

-- Tabela de cobranças (PIX, Crédito, Débito, Cripto)
CREATE TABLE IF NOT EXISTS cobrancas (
    txid VARCHAR(35) PRIMARY KEY,
    valor DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'AGUARDANDO',
    campanha_id VARCHAR(50),
    tipo_pagamento VARCHAR(20) NOT NULL DEFAULT 'PIX',
    provider VARCHAR(50) NOT NULL DEFAULT 'REDE',
    chave_pix VARCHAR(77),
    brcode TEXT,
    expiracao INTEGER NOT NULL DEFAULT 3600,
    rede_tid VARCHAR(100),
    provider_tid VARCHAR(100),
    dados_pagamento JSONB,
    crypto_currency VARCHAR(20),
    crypto_address VARCHAR(255),
    dados_doador_temp JSONB,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_tipo_pagamento CHECK (tipo_pagamento IN ('PIX', 'CREDITO', 'DEBITO', 'CRIPTO')),
    CONSTRAINT check_provider CHECK (provider IN ('REDE', 'ITAU', 'BINANCE_PAY'))
);

-- Tabela de doadores
CREATE TABLE IF NOT EXISTS doadores (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255),
    whatsapp VARCHAR(20),
    anonimo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de transações confirmadas
CREATE TABLE IF NOT EXISTS transacoes (
    id SERIAL PRIMARY KEY,
    cobranca_txid VARCHAR(35) NOT NULL REFERENCES cobrancas(txid) ON DELETE CASCADE,
    doador_id INTEGER REFERENCES doadores(id) ON DELETE SET NULL,
    valor DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMADA',
    tipo_pagamento VARCHAR(20) NOT NULL DEFAULT 'PIX',
    provider VARCHAR(50) NOT NULL DEFAULT 'REDE',
    rede_tid VARCHAR(100),
    provider_tid VARCHAR(100),
    bandeira_cartao VARCHAR(50),
    parcelas INTEGER,
    crypto_currency VARCHAR(20),
    crypto_address VARCHAR(255),
    confirmado_em TIMESTAMP,
    webhook_recebido_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dados_webhook JSONB,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_tipo_pagamento_transacoes CHECK (tipo_pagamento IN ('PIX', 'CREDITO', 'DEBITO', 'CRIPTO')),
    CONSTRAINT check_provider_transacoes CHECK (provider IN ('REDE', 'ITAU', 'BINANCE_PAY'))
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_cobrancas_status ON cobrancas(status);
CREATE INDEX IF NOT EXISTS idx_cobrancas_campanha ON cobrancas(campanha_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_tipo_pagamento ON cobrancas(tipo_pagamento);
CREATE INDEX IF NOT EXISTS idx_cobrancas_provider ON cobrancas(provider);
CREATE INDEX IF NOT EXISTS idx_cobrancas_rede_tid ON cobrancas(rede_tid) WHERE rede_tid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cobrancas_provider_tid ON cobrancas(provider_tid) WHERE provider_tid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cobrancas_crypto_currency ON cobrancas(crypto_currency) WHERE crypto_currency IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transacoes_txid ON transacoes(cobranca_txid);
CREATE INDEX IF NOT EXISTS idx_transacoes_doador ON transacoes(doador_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_tipo_pagamento ON transacoes(tipo_pagamento);
CREATE INDEX IF NOT EXISTS idx_transacoes_provider ON transacoes(provider);
CREATE INDEX IF NOT EXISTS idx_transacoes_rede_tid ON transacoes(rede_tid) WHERE rede_tid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transacoes_provider_tid ON transacoes(provider_tid) WHERE provider_tid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transacoes_crypto_currency ON transacoes(crypto_currency) WHERE crypto_currency IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_doadores_whatsapp ON doadores(whatsapp) WHERE whatsapp IS NOT NULL;

-- Função para atualizar o campo atualizado_em automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar atualizado_em na tabela cobrancas
CREATE TRIGGER update_cobrancas_updated_at 
    BEFORE UPDATE ON cobrancas 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

