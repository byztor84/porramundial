import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://thlmriucsgaihijekojm.supabase.co';
const supabaseKey = 'sb_publishable_3W-oZraqknNYmBft-QGq_A_rDLktYt2'; // Esta es la Anon Key pública que leímos en .env.local

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('Conectando a Supabase...');
  
  // Consultar profiles
  const { data: profiles, error: pError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, role');
    
  if (pError) {
    console.error('Error al consultar profiles:', pError);
  } else {
    console.log('\n--- PERFILES EN LA BASE DE DATOS (%d) ---', profiles.length);
    profiles.forEach(p => {
      console.log(`- [${p.id}] ${p.first_name} ${p.last_name} (${p.email}) - Rol: ${p.role}`);
    });
  }

  // Consultar pools
  const { data: pools, error: poError } = await supabase
    .from('pools')
    .select('id, name, invite_code');
    
  if (poError) {
    console.error('Error al consultar pools:', poError);
  } else {
    console.log('\n--- PORRAS EN LA BASE DE DATOS (%d) ---', pools?.length || 0);
    pools?.forEach(p => {
      console.log(`- Porra: "${p.name}" (ID: ${p.id}) [Código: ${p.invite_code}]`);
    });
  }

  // Consultar standings
  const { data: standings, error: sError } = await supabase
    .from('standings')
    .select('user_id, pool_id, total_points');
    
  if (sError) {
    console.error('Error al consultar standings:', sError);
  } else {
    console.log('\n--- STANDINGS EN LA BASE DE DATOS (%d) ---', standings?.length || 0);
    standings?.forEach(s => {
      console.log(`- User: ${s.user_id} | Pool: ${s.pool_id} | Puntos: ${s.total_points}`);
    });
  }
  
  // Consultar pool_members
  const { data: members, error: mError } = await supabase
    .from('pool_members')
    .select('pool_id, user_id, role, has_paid');
    
  if (mError) {
    console.error('Error al consultar pool_members:', mError);
  } else {
    console.log('\n--- MIEMBROS DE PORRAS EN LA BASE DE DATOS (%d) ---', members?.length || 0);
    members?.forEach(m => {
      console.log(`- Pool: ${m.pool_id} | User: ${m.user_id} | Rol: ${m.role} | Pagado: ${m.has_paid}`);
    });
  }
}

check();
