
DO $$
DECLARE
    target_pool_id UUID;
    new_user_id UUID;
    match_rec RECORD;
    i INTEGER;
    random_score_a INTEGER;
    random_score_b INTEGER;
    random_team_a UUID;
    random_team_b UUID;
BEGIN
    -- 1. Obtener el Pool principal
    SELECT id INTO target_pool_id FROM pools ORDER BY created_at ASC LIMIT 1;
    
    IF target_pool_id IS NULL THEN
        -- Crear un pool si no existe (fallback)
        target_pool_id := gen_random_uuid();
        INSERT INTO public.profiles (id, first_name, last_name, email)
        VALUES (gen_random_uuid(), 'Admin', 'Test', 'admin@test.com')
        ON CONFLICT DO NOTHING;
        
        INSERT INTO pools (id, name, description, invite_code, creator_id)
        VALUES (target_pool_id, 'Pool de Prueba', 'Generada automáticamente', 'TEST2026', (SELECT id FROM profiles LIMIT 1));
    END IF;

    -- 2. Crear 5 usuarios ficticios
    FOR i IN 1..5 LOOP
        new_user_id := gen_random_uuid();
        
        -- Insertar Perfil
        INSERT INTO public.profiles (id, first_name, last_name, email, prediction_locked)
        VALUES (
            new_user_id,
            'Usuario' || i,
            'Prueba',
            'user' || i || '@test.com',
            TRUE
        );
        
        -- Insertar en Pool
        INSERT INTO public.pool_members (pool_id, user_id, role, has_paid, prediction_locked)
        VALUES (
            target_pool_id,
            new_user_id,
            'member',
            (i <= 3), -- 3 participan por premio (has_paid = true)
            TRUE      -- Predicción bloqueada
        );

        -- 3. Generar Predicciones Aleatorias para todos los partidos
        FOR match_rec IN SELECT id, stage FROM matches LOOP
            random_score_a := floor(random() * 4); -- 0 a 3 goles
            random_score_b := floor(random() * 4);
            
            INSERT INTO public.predictions (user_id, pool_id, match_id, predicted_score_a, predicted_score_b, predicted_winner_id)
            VALUES (
                new_user_id,
                target_pool_id,
                match_rec.id,
                random_score_a,
                random_score_b,
                CASE 
                    WHEN match_rec.stage != 'group' AND random_score_a = random_score_b THEN
                        -- Si es empate en eliminatorias, elegimos un ganador aleatorio de entre todos los equipos
                        -- (esto es simplificado para el test, el motor del bracket lo gestionará)
                        (SELECT id FROM teams ORDER BY random() LIMIT 1)
                    ELSE NULL
                END
            );
        END LOOP;

        -- 4. Cuadro de Honor Aleatorio
        INSERT INTO public.honors_predictions (user_id, pool_id, champion_id, runner_up_id, top_scorer)
        VALUES (
            new_user_id,
            target_pool_id,
            (SELECT id FROM teams ORDER BY random() LIMIT 1),
            (SELECT id FROM teams ORDER BY random() LIMIT 1),
            CASE i 
                WHEN 1 THEN 'Kylian Mbappé'
                WHEN 2 THEN 'Lamine Yamal'
                WHEN 3 THEN 'Erling Haaland'
                WHEN 4 THEN 'Vinicius Jr'
                ELSE 'Harry Kane'
            END
        );
    END LOOP;
    
    RAISE NOTICE 'Se han creado 5 usuarios de prueba con predicciones aleatorias en el pool %', target_pool_id;
END $$;
