
DO $$
DECLARE
    match_rec RECORD;
    res_a INTEGER;
    res_b INTEGER;
BEGIN
    -- 1. Simular resultados para los primeros 12 partidos (Jornada 1 de algunos grupos)
    FOR match_rec IN SELECT id, team_a_id, team_b_id FROM matches WHERE match_number <= 12 LOOP
        res_a := floor(random() * 4);
        res_b := floor(random() * 4);
        
        INSERT INTO public.results (match_id, score_a, score_b, winner_id)
        VALUES (
            match_rec.id,
            res_a,
            res_b,
            CASE 
                WHEN res_a > res_b THEN match_rec.team_a_id
                WHEN res_b > res_a THEN match_rec.team_b_id
                ELSE NULL
            END
        ) ON CONFLICT (match_id) DO UPDATE 
        SET score_a = EXCLUDED.score_a, 
            score_b = EXCLUDED.score_b, 
            winner_id = EXCLUDED.winner_id;
    END LOOP;

    -- 2. Recalcular standings (esto normalmente lo haría un proceso o trigger, pero lo forzamos)
    -- Nota: En esta arquitectura, el ranking se suele calcular bajo demanda o con un trigger complejo.
    -- Aquí simplemente insertamos los resultados para que la UI los pinte y calcule los puntos en vivo.
    
    RAISE NOTICE 'Se han simulado resultados para los primeros 12 partidos. ¡Revisa el ranking y los perfiles!';
END $$;
