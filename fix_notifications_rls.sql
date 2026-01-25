-- Verificar y corregir políticas RLS para t_notificaciones

-- Primero, verificar las políticas actuales
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 't_notificaciones';

-- Si las políticas están mal, eliminarlas y recrearlas
DROP POLICY IF EXISTS "notif_select_policy" ON public.t_notificaciones;
DROP POLICY IF EXISTS "notif_update_policy" ON public.t_notificaciones;
DROP POLICY IF EXISTS "notif_insert_policy" ON public.t_notificaciones;

-- Recrear políticas correctas
-- SELECT: Un usuario puede ver sus propias notificaciones
CREATE POLICY "notif_select_policy" ON public.t_notificaciones 
FOR SELECT USING (
    usuario_id IN (
        SELECT id FROM public.t_usuarios WHERE auth_user_id = auth.uid()
    )
);

-- UPDATE: Un usuario puede actualizar (marcar como leída) sus propias notificaciones
CREATE POLICY "notif_update_policy" ON public.t_notificaciones 
FOR UPDATE USING (
    usuario_id IN (
        SELECT id FROM public.t_usuarios WHERE auth_user_id = auth.uid()
    )
) WITH CHECK (
    usuario_id IN (
        SELECT id FROM public.t_usuarios WHERE auth_user_id = auth.uid()
    )
);

-- INSERT: Permitir que cualquiera inserte (para testing y sistema)
CREATE POLICY "notif_insert_policy" ON public.t_notificaciones 
FOR INSERT WITH CHECK (true);

-- Verificar que Realtime esté habilitado
-- Nota: Esto debe ejecutarse desde el SQL Editor de Supabase
ALTER PUBLICATION supabase_realtime ADD TABLE public.t_notificaciones;
