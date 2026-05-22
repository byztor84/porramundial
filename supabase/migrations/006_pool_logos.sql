-- Añadir soporte para logos personalizados por porra
ALTER TABLE pools ADD COLUMN IF NOT EXISTS logo_url TEXT;
