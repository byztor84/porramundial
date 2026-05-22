-- ============================================
-- Migración a Arquitectura Multi-Porra
-- ============================================

-- 1. Crear tablas de Pools (Porras)
CREATE TABLE IF NOT EXISTS pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  entry_fee NUMERIC DEFAULT 0,
  invite_code TEXT NOT NULL UNIQUE,
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pool_members (
  pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  has_paid BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (pool_id, user_id)
);

-- Borramos datos existentes de predicciones ya que la estructura fundamental cambia
TRUNCATE TABLE predictions CASCADE;
TRUNCATE TABLE bracket_predictions CASCADE;
TRUNCATE TABLE honors_predictions CASCADE;
TRUNCATE TABLE standings CASCADE;

-- 2. Alter predictions
ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_user_id_match_id_key;
ALTER TABLE predictions ADD COLUMN pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE;
ALTER TABLE predictions ADD CONSTRAINT predictions_user_id_match_id_pool_id_key UNIQUE(user_id, match_id, pool_id);

-- 3. Alter bracket_predictions
ALTER TABLE bracket_predictions DROP CONSTRAINT IF EXISTS bracket_predictions_user_id_stage_team_id_key;
ALTER TABLE bracket_predictions ADD COLUMN pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE;
ALTER TABLE bracket_predictions ADD CONSTRAINT bracket_predictions_user_id_stage_team_id_pool_id_key UNIQUE(user_id, stage, team_id, pool_id);

-- 4. Alter honors_predictions
ALTER TABLE honors_predictions DROP CONSTRAINT IF EXISTS honors_predictions_user_id_key;
ALTER TABLE honors_predictions ADD COLUMN pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE;
ALTER TABLE honors_predictions ADD CONSTRAINT honors_predictions_user_id_pool_id_key UNIQUE(user_id, pool_id);

-- 5. Alter standings
ALTER TABLE standings DROP CONSTRAINT IF EXISTS standings_pkey CASCADE;
ALTER TABLE standings ADD COLUMN pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE;
ALTER TABLE standings ADD PRIMARY KEY (user_id, pool_id);

-- 6. Modificar el Trigger de nuevos usuarios
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    new.email
  );
  -- Ya no se inserta en standings por defecto, se hará cuando el usuario se una a un pool
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Trigger para crear el standings automáticamente al unirse a una porra
CREATE OR REPLACE FUNCTION handle_new_pool_member()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.standings (user_id, pool_id)
  VALUES (NEW.user_id, NEW.pool_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_pool_member_created ON pool_members;
CREATE TRIGGER on_pool_member_created
  AFTER INSERT ON pool_members
  FOR EACH ROW EXECUTE PROCEDURE handle_new_pool_member();

-- 8. RPC: Función para unirse a una porra con el código de invitación
CREATE OR REPLACE FUNCTION join_pool(invite_code_input TEXT)
RETURNS UUID AS $$
DECLARE
  target_pool_id UUID;
BEGIN
  -- Encontrar el pool_id correspondiente al invite_code
  SELECT id INTO target_pool_id FROM pools WHERE invite_code = invite_code_input LIMIT 1;
  
  IF target_pool_id IS NULL THEN
    RAISE EXCEPTION 'Código de invitación inválido';
  END IF;

  -- Insertar en pool_members
  INSERT INTO pool_members (pool_id, user_id, role)
  VALUES (target_pool_id, auth.uid(), 'member')
  ON CONFLICT (pool_id, user_id) DO NOTHING;

  RETURN target_pool_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. RLS Policies
ALTER TABLE pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pools_read_member" ON pools FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM pool_members WHERE pool_id = pools.id AND user_id = auth.uid()));
CREATE POLICY "pools_insert" ON pools FOR INSERT TO authenticated WITH CHECK (creator_id = auth.uid());
CREATE POLICY "pools_update" ON pools FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM pool_members WHERE pool_id = pools.id AND user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "pools_delete" ON pools FOR DELETE TO authenticated USING (creator_id = auth.uid());

CREATE POLICY "pool_members_read" ON pool_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "pool_members_insert_own" ON pool_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "pool_members_delete" ON pool_members FOR DELETE TO authenticated USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM pools WHERE pools.id = pool_members.pool_id AND pools.creator_id = auth.uid()));

-- Reemplazar RLS antigua de standings
DROP POLICY IF EXISTS "standings_read_all" ON standings;
CREATE POLICY "standings_read_pool" ON standings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM pool_members WHERE pool_id = standings.pool_id AND user_id = auth.uid()));
