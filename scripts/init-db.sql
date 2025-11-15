-- Script de inicialização do banco de dados PostgreSQL
-- Compatível com Vercel Postgres

-- Tabela de cobranças PIX
CREATE TABLE IF NOT EXISTS cobrancas (
    txid VARCHAR(35) PRIMARY KEY,
    valor DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'AGUARDANDO',
    campanha_id VARCHAR(50),
    chave_pix VARCHAR(77) NOT NULL,
    brcode TEXT,
    expiracao INTEGER NOT NULL DEFAULT 3600,
    dados_doador_temp JSONB,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    confirmado_em TIMESTAMP,
    webhook_recebido_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dados_webhook JSONB,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_cobrancas_status ON cobrancas(status);
CREATE INDEX IF NOT EXISTS idx_cobrancas_campanha ON cobrancas(campanha_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_txid ON transacoes(cobranca_txid);
CREATE INDEX IF NOT EXISTS idx_transacoes_doador ON transacoes(doador_id);
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

