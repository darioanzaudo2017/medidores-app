-- =====================================================
-- RLS SETUP PARA SISTEMA DE ÓRDENES - medidores_app v1.1
-- =====================================================

-- 1. FUNCIONES HELPER (SECURITY DEFINER para permitir consultas internas)
-- =====================================================

-- Obtener el ID de usuario actual basado en auth.uid()
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT id FROM public.t_usuarios WHERE auth_user_id = auth.uid() LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Obtener el nombre del rol del usuario actual
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT tu.nombre 
    FROM public.t_usuarios u
    JOIN public.t_tipos_usuario tu ON u.tipo_usuario_id = tu.id
    WHERE u.auth_user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helpers booleanos para roles
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.get_user_role() = 'Superadmin';
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.is_supervisor()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.get_user_role() = 'Supervisor';
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.is_agente()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.get_user_role() = 'Agente';
END;
$$ LANGUAGE plpgsql STABLE;

-- Obtener IDs de agentes asignados al supervisor actual
CREATE OR REPLACE FUNCTION public.get_supervisor_agents()
RETURNS TABLE(agente_id UUID) AS $$
BEGIN
  RETURN QUERY 
  SELECT s.agente_id 
  FROM public.t_supervisores s 
  WHERE s.supervisor_id = public.get_current_user_id() AND s.activo = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. HABILITAR RLS EN TODAS LAS TABLAS (Lote de seguridad)
