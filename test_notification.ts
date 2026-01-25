import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qtfivfifskeagrfsgyav.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0Zml2Zmlmc2tlYWdyZnNneWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5MDI3NDAsImV4cCI6MjA2OTQ3ODc0MH0.SfPydTG0Jd0D2WrhLDH9E1dDAD5KHpkp8WV5ayj4kvY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function sendNotification() {
    // 1. Get a user
    const { data: userData, error: userError } = await supabase
        .from('t_usuarios')
        .select('id, nombre, email')
        .limit(1)
        .single(); // Just grab the first user found or you can specify your own ID if known

    // Or better, ask for the user ID I am logged in with?
    // Since this runs in node, I don't know who is logged in on the frontend.
    // I made the table RLS "insert: true", so anonymity can insert.
    // I need a valid user ID to send it to.

    // Hardcoded ID from previous context if available, or just fetch one.
    // Let's assume the user viewing the app is the first agent/admin found.

    if (userError || !userData) {
        console.error('Cant find user to send notification to', userError);
        return;
    }

    console.log(`Sending test notification to ${userData.email} (${userData.id})...`);

    const { error } = await supabase
        .from('t_notificaciones')
        .insert({
            usuario_id: userData.id,
            tipo: 'SYSTEM',
            titulo: 'Prueba de Sistema',
            mensaje: 'Esta es una notificación de prueba enviada desde el script de verificación.',
            leida: false,
            created_at: new Date().toISOString()
        });

    if (error) {
        console.error('Error inserting notification:', error);
    } else {
        console.log('✅ Notification sent successfully!');
    }
}

sendNotification();
