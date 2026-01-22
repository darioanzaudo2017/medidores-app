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
    AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

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
}

interface Agent {
    id: string;
    nombre: string;
    apellido: string;
}

export const VerificationQueue = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAgent, setSelectedAgent] = useState('');
    const [agents, setAgents] = useState<Agent[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchingAgents, setFetchingAgents] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [stats, setStats] = useState({
        pending: 0,
        verifiedToday: 0,
        avgTime: '15.4m'
    });

    const pageSize = 10;

    const fetchAgents = async () => {
        setFetchingAgents(true);
        try {
            // Intentar obtener agentes de la tabla vt_agentes
            const { data, error } = await supabase
                .from('vt_agentes')
                .select('id, nombre, apellido');

            if (error) throw error;
            if (data) setAgents(data);
        } catch (err) {
            console.error('Error fetching agents:', err);
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
                .eq('estado_nombre', 'CERRADO AGENTE')
                .order('created_at', { ascending: false });

            if (searchTerm) {
                query = query.or(`cliente_nombre.ilike.%${searchTerm}%,cliente_apellido.ilike.%${searchTerm}%,id_orden.cast.text.ilike.%${searchTerm}%`);
            }

            if (selectedAgent) {
                query = query.eq('agente_id', selectedAgent);
            }

            const { data, count, error } = await query
                .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

            if (error) throw error;
            setOrders(data || []);
            setStats(prev => ({ ...prev, pending: count || 0 }));

            // Obtener estadística de verificado hoy
            const today = new Date().toISOString().split('T')[0];
            const { count: verifiedCount } = await supabase
                .from('v_ordenes_detalladas')
                .select('*', { count: 'exact', head: true })
                .eq('estado_nombre', 'VERIFICADO')
                .gte('created_at', today);

            setStats(prev => ({ ...prev, verifiedToday: verifiedCount || 0 }));

        } catch (err) {
            console.error('Error fetching queue:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAgents();
    }, []);

    useEffect(() => {
        const timer = setTimeout(fetchQueueData, 400);
        return () => clearTimeout(timer);
    }, [searchTerm, selectedAgent, currentPage]);

    const clearFilters = () => {
        setSearchTerm('');
        setSelectedAgent('');
        setCurrentPage(1);
    };

    const calculateProgress = (order: Order) => {
        const fields = [
            order.morador, order.gabinete_linea, order.cliente_accede_cambio,
            order.medidor_mal_estado, order.posee_reja_soldadura, order.puede_retirar,
            order.fugas, order.perdida_valvula, order.operar_valvula, order.accede_vivienda
        ];
        const completed = fields.filter(f => f && f !== '---' && f.toUpperCase() !== 'NO').length;
        return {
            percent: (completed / fields.length) * 100,
            completed,
            total: fields.length
        };
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
                    label="Verificadas Hoy"
                    value={stats.verifiedToday}
                    icon={CheckCircle}
                    trend="+8.1%"
                    trendColor="text-green-600"
                    trendBg="bg-green-100 dark:bg-green-900/30"
                />
            </div>

            {/* Filter Bar */}
            <div className="bg-white dark:bg-[#1a2e2f] p-4 rounded-xl border border-[#dbe5e6] dark:border-[#2d4546] shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#618789] w-4 h-4" />
                        <input
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            placeholder="Buscar órdenes, agentes o IDs..."
                            className="w-full pl-10 pr-4 py-2.5 bg-[#f1f3f4] dark:bg-white/5 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none font-medium"
                        />
                    </div>

                    <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[#618789] w-4 h-4" />
                        <select
                            value={selectedAgent}
                            onChange={(e) => { setSelectedAgent(e.target.value); setCurrentPage(1); }}
                            className="w-full pl-10 pr-4 py-2.5 bg-[#f1f3f4] dark:bg-white/5 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 appearance-none outline-none cursor-pointer font-medium"
                        >
                            {fetchingAgents ? (
                                <option>Cargando agentes...</option>
                            ) : (
                                <>
                                    <option value="">Filtrar por Agente...</option>
                                    {agents.map(a => <option key={a.id} value={a.id}>{a.nombre} {a.apellido}</option>)}
                                </>
                            )}
                        </select>
                    </div>

                    <div className="flex items-center gap-4 lg:col-span-2">
                        <button
                            onClick={clearFilters}
                            className="text-xs font-black text-[#618789] hover:text-primary flex items-center gap-1.5 transition-colors uppercase tracking-widest"
                        >
                            <FilterX className="w-4 h-4" />
                            Limpiar Filtros
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs and Table Section */}
            <div className="bg-white dark:bg-[#1a2e2f] rounded-2xl border border-[#dbe5e6] dark:border-[#2d4546] shadow-xl shadow-black/5 overflow-hidden">
                {/* Tabs Component */}
                <div className="border-b border-[#dbe5e6] dark:border-[#2d4546] px-6 bg-[#f9fafa] dark:bg-white/[0.02]">
                    <div className="flex gap-8">
                        <button className="border-b-2 border-primary text-[#111818] dark:text-white pb-4 pt-4 text-xs font-black uppercase tracking-widest">
                            Pendientes de Revisión
                            <span className="ml-2 bg-primary/20 text-[#111818] px-2 py-0.5 rounded-full text-[10px] tracking-normal">{stats.pending}</span>
                        </button>
                    </div>
                </div>

                {/* Table Content */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-[#f9fafa] dark:bg-white/[0.02] border-b border-[#dbe5e6] dark:border-[#2d4546]">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-black text-[#618789] uppercase tracking-widest">Identificador de Orden</th>
                                <th className="px-6 py-4 text-[10px] font-black text-[#618789] uppercase tracking-widest">Agente de Campo</th>
                                <th className="px-6 py-4 text-[10px] font-black text-[#618789] uppercase tracking-widest">Finalización</th>
                                <th className="px-6 py-4 text-[10px] font-black text-[#618789] uppercase tracking-widest">Progreso de Datos</th>
                                <th className="px-6 py-4 text-[10px] font-black text-[#618789] uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#dbe5e6] dark:divide-[#2d4546]">
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={5} className="px-6 py-10"><div className="h-4 bg-gray-100 dark:bg-white/5 rounded w-full"></div></td>
                                    </tr>
                                ))
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <AlertCircle className="w-10 h-10 text-gray-300" />
                                            <p className="text-sm font-bold text-[#618789]">No se encontraron órdenes pendientes de verificación.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                orders.map((order) => {
                                    const progress = calculateProgress(order);
                                    return (
                                        <tr key={order.id_orden} className="hover:bg-primary/[0.02] transition-colors group">
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-[#111818] dark:text-white tabular-nums">#{order.id_orden}</span>
                                                    <span className="text-[10px] text-[#618789] font-bold uppercase tracking-tight mt-0.5">{order.clase_orden || 'Tipo Estándar'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-xs border border-primary/20">
                                                        {order.agente_nombre?.[0] || 'A'}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-[#111818] dark:text-white">{order.agente_nombre} {order.agente_apellido}</span>
                                                        <span className="text-[10px] text-[#618789] font-medium leading-none mt-1">Técnico de Campo</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold text-[#111818] dark:text-white tabular-nums">
                                                        {order.fecha_primera_visita ? new Date(order.fecha_primera_visita).toLocaleDateString() : '---'}
                                                    </span>
                                                    <p className="text-[10px] text-[#618789] font-bold uppercase mt-0.5 italic">{order.motivo_cierre_nombre || 'Cerrado'}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="w-full max-w-[180px] space-y-2">
                                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                                        <span className="text-[#618789]">Protocolo Verificado</span>
                                                        <span className="text-primary">{progress.completed}/{progress.total}</span>
                                                    </div>
                                                    <div className="w-full bg-[#f0f4f4] dark:bg-white/5 h-2 rounded-full overflow-hidden border border-transparent dark:border-white/5">
                                                        <div
                                                            className="bg-primary h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(255,193,7,0.3)]"
                                                            style={{ width: `${progress.percent}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <Link
                                                    to={`/ordenes/${order.id_orden}`}
                                                    className="inline-flex items-center gap-2 bg-primary text-[#111818] px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all active:scale-95"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                    Auditar Orden
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
        </div>
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
