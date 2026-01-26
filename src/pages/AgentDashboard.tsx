import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import {
    ClipboardList,
    Clock,
    CheckCircle2,
    Search,
    MapPin,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    AlertCircle,
    Play,
    Hash
} from 'lucide-react';
import { cn } from '../lib/utils';

interface Order {
    id_orden: number;
    cliente_nombre: string;
    cliente_calle: string;
    cliente_numero: string;
    cliente_medidor: string;
    estado_nombre: string;
    id_estado_orden: string;
    created_at: string;
    paso_actual: number;
    motivo_cierre_nombre?: string;
}

const AgentDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<Order[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [activeTab, setActiveTab] = useState<'assigned' | 'closed'>('assigned');
    const [stats, setStats] = useState({
        pending: 0,
        inProgress: 0,
        completedToday: 0
    });

    const pageSize = 10;

    const fetchDashboardData = useCallback(async () => {
        if (!user) return;
        setLoading(true);

        try {
            // 1. Obtener el ID de usuario interno
            const { data: userData, error: userError } = await supabase
                .from('t_usuarios')
                .select('id')
                .eq('auth_user_id', user.id)
                .single();

            if (userError) throw userError;
            const agentId = userData.id;

            // 2. Obtener órdenes del agente con paginación y búsqueda
            let query = supabase
                .from('v_ordenes_detalladas')
                .select('*', { count: 'exact' })
                .eq('agente_id', agentId)
                .order('created_at', { ascending: false });

            if (activeTab === 'assigned') {
                query = query.in('id_estado_orden', [
                    'b0f48c39-3f90-4690-9144-0fd200a655f3', // PENDIENTE
                    '9cedf5ae-f10c-4412-a617-69646a4ee515',  // ASIGNADO
                    '60804b07-3287-45b4-b4f2-622884f519d2',  // EN PROCESO
                    '3945416a-775d-412b-b05b-86a582934aaf'   // REASIGNADO
                ]);
            } else {
                query = query.eq('id_estado_orden', 'b28d55bb-f885-4cfa-a181-88c1d80ac118'); // CERRADO AGENTE
            }

            if (searchTerm) {
                const cleanTerm = searchTerm.trim();
                const term = `%${cleanTerm}%`;

                // Construimos las condiciones de búsqueda sin cliente_apellido ya que no existe en la vista
                let orConditions = `cliente_nombre.ilike.${term},cliente_calle.ilike.${term},cliente_numero.ilike.${term},cliente_medidor.ilike.${term}`;

                // Si es un número, también buscamos por ID de orden
                if (!isNaN(Number(cleanTerm)) && cleanTerm !== '') {
                    orConditions += `,id_orden.eq.${cleanTerm}`;
                }

                query = query.or(orConditions);
            }

            const { data, count, error } = await query
                .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

            if (error) throw error;
            setOrders(data as unknown as Order[] || []);
            setTotalCount(count || 0);

            // 3. Calcular Stats (KPIs)
            const { count: pendingCount } = await supabase
                .from('t_ordenes')
                .select('*', { count: 'exact', head: true })
                .eq('id_agente', agentId)
                .in('id_estado_orden', [
                    'b0f48c39-3f90-4690-9144-0fd200a655f3', // PENDIENTE
                    '9cedf5ae-f10c-4412-a617-69646a4ee515',   // ASIGNADO
                    '3945416a-775d-412b-b05b-86a582934aaf'    // REASIGNADO
                ]);

            const { count: progressCount } = await supabase
                .from('t_ordenes')
                .select('*', { count: 'exact', head: true })
                .eq('id_agente', agentId)
                .eq('id_estado_orden', '60804b07-3287-45b4-b4f2-622884f519d2'); // EN PROCESO

            const today = new Date().toISOString().split('T')[0];
            const { count: doneTodayCount } = await supabase
                .from('t_ordenes')
                .select('*', { count: 'exact', head: true })
                .eq('id_agente', agentId)
                .eq('id_estado_orden', 'b28d55bb-f885-4cfa-a181-88c1d80ac118') // CERRADO AGENTE
                .gte('created_at', today);

            setStats({
                pending: pendingCount || 0,
                inProgress: progressCount || 0,
                completedToday: doneTodayCount || 0
            });

        } catch (err) {
            console.error('Error fetching dashboard data:', err);
        } finally {
            setLoading(false);
        }
    }, [user, activeTab, searchTerm, currentPage, pageSize]);

    useEffect(() => {
        const timer = setTimeout(fetchDashboardData, 300);
        return () => clearTimeout(timer);
    }, [fetchDashboardData]);

    return (
        <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-safe pt-safe">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">Mis Tareas</h1>
                    <p className="text-gray-500 font-medium">Gestiona y ejecuta tus órdenes de trabajo asignadas.</p>
                </div>
                <button
                    onClick={() => fetchDashboardData()}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-sm active:scale-95"
                >
                    <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                    Actualizar
                </button>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    label="Pendientes"
                    value={stats.pending}
                    icon={ClipboardList}
                    color="bg-yellow-500"
                    lightColor="bg-yellow-50"
                />
                <StatCard
                    label="En Proceso"
                    value={stats.inProgress}
                    icon={Clock}
                    color="bg-blue-600"
                    lightColor="bg-blue-50"
                />
                <StatCard
                    label="Completadas Hoy"
                    value={stats.completedToday}
                    icon={CheckCircle2}
                    color="bg-green-500"
                    lightColor="bg-green-50"
                />
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-gray-100 rounded-2xl w-fit">
                <button
                    onClick={() => { setActiveTab('assigned'); setCurrentPage(1); }}
                    className={cn(
                        "flex items-center gap-2 px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all",
                        activeTab === 'assigned' ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                    )}
                >
                    <Clock className="w-4 h-4" />
                    Asignadas ({stats.pending + stats.inProgress})
                </button>
                <button
                    onClick={() => { setActiveTab('closed'); setCurrentPage(1); }}
                    className={cn(
                        "flex items-center gap-2 px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all",
                        activeTab === 'closed' ? "bg-white text-green-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                    )}
                >
                    <CheckCircle2 className="w-4 h-4" />
                    Mis Cierres
                </button>
            </div>

            {/* Orders Container */}
            <div className="bg-white rounded-3xl shadow-xl shadow-black/5 border border-gray-100 overflow-hidden">
                <div className="p-4 md:p-6 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/30">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            placeholder="Buscar por nombre, dirección o medidor..."
                            className="w-full pl-12 pr-4 py-3 bg-white border-gray-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                        />
                    </div>
                </div>

                {/* Mobile View: Cards */}
                <div className="md:hidden divide-y divide-gray-50 pb-20">
                    {loading ? (
                        [...Array(3)].map((_, i) => (
                            <div key={i} className="p-4 animate-pulse space-y-3">
                                <div className="h-4 bg-gray-100 rounded w-1/3"></div>
                                <div className="h-4 bg-gray-100 rounded w-full"></div>
                                <div className="h-10 bg-gray-100 rounded w-full"></div>
                            </div>
                        ))
                    ) : orders.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">
                            <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-20" />
                            <p className="text-sm font-bold">No hay órdenes para mostrar</p>
                        </div>
                    ) : (
                        orders.map((order) => (
                            <div key={order.id_orden} className="p-4 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col">
                                        <span className="text-lg font-black text-gray-900 leading-none">#{order.id_orden}</span>
                                        <span className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wide">
                                            {new Date(order.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <span className={cn(
                                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                        order.estado_nombre === 'EN PROCESO' ? "bg-blue-100 text-blue-700" :
                                            order.estado_nombre === 'CERRADO AGENTE' ? "bg-green-100 text-green-700" :
                                                "bg-yellow-100 text-yellow-700"
                                    )}>
                                        {order.estado_nombre}
                                    </span>
                                </div>

                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-gray-900">{order.cliente_nombre}</span>
                                    <div className="flex flex-col gap-1 mt-1">
                                        <div className="flex items-center gap-1.5 text-gray-500">
                                            <MapPin className="w-3.5 h-3.5" />
                                            <span className="text-xs font-medium">{order.cliente_calle} {order.cliente_numero}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[#688182]">
                                            <Hash className="w-3.5 h-3.5" />
                                            <span className="text-xs font-bold uppercase tracking-wider">Medidor: {order.cliente_medidor}</span>
                                        </div>
                                    </div>
                                    {activeTab === 'closed' && order.motivo_cierre_nombre && (
                                        <div className="mt-2 py-1.5 px-3 bg-gray-100 rounded-lg inline-flex items-center gap-2">
                                            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                                                {order.motivo_cierre_nombre}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => navigate(`/orden/${order.id_orden}/ejecutar`)}
                                    className={cn(
                                        "w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg",
                                        order.estado_nombre === 'EN PROCESO' ? "bg-blue-600 text-white shadow-blue-500/10" :
                                            order.estado_nombre === 'CERRADO AGENTE' ? "bg-gray-100 text-gray-600 shadow-none hover:bg-gray-200" :
                                                "bg-blue-600 text-white shadow-blue-500/10 hover:bg-blue-700"
                                    )}
                                >
                                    <span>{order.estado_nombre === 'EN PROCESO' ? 'Continuar' :
                                        order.estado_nombre === 'CERRADO AGENTE' ? 'Ver Detalle' : 'Iniciar Trabajo'}</span>
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Desktop View: Table */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/50">
                            <tr>
                                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Orden</th>
                                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Cliente / Domicilio</th>
                                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Estado</th>
                                {activeTab === 'closed' && (
                                    <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Motivo de Cierre</th>
                                )}
                                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                [...Array(3)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={5} className="px-6 py-8"><div className="h-4 bg-gray-100 rounded-lg w-full"></div></td>
                                    </tr>
                                ))
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center text-gray-400 font-bold">No se encontraron órdenes</td>
                                </tr>
                            ) : (
                                orders.map((order) => (
                                    <tr key={order.id_orden} className="hover:bg-blue-50/30 transition-colors group">
                                        <td className="px-6 py-6">
                                            <div className="flex flex-col">
                                                <span className="text-lg font-black text-gray-900 leading-none">#{order.id_orden}</span>
                                                <span className="text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-wide">
                                                    Asignada: {new Date(order.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-gray-900">{order.cliente_nombre}</span>
                                                <div className="flex items-center gap-1.5 mt-1 text-gray-500">
                                                    <MapPin className="w-3.5 h-3.5" />
                                                    <span className="text-xs font-medium">{order.cliente_calle} {order.cliente_numero}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-1 text-[#688182]">
                                                    <Hash className="w-3.5 h-3.5" />
                                                    <span className="text-[10px] font-bold uppercase tracking-wider">Medidor: {order.cliente_medidor}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6">
                                            <span className={cn(
                                                "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest",
                                                order.estado_nombre === 'EN PROCESO' ? "bg-blue-100 text-blue-700" :
                                                    order.estado_nombre === 'CERRADO AGENTE' ? "bg-green-100 text-green-700" :
                                                        "bg-yellow-100 text-yellow-700"
                                            )}>
                                                {order.estado_nombre}
                                            </span>
                                        </td>
                                        {activeTab === 'closed' && (
                                            <td className="px-6 py-6">
                                                <span className="text-xs font-bold text-gray-600">
                                                    {order.motivo_cierre_nombre || '---'}
                                                </span>
                                            </td>
                                        )}
                                        <td className="px-6 py-6 text-right">
                                            <button
                                                onClick={() => navigate(`/orden/${order.id_orden}/ejecutar`)}
                                                className={cn(
                                                    "inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg",
                                                    order.estado_nombre === 'EN PROCESO' ? "bg-blue-600 text-white shadow-blue-500/10 hover:bg-blue-700" :
                                                        order.estado_nombre === 'CERRADO AGENTE' ? "bg-gray-100 text-gray-600 shadow-none hover:bg-gray-200" :
                                                            "bg-blue-600 text-white shadow-blue-500/10 hover:bg-blue-700"
                                                )}
                                            >
                                                {order.estado_nombre === 'EN PROCESO' ? (
                                                    <><span>Continuar</span> <ChevronRight className="w-4 h-4" /></>
                                                ) : order.estado_nombre === 'CERRADO AGENTE' ? (
                                                    <><span>Ver Detalle</span> <ChevronRight className="w-4 h-4" /></>
                                                ) : (
                                                    <><span>Iniciar</span> <Play className="w-4 h-4" /></>
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {
                    totalCount > 0 && (
                        <div className="p-6 border-t border-gray-50 flex items-center justify-between bg-gray-50/20 pb-safe">
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest tabular-nums">
                                Mostrando {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalCount)} de {totalCount}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    className="p-3 border border-gray-200 rounded-xl disabled:opacity-30 bg-white hover:bg-gray-50 transition-all font-bold"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                    disabled={currentPage * pageSize >= totalCount}
                                    onClick={() => setCurrentPage(p => p + 1)}
                                    className="p-3 border border-gray-200 rounded-xl disabled:opacity-30 bg-white hover:bg-gray-50 transition-all font-bold"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )
                }
            </div >
        </div >
    );
};

interface StatCardProps {
    label: string;
    value: number;
    icon: React.ElementType;
    color: string;
    lightColor: string;
}

const StatCard = ({ label, value, icon: Icon, color, lightColor }: StatCardProps) => (
    <div className="bg-white p-6 rounded-3xl shadow-xl shadow-black/5 border border-gray-100 flex items-center justify-between group hover:border-blue-200 transition-all">
        <div className="space-y-1">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">{label}</p>
            <p className="text-4xl font-black text-gray-900 tabular-nums">{value}</p>
        </div>
        <div className={cn("p-4 rounded-2xl transition-all group-hover:scale-110", lightColor)}>
            <Icon className={cn("w-7 h-7", color.replace('bg-', 'text-'))} />
        </div>
    </div>
);

export default AgentDashboard;
