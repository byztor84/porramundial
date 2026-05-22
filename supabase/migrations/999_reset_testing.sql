-- 🧹 SCRIPT DE RESET TOTAL PARA PRUEBAS (Porra Mundial GINSO)
-- Ejecuta este script en el SQL Editor de Supabase para volver al punto inicial de la competición.

-- 1. Borrar todas las predicciones de los usuarios en todos los niveles
TRUNCATE TABLE predictions CASCADE;
TRUNCATE TABLE bracket_predictions CASCADE;
TRUNCATE TABLE honors_predictions CASCADE;

-- 2. Borrar todos los resultados reales introducidos por el admin (vuelve a modo pre-torneo)
TRUNCATE TABLE results CASCADE;

-- 3. Borrar y re-inicializar los puntos de todos los jugadores
TRUNCATE TABLE standings CASCADE;
INSERT INTO standings (user_id)
SELECT id FROM profiles
ON CONFLICT (user_id) DO NOTHING;

-- 4. Desbloquear todas las porras y perfiles para permitir nuevos cambios
UPDATE profiles SET prediction_locked = FALSE;
UPDATE pool_members SET prediction_locked = FALSE;

-- 5. Resetear los equipos asignados a la fase eliminatoria (vuelven a ser TBD)
UPDATE matches 
SET team_a_id = NULL, 
    team_b_id = NULL 
WHERE stage != 'group';

-- 6. Resetear configuración del torneo a valores por defecto
UPDATE tournament_config SET value = 'ESP' WHERE key = 'national_team';
UPDATE tournament_config SET value = '' WHERE key IN ('champion_id', 'runner_up_id', 'top_scorer');

-- 7. (Opcional) Si quieres borrar también los equipos y partidos para volver a seedear:
-- TRUNCATE TABLE matches CASCADE;
-- TRUNCATE TABLE teams CASCADE;
-- NOTA: Si haces esto, tendrás que ejecutar de nuevo el script 002_seed_matches.sql
