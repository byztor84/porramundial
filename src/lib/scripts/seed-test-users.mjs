
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Configuración - Ajusta con tus credenciales locales o de entorno
const supabaseUrl = 'http://localhost:54321';
const supabaseKey = 'service_role_key_here'; // Necesitaremos la service_role para saltar RLS

async function seed() {
  console.log("Iniciando seed de usuarios de prueba...");
}
seed();
