-- ============================================
-- Porra Mundial - Schema de Base de Datos
-- Supabase PostgreSQL
-- FIFA World Cup 2026 (48 equipos)
-- ============================================

-- PROFILES (extiende auth.users de Supabase)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  prediction_locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TEAMS (48 equipos del Mundial)
CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  group_letter CHAR(1) NOT NULL,
  fifa_ranking INTEGER DEFAULT 0,
  flag_emoji TEXT DEFAULT '🏳️'
);

-- MATCHES (todos los partidos del torneo)
CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  stage TEXT NOT NULL CHECK (stage IN ('group','R32','R16','QF','SF','3rd','F')),
  group_letter CHAR(1),
  match_number INTEGER UNIQUE,
  team_a_id INTEGER REFERENCES teams(id),
  team_b_id INTEGER REFERENCES teams(id),
  match_datetime TIMESTAMPTZ,
  is_bonus BOOLEAN DEFAULT FALSE,
  venue TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PREDICTIONS (predicciones de marcador por partido)
CREATE TABLE IF NOT EXISTS predictions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  predicted_score_a INTEGER NOT NULL DEFAULT 0 CHECK (predicted_score_a >= 0 AND predicted_score_a <= 20),
  predicted_score_b INTEGER NOT NULL DEFAULT 0 CHECK (predicted_score_b >= 0 AND predicted_score_b <= 20),
  predicted_winner_id INTEGER REFERENCES teams(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, match_id)
);

-- RESULTS (resultados reales introducidos por admin)
CREATE TABLE IF NOT EXISTS results (
  match_id INTEGER PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  score_a INTEGER NOT NULL CHECK (score_a >= 0),
  score_b INTEGER NOT NULL CHECK (score_b >= 0),
  winner_id INTEGER REFERENCES teams(id),
  yellow_cards_a INTEGER DEFAULT 0,
  red_cards_a INTEGER DEFAULT 0,
  yellow_cards_b INTEGER DEFAULT 0,
  red_cards_b INTEGER DEFAULT 0,
  entered_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- BRACKET PREDICTIONS (equipos clasificados a cada ronda según el usuario)
CREATE TABLE IF NOT EXISTS bracket_predictions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('R32','R16','QF','SF','F','champion')),
  team_id INTEGER NOT NULL REFERENCES teams(id),
  UNIQUE(user_id, stage, team_id)
);

-- HONORS PREDICTIONS (cuadro de honor)
CREATE TABLE IF NOT EXISTS honors_predictions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  champion_id INTEGER REFERENCES teams(id),
  runner_up_id INTEGER REFERENCES teams(id),
  top_scorer TEXT DEFAULT '',
  UNIQUE(user_id)
);

-- STANDINGS (ranking calculado - se actualiza tras cada resultado)
CREATE TABLE IF NOT EXISTS standings (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  total_points INTEGER DEFAULT 0,
  exact_hits INTEGER DEFAULT 0,
  match_points INTEGER DEFAULT 0,
  bracket_points INTEGER DEFAULT 0,
  honors_points INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TOURNAMENT CONFIG (configuración global)
CREATE TABLE IF NOT EXISTS tournament_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Insertar configuración por defecto
INSERT INTO tournament_config (key, value) VALUES
  ('national_team', 'ESP'),
  ('champion_id', ''),
  ('runner_up_id', ''),
  ('top_scorer', '')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE bracket_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE honors_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_config ENABLE ROW LEVEL SECURITY;

-- Teams: lectura pública
CREATE POLICY "teams_read_all" ON teams FOR SELECT TO authenticated USING (true);

-- Matches: lectura pública
CREATE POLICY "matches_read_all" ON matches FOR SELECT TO authenticated USING (true);

-- Profiles: lectura pública (para ranking), update del propio
CREATE POLICY "profiles_read_all" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Predictions: CRUD propio
CREATE POLICY "predictions_read_own" ON predictions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "predictions_insert_own" ON predictions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "predictions_update_own" ON predictions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "predictions_delete_own" ON predictions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Results: lectura pública
CREATE POLICY "results_read_all" ON results FOR SELECT TO authenticated USING (true);
CREATE POLICY "results_admin_insert" ON results FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "results_admin_update" ON results FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Bracket predictions: CRUD propio
CREATE POLICY "bracket_read_own" ON bracket_predictions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "bracket_insert_own" ON bracket_predictions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bracket_update_own" ON bracket_predictions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "bracket_delete_own" ON bracket_predictions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Honors predictions: CRUD propio
CREATE POLICY "honors_read_own" ON honors_predictions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "honors_insert_own" ON honors_predictions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "honors_update_own" ON honors_predictions FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Standings: lectura pública
CREATE POLICY "standings_read_all" ON standings FOR SELECT TO authenticated USING (true);
CREATE POLICY "standings_admin_all" ON standings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Tournament config: lectura pública, escritura admin
CREATE POLICY "config_read_all" ON tournament_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "config_admin_write" ON tournament_config FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================
-- REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE standings;

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-crear profile cuando un usuario se registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, email, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    new.email,
    CASE WHEN new.email = 'vromero@ginso.org' THEN 'admin' ELSE 'user' END
  );
  
  -- También crear entrada de standings vacía
  INSERT INTO public.standings (user_id)
  VALUES (new.id);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para nuevo usuario
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER predictions_updated_at
  BEFORE UPDATE ON predictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER results_updated_at
  BEFORE UPDATE ON results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER standings_updated_at
  BEFORE UPDATE ON standings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- SEED DATA: 48 EQUIPOS
