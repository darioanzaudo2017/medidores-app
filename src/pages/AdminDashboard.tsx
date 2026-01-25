import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
    Users,
    ClipboardCheck,
    Clock,
    TrendingUp,
    TrendingDown,
    Search,
    Bell,
    Download,
    Calendar,
    ChevronRight,
    LayoutDashboard,
    ClipboardList,
    Star,
    MapPin,
    CheckCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import AgentMap from '../components/AgentMap';

interface StatData {
    totalOrders: number;
    completionRate: number;
    avgTime: string;
    activeAgents: number;
    pendingOrders: number;
}

interface RawOrder {
    id_orden: number;
    id_estado_orden: string;
    id_agente: string;
    created_at: string;
    latcambio: string;
    longcambio: string;
}

interface AgentPerformanceData {
    id: string;
    name: string;
    role: string;
    assigned: number;
    completed: number;
    score: number;
    rawOrders: RawOrder[];
}

interface TrendData {
    label: string;
    created: number;
    completed: number;
}

interface DBUserWithRole {
    id: string;
    nombre: string;
    apellido: string;
    tipo_usuario: { nombre: string } | null;
}

const AdminDashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<StatData>({
        totalOrders: 0,
        completionRate: 0,
        avgTime: '0h',
        activeAgents: 0,
        pendingOrders: 0
    });
    const [agentPerformance, setAgentPerformance] = useState<AgentPerformanceData[]>([]);
    const [orderTrends, setOrderTrends] = useState<TrendData[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAgent, setSelectedAgent] = useState<AgentPerformanceData | null>(null);
    const [showAllOrders, setShowAllOrders] = useState(false);
    const [inventory, setInventory] = useState({
        completed: 0,
        inProgress: 0,
        pending: 0,
        total: 0
    });

    const fetchDashboardData = useCallback(async () => {
        try {
            setLoading(true);

            // 0. Get Agent Role ID first
            const { data: roleData } = await supabase
                .from('t_tipos_usuario')
                .select('id')
                .eq('nombre', 'AGENTE')
                .single();

            const agentRoleId = roleData?.id;

            // 1. Fetch Basic Stats
            const { count: totalOrders } = await supabase.from('t_ordenes').select('*', { count: 'exact', head: true });

            const { count: completedOrders } = await supabase
                .from('t_ordenes')
                .select('*', { count: 'exact', head: true })
                .in('id_estado_orden', ['71d96e8b-18b5-41c8-9aff-cfd0c708f526', 'b28d55bb-f885-4cfa-a181-88c1d80ac118']);

            const { count: pendingOrdersCount } = await supabase
                .from('t_ordenes')
                .select('*', { count: 'exact', head: true })
                .eq('id_estado_orden', 'b0f48c39-3f90-4690-9144-0fd200a655f3');

            let agentsCount = 0;
            if (agentRoleId) {
                const { count } = await supabase
                    .from('t_usuarios')
                    .select('*', { count: 'exact', head: true })
                    .eq('tipo_usuario_id', agentRoleId);
                agentsCount = count || 0;
            }

            // 2. Fetch Agent Performance
            const { data: agentsData } = await supabase
                .from('t_usuarios')
                .select(`id, nombre, apellido, tipo_usuario:t_tipos_usuario(nombre)`);

            const { data: allOrders } = await supabase
                .from('t_ordenes')
                .select('id_orden, id_estado_orden, id_agente, created_at, latcambio, longcambio');

            const processedAgents: AgentPerformanceData[] = (agentsData as unknown as DBUserWithRole[])
                ?.filter(u => u.tipo_usuario?.nombre === 'AGENTE' || u.tipo_usuario?.nombre === 'Superadmin')
                .map(u => {
                    const agentOrders = (allOrders as RawOrder[])?.filter((o) => o.id_agente === u.id) || [];
                    const totalCount = agentOrders.length;
                    const completedCount = agentOrders.filter((o) =>
                        ['71d96e8b-18b5-41c8-9aff-cfd0c708f526', 'b28d55bb-f885-4cfa-a181-88c1d80ac118'].includes(o.id_estado_orden)
                    ).length;

                    return {
                        id: u.id,
                        name: `${u.nombre} ${u.apellido}`,
                        role: u.tipo_usuario?.nombre || 'Agente',
                        assigned: totalCount,
                        completed: completedCount,
                        score: 4.5 + (Math.random() * 0.5),
                        rawOrders: agentOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    };
                }) || [];

            setAgentPerformance(processedAgents);

            // Update selectedAgent if it was already selected
            setSelectedAgent(prev => {
                if (!prev) return prev;
                const updated = processedAgents.find(a => a.id === prev.id);
                return updated || prev;
            });

            // 3. Trends
            const { data: simpleTrend } = await supabase
                .from('t_ordenes')
                .select('created_at, id_estado_orden')
                .order('created_at', { ascending: false })
                .limit(1000);

            const trendsMap: Record<string, TrendData> = {};
            simpleTrend?.forEach(o => {
                const date = new Date(o.created_at).toLocaleDateString();
                if (!trendsMap[date]) {
                    trendsMap[date] = {
                        created: 0,
                        completed: 0,
                        label: new Date(o.created_at).toLocaleDateString('es-AR', { weekday: 'short' })
                    };
                }
                trendsMap[date].created++;
                if (['71d96e8b-18b5-41c8-9aff-cfd0c708f526', 'b28d55bb-f885-4cfa-a181-88c1d80ac118'].includes(o.id_estado_orden)) {
                    trendsMap[date].completed++;
                }
            });

            const trendsArray = Object.values(trendsMap).slice(0, 7).reverse();
            setOrderTrends(trendsArray.length > 0 ? trendsArray : [
                { label: 'Lun', created: 10, completed: 8 },
                { label: 'Mar', created: 15, completed: 12 },
                { label: 'Mie', created: 8, completed: 5 },
                { label: 'Jue', created: 12, completed: 10 },
                { label: 'Vie', created: 20, completed: 18 },
                { label: 'Sab', created: 5, completed: 3 },
                { label: 'Dom', created: 2, completed: 1 },
            ]);

            setStats({
                totalOrders: totalOrders || 0,
                completionRate: totalOrders ? Math.round(((completedOrders || 0) / totalOrders) * 100) : 0,
                avgTime: '4.2h',
                activeAgents: agentsCount,
                pendingOrders: pendingOrdersCount || 0
            });

            setInventory({
                completed: completedOrders || 0,
                inProgress: (totalOrders || 0) - (completedOrders || 0) - (pendingOrdersCount || 0),
                pending: pendingOrdersCount || 0,
                total: totalOrders || 0
            });

        } catch (err: unknown) {
            const error = err as Error;
            console.error('Error fetching admin data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f9fafa] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xs font-black uppercase tracking-widest text-gray-400">Cargando métricas...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#f9fafa] min-h-screen font-sans text-slate-900 pb-12">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 px-8 py-4">
                <div className="max-w-[1400px] mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-600 text-white p-2 rounded-xl shadow-lg shadow-blue-200">
                            <LayoutDashboard className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black tracking-tight text-slate-800">Panel de Control</h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Admin Dashboard</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative hidden md:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Buscar por nombre o rol..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 rounded-2xl bg-gray-50 border-none text-sm focus:ring-2 focus:ring-blue-100 w-64 font-medium"
                            />
                        </div>
                        <button className="p-2.5 bg-gray-50 text-gray-500 rounded-2xl hover:bg-gray-100 transition-colors">
                            <Bell className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-[1400px] mx-auto px-8 py-8">
                {/* Content Logic: Overview vs Agent Detail */}
                {!selectedAgent ? (
                    <>
                        {/* Page Action Bar */}
                        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                            <div>
                                <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                                    <span>Dashboard</span>
                                    <ChevronRight className="w-3 h-3" />
                                    <span className="text-blue-600">Reportes de Rendimiento</span>
                                </div>
                                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Análisis & Rendimiento</h2>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <button className="flex items-center gap-2 bg-white border border-gray-100 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-gray-50 transition-all shadow-sm">
                                    <Calendar className="w-4 h-4" />
                                    Este Mes
                                </button>
                                <button className="bg-blue-600 text-white px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 transition-all shadow-xl shadow-blue-200">
                                    <Download className="w-4 h-4" />
                                    Exportar CSV
                                </button>
                            </div>
                        </div>

                        {/* KPI Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            <div className="bg-white p-6 rounded-[2rem] border border-gray-50 shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Total de Órdenes</p>
                                    <h3 className="text-3xl font-black text-slate-800">{stats.totalOrders.toLocaleString()}</h3>
                                    <div className="flex items-center gap-1 text-green-600 font-bold text-[10px] mt-2">
                                        <TrendingUp className="w-3 h-3" /> +14.2% vs mes anterior
                                    </div>
                                </div>
                                <div className="bg-blue-50 p-4 rounded-2xl">
                                    <ClipboardList className="w-6 h-6 text-blue-600" />
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-[2rem] border border-gray-50 shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Tasa de Cierre</p>
                                    <h3 className="text-3xl font-black text-slate-800 text-green-600">{stats.completionRate}%</h3>
                                    <div className="flex items-center gap-1 text-green-600 font-bold text-[10px] mt-2">
                                        <TrendingUp className="w-3 h-3" /> +2.1% vs mes anterior
                                    </div>
                                </div>
                                <div className="bg-green-50 p-4 rounded-2xl">
                                    <ClipboardCheck className="w-6 h-6 text-green-600" />
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-[2rem] border border-gray-50 shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Tiempo Resol.</p>
                                    <h3 className="text-3xl font-black text-slate-800">{stats.avgTime}</h3>
                                    <div className="flex items-center gap-1 text-red-500 font-bold text-[10px] mt-2">
                                        <TrendingDown className="w-3 h-3" /> +0.5h más lento
                                    </div>
                                </div>
                                <div className="bg-orange-50 p-4 rounded-2xl">
                                    <Clock className="w-6 h-6 text-orange-600" />
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-[2rem] border border-gray-50 shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Agentes Activos</p>
                                    <h3 className="text-3xl font-black text-slate-800">{stats.activeAgents}</h3>
                                    <div className="text-gray-400 font-bold text-[10px] mt-2">
                                        Agentes en campo hoy
                                    </div>
                                </div>
                                <div className="bg-purple-50 p-4 rounded-2xl">
                                    <Users className="w-6 h-6 text-purple-600" />
                                </div>
                            </div>
                        </div>

                        {/* Charts Area */}
                        <div className="grid grid-cols-12 gap-6 mb-8">
                            {/* Main Trend */}
                            <div className="col-span-12 lg:col-span-8 bg-white p-8 rounded-[2.5rem] border border-gray-50 shadow-sm">
                                <div className="flex items-center justify-between mb-10">
                                    <div>
                                        <h4 className="text-lg font-black text-slate-800">Tendencia de Órdenes</h4>
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Órdenes creadas vs completadas</p>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full bg-blue-600"></span>
                                            <span className="text-[10px] font-black text-gray-500 uppercase">Completadas</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full bg-gray-200"></span>
                                            <span className="text-[10px] font-black text-gray-500 uppercase">Creadas</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="h-[300px] flex items-end gap-3 relative px-4">
                                    {orderTrends.map((data, i) => {
                                        const maxVal = Math.max(...orderTrends.map(t => t.created), 1);
                                        const createdHeight = (data.created / maxVal) * 100;
                                        const completedHeight = (data.completed / maxVal) * 100;

                                        return (
                                            <div key={i} className="flex-1 flex flex-col items-center gap-3 group">
                                                <div className="w-full flex flex-col items-center justify-end gap-1 h-full">
                                                    <div
                                                        className="w-full bg-gray-100 rounded-t-lg transition-all group-hover:bg-gray-200"
                                                        style={{ height: `${createdHeight}%` }}
                                                    ></div>
                                                    <div
                                                        className="w-full bg-blue-600 rounded-t-lg transition-all group-hover:bg-blue-700 shadow-lg shadow-blue-100"
                                                        style={{ height: `${completedHeight}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-[10px] font-black text-gray-400 uppercase">
                                                    {data.label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Status Breakdown */}
                            <div className="col-span-12 lg:col-span-4 bg-white p-8 rounded-[2.5rem] border border-gray-50 shadow-sm text-center flex flex-col justify-center">
                                <div className="mb-8">
                                    <h4 className="text-lg font-black text-slate-800">Estado de Inventario</h4>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Resumen de estados actuales</p>
                                </div>

                                <div className="relative size-48 mx-auto flex items-center justify-center">
                                    <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                                        <circle className="text-gray-100" strokeWidth="3" fill="none" cx="18" cy="18" r="15.9155" />
                                        <circle
                                            className="text-blue-600 transition-all duration-1000"
                                            strokeWidth="3"
                                            strokeDasharray={`${inventory.total > 0 ? (inventory.completed / inventory.total) * 100 : 0}, 100`}
                                            strokeLinecap="round"
                                            fill="none" cx="18" cy="18" r="15.9155"
                                        />
                                        <circle
                                            className="text-orange-400 transition-all duration-1000"
                                            strokeWidth="3"
                                            strokeDasharray={`${inventory.total > 0 ? (inventory.inProgress / inventory.total) * 100 : 0}, 100`}
                                            strokeDashoffset={`${inventory.total > 0 ? -((inventory.completed / inventory.total) * 100) : 0}`}
                                            strokeLinecap="round"
                                            fill="none" cx="18" cy="18" r="15.9155"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-3xl font-black text-slate-800">{inventory.pending}</span>
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mt-1">Pendientes</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mt-10">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                                        <span className="text-[10px] font-bold text-slate-600 uppercase">Cerradas ({inventory.total > 0 ? Math.round((inventory.completed / inventory.total) * 100) : 0}%)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-orange-400"></span>
                                        <span className="text-[10px] font-bold text-slate-600 uppercase">En Proceso ({inventory.total > 0 ? Math.round((inventory.inProgress / inventory.total) * 100) : 0}%)</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Detailed Table */}
                        <div className="bg-white rounded-[2.5rem] border border-gray-50 shadow-sm overflow-hidden p-8">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                                <div>
                                    <h4 className="text-lg font-black text-slate-800">Resumen de Agentes</h4>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Métricas granulares por técnico</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                                        <input
                                            className="pl-9 pr-4 py-2 rounded-xl border border-gray-100 bg-gray-50 text-xs font-bold w-48 focus:ring-2 focus:ring-blue-100 transition-all"
                                            placeholder="Filtrar agentes..."
                                            type="text"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                            <th className="pb-4 px-2">Agente</th>
                                            <th className="pb-4 px-2">Rol</th>
                                            <th className="pb-4 px-2">Asignadas</th>
                                            <th className="pb-4 px-2">Completadas</th>
                                            <th className="pb-4 px-2">Eficiencia</th>
                                            <th className="pb-4 px-2">Calificación</th>
                                            <th className="pb-4 px-2 text-right">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {agentPerformance
                                            .filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()) || a.role.toLowerCase().includes(searchTerm.toLowerCase()))
                                            .map((agent, i) => (
                                                <tr
                                                    key={i}
                                                    onClick={() => setSelectedAgent(agent)}
                                                    className="hover:bg-gray-50/50 transition-colors group cursor-pointer"
                                                >
                                                    <td className="py-5 px-2">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-2xl bg-slate-100 flex items-center justify-center font-black text-xs text-slate-600 uppercase">
                                                                {agent.name.split(' ').map((n) => n[0]).join('')}
                                                            </div>
                                                            <p className="text-sm font-black text-slate-800">{agent.name}</p>
                                                        </div>
                                                    </td>
                                                    <td className="py-5 px-2 text-xs font-bold text-gray-500 uppercase">{agent.role}</td>
                                                    <td className="py-5 px-2 text-sm font-black text-slate-700">{agent.assigned}</td>
                                                    <td className="py-5 px-2 text-sm font-black text-blue-600">{agent.completed}</td>
                                                    <td className="py-5 px-2">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-xs font-black text-slate-800">
                                                                {agent.assigned > 0 ? Math.round((agent.completed / agent.assigned) * 100) : 0}%
                                                            </span>
                                                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-green-500 rounded-full"
                                                                    style={{ width: `${agent.assigned > 0 ? (agent.completed / agent.assigned) * 100 : 0}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-5 px-2">
                                                        <div className="flex text-yellow-400">
                                                            {[...Array(5)].map((_, j) => (
                                                                <Star key={j} className={cn("w-3.5 h-3.5 fill-current", j < Math.floor(agent.score) ? "text-yellow-400" : "text-gray-200")} />
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="py-5 px-2 text-right">
                                                        <button className="p-2 hover:bg-white rounded-xl shadow-sm text-gray-400 hover:text-blue-600 transition-all">
                                                            <TrendingUp className="w-5 h-5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : (
                    /* Mini Dashboard: Agent Tracking View */
                    <div className="animate-in fade-in slide-in-from-right duration-500">
                        <button
                            onClick={() => {
                                setSelectedAgent(null);
                                setShowAllOrders(false);
                            }}
                            className="mb-8 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-blue-600 transition-colors"
                        >
                            <ChevronRight className="w-4 h-4 rotate-180" /> Volver al Resumen General
                        </button>

                        <div className="grid grid-cols-12 gap-8">
                            {/* Profile Sidebar */}
                            <div className="col-span-12 lg:col-span-4 space-y-6">
                                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-50 shadow-sm text-center">
                                    <div className="w-24 h-24 mx-auto rounded-[2rem] bg-blue-600 flex items-center justify-center text-white text-3xl font-black mb-6 shadow-xl shadow-blue-100">
                                        {selectedAgent.name.split(' ').map((n) => n[0]).join('')}
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-800">{selectedAgent.name}</h3>
                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">{selectedAgent.role}</p>

                                    <div className="grid grid-cols-2 gap-4 mt-10">
                                        <div className="bg-gray-50 p-4 rounded-2xl">
                                            <p className="text-[10px] font-black text-gray-400 uppercase leading-none mb-2">Asignadas</p>
                                            <p className="text-xl font-black text-slate-800">{selectedAgent.assigned}</p>
                                        </div>
                                        <div className="bg-green-50 p-4 rounded-2xl">
                                            <p className="text-[10px] font-black text-green-600 uppercase leading-none mb-2">Cerradas</p>
                                            <p className="text-xl font-black text-green-700">{selectedAgent.completed}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-50 shadow-sm">
                                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">Ubicación de Trabajo</h4>
                                    <div className="h-64 bg-slate-50 rounded-[2rem] relative overflow-hidden">
                                        <AgentMap orders={selectedAgent.rawOrders} />
                                    </div>
                                    <div className="mt-4 flex items-start gap-3 p-4 bg-blue-50/50 rounded-2xl">
                                        <MapPin className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-bold text-slate-700">Puntos de Actividad</p>
                                            <p className="text-[10px] text-slate-500">Mostrando las coordenadas de las últimas órdenes registradas por el agente.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Activity Timeline / Detail */}
                            <div className="col-span-12 lg:col-span-8 space-y-6">
                                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-50 shadow-sm h-full">
                                    <div className="flex items-center justify-between mb-8">
                                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Actividad Reciente</h4>
                                        <div className="bg-blue-50 px-4 py-1.5 rounded-full text-blue-600 text-[10px] font-black uppercase">En Tiempo Real</div>
                                    </div>

                                    <div className="space-y-6">
                                        {selectedAgent.rawOrders.length > 0 ? (
                                            selectedAgent.rawOrders
                                                .slice(0, showAllOrders ? selectedAgent.rawOrders.length : 5)
                                                .map((order, idx) => (
                                                    <div key={idx} className="flex items-start gap-4 p-4 hover:bg-gray-50 rounded-3xl transition-colors border border-transparent hover:border-gray-100">
                                                        <div className={cn(
                                                            "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0",
                                                            ['71d96e8b-18b5-41c8-9aff-cfd0c708f526', 'b28d55bb-f885-4cfa-a181-88c1d80ac118'].includes(order.id_estado_orden)
                                                                ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600"
                                                        )}>
                                                            {['71d96e8b-18b5-41c8-9aff-cfd0c708f526', 'b28d55bb-f885-4cfa-a181-88c1d80ac118'].includes(order.id_estado_orden)
                                                                ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <p className="text-sm font-black text-slate-800">Orden #{order.id_orden}</p>
                                                                <p className="text-[10px] font-bold text-gray-400">
                                                                    {new Date(order.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                                </p>
                                                            </div>
                                                            <p className="text-xs text-gray-500 font-medium">Estado: {
                                                                order.id_estado_orden === '71d96e8b-18b5-41c8-9aff-cfd0c708f526' ? 'Verificado' :
                                                                    order.id_estado_orden === 'b28d55bb-f885-4cfa-a181-88c1d80ac118' ? 'Cerrado Agente' :
                                                                        'En Proceso'
                                                            }</p>
                                                        </div>
                                                    </div>
                                                ))
                                        ) : (
                                            <p className="text-sm font-bold text-gray-400 text-center py-10 italic">No hay actividad registrada aún.</p>
                                        )}
                                    </div>

                                    {selectedAgent.rawOrders.length > 5 && (
                                        <button
                                            onClick={() => setShowAllOrders(!showAllOrders)}
                                            className="w-full mt-10 py-4 bg-gray-50 rounded-[2rem] text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-gray-100 transition-colors"
                                        >
                                            {showAllOrders ? 'Ver menos' : `Cargar Historial Completo (${selectedAgent.rawOrders.length} órdenes)`}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminDashboard;