-- =====================================================
DO $$ 
DECLARE 
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['t_ordenes', 't_usuarios', 't_clientes', 't_fotos', 't_supervisores', 'ubicaciones', 't_medidores', 't_motivos_cierre', 't_estados', 't_estados_medidor', 't_rutas', 't_barrios', 't_tipos_usuario', 'temp_carga_csv', 'tablacron', 't_offline_log']) LOOP
    EXECUTE format('ALTER TABLE IF EXISTS %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- 3. ELIMINAR POLÍTICAS EXISTENTES (Para re-ejecución limpia)
-- =====================================================
DO $$ 
DECLARE 
  pol record;
BEGIN
  FOR pol IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- 4. POLÍTICAS POR TABLA
-- =====================================================

-- --- t_ordenes ---
CREATE POLICY "ordenes_select_policy" ON t_ordenes FOR SELECT USING (
  public.is_superadmin() OR 
  (public.is_agente() AND id_agente = public.get_current_user_id()) OR 
  (public.is_supervisor() AND id_agente IN (SELECT s.agente_id FROM public.get_supervisor_agents() s))
);

CREATE POLICY "ordenes_insert_policy" ON t_ordenes FOR INSERT WITH CHECK (
  public.is_superadmin() OR public.is_supervisor()
);

CREATE POLICY "ordenes_update_policy" ON t_ordenes FOR UPDATE USING (
  public.is_superadmin() OR 
  (public.is_agente() AND id_agente = public.get_current_user_id()) OR 
  (public.is_supervisor() AND id_agente IN (SELECT s.agente_id FROM public.get_supervisor_agents() s))
);

CREATE POLICY "ordenes_delete_policy" ON t_ordenes FOR DELETE USING (public.is_superadmin());

-- --- t_usuarios ---
CREATE POLICY "usuarios_select_policy" ON t_usuarios FOR SELECT USING (
  public.is_superadmin() OR 
  id = public.get_current_user_id() OR 
  (public.is_supervisor() AND id IN (SELECT s.agente_id FROM public.get_supervisor_agents() s))
);

CREATE POLICY "usuarios_modify_policy" ON t_usuarios FOR ALL USING (public.is_superadmin());

-- --- t_clientes ---
CREATE POLICY "clientes_select_policy" ON t_clientes FOR SELECT USING (
  public.is_superadmin() OR 
  id IN (
    SELECT o.id_cliente FROM public.t_ordenes o
    WHERE (o.id_agente = public.get_current_user_id()) 
    OR (o.id_agente IN (SELECT s.agente_id FROM public.get_supervisor_agents() s))
  )
);

CREATE POLICY "clientes_modify_policy" ON t_clientes FOR ALL USING (public.is_superadmin());

-- --- t_fotos ---
CREATE POLICY "fotos_select_policy" ON t_fotos FOR SELECT USING (
  public.is_superadmin() OR 
  orden_id IN (
    SELECT o.id_orden FROM public.t_ordenes o
    WHERE (o.id_agente = public.get_current_user_id()) 
    OR (o.id_agente IN (SELECT s.agente_id FROM public.get_supervisor_agents() s))
  )
);

CREATE POLICY "fotos_insert_policy" ON t_fotos FOR INSERT WITH CHECK (
  public.is_superadmin() OR 
  (public.is_agente() AND orden_id IN (SELECT o.id_orden FROM public.t_ordenes o WHERE o.id_agente = public.get_current_user_id()))
);

CREATE POLICY "fotos_update_delete_policy" ON t_fotos FOR ALL USING (
  public.is_superadmin() OR 
  (public.is_agente() AND orden_id IN (SELECT o.id_orden FROM public.t_ordenes o WHERE o.id_agente = public.get_current_user_id()))
);

-- --- t_supervisores ---
CREATE POLICY "supervisores_select_policy" ON t_supervisores FOR SELECT USING (
  public.is_superadmin() OR 
  supervisor_id = public.get_current_user_id() OR 
  agente_id = public.get_current_user_id()
);

CREATE POLICY "supervisores_modify_policy" ON t_supervisores FOR ALL USING (
  public.is_superadmin() OR 
  (public.is_supervisor() AND supervisor_id = public.get_current_user_id())
);

-- --- ubicaciones ---
CREATE POLICY "ubicaciones_select_policy" ON ubicaciones FOR SELECT USING (
  public.is_superadmin() OR 
  idagente = public.get_current_user_id() OR 
  (public.is_supervisor() AND idagente IN (SELECT s.agente_id FROM public.get_supervisor_agents() s))
);

CREATE POLICY "ubicaciones_insert_policy" ON ubicaciones FOR INSERT WITH CHECK (
  public.is_superadmin() OR 
  (public.is_agente() AND idagente = public.get_current_user_id())
);

-- --- t_medidores ---
CREATE POLICY "medidores_select_policy" ON t_medidores FOR SELECT USING (
  public.is_superadmin() OR 
  (public.is_agente() AND id_agente = public.get_current_user_id()) OR
  (public.is_supervisor() AND id_agente IN (SELECT s.agente_id FROM public.get_supervisor_agents() s))
);

CREATE POLICY "medidores_modify_policy" ON t_medidores FOR ALL USING (
  public.is_superadmin() OR 
  (public.is_agente() AND id_agente = public.get_current_user_id())
);

-- --- Tablas de Referencia ---
DO $$ 
DECLARE 
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['t_estados', 't_estados_medidor', 't_rutas', 't_barrios', 't_tipos_usuario', 't_motivos_cierre']) LOOP
    EXECUTE format('CREATE POLICY "ref_select_policy" ON %I FOR SELECT USING (true)', t);
    EXECUTE format('CREATE POLICY "ref_modify_policy" ON %I FOR ALL USING (public.is_superadmin())', t);
  END LOOP;
END $$;

-- --- Tablas Privadas ---
DO $$ 
DECLARE 
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['temp_carga_csv', 'tablacron', 't_offline_log']) LOOP
    EXECUTE format('CREATE POLICY "admin_only_policy" ON %I FOR ALL USING (public.is_superadmin())', t);
  END LOOP;
END $$;

-- 5. ÍNDICES PARA PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_t_usuarios_auth_user_id ON public.t_usuarios(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_t_usuarios_tipo_id ON public.t_usuarios(tipo_usuario_id);
CREATE INDEX IF NOT EXISTS idx_t_ordenes_agente_id ON public.t_ordenes(id_agente);
CREATE INDEX IF NOT EXISTS idx_t_ordenes_supervisor_id ON public.t_ordenes(id_supervisor);
CREATE INDEX IF NOT EXISTS idx_t_supervisores_active ON public.t_supervisores(supervisor_id, agente_id) WHERE activo = true;
