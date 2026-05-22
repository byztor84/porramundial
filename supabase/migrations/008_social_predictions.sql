-- Permitir ver predicciones de otros miembros de la misma porra
DROP POLICY IF EXISTS "predictions_read_own" ON predictions;
CREATE POLICY "predictions_read_pool_members" ON predictions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM pool_members pm
    WHERE pm.pool_id = predictions.pool_id 
    AND pm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "bracket_read_own" ON bracket_predictions;
CREATE POLICY "bracket_read_pool_members" ON bracket_predictions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM pool_members pm
    WHERE pm.user_id = auth.uid()
    -- Como bracket_predictions no tiene pool_id directo, validamos que el usuario dueño de la predicción esté en alguna porra con el usuario actual
    AND pm.pool_id IN (
      SELECT pool_id FROM pool_members WHERE user_id = bracket_predictions.user_id
    )
  )
);

DROP POLICY IF EXISTS "honors_read_own" ON honors_predictions;
CREATE POLICY "honors_read_pool_members" ON honors_predictions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM pool_members pm
    WHERE pm.user_id = auth.uid()
    AND pm.pool_id IN (
      SELECT pool_id FROM pool_members WHERE user_id = honors_predictions.user_id
    )
  )
);
