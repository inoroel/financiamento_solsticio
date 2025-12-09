-- Script de migração: Adicionar coluna mensagem na tabela doadores
-- Execute este script se o banco de dados já existe e precisa adicionar a coluna mensagem

-- Adiciona coluna mensagem se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'doadores' 
        AND column_name = 'mensagem'
    ) THEN
        ALTER TABLE doadores ADD COLUMN mensagem TEXT;
        RAISE NOTICE 'Coluna mensagem adicionada com sucesso na tabela doadores';
    ELSE
        RAISE NOTICE 'Coluna mensagem já existe na tabela doadores';
    END IF;
END $$;
