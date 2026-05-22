const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://thlmriucsgaihijekojm.supabase.co';
const supabaseKey = 'sb_publishable_3W-oZraqknNYmBft-QGq_A_rDLktYt2'; // from .env.local

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', 'vromero@ginso.org');
    
  if (error) {
    console.error('Error fetching profile:', error);
  } else {
    console.log('Profile found:', data);
  }
}

run();
