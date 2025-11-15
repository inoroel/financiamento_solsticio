-- Script de migração para adicionar campo WhatsApp na tabela doadores
-- Execute este script se a tabela doadores já existir sem o campo whatsapp

-- Adiciona coluna whatsapp se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'doadores' 
        AND column_name = 'whatsapp'
    ) THEN
        ALTER TABLE doadores ADD COLUMN whatsapp VARCHAR(20);
        RAISE NOTICE 'Coluna whatsapp adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna whatsapp já existe';
    END IF;
END $$;

-- Cria índice se não existir
CREATE INDEX IF NOT EXISTS idx_doadores_whatsapp ON doadores(whatsapp) WHERE whatsapp IS NOT NULL;