-- ============================================
INSERT INTO teams (name, code, group_letter, fifa_ranking, flag_emoji) VALUES
  -- Grupo A
  ('Canadá', 'CAN', 'A', 43, '🇨🇦'),
  ('Argentina', 'ARG', 'A', 1, '🇦🇷'),
  ('Marruecos', 'MAR', 'A', 14, '🇲🇦'),
  ('Australia', 'AUS', 'A', 24, '🇦🇺'),
  -- Grupo B
  ('México', 'MEX', 'B', 15, '🇲🇽'),
  ('Colombia', 'COL', 'B', 11, '🇨🇴'),
  ('Senegal', 'SEN', 'B', 20, '🇸🇳'),
  ('Nueva Zelanda', 'NZL', 'B', 93, '🇳🇿'),
  -- Grupo C
  ('Estados Unidos', 'USA', 'C', 16, '🇺🇸'),
  ('Brasil', 'BRA', 'C', 5, '🇧🇷'),
  ('Turquía', 'TUR', 'C', 26, '🇹🇷'),
  ('China', 'CHN', 'C', 89, '🇨🇳'),
  -- Grupo D
  ('Indonesia', 'IDN', 'D', 100, '🇮🇩'),
  ('Países Bajos', 'NED', 'D', 3, '🇳🇱'),
  ('Japón', 'JPN', 'D', 17, '🇯🇵'),
  ('Kenia', 'KEN', 'D', 105, '🇰🇪'),
  -- Grupo E
  ('Alemania', 'GER', 'E', 4, '🇩🇪'),
  ('Uruguay', 'URU', 'E', 10, '🇺🇾'),
  ('Panamá', 'PAN', 'E', 44, '🇵🇦'),
  ('Italia', 'ITA', 'E', 7, '🇮🇹'),
  -- Grupo F
  ('Portugal', 'POR', 'F', 6, '🇵🇹'),
  ('España', 'ESP', 'F', 2, '🇪🇸'),
  ('Paraguay', 'PAR', 'F', 54, '🇵🇾'),
  ('Arabia Saudí', 'KSA', 'F', 60, '🇸🇦'),
  -- Grupo G
  ('Francia', 'FRA', 'G', 8, '🇫🇷'),
  ('Uzbekistán', 'UZB', 'G', 62, '🇺🇿'),
  ('Honduras', 'HON', 'G', 73, '🇭🇳'),
  ('Corea del Sur', 'KOR', 'G', 22, '🇰🇷'),
  -- Grupo H
  ('Inglaterra', 'ENG', 'H', 9, '🏴󠁧󠁢󠁥󠁮󠁧󠁿'),
  ('Ecuador', 'ECU', 'H', 30, '🇪🇨'),
  ('Serbia', 'SRB', 'H', 33, '🇷🇸'),
  ('Bahréin', 'BHR', 'H', 81, '🇧🇭'),
  -- Grupo I
  ('Dinamarca', 'DEN', 'I', 18, '🇩🇰'),
  ('Perú', 'PER', 'I', 35, '🇵🇪'),
  ('Irán', 'IRN', 'I', 21, '🇮🇷'),
  ('Camerún', 'CMR', 'I', 48, '🇨🇲'),
  -- Grupo J
  ('Croacia', 'CRO', 'J', 12, '🇭🇷'),
  ('Bélgica', 'BEL', 'J', 13, '🇧🇪'),
  ('Venezuela', 'VEN', 'J', 29, '🇻🇪'),
  ('Costa de Marfil', 'CIV', 'J', 36, '🇨🇮'),
  -- Grupo K
  ('Suiza', 'SUI', 'K', 19, '🇨🇭'),
  ('Austria', 'AUT', 'K', 23, '🇦🇹'),
  ('Chile', 'CHI', 'K', 31, '🇨🇱'),
  ('Ghana', 'GHA', 'K', 67, '🇬🇭'),
  -- Grupo L
  ('Nigeria', 'NGA', 'L', 28, '🇳🇬'),
  ('Egipto', 'EGY', 'L', 34, '🇪🇬'),
  ('Bolivia', 'BOL', 'L', 82, '🇧🇴'),
  ('Gales', 'WAL', 'L', 27, '🏴󠁧󠁢󠁷󠁬󠁳󠁿')
ON CONFLICT (code) DO NOTHING;
