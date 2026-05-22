-- 1. Hacer a vromero@ginso.org administrador
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'vromero@ginso.org';

-- 2. Actualizar Fechas y Sedes de la Fase Final (Dieciseisavos a Final)
-- Fechas ajustadas a horario CET/CEST (España)

-- DIECISEISAVOS
UPDATE public.matches SET match_datetime = '2026-06-28 21:00:00+02', venue = 'SoFi Stadium, Los Angeles' WHERE match_number = 73;
UPDATE public.matches SET match_datetime = '2026-06-29 22:30:00+02', venue = 'Gillette Stadium, Boston' WHERE match_number = 74;
UPDATE public.matches SET match_datetime = '2026-06-30 03:00:00+02', venue = 'Estadio BBVA, Monterrey' WHERE match_number = 75;
UPDATE public.matches SET match_datetime = '2026-06-29 19:00:00+02', venue = 'NRG Stadium, Houston' WHERE match_number = 76;
UPDATE public.matches SET match_datetime = '2026-06-30 23:00:00+02', venue = 'MetLife Stadium, New Jersey' WHERE match_number = 77;
UPDATE public.matches SET match_datetime = '2026-06-30 19:00:00+02', venue = 'AT&T Stadium, Arlington' WHERE match_number = 78;
UPDATE public.matches SET match_datetime = '2026-07-01 03:00:00+02', venue = 'Estadio Azteca, CDMX' WHERE match_number = 79;
UPDATE public.matches SET match_datetime = '2026-07-01 18:00:00+02', venue = 'Mercedes-Benz Stadium, Atlanta' WHERE match_number = 80;
UPDATE public.matches SET match_datetime = '2026-07-02 02:00:00+02', venue = 'Levi''s Stadium, Santa Clara' WHERE match_number = 81;
UPDATE public.matches SET match_datetime = '2026-07-01 22:00:00+02', venue = 'Lumen Field, Seattle' WHERE match_number = 82;
UPDATE public.matches SET match_datetime = '2026-07-02 01:00:00+02', venue = 'BMO Field, Toronto' WHERE match_number = 83;
UPDATE public.matches SET match_datetime = '2026-07-02 21:00:00+02', venue = 'SoFi Stadium, Los Angeles' WHERE match_number = 84;
UPDATE public.matches SET match_datetime = '2026-07-02 05:00:00+02', venue = 'BC Place, Vancouver' WHERE match_number = 85;
UPDATE public.matches SET match_datetime = '2026-07-03 00:00:00+02', venue = 'Hard Rock Stadium, Miami' WHERE match_number = 86;
UPDATE public.matches SET match_datetime = '2026-07-03 03:30:00+02', venue = 'Arrowhead Stadium, Kansas City' WHERE match_number = 87;
UPDATE public.matches SET match_datetime = '2026-07-03 20:00:00+02', venue = 'AT&T Stadium, Arlington' WHERE match_number = 88;

-- OCTAVOS
UPDATE public.matches SET match_datetime = '2026-07-04 19:00:00+02', venue = 'NRG Stadium, Houston' WHERE match_number = 90;
UPDATE public.matches SET match_datetime = '2026-07-04 23:00:00+02', venue = 'Lincoln Financial Field, Philadelphia' WHERE match_number = 89;
UPDATE public.matches SET match_datetime = '2026-07-06 02:00:00+02', venue = 'Estadio Azteca, CDMX' WHERE match_number = 92;
UPDATE public.matches SET match_datetime = '2026-07-05 22:00:00+02', venue = 'MetLife Stadium, New Jersey' WHERE match_number = 91;
UPDATE public.matches SET match_datetime = '2026-07-06 21:00:00+02', venue = 'AT&T Stadium, Arlington' WHERE match_number = 93;
UPDATE public.matches SET match_datetime = '2026-07-07 02:00:00+02', venue = 'Lumen Field, Seattle' WHERE match_number = 94;
UPDATE public.matches SET match_datetime = '2026-07-07 18:00:00+02', venue = 'Mercedes-Benz Stadium, Atlanta' WHERE match_number = 95;
UPDATE public.matches SET match_datetime = '2026-07-07 22:00:00+02', venue = 'BC Place, Vancouver' WHERE match_number = 96;

-- CUARTOS
UPDATE public.matches SET match_datetime = '2026-07-09 22:00:00+02', venue = 'Gillette Stadium, Boston' WHERE match_number = 97;
UPDATE public.matches SET match_datetime = '2026-07-10 21:00:00+02', venue = 'SoFi Stadium, Los Angeles' WHERE match_number = 98;
UPDATE public.matches SET match_datetime = '2026-07-11 23:00:00+02', venue = 'Hard Rock Stadium, Miami' WHERE match_number = 99;
UPDATE public.matches SET match_datetime = '2026-07-12 03:00:00+02', venue = 'Arrowhead Stadium, Kansas City' WHERE match_number = 100;

-- SEMIFINALES
UPDATE public.matches SET match_datetime = '2026-07-14 21:00:00+02', venue = 'AT&T Stadium, Arlington' WHERE match_number = 101;
UPDATE public.matches SET match_datetime = '2026-07-15 21:00:00+02', venue = 'Mercedes-Benz Stadium, Atlanta' WHERE match_number = 102;

-- TERCER PUESTO Y FINAL
UPDATE public.matches SET match_datetime = '2026-07-18 23:00:00+02', venue = 'Hard Rock Stadium, Miami' WHERE match_number = 103;
UPDATE public.matches SET match_datetime = '2026-07-19 21:00:00+02', venue = 'MetLife Stadium, New Jersey' WHERE match_number = 104;
