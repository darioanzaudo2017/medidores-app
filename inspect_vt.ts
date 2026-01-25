import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qtfivfifskeagrfsgyav.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0Zml2Zmlmc2tlYWdyZnNneWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5MDI3NDAsImV4cCI6MjA2OTQ3ODc0MH0.SfPydTG0Jd0D2WrhLDH9E1dDAD5KHpkp8WV5ayj4kvY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkViews() {
    const { data: data1, error: error1 } = await supabase.from('vt_descarga_plantilla').select('*').limit(1);
    if (error1) console.error('Error vt_descarga_plantilla:', error1);
    else console.log('VT_DESCARGA_COLUMNS:', JSON.stringify(Object.keys(data1[0] || {})));
}

checkViews();
