-- Agregar columna de bloqueo de predicción por porra
ALTER TABLE pool_members ADD COLUMN IF NOT EXISTS prediction_locked BOOLEAN DEFAULT FALSE;

-- Actualizar RLS para permitir al usuario actualizar su propio estado de bloqueo
CREATE POLICY "pool_members_update_own" ON pool_members 
FOR UPDATE TO authenticated 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
