-- Schema do banco de dados para Bilheteria Virtual
-- Compatível com Vercel Postgres

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    nome VARCHAR(255) NOT NULL,
    cpf VARCHAR(14),
    telefone VARCHAR(20),
    senha_hash VARCHAR(255),
    provider VARCHAR(20) DEFAULT 'email',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de eventos
CREATE TABLE IF NOT EXISTS eventos (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(100) UNIQUE NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    local_nome VARCHAR(255),
    local_endereco TEXT,
    local_cidade VARCHAR(100),
    local_uf CHAR(2),
    data_evento TIMESTAMP NOT NULL,
    data_fim TIMESTAMP,
    imagem_url TEXT,
    banner_url TEXT,
    status VARCHAR(20) DEFAULT 'ATIVO',
    organizador_nome VARCHAR(255),
    classificacao_etaria VARCHAR(20),
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_evento_status CHECK (status IN ('ATIVO', 'ESGOTADO', 'CANCELADO', 'ENCERRADO'))
);

-- Tabela de setores/categorias de ingresso
CREATE TABLE IF NOT EXISTS setores (
    id SERIAL PRIMARY KEY,
    evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    preco DECIMAL(10, 2) NOT NULL,
    quantidade_total INTEGER NOT NULL,
    quantidade_vendida INTEGER DEFAULT 0,
    max_por_pedido INTEGER DEFAULT 10,
    data_inicio_vendas TIMESTAMP,
    data_fim_vendas TIMESTAMP,
    status VARCHAR(20) DEFAULT 'DISPONIVEL',
    ordem INTEGER DEFAULT 0,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_setor_status CHECK (status IN ('DISPONIVEL', 'ESGOTADO', 'ENCERRADO'))
);

-- Tabela de pedidos
CREATE TABLE IF NOT EXISTS pedidos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    evento_id INTEGER NOT NULL REFERENCES eventos(id),
    email_comprador VARCHAR(255) NOT NULL,
    nome_comprador VARCHAR(255) NOT NULL,
    cpf_comprador VARCHAR(14),
    telefone_comprador VARCHAR(20),
    valor_total DECIMAL(10, 2) NOT NULL,
    taxa_servico DECIMAL(10, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'AGUARDANDO',
    tipo_pagamento VARCHAR(20),
    provider VARCHAR(50) DEFAULT 'REDE',
    txid VARCHAR(100),
    dados_pagamento JSONB,
    pago_em TIMESTAMP,
    expira_em TIMESTAMP,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_pedido_status CHECK (status IN ('AGUARDANDO', 'PAGO', 'CANCELADO', 'EXPIRADO')),
    CONSTRAINT check_pedido_tipo CHECK (tipo_pagamento IS NULL OR tipo_pagamento IN ('PIX', 'CREDITO', 'DEBITO', 'CRIPTO'))
);

-- Tabela de ingressos individuais
CREATE TABLE IF NOT EXISTS ingressos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(30) UNIQUE NOT NULL,
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    setor_id INTEGER NOT NULL REFERENCES setores(id),
    nome_titular VARCHAR(255),
    cpf_titular VARCHAR(14),
    status VARCHAR(20) DEFAULT 'VALIDO',
    usado_em TIMESTAMP,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_ingresso_status CHECK (status IN ('VALIDO', 'USADO', 'CANCELADO'))
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_eventos_slug ON eventos(slug);
CREATE INDEX IF NOT EXISTS idx_eventos_data ON eventos(data_evento);
CREATE INDEX IF NOT EXISTS idx_eventos_status ON eventos(status);
CREATE INDEX IF NOT EXISTS idx_setores_evento ON setores(evento_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_usuario ON pedidos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_evento ON pedidos(evento_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_codigo ON pedidos(codigo);
CREATE INDEX IF NOT EXISTS idx_pedidos_txid ON pedidos(txid) WHERE txid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ingressos_pedido ON ingressos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_ingressos_codigo ON ingressos(codigo);
CREATE INDEX IF NOT EXISTS idx_ingressos_status ON ingressos(status);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);

-- Função para atualizar o campo atualizado_em automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para atualizar atualizado_em
CREATE TRIGGER update_eventos_updated_at 
    BEFORE UPDATE ON eventos 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pedidos_updated_at 
    BEFORE UPDATE ON pedidos 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
