-- =====================================================
-- RLS SETUP PARA SISTEMA DE ÓRDENES - medidores_app
-- =====================================================

-- 1. FUNCIONES HELPER (SECURITY DEFINER para permitir consultas internas)
-- =====================================================

-- Obtener el ID de usuario actual basado en auth.uid()
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID AS $$
  SELECT id FROM public.t_usuarios WHERE auth_user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Obtener el nombre del rol del usuario actual
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT tu.nombre 
  FROM public.t_usuarios u
  JOIN public.t_tipos_usuario tu ON u.tipo_usuario_id = tu.id
  WHERE u.auth_user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Helpers booleanos para roles
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() = 'Superadmin';
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.is_supervisor()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() = 'Supervisor';
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.is_agente()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() = 'Agente';
$$ LANGUAGE sql STABLE;

-- Obtener IDs de agentes asignados al supervisor actual
CREATE OR REPLACE FUNCTION public.get_supervisor_agents()
RETURNS TABLE(agente_id UUID) AS $$
  SELECT agente_id FROM public.t_supervisores WHERE supervisor_id = public.get_current_user_id() AND activo = true;
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. HABILITAR RLS EN TODAS LAS TABLAS
-- =====================================================
ALTER TABLE t_ordenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE t_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE t_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE t_fotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE t_supervisores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ubicaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE t_medidores ENABLE ROW LEVEL SECURITY;
ALTER TABLE t_motivos_cierre ENABLE ROW LEVEL SECURITY;
ALTER TABLE t_estados ENABLE ROW LEVEL SECURITY;
ALTER TABLE t_estados_medidor ENABLE ROW LEVEL SECURITY;
ALTER TABLE t_rutas ENABLE ROW LEVEL SECURITY;
ALTER TABLE t_barrios ENABLE ROW LEVEL SECURITY;
ALTER TABLE t_tipos_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE temp_carga_csv ENABLE ROW LEVEL SECURITY;
ALTER TABLE tablacron ENABLE ROW LEVEL SECURITY;
ALTER TABLE t_offline_log ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICAS POR TABLA
-- =====================================================

-- --- t_ordenes ---
CREATE POLICY "ordenes_select_policy" ON t_ordenes FOR SELECT USING (
  is_superadmin() OR 
  (is_agente() AND id_agente = get_current_user_id()) OR 
  (is_supervisor() AND id_agente IN (SELECT agente_id FROM get_supervisor_agents()))
);

CREATE POLICY "ordenes_insert_policy" ON t_ordenes FOR INSERT WITH CHECK (
  is_superadmin() OR is_supervisor()
);

CREATE POLICY "ordenes_update_policy" ON t_ordenes FOR UPDATE USING (
  is_superadmin() OR 
  (is_agente() AND id_agente = get_current_user_id()) OR 
  (is_supervisor() AND id_agente IN (SELECT agente_id FROM get_supervisor_agents()))
) WITH CHECK (
  is_superadmin() OR 
  (is_agente() AND id_agente = get_current_user_id()) OR 
  (is_supervisor() AND id_agente IN (SELECT agente_id FROM get_supervisor_agents()))
);

CREATE POLICY "ordenes_delete_policy" ON t_ordenes FOR DELETE USING (is_superadmin());

-- --- t_usuarios ---
CREATE POLICY "usuarios_select_policy" ON t_usuarios FOR SELECT USING (
  is_superadmin() OR 
  id = get_current_user_id() OR 
  (is_supervisor() AND id IN (SELECT agente_id FROM get_supervisor_agents()))
);

CREATE POLICY "usuarios_modify_policy" ON t_usuarios FOR ALL USING (is_superadmin());

-- --- t_clientes ---
CREATE POLICY "clientes_select_policy" ON t_clientes FOR SELECT USING (
  is_superadmin() OR 
  id IN (
    SELECT id_cliente FROM t_ordenes 
    WHERE (id_agente = get_current_user_id()) 
    OR (id_agente IN (SELECT agente_id FROM get_supervisor_agents()))
  )
);

CREATE POLICY "clientes_modify_policy" ON t_clientes FOR ALL USING (is_superadmin());

-- --- t_fotos ---
CREATE POLICY "fotos_select_policy" ON t_fotos FOR SELECT USING (
  is_superadmin() OR 
  orden_id IN (
    SELECT id_orden FROM t_ordenes 
    WHERE (id_agente = get_current_user_id()) 
    OR (id_agente IN (SELECT agente_id FROM get_supervisor_agents()))
  )
);

