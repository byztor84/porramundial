DROP POLICY IF EXISTS "predictions_read_own" ON predictions;
DROP POLICY IF EXISTS "predictions_read_pool_members" ON predictions;
DROP POLICY IF EXISTS "predictions_admin_read_all" ON predictions;
DROP POLICY IF EXISTS "predictions_pool_read" ON predictions;
DROP POLICY IF EXISTS "predictions_insert_own" ON predictions;
DROP POLICY IF EXISTS "predictions_update_own" ON predictions;

DROP POLICY IF EXISTS "bracket_read_own" ON bracket_predictions;
DROP POLICY IF EXISTS "bracket_read_pool_members" ON bracket_predictions;
DROP POLICY IF EXISTS "bracket_admin_read_all" ON bracket_predictions;
DROP POLICY IF EXISTS "bracket_pool_read" ON bracket_predictions;
DROP POLICY IF EXISTS "bracket_insert_own" ON bracket_predictions;

DROP POLICY IF EXISTS "honors_read_own" ON honors_predictions;
DROP POLICY IF EXISTS "honors_read_pool_members" ON honors_predictions;
DROP POLICY IF EXISTS "honors_admin_read_all" ON honors_predictions;
DROP POLICY IF EXISTS "honors_pool_read" ON honors_predictions;
DROP POLICY IF EXISTS "honors_insert_own" ON honors_predictions;

DROP POLICY IF EXISTS "standings_read_pool" ON standings;
DROP POLICY IF EXISTS "standings_admin_all" ON standings;
DROP POLICY IF EXISTS "standings_pool_read" ON standings;

CREATE POLICY "predictions_admin_read_all" ON predictions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "predictions_pool_read" ON predictions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM pool_members WHERE pool_id = predictions.pool_id AND user_id = auth.uid()));

CREATE POLICY "predictions_insert_own" ON predictions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "predictions_update_own" ON predictions FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "bracket_admin_read_all" ON bracket_predictions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "bracket_pool_read" ON bracket_predictions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM pool_members WHERE pool_id = bracket_predictions.pool_id AND user_id = auth.uid()));

CREATE POLICY "bracket_insert_own" ON bracket_predictions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "honors_admin_read_all" ON honors_predictions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "honors_pool_read" ON honors_predictions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM pool_members WHERE pool_id = honors_predictions.pool_id AND user_id = auth.uid()));

CREATE POLICY "honors_insert_own" ON honors_predictions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "standings_admin_all" ON standings FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "standings_pool_read" ON standings FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM pool_members WHERE pool_id = standings.pool_id AND user_id = auth.uid()));
