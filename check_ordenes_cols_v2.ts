import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qtfivfifskeagrfsgyav.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0Zml2Zmlmc2tlYWdyZnNneWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5MDI3NDAsImV4cCI6MjA2OTQ3ODc0MH0.SfPydTG0Jd0D2WrhLDH9E1dDAD5KHpkp8WV5ayj4kvY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTable() {
    const { data, error } = await supabase.from('t_ordenes').select('*').limit(10);
    if (error) {
        console.error('Error:', error);
        return;
    }
    if (data && data.length > 0) {
        // Find a row that has many keys
        let maxKeys = 0;
        let bestRow = data[0];
        data.forEach(row => {
            const keys = Object.keys(row).length;
            if (keys > maxKeys) {
                maxKeys = keys;
                bestRow = row;
            }
        });
        console.log('COLUMNS:', JSON.stringify(Object.keys(bestRow)));
    } else {
        console.log('No data found');
    }
}

checkTable();