CREATE POLICY "fotos_insert_policy" ON t_fotos FOR INSERT WITH CHECK (
  is_superadmin() OR 
  (is_agente() AND orden_id IN (SELECT id_orden FROM t_ordenes WHERE id_agente = get_current_user_id()))
);

CREATE POLICY "fotos_update_delete_policy" ON t_fotos FOR ALL USING (
  is_superadmin() OR 
  (is_agente() AND orden_id IN (SELECT id_orden FROM t_ordenes WHERE id_agente = get_current_user_id()))
);

-- --- t_supervisores ---
CREATE POLICY "supervisores_select_policy" ON t_supervisores FOR SELECT USING (
  is_superadmin() OR 
  supervisor_id = get_current_user_id() OR 
  agente_id = get_current_user_id()
);

CREATE POLICY "supervisores_modify_policy" ON t_supervisores FOR ALL USING (
  is_superadmin() OR 
  (is_supervisor() AND supervisor_id = get_current_user_id())
);

-- --- ubicaciones ---
CREATE POLICY "ubicaciones_select_policy" ON ubicaciones FOR SELECT USING (
  is_superadmin() OR 
  idagente = get_current_user_id() OR 
  (is_supervisor() AND idagente IN (SELECT agente_id FROM get_supervisor_agents()))
);

CREATE POLICY "ubicaciones_insert_policy" ON ubicaciones FOR INSERT WITH CHECK (
  is_superadmin() OR 
  (is_agente() AND idagente = get_current_user_id())
);

-- --- t_medidores ---
CREATE POLICY "medidores_select_policy" ON t_medidores FOR SELECT USING (
  is_superadmin() OR 
  (is_agente() AND id_agente = get_current_user_id()) OR
  (is_supervisor() AND id_agente IN (SELECT agente_id FROM get_supervisor_agents()))
);

CREATE POLICY "medidores_modify_policy" ON t_medidores FOR ALL USING (
  is_superadmin() OR 
  (is_agente() AND id_agente = get_current_user_id())
);

-- --- Tablas de Referencia (Lectura completa) ---
-- t_estados, t_estados_medidor, t_rutas, t_barrios, t_tipos_usuario, t_motivos_cierre
DO $$ 
DECLARE 
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['t_estados', 't_estados_medidor', 't_rutas', 't_barrios', 't_tipos_usuario', 't_motivos_cierre']) LOOP
    EXECUTE format('CREATE POLICY "ref_select_policy" ON %I FOR SELECT USING (true)', t);
    EXECUTE format('CREATE POLICY "ref_modify_policy" ON %I FOR ALL USING (is_superadmin())', t);
  END LOOP;
END $$;

-- --- Tablas Privadas (Solo Superadmin) ---
-- temp_carga_csv, tablacron, t_offline_log
DO $$ 
DECLARE 
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['temp_carga_csv', 'tablacron', 't_offline_log']) LOOP
    EXECUTE format('CREATE POLICY "admin_only_policy" ON %I FOR ALL USING (is_superadmin())', t);
  END LOOP;
END $$;

-- 4. ÍNDICES PARA PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_t_usuarios_auth_user_id ON t_usuarios(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_t_usuarios_tipo_id ON t_usuarios(tipo_usuario_id);
CREATE INDEX IF NOT EXISTS idx_t_ordenes_agente_id ON t_ordenes(id_agente);
CREATE INDEX IF NOT EXISTS idx_t_ordenes_supervisor_id ON t_ordenes(id_supervisor);
CREATE INDEX IF NOT EXISTS idx_t_ordenes_cliente_id ON t_ordenes(id_cliente);
CREATE INDEX IF NOT EXISTS idx_t_supervisores_active ON t_supervisores(supervisor_id, agente_id) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_t_fotos_orden_id ON t_fotos(orden_id);
CREATE INDEX IF NOT EXISTS idx_ubicaciones_agente_id ON ubicaciones(idagente);

-- 5. TESTING (Queries de ejemplo para validación)
-- =====================================================
/*
-- PROBAR COMO AGENTE:
-- SET role TO authenticated;
-- SET auth.uid() = 'uuid-del-agente'; 
-- SELECT * FROM t_ordenes; -- Debería ver solo sus órdenes

-- PROBAR COMO SUPERVISOR:
-- SET auth.uid() = 'uuid-del-supervisor';
-- SELECT * FROM t_usuarios; -- Debería ver solo sus agentes y a sí mismo
*/
