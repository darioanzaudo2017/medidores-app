import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
    Plus,
    Search,
    FilterX,
    MoreVertical,
    ChevronLeft,
    ChevronRight,
    Clock,
    CheckCircle,
    Package,
    User,
    Activity,
    Hash,
    MapPin,
    Cpu,
    UserCheck,
    X,
    Loader2,
    Check,
    Eye
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';

interface Order {
    id_orden: number;
    created_at: string;
    clase_orden: string;
    cliente_nombre: string;
    cliente_apellido: string;
    cliente_calle: string;
    cliente_numero: number;
    cliente_medidor: string;
    estado_nombre: string;
    agente_id: string;
    agente_nombre: string;
    agente_apellido: string;
    agente_email: string;
}

interface Agent {
    id: string;
    nombre: string;
    apellido: string;
}

export const Orders = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [states, setStates] = useState<string[]>([]);
    const [fetchingAgents, setFetchingAgents] = useState(false);

    // Selection State
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    // Assignment Modal State
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assigningLoading, setAssigningLoading] = useState(false);
    const [targetAgentId, setTargetAgentId] = useState('');
    const [assignmentSuccess, setAssignmentSuccess] = useState(false);

    // Filters State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStatus, setSelectedStatus] = useState<string>('');
    const [selectedAgent, setSelectedAgent] = useState<string>('');
    const [minStreetNum, setMinStreetNum] = useState<string>('');
    const [maxStreetNum, setMaxStreetNum] = useState<string>('');
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    const [stats, setStats] = useState({
        total: 0,
        pending: 0,
        assigned: 0,
        completedToday: 0
    });

    const fetchFilterAndStats = async () => {
        setFetchingAgents(true);
        try {
            // 1. Fetch Agents via RPC
            const { data: agentsData } = await supabase.rpc('get_agents_list');
            if (agentsData) setAgents(agentsData);

            // 2. Fetch States
            const { data: statesData } = await supabase
                .from('t_estados')
                .select('nombre')
                .eq('activo', true)
                .order('nombre');
            if (statesData) setStates(statesData.map(s => s.nombre));

            // 3. Fetch specific counts for stats
            const { count: totalCount } = await supabase.from('t_ordenes').select('*', { count: 'exact', head: true });

            const { data: assignedData } = await supabase
                .from('v_ordenes_detalladas')
                .select('id_orden')
                .eq('estado_nombre', 'ASIGNADO');

            const { data: pendingData } = await supabase
                .from('v_ordenes_detalladas')
                .select('id_orden')
                .eq('estado_nombre', 'PENDIENTE');

            setStats(prev => ({
                ...prev,
                total: totalCount || 0,
                assigned: (assignedData as any)?.length || 0,
                pending: (pendingData as any)?.length || 0
            }));

        } catch (err) {
            console.error('Error in fetchFilterAndStats:', err);
        } finally {
            setFetchingAgents(false);
        }
    };

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('buscar_ordenes', {
                p_search: searchTerm || null,
                p_estados: selectedStatus || null,
                p_usuarios: selectedAgent || null,
                p_numero_min: minStreetNum ? parseFloat(minStreetNum) : null,
                p_numero_max: maxStreetNum ? parseFloat(maxStreetNum) : null,
                p_limit: pageSize,
                p_offset: (currentPage - 1) * pageSize
            });

            if (error) throw error;
            setOrders(data || []);

            if (data && data.length > 0 && data[0].total_count) {
                setStats(prev => ({ ...prev, total: parseInt(data[0].total_count) }));
            }
        } catch (err: any) {
            console.error('Error in fetchOrders:', err);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, selectedStatus, selectedAgent, minStreetNum, maxStreetNum, currentPage]);

    useEffect(() => {
        fetchFilterAndStats();
    }, []);

    useEffect(() => {
        const timer = setTimeout(fetchOrders, 400);
        return () => clearTimeout(timer);
    }, [fetchOrders]);

    // Bulk Assignment Logic
    const handleBulkAssign = async () => {
        if (!targetAgentId || selectedIds.length === 0) return;

        setAssigningLoading(true);
        try {
            // 1. Get the ID for 'ASIGNADO' status
            const { data: statusData } = await supabase
                .from('t_estados')
                .select('id')
                .eq('nombre', 'ASIGNADO')
                .single();

            if (!statusData) throw new Error('Status ASIGNADO not found');

            // 2. Perform bulk update
            const { error } = await supabase
                .from('t_ordenes')
                .update({
                    id_agente: targetAgentId,
                    id_estado_orden: statusData.id
                })
                .in('id_orden', selectedIds);

            if (error) throw error;

            // 3. Success Workflow
            setAssignmentSuccess(true);
            setTimeout(() => {
                setAssignmentSuccess(false);
                setShowAssignModal(false);
                setSelectedIds([]);
                setTargetAgentId('');
                fetchOrders();
                fetchFilterAndStats();
            }, 1500);

        } catch (err) {
            console.error('Error in bulk assignment:', err);
            alert('Failed to assign orders. Please try again.');
        } finally {
            setAssigningLoading(false);
        }
    };

    // Selection handlers
    const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        if (selectedIds.length === orders.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(orders.map(o => o.id_orden));
        }
    };

    const toggleSelectRow = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const clearFilters = () => {
        setSearchTerm('');
        setSelectedStatus('');
        setSelectedAgent('');
        setMinStreetNum('');
        setMaxStreetNum('');
        setCurrentPage(1);
        setSelectedIds([]);
    };

    return (
        <div className="p-4 lg:p-8 space-y-8 animate-in fade-in duration-500 text-left">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-extrabold tracking-tight">Orders Management</h2>
                    <p className="text-[#677c83] mt-1 font-medium">Bulk processing and service point monitoring.</p>
                </div>
                <div className="flex items-center gap-3">
                    {selectedIds.length > 0 && (
                        <button
                            onClick={() => setShowAssignModal(true)}
                            className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-3 rounded-xl flex items-center gap-2 text-sm font-bold shadow-lg shadow-orange-500/20 transition-all animate-in slide-in-from-right-4"
                        >
                            <UserCheck className="w-5 h-5" />
                            Assign {selectedIds.length} Orders
                        </button>
                    )}
                    <button className="bg-primary hover:bg-primary/90 text-white px-5 py-3 rounded-xl flex items-center gap-2 text-sm font-bold shadow-lg shadow-primary/20 transition-all">
                        <Plus className="w-5 h-5" />
                        New Order
                    </button>
                </div>
            </div>

            {/* Improved Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard icon={Package} label="Total Orders" value={stats.total.toLocaleString()} color="primary" />
                <StatCard icon={Clock} label="Pending" value={stats.pending.toLocaleString()} color="orange" />
                <StatCard icon={UserCheck} label="Assigned" value={stats.assigned.toLocaleString()} color="teal" />
                <StatCard icon={CheckCircle} label="Completed Today" value={stats.completedToday.toLocaleString()} color="green" />
            </div>

            {/* Advanced Filters */}
            <div className="bg-white dark:bg-[#2d3238] rounded-2xl border border-[#dde2e4] dark:border-white/10 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-[#dde2e4] dark:border-white/10">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#677c83] w-4 h-4" />
                            <input
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                placeholder="ID, Name, Street, Meter..."
                                className="w-full pl-10 pr-4 py-2.5 bg-[#f1f3f4] dark:bg-white/5 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                            />
                        </div>

                        <div className="relative">
                            <Activity className="absolute left-3 top-1/2 -translate-y-1/2 text-[#677c83] w-4 h-4" />
                            <select
                                value={selectedStatus}
                                onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
                                className="w-full pl-10 pr-4 py-2.5 bg-[#f1f3f4] dark:bg-white/5 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 appearance-none outline-none cursor-pointer"
                            >
                                <option value="">All Statuses</option>
                                {states.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[#677c83] w-4 h-4" />
                            <select
                                value={selectedAgent}
                                onChange={(e) => { setSelectedAgent(e.target.value); setCurrentPage(1); }}
                                className="w-full pl-10 pr-4 py-2.5 bg-[#f1f3f4] dark:bg-white/5 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 appearance-none outline-none cursor-pointer"
                            >
                                {fetchingAgents ? (
                                    <option>Loading agents...</option>
                                ) : (
                                    <>
                                        <option value="">Select Agent...</option>
                                        {agents.map(a => <option key={a.id} value={a.id}>{a.nombre} {a.apellido}</option>)}
                                    </>
                                )}
                            </select>
                        </div>

                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-[#677c83] w-3 h-3" />
                                <input
                                    value={minStreetNum}
                                    onChange={(e) => { setMinStreetNum(e.target.value); setCurrentPage(1); }}
                                    placeholder="Min #"
                                    className="w-full pl-8 pr-2 py-2.5 bg-[#f1f3f4] dark:bg-white/5 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                            </div>
                            <div className="relative flex-1">
                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-[#677c83] w-3 h-3" />
                                <input
                                    value={maxStreetNum}
                                    onChange={(e) => { setMaxStreetNum(e.target.value); setCurrentPage(1); }}
                                    placeholder="Max #"
                                    className="w-full pl-8 pr-2 py-2.5 bg-[#f1f3f4] dark:bg-white/5 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                        <button
                            onClick={clearFilters}
                            className="text-xs font-bold text-[#677c83] hover:text-primary flex items-center gap-1.5 transition-colors"
                        >
                            <FilterX className="w-4 h-4" />
                            Clear Filters ({selectedIds.length} items selected)
                        </button>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <span className="text-[10px] font-black text-[#677c83] uppercase tracking-widest tabular-nums font-mono">Real-time DB Active</span>
                        </div>
                    </div>
                </div>

                {/* Improved Table with Selection */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1050px]">
                        <thead>
                            <tr className="bg-[#f9fafa] dark:bg-white/2 border-b border-[#dde2e4] dark:border-white/10">
                                <th className="px-6 py-4 w-12 text-center">
                                    <input
                                        type="checkbox"
                                        className="rounded border-[#dde2e4] text-primary focus:ring-primary/20 cursor-pointer"
                                        checked={orders.length > 0 && selectedIds.length === orders.length}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th className="px-6 py-4 text-xs font-bold text-[#677c83] uppercase tracking-wider">ID</th>
                                <th className="px-6 py-4 text-xs font-bold text-[#677c83] uppercase tracking-wider">Client & Details</th>
                                <th className="px-6 py-4 text-xs font-bold text-[#677c83] uppercase tracking-wider">Address / Street</th>
                                <th className="px-6 py-4 text-xs font-bold text-[#677c83] uppercase tracking-wider">Meter serial</th>
                                <th className="px-6 py-4 text-xs font-bold text-[#677c83] uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-[#677c83] uppercase tracking-wider">Assigned Agent</th>
                                <th className="px-6 py-4 text-xs font-bold text-[#677c83] uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#dde2e4] dark:divide-white/10">
                            {loading ? (
                                [...Array(pageSize)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={8} className="px-6 py-6"><div className="h-4 bg-gray-100 dark:bg-white/5 rounded w-full"></div></td>
                                    </tr>
                                ))
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-20 text-center text-[#677c83]">No matching records found.</td>
                                </tr>
                            ) : (
                                orders.map((order) => (
                                    <tr
                                        key={order.id_orden}
                                        className={cn(
                                            "hover:bg-primary/[0.02] transition-colors cursor-pointer group",
                                            selectedIds.includes(order.id_orden) && "bg-primary/[0.04]"
                                        )}
                                        onClick={() => toggleSelectRow(order.id_orden)}
                                    >
                                        <td className="px-6 py-4 text-center">
                                            <input
                                                type="checkbox"
                                                className="rounded border-[#dde2e4] text-primary focus:ring-primary/20 cursor-pointer"
                                                checked={selectedIds.includes(order.id_orden)}
                                                onChange={(e) => { e.stopPropagation(); toggleSelectRow(order.id_orden); }}
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <Link
                                                to={`/ordenes/${order.id_orden}`}
                                                className="text-xs font-black text-primary font-mono bg-primary/10 px-2 py-1 rounded hover:bg-primary/20 transition-colors"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                #{order.id_orden}
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-[#121617] dark:text-white uppercase truncate max-w-[180px]">
                                                    {order.cliente_nombre} {order.cliente_apellido}
                                                </span>
                                                <span className="text-[10px] text-[#677c83] font-bold italic">{order.clase_orden || 'Standard Type'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-start gap-2">
                                                <MapPin className="w-3.5 h-3.5 text-primary mt-0.5" />
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold truncate max-w-[200px]">
                                                        {order.cliente_calle} {order.cliente_numero}
                                                    </span>
                                                    <span className="text-[10px] text-[#677c83]">Property Address</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-600">
                                                    <Cpu className="w-4 h-4" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black tabular-nums">{order.cliente_medidor || '---'}</span>
                                                    <span className="text-[10px] text-[#677c83] font-medium tracking-tight uppercase">Meter ID</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={order.estado_nombre} />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary border-2 border-white dark:border-white/10 shadow-sm">
                                                    {order.agente_nombre?.[0] || 'A'}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold leading-none">{order.agente_nombre || 'Unassigned'}</span>
                                                    <span className="text-[10px] text-[#677c83] leading-none mt-1">{order.agente_apellido}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Link
                                                    to={`/ordenes/${order.id_orden}`}
                                                    className="p-2 hover:bg-primary/10 rounded-xl text-[#677c83] hover:text-primary transition-all"
                                                    onClick={(e) => e.stopPropagation()}
                                                    title="View Detail"
                                                >
                                                    <Eye className="w-5 h-5" />
                                                </Link>
                                                <button className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-[#677c83] transition-all">
                                                    <MoreVertical className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-6 bg-[#f9fafa] dark:bg-white/2 border-t border-[#dde2e4] dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-[10px] font-black text-[#677c83] uppercase tracking-widest tabular-nums">
                        Displaying {orders.length} of {stats.total} total records
                    </p>
                    <div className="flex items-center gap-3">
                        <button
                            disabled={currentPage === 1}
                            onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => Math.max(1, prev - 1)); setSelectedIds([]); }}
                            className="w-10 h-10 flex items-center justify-center rounded-xl border border-[#dde2e4] dark:border-white/10 text-primary hover:bg-primary/5 transition-all disabled:opacity-30"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="px-4 py-2 bg-primary/5 rounded-xl border border-primary/20">
                            <span className="text-sm font-black text-primary">{currentPage}</span>
                        </div>
                        <button
                            disabled={orders.length < pageSize}
                            onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => prev + 1); setSelectedIds([]); }}
                            className="w-10 h-10 flex items-center justify-center rounded-xl border border-[#dde2e4] dark:border-white/10 text-primary hover:bg-primary/5 transition-all disabled:opacity-30"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Assignment Modal */}
            {showAssignModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#2d3238] rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-[#dde2e4] dark:border-white/10 flex items-center justify-between bg-primary/[0.03]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                    <UserCheck className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black tracking-tight">Bulk Assignment</h3>
                                    <p className="text-xs text-[#677c83] font-bold uppercase">{selectedIds.length} orders total</p>
                                </div>
                            </div>
                            <button
                                onClick={() => !assigningLoading && setShowAssignModal(false)}
                                className="p-2 hover:bg-white dark:hover:bg-white/5 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5 text-[#677c83]" />
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            {assignmentSuccess ? (
                                <div className="py-10 flex flex-col items-center text-center gap-4 animate-in zoom-in fade-in">
                                    <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center text-white shadow-xl shadow-green-500/20">
                                        <Check className="w-10 h-10" />
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-black text-[#121617] dark:text-white">Assignment Successful!</h4>
                                        <p className="text-sm text-[#677c83] font-medium mt-1">Updates are being finalized...</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-4">
                                        <label className="text-xs font-black text-[#677c83] uppercase tracking-widest pl-1">Target Agent</label>
                                        <div className="grid grid-cols-1 gap-3">
                                            {agents.length === 0 ? (
                                                <p className="text-sm text-center py-4 text-[#677c83] italic border-2 border-dashed rounded-2xl">No agents found</p>
                                            ) : (
                                                <div className="max-h-[240px] overflow-y-auto pr-2 custom-scrollbar space-y-2">
                                                    {agents.map(agent => (
                                                        <button
                                                            key={agent.id}
                                                            onClick={() => setTargetAgentId(agent.id)}
                                                            className={cn(
                                                                "w-full p-4 rounded-2xl border-2 text-left flex items-center gap-4 transition-all active:scale-[0.98]",
                                                                targetAgentId === agent.id
                                                                    ? "border-primary bg-primary/5 ring-4 ring-primary/10"
                                                                    : "border-transparent bg-[#f1f3f4] dark:bg-white/5 hover:border-[#dde2e4] dark:hover:border-white/20"
                                                            )}
                                                        >
                                                            <div className={cn(
                                                                "w-10 h-10 rounded-full flex items-center justify-center text-sm font-black transition-colors",
                                                                targetAgentId === agent.id ? "bg-primary text-white" : "bg-white dark:bg-white/10 text-primary"
                                                            )}>
                                                                {agent.nombre[0]}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-sm">{agent.nombre} {agent.apellido}</span>
                                                                <span className="text-[10px] text-[#677c83] font-bold uppercase">Ready for assign</span>
                                                            </div>
                                                            {targetAgentId === agent.id && <Check className="ml-auto w-5 h-5 text-primary" />}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        disabled={!targetAgentId || assigningLoading}
                                        onClick={handleBulkAssign}
                                        className="w-full py-4 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black text-sm shadow-xl shadow-primary/20 flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        {assigningLoading ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <UserCheck className="w-5 h-5" />
                                                Confirm Assignment
                                            </>
                                        )}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const StatCard = ({ icon: Icon, label, value, color }: any) => (
    <div className="bg-white dark:bg-[#2d3238] p-6 rounded-2xl border border-[#dde2e4] dark:border-white/10 shadow-sm relative overflow-hidden group hover:border-primary/50 transition-all">
        <div className={cn(
            "absolute -top-4 -right-4 p-8 opacity-[0.03] group-hover:opacity-[0.1] transition-all",
            color === 'orange' ? 'text-orange-500' : color === 'green' ? 'text-green-500' : color === 'teal' ? 'text-teal-500' : 'text-primary'
        )}>
            <Icon className="w-24 h-24" />
        </div>
        <div className="relative z-10 text-left">
            <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center mb-4",
                color === 'orange' ? 'bg-orange-500/10 text-orange-500' :
                    color === 'green' ? 'bg-green-500/10 text-green-500' :
                        color === 'teal' ? 'bg-teal-500/10 text-teal-500' :
                            'bg-primary/10 text-primary'
            )}>
                <Icon className="w-6 h-6" />
            </div>
            <p className="text-[10px] font-black text-[#677c83] uppercase tracking-widest">{label}</p>
            <h3 className="text-2xl font-black mt-1 tabular-nums">{value}</h3>
        </div>
    </div>
);

const StatusBadge = ({ status = '' }: { status?: string }) => {
    const s = status?.toUpperCase();
    const styles: any = {
        'PENDIENTE': 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 border-orange-200 dark:border-orange-500/30',
        'VERIFICADO': 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 border-green-200 dark:border-green-500/30',
        'ASIGNADO': 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border-blue-200 dark:border-blue-500/30',
    };

    const badgeStyle = styles[s] || 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400 border-gray-200';

    return (
        <span className={cn(
            "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
            badgeStyle
        )}>
            {status || 'UNSET'}
        </span>
    );
};
