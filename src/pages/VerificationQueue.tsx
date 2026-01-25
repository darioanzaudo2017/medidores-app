import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    RefreshCw,
    Zap,
    Hourglass,
    Timer,
    CheckCircle,
    Search,
    User,
    FilterX,
    ChevronLeft,
    ChevronRight,
    Eye,
    AlertCircle,
    Calendar,
    Download,
    Loader2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useToast } from '../hooks/useToast';

interface Order {
    id_orden: number;
    created_at: string;
    clase_orden: string;
    agente_nombre: string;
    agente_apellido: string;
    estado_nombre: string;
    fecha_primera_visita: string;
    motivo_cierre_nombre: string;
    // Checklist fields for progress calculation
    morador: string;
    gabinete_linea: string;
    cliente_accede_cambio: string;
    medidor_mal_estado: string;
    posee_reja_soldadura: string;
    puede_retirar: string;
    fugas: string;
    perdida_valvula: string;
    operar_valvula: string;
    accede_vivienda: string;
    cliente_nombre: string;
    cliente_calle: string;
    cliente_numero: number;
    cliente_medidor: string;
    fecha_finalizacion_agente: string;
}

interface Agent {
    id: string;
    nombre: string;
    apellido: string;
}

export const VerificationQueue = () => {
    const toast = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAgent, setSelectedAgent] = useState('');
    const [agents, setAgents] = useState<Agent[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchingAgents, setFetchingAgents] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [stats, setStats] = useState({
        pending: 0,
        verified: 0,
        avgTime: '15.4m'
    });
    const [activeTab, setActiveTab] = useState<'pending' | 'verified'>('pending');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isExporting, setIsExporting] = useState(false);

    const pageSize = 10;

    const fetchAgents = async () => {
        setFetchingAgents(true);
        try {
            // 1. Get Agent Role ID
            const { data: roleData } = await supabase
                .from('t_tipos_usuario')
                .select('id')
                .eq('nombre', 'AGENTE')
                .single();

            if (roleData?.id) {
                // 2. Fetch users with that role
                const { data, error } = await supabase
                    .from('t_usuarios')
                    .select('id, nombre, apellido')
                    .eq('tipo_usuario_id', roleData.id)
                    .order('nombre');

                if (error) throw error;
                setAgents(data || []);
            }
        } catch (err) {
            console.error('Error fetching agents:', err);
            // Fallback: try to fetch all users if filtering by role fails
            const { data } = await supabase.from('t_usuarios').select('id, nombre, apellido').limit(50);
            if (data) setAgents(data);
        } finally {
            setFetchingAgents(false);
        }
    };

    const fetchQueueData = async () => {
        setLoading(true);
        try {
            // Construir consulta para v_ordenes_detalladas
            let query = supabase
                .from('v_ordenes_detalladas')
                .select('*', { count: 'exact' })
                .eq('estado_nombre', activeTab === 'pending' ? 'CERRADO AGENTE' : 'VERIFICADO')
                .order('fecha_finalizacion_agente', { ascending: false, nullsFirst: false });

            if (startDate) {
                query = query.gte('fecha_finalizacion_agente', startDate);
            }
            if (endDate) {
                query = query.lte('fecha_finalizacion_agente', endDate + 'T23:59:59');
            }

            if (searchTerm) {
                // Determine if searching for a numeric ID or a name
                const isNumeric = /^\d+$/.test(searchTerm);
                if (isNumeric) {
                    // Search by exact ID OR names OR street number OR meter serial
                    query = query.or(`id_orden.eq.${searchTerm},cliente_nombre.ilike.%${searchTerm}%,agente_nombre.ilike.%${searchTerm}%,agente_apellido.ilike.%${searchTerm}%,cliente_numero.eq.${searchTerm},cliente_medidor.ilike.%${searchTerm}%`);
                } else {
                    // Search by names (client or agent) OR street name OR meter serial
                    query = query.or(`cliente_nombre.ilike.%${searchTerm}%,agente_nombre.ilike.%${searchTerm}%,agente_apellido.ilike.%${searchTerm}%,cliente_calle.ilike.%${searchTerm}%,cliente_medidor.ilike.%${searchTerm}%`);
                }
            }

            if (selectedAgent) {
                query = query.eq('agente_id', selectedAgent);
            }

            const { data, count, error } = await query
                .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

            if (error) throw error;
            setOrders(data || []);

            if (activeTab === 'pending') {
                setStats(prev => ({ ...prev, pending: count || 0 }));
            } else {
                setStats(prev => ({ ...prev, verified: count || 0 }));
            }

            // Obtener estadística del otro estado para los contadores de las pestañas
            const otherStatus = activeTab === 'pending' ? 'VERIFICADO' : 'CERRADO AGENTE';
            const { count: otherCount } = await supabase
                .from('v_ordenes_detalladas')
                .select('*', { count: 'exact', head: true })
                .eq('estado_nombre', otherStatus);

            if (activeTab === 'pending') {
                setStats(prev => ({ ...prev, verified: otherCount || 0 }));
            } else {
                setStats(prev => ({ ...prev, pending: otherCount || 0 }));
            }

        } catch (err) {
            console.error('Error fetching queue:', err);
        } finally {
            setLoading(false);
        }
    };

    const exportToExcel = async () => {
        try {
            setIsExporting(true);

            // 1. Obtener todos los IDs de órdenes que coinciden con los filtros actuales
            // Usamos v_ordenes_detalladas porque tiene todos los campos de filtrado (fecha, agente, buscador)
            let idQuery = supabase
                .from('v_ordenes_detalladas')
                .select('id_orden')
                .eq('estado_nombre', 'VERIFICADO');

            if (startDate) idQuery = idQuery.gte('fecha_finalizacion_agente', startDate);
            if (endDate) idQuery = idQuery.lte('fecha_finalizacion_agente', endDate + 'T23:59:59');

            if (searchTerm) {
                const isNumeric = /^\d+$/.test(searchTerm);
                if (isNumeric) {
                    idQuery = idQuery.or(`id_orden.eq.${searchTerm},cliente_nombre.ilike.%${searchTerm}%,agente_nombre.ilike.%${searchTerm}%,agente_apellido.ilike.%${searchTerm}%,cliente_numero.eq.${searchTerm},cliente_medidor.ilike.%${searchTerm}%`);
                } else {
                    idQuery = idQuery.or(`cliente_nombre.ilike.%${searchTerm}%,agente_nombre.ilike.%${searchTerm}%,agente_apellido.ilike.%${searchTerm}%,cliente_calle.ilike.%${searchTerm}%,cliente_medidor.ilike.%${searchTerm}%`);
                }
            }
            if (selectedAgent) idQuery = idQuery.eq('agente_id', selectedAgent);

            const { data: idData, error: idError } = await idQuery;
            if (idError) throw idError;

            if (!idData || idData.length === 0) {
                toast.warning('Sin datos', 'No hay datos para exportar con los filtros seleccionados');
                return;
            }

            const ids = idData.map(d => d.id_orden);

            // 2. Obtener los datos de la vista de descarga para esos IDs
            // Dividimos en batches por si hay muchísimos IDs (Supabase/PostgREST tiene límites en la URL)
            const batchSize = 500;
            let finalData: any[] = [];

            for (let i = 0; i < ids.length; i += batchSize) {
                const batch = ids.slice(i, i + batchSize);
                const { data, error } = await supabase
                    .from('vt_descarga_plantilla')
                    .select('*')
                    .in('Orden', batch);

                if (error) throw error;
                if (data) finalData = [...finalData, ...data];
            }

            if (finalData.length === 0) {
                toast.error('Error de Exportación', 'No se encontraron datos en la vista de plantilla para las órdenes seleccionadas');
                return;
            }

            const ws = XLSX.utils.json_to_sheet(finalData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Ordenes Verificadas");
            XLSX.writeFile(wb, `Reporte_Ordenes_Verificadas_${new Date().toISOString().split('T')[0]}.xlsx`);

        } catch (err) {
            console.error('Error exporting:', err);
            toast.error('Error al exportar', 'Verifique que la columna "Orden" exista en la plantilla.');
        } finally {
            setIsExporting(false);
        }
    };

    useEffect(() => {
        fetchAgents();
    }, []);

    useEffect(() => {
        const timer = setTimeout(fetchQueueData, 400);
        return () => clearTimeout(timer);
    }, [searchTerm, selectedAgent, currentPage, activeTab, startDate, endDate]);

    const clearFilters = () => {
        setSearchTerm('');
        setSelectedAgent('');
        setStartDate('');
        setEndDate('');
        setCurrentPage(1);
    };

    return (
        <div className="p-4 lg:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
            {/* Page Heading Component */}
            <div className="flex flex-wrap justify-between items-end gap-4">
                <div className="space-y-1">
                    <h2 className="text-[#111818] dark:text-white text-3xl font-black tracking-tight">Cola de Verificación de Órdenes</h2>
                    <p className="text-[#618789] text-base font-medium">Revise y valide las órdenes de servicio cerradas por operarios para su procesamiento final.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => fetchQueueData()}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#1a2e2f] border border-[#dbe5e6] dark:border-[#2d4546] rounded-lg text-sm font-bold text-[#111818] dark:text-white hover:bg-background-light transition-colors shadow-sm"
                    >
                        <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                        Actualizar Cola
                    </button>
                    <button className="flex items-center gap-2 px-6 py-2 bg-primary rounded-lg text-sm font-black text-[#111818] hover:bg-primary/80 transition-all shadow-md active:scale-95">
                        <Zap className="w-4 h-4" />
                        Verificación Rápida
                    </button>
                </div>
            </div>

            {/* Stats Component */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    label="Total Pendientes"
                    value={stats.pending}
                    icon={Hourglass}
                    trend="+12.5%"
                    trendColor="text-green-600"
                    trendBg="bg-green-100 dark:bg-green-900/30"
                />
                <StatCard
                    label="Tiempo Promedio Proc."
                    value={stats.avgTime}
                    icon={Timer}
                    trend="-5.2%"
                    trendColor="text-red-600"
                    trendBg="bg-red-100 dark:bg-red-900/30"
                />
                <StatCard
                    label="Total Verificadas"
                    value={stats.verified}
                    icon={CheckCircle}
                    trend="+8.1%"
                    trendColor="text-green-600"
                    trendBg="bg-green-100 dark:bg-green-900/30"
                />
            </div>

            {/* Filter Bar */}
            <div className="bg-white dark:bg-[#1a2e2f] p-5 rounded-2xl border border-[#dbe5e6] dark:border-[#2d4546] shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 items-end">
                    <div className="lg:col-span-3 space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-[#618789] ml-1 tracking-widest">Búsqueda Rápida</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#618789] w-4 h-4" />
                            <input
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                placeholder="Orden, Cliente, Medidor..."
                                className="w-full pl-10 pr-4 py-2.5 bg-[#f1f3f4] dark:bg-white/5 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none font-bold"
                            />
                        </div>
                    </div>

                    <div className="lg:col-span-2 space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-[#618789] ml-1 tracking-widest">Agente</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[#618789] w-4 h-4" />
                            <select
                                value={selectedAgent}
                                onChange={(e) => { setSelectedAgent(e.target.value); setCurrentPage(1); }}
                                className="w-full pl-10 pr-4 py-2.5 bg-[#f1f3f4] dark:bg-white/5 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 appearance-none outline-none cursor-pointer font-bold"
                            >
                                {fetchingAgents ? (
                                    <option>Cargando...</option>
                                ) : (
                                    <>
                                        <option value="">Todos los Agentes</option>
                                        {agents.map(a => <option key={a.id} value={a.id}>{a.nombre} {a.apellido}</option>)}
                                    </>
                                )}
                            </select>
                        </div>
                    </div>

                    <div className="lg:col-span-2 space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-[#618789] ml-1 tracking-widest">Desde</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-[#618789] w-4 h-4 pointer-events-none" />
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
                                className="w-full pl-10 pr-4 py-2.5 bg-[#f1f3f4] dark:bg-white/5 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none font-bold"
                            />
                        </div>
                    </div>

                    <div className="lg:col-span-2 space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-[#618789] ml-1 tracking-widest">Hasta</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-[#618789] w-4 h-4 pointer-events-none" />
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
                                className="w-full pl-10 pr-4 py-2.5 bg-[#f1f3f4] dark:bg-white/5 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none font-bold"
                            />
                        </div>
                    </div>

                    <div className="lg:col-span-2 flex gap-2">
                        <button
                            onClick={clearFilters}
                            className="flex-1 bg-gray-100 hover:bg-gray-200 text-[#618789] p-2.5 rounded-xl transition-all active:scale-95"
                            title="Limpiar Filtros"
                        >
                            <FilterX className="w-5 h-5 mx-auto" />
                        </button>
                        <button
                            onClick={exportToExcel}
                            disabled={isExporting}
                            className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-200 disabled:opacity-50"
                        >
                            {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                            <span className="text-[10px] font-black uppercase tracking-widest">Excel</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs and Table Section */}
            <div className="bg-white dark:bg-[#1a2e2f] rounded-2xl border border-[#dbe5e6] dark:border-[#2d4546] shadow-xl shadow-black/5 overflow-hidden">
                {/* Tabs Component */}
                <div className="border-b border-[#dbe5e6] dark:border-[#2d4546] px-6 bg-[#f9fafa] dark:bg-white/[0.02]">
                    <div className="flex gap-8">
                        <button
                            onClick={() => { setActiveTab('pending'); setCurrentPage(1); }}
                            className={cn(
                                "pb-4 pt-4 text-xs font-black uppercase tracking-widest transition-all border-b-2",
                                activeTab === 'pending' ? "border-primary text-[#111818] dark:text-white" : "border-transparent text-[#618789] hover:text-[#111818]"
                            )}
                        >
                            Pendientes de Revisión
                            <span className={cn(
                                "ml-2 px-2 py-0.5 rounded-full text-[10px] tracking-normal",
                                activeTab === 'pending' ? "bg-primary/20 text-[#111818]" : "bg-gray-100 text-[#618789]"
                            )}>{stats.pending}</span>
                        </button>
                        <button
                            onClick={() => { setActiveTab('verified'); setCurrentPage(1); }}
                            className={cn(
                                "pb-4 pt-4 text-xs font-black uppercase tracking-widest transition-all border-b-2",
                                activeTab === 'verified' ? "border-primary text-[#111818] dark:text-white" : "border-transparent text-[#618789] hover:text-[#111818]"
                            )}
                        >
                            Órdenes Verificadas
                            <span className={cn(
                                "ml-2 px-2 py-0.5 rounded-full text-[10px] tracking-normal",
                                activeTab === 'verified' ? "bg-primary/20 text-[#111818]" : "bg-gray-100 text-[#618789]"
                            )}>{stats.verified}</span>
                        </button>
                    </div>
                </div>

                {/* Table Content */}
                {/* Mobile View: Cards */}
                <div className="md:hidden divide-y divide-[#dbe5e6] dark:divide-[#2d4546]">
                    {loading ? (
                        [...Array(pageSize)].map((_, i) => (
                            <div key={i} className="p-4 animate-pulse space-y-3">
                                <div className="h-4 bg-gray-100 dark:bg-white/5 rounded w-1/3"></div>
                                <div className="h-4 bg-gray-100 dark:bg-white/5 rounded w-full"></div>
                                <div className="h-10 bg-gray-100 dark:bg-white/5 rounded w-full"></div>
                            </div>
                        ))
                    ) : orders.length === 0 ? (
                        <div className="p-12 text-center text-[#618789]">
                            <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-20" />
                            <p className="text-sm font-bold">
                                {activeTab === 'pending'
                                    ? "No se encontraron órdenes pendientes."
                                    : "No se encontraron órdenes verificadas."}
                            </p>
                        </div>
                    ) : (
                        orders.map((order) => (
                            <div key={order.id_orden} className="p-4 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-[#111818] dark:text-white tabular-nums">#{order.id_orden}</span>
                                        <span className="text-[10px] text-[#618789] font-bold uppercase tracking-tight mt-0.5">{order.clase_orden || 'Tipo Estándar'}</span>
                                    </div>
                                    <div className="text-right flex flex-col items-end">
                                        <span className="text-sm font-black text-[#111818] dark:text-white tabular-nums">
                                            {order.fecha_finalizacion_agente ? new Date(order.fecha_finalizacion_agente).toLocaleDateString() : (order.fecha_primera_visita ? new Date(order.fecha_primera_visita).toLocaleDateString() : '---')}
                                        </span>
                                        <span className="text-[10px] text-[#618789] font-bold uppercase tracking-tight mt-0.5">Cierre</span>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-sm font-bold text-[#111818] dark:text-white truncate">{order.cliente_nombre}</p>
                                    <p className="text-xs text-primary font-black uppercase tracking-tight">
                                        {order.cliente_calle} {order.cliente_numero}
                                    </p>
                                    <p className="text-[10px] font-mono font-black text-[#618789]">
                                        MED: {order.cliente_medidor || '---'}
                                    </p>
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <div className="flex items-center gap-2">
                                        <div className="size-6 rounded bg-primary/10 flex items-center justify-center text-primary font-black text-[8px]">
                                            {order.agente_nombre?.[0] || 'A'}
                                        </div>
                                        <span className="text-[10px] font-bold text-[#618789]">{order.agente_nombre} {order.agente_apellido}</span>
                                    </div>
                                    <Link
                                        to={`/ordenes/${order.id_orden}`}
                                        className="inline-flex items-center gap-2 bg-primary text-[#111818] px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/10"
                                    >
                                        <Eye className="w-4 h-4" />
                                        {activeTab === 'pending' ? 'Auditar' : 'Ver'}
                                    </Link>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Table Content - Hidden on Mobile */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-[#f9fafa] dark:bg-white/[0.02] border-b border-[#dbe5e6] dark:border-[#2d4546]">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-black text-[#618789] uppercase tracking-widest">Identificador de Orden</th>
                                <th className="px-6 py-4 text-[10px] font-black text-[#618789] uppercase tracking-widest">Cliente / Dirección</th>
                                <th className="px-6 py-4 text-[10px] font-black text-[#618789] uppercase tracking-widest">Medidor</th>
                                <th className="px-6 py-4 text-[10px] font-black text-[#618789] uppercase tracking-widest text-center">Fecha</th>
                                <th className="px-6 py-4 text-[10px] font-black text-[#618789] uppercase tracking-widest">Agente</th>
                                <th className="px-6 py-4 text-[10px] font-black text-[#618789] uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#dbe5e6] dark:divide-[#2d4546]">
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="px-6 py-10"><div className="h-4 bg-gray-100 dark:bg-white/5 rounded w-full"></div></td>
                                    </tr>
                                ))
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <AlertCircle className="w-10 h-10 text-gray-300" />
                                            <p className="text-sm font-bold text-[#618789]">
                                                {activeTab === 'pending'
                                                    ? "No se encontraron órdenes pendientes de verificación."
                                                    : "No se encontraron órdenes verificadas."}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                orders.map((order) => {
                                    return (
                                        <tr key={order.id_orden} className="hover:bg-primary/[0.02] transition-colors group">
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-[#111818] dark:text-white tabular-nums">#{order.id_orden}</span>
                                                    <span className="text-[10px] text-[#618789] font-bold uppercase tracking-tight mt-0.5">{order.clase_orden || 'Tipo Estándar'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-[#111818] dark:text-white truncate max-w-[200px]">{order.cliente_nombre}</span>
                                                    <span className="text-[10px] text-primary font-black uppercase tracking-tight mt-0.5">
                                                        {order.cliente_calle} {order.cliente_numero}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-mono font-black text-[#111818] dark:text-white">
                                                        {order.cliente_medidor || '---'}
                                                    </span>
                                                    <p className="text-[9px] text-[#618789] font-bold uppercase mt-0.5">Nro de Serie</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-sm font-black text-[#111818] dark:text-white tabular-nums">
                                                        {order.fecha_finalizacion_agente ? new Date(order.fecha_finalizacion_agente).toLocaleDateString() : (order.fecha_primera_visita ? new Date(order.fecha_primera_visita).toLocaleDateString() : '---')}
                                                    </span>
                                                    <span className="text-[10px] text-[#618789] font-bold uppercase tracking-tight mt-0.5">Cierre Agente</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black text-[10px] border border-primary/20 shrink-0">
                                                        {order.agente_nombre?.[0] || 'A'}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-[#111818] dark:text-white leading-tight">{order.agente_nombre} {order.agente_apellido}</span>
                                                        <span className="text-[9px] text-[#618789] font-medium leading-none mt-0.5">
                                                            Visita: {order.fecha_primera_visita ? new Date(order.fecha_primera_visita).toLocaleDateString() : '---'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <Link
                                                    to={`/ordenes/${order.id_orden}`}
                                                    className="inline-flex items-center gap-2 bg-primary text-[#111818] px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all active:scale-95"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                    {activeTab === 'pending' ? 'Auditar Orden' : 'Ver Detalle'}
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-6 bg-[#f9fafa] dark:bg-white/[0.02] border-t border-[#dbe5e6] dark:border-[#2d4546] flex items-center justify-between">
                    <p className="text-[10px] font-black text-[#618789] uppercase tracking-widest tabular-nums">
                        Mostrando {orders.length} órdenes en cola
                    </p>
                    <div className="flex gap-2">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className="p-2 border border-[#dbe5e6] dark:border-[#2d4546] rounded-lg disabled:opacity-30 hover:bg-white dark:hover:bg-white/5 transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="px-4 py-2 bg-primary/10 rounded-lg text-primary text-xs font-black">{currentPage}</div>
                        <button
                            disabled={orders.length < pageSize}
                            onClick={() => setCurrentPage(p => p + 1)}
                            className="p-2 border border-[#dbe5e6] dark:border-[#2d4546] rounded-lg disabled:opacity-30 hover:bg-white dark:hover:bg-white/5 transition-colors"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div >
    );
};

const StatCard = ({ label, value, icon: Icon, trend, trendColor, trendBg }: any) => (
    <div className="bg-white dark:bg-[#1a2e2f] rounded-2xl p-6 border border-[#dbe5e6] dark:border-[#2d4546] shadow-xl shadow-black/5 hover:border-primary/50 transition-all group">
        <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-primary/10 rounded-xl text-primary group-hover:bg-primary group-hover:text-[#111818] transition-all">
                <Icon className="w-6 h-6" />
            </div>
            <span className={cn(trendColor, trendBg, "text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest border border-transparent group-hover:border-current/20 transition-all")}>
                {trend}
            </span>
        </div>
        <p className="text-[#618789] text-[10px] font-black uppercase tracking-widest mb-1">{label}</p>
        <p className="text-[#111818] dark:text-white text-4xl font-black tabular-nums">{value}</p>
    </div>
);
