-- Permitir que los administradores de la porra marquen como pagado a los miembros
CREATE POLICY "pool_members_admin_update" ON pool_members 
FOR UPDATE TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM pool_members AS pm 
    WHERE pm.pool_id = pool_members.pool_id 
    AND pm.user_id = auth.uid() 
    AND pm.role = 'admin'
  )
);

-- Nota: Ya añadimos logo_url en 006, pero nos aseguramos de que el admin pueda editarlo
CREATE POLICY "pools_admin_update" ON pools 
FOR UPDATE TO authenticated 
USING (creator_id = auth.uid() OR EXISTS (SELECT 1 FROM pool_members WHERE pool_id = pools.id AND user_id = auth.uid() AND role = 'admin'));
