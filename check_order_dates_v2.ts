import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qtfivfifskeagrfsgyav.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0Zml2Zmlmc2tlYWdyZnNneWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5MDI3NDAsImV4cCI6MjA2OTQ3ODc0MH0.SfPydTG0Jd0D2WrhLDH9E1dDAD5KHpkp8WV5ayj4kvY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkOrder() {
    const { data, error } = await supabase
        .from('v_ordenes_detalladas')
        .select('id_orden, created_at, fecha_primera_visita, fechahora_arg, cliente_fecha_visita_arg')
        .eq('id_orden', 501417587)
        .single();

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('ID:', data.id_orden);
        console.log('CREATED_AT:', data.created_at);
        console.log('FECHA_PRIMERA:', data.fecha_primera_visita);
        console.log('FECHAHORA_ARG:', data.fechahora_arg);
        console.log('VISITA_ARG:', data.cliente_fecha_visita_arg);
    }
}

checkOrder();
