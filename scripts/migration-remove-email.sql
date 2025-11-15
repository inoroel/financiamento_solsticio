-- Script de migração para remover campo email da tabela doadores
-- Execute este script se a tabela doadores já existir com o campo email

-- Remove índice do email se existir
DROP INDEX IF EXISTS idx_doadores_email;

-- Remove coluna email se existir
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'doadores' 
        AND column_name = 'email'
    ) THEN
        ALTER TABLE doadores DROP COLUMN email;
        RAISE NOTICE 'Coluna email removida com sucesso';
    ELSE
        RAISE NOTICE 'Coluna email não existe';
    END IF;
END $$;

