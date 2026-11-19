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
    CONSTRAINT check_provider CHECK (provider IN ('REDE', 'STELLAR'))
);

-- Tabela de doadores
CREATE TABLE IF NOT EXISTS doadores (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255),
    whatsapp VARCHAR(20),
    anonimo BOOLEAN NOT NULL DEFAULT true,
    mensagem TEXT,
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
    CONSTRAINT check_provider_transacoes CHECK (provider IN ('REDE', 'STELLAR'))
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

-- Tabela de administradores autorizados (Google OAuth)
CREATE TABLE IF NOT EXISTS admin_users (
    email VARCHAR(255) PRIMARY KEY,
    role VARCHAR(20) NOT NULL DEFAULT 'admin',
    active BOOLEAN NOT NULL DEFAULT true,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_admin_role CHECK (role IN ('root', 'admin'))
);

-- Tabela de auditoria de estornos
CREATE TABLE IF NOT EXISTS estornos_log (
    id SERIAL PRIMARY KEY,
    tid VARCHAR(100) NOT NULL,
    cobranca_txid VARCHAR(35),
    valor_estornado DECIMAL(10, 2),
    estorno_total BOOLEAN NOT NULL DEFAULT true,
    refund_id VARCHAR(100),
    cancel_id VARCHAR(100),
    nsu VARCHAR(100),
    status VARCHAR(40) NOT NULL,
    return_code VARCHAR(20),
    return_message TEXT,
    admin_email VARCHAR(255) NOT NULL,
    motivo TEXT,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_estornos_log_tid ON estornos_log(tid);
CREATE INDEX IF NOT EXISTS idx_estornos_log_admin ON estornos_log(admin_email);
CREATE INDEX IF NOT EXISTS idx_estornos_log_criado_em ON estornos_log(criado_em DESC);

-- Tabela de tiers de recompensa
CREATE TABLE IF NOT EXISTS reward_tiers (
    slug VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    min_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    color VARCHAR(20) NOT NULL DEFAULT '#6b7280',
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_reward_tier_min_amount CHECK (min_amount >= 0)
);

-- Tabela de recompensas e estoque disponível
CREATE TABLE IF NOT EXISTS rewards (
    id SERIAL PRIMARY KEY,
    code VARCHAR(60) UNIQUE,
    tier_slug VARCHAR(50) NOT NULL REFERENCES reward_tiers(slug) ON UPDATE CASCADE ON DELETE RESTRICT,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    quantidade_disponivel INTEGER,
    active BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_rewards_quantidade CHECK (quantidade_disponivel IS NULL OR quantidade_disponivel >= 0)
);

CREATE INDEX IF NOT EXISTS idx_rewards_tier_slug ON rewards(tier_slug);

-- Tabela de controle de entregas de recompensas aos doadores
CREATE TABLE IF NOT EXISTS reward_deliveries (
    id SERIAL PRIMARY KEY,
    reward_id INTEGER NOT NULL REFERENCES rewards(id) ON DELETE RESTRICT,
    doador_id INTEGER NOT NULL REFERENCES doadores(id) ON DELETE RESTRICT,
    quantidade INTEGER NOT NULL DEFAULT 1,
    data_entrega DATE NOT NULL,
    observacoes TEXT,
    registrado_por VARCHAR(255) NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_reward_delivery_qty CHECK (quantidade > 0)
);

CREATE INDEX IF NOT EXISTS idx_reward_deliveries_reward_id ON reward_deliveries(reward_id);
CREATE INDEX IF NOT EXISTS idx_reward_deliveries_doador_id ON reward_deliveries(doador_id);
CREATE INDEX IF NOT EXISTS idx_reward_deliveries_data ON reward_deliveries(data_entrega DESC);

-- Tabela de metas de doação
CREATE TABLE IF NOT EXISTS metas_doacao (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(60) UNIQUE NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    descricao TEXT,
    valor_meta DECIMAL(12, 2) NOT NULL,
    valor_inicial DECIMAL(12, 2) NOT NULL DEFAULT 0,
    campanha_id VARCHAR(50),
    data_inicio DATE,
    data_fim DATE,
    ordem INTEGER NOT NULL DEFAULT 0,
    destaque BOOLEAN NOT NULL DEFAULT false,
    ativa BOOLEAN NOT NULL DEFAULT true,
    atualizado_por VARCHAR(255),
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_metas_valor_meta CHECK (valor_meta > 0),
    CONSTRAINT check_metas_valor_inicial CHECK (valor_inicial >= 0),
    CONSTRAINT check_metas_datas CHECK (data_inicio IS NULL OR data_fim IS NULL OR data_fim >= data_inicio)
);

CREATE INDEX IF NOT EXISTS idx_metas_doacao_ativa ON metas_doacao(ativa);
CREATE INDEX IF NOT EXISTS idx_metas_doacao_campanha ON metas_doacao(campanha_id) WHERE campanha_id IS NOT NULL;

-- Função para atualizar o campo atualizado_em automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar atualizado_em na tabela cobrancas
DROP TRIGGER IF EXISTS update_cobrancas_updated_at ON cobrancas;
CREATE TRIGGER update_cobrancas_updated_at 
    BEFORE UPDATE ON cobrancas 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

