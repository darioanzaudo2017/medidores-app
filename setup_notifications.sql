-- =====================================================
-- SETUP NOTIFICACIONES - medidores_app
-- =====================================================

-- 1. Crear tabla de notificaciones
CREATE TABLE IF NOT EXISTS public.t_notificaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES public.t_usuarios(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL, -- 'ORDER_ASSIGNED', 'ORDER_STATUS_CHANGED', 'SYSTEM', 'REMINDER'
    titulo VARCHAR(255) NOT NULL,
    mensaje TEXT,
    leida BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 2. Habilitar RLS
ALTER TABLE public.t_notificaciones ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Seguridad (RLS)

-- SELECT: Un usuario solo puede ver sus propias notificaciones
CREATE POLICY "notif_select_policy" ON public.t_notificaciones 
FOR SELECT USING (
    usuario_id = public.get_current_user_id()
);

-- UPDATE: Un usuario solo puede marcar como leídas sus propias notificaciones
CREATE POLICY "notif_update_policy" ON public.t_notificaciones 
FOR UPDATE USING (
    usuario_id = public.get_current_user_id()
) WITH CHECK (
    usuario_id = public.get_current_user_id()
);

-- INSERT: Permitir insertar notificaciones (generalmente el sistema o admin)
-- Se permite a todos insertar, pero solo ver las suyas. 
-- Esto facilita que un trigger o función de backend inserte alertas para otros.
CREATE POLICY "notif_insert_policy" ON public.t_notificaciones 
FOR INSERT WITH CHECK (
    true 
);

-- 4. Activación de Realtime
-- Para que el cliente reciba alertas en vivo, la tabla debe estar en la publicación de realtime.
ALTER PUBLICATION supabase_realtime ADD TABLE public.t_notificaciones;

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_id ON public.t_notificaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_leida ON public.t_notificaciones(leida);
CREATE INDEX IF NOT EXISTS idx_notificaciones_created_at ON public.t_notificaciones(created_at DESC);

-- Comentario explicativo
COMMENT ON TABLE public.t_notificaciones IS 'Almacena alertas y notificaciones push in-app para usuarios';
