import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
    Map as MapIcon,
    Search,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    FilterX
} from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '../lib/utils';

interface OrderMapData {
    id_orden: number;
    created_at: string;
    cliente_nombre: string;
    cliente_apellido: string;
    cliente_calle: string;
    cliente_numero: string;
    cliente_medidor: string;
    lat_final: number | null;
    long_final: number | null;
    estado_nombre: string;
    motivo_cierre_nombre: string;
    agente_nombre: string;
    id_estado_orden: string;
    id_motivo_cierre: number | null;
}

const ChangeView = ({ center, zoom }: { center: [number, number], zoom: number }) => {
    const map = useMap();
    useEffect(() => {
        map.setView(center, zoom);
    }, [center, zoom, map]);
    return null;
};

export const RealTimeMap = () => {
    const [orders, setOrders] = useState<OrderMapData[]>([]);
    const [motivos, setMotivos] = useState<{ id: number, Motivo: string }[]>([]);
    const [estados, setEstados] = useState<{ id: string, nombre: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [motiveFilter, setMotiveFilter] = useState('');
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
    const [mapCenter, setMapCenter] = useState<[number, number]>([-31.4135, -64.18105]);
    const [mapZoom, setMapZoom] = useState(13);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Fetch auxiliares
            const [{ data: mData }, { data: eData }] = await Promise.all([
                supabase.from('t_motivos_cierre').select('id, Motivo').order('id'),
                supabase.from('t_estados').select('id, nombre').order('nombre')
            ]);
            if (mData) setMotivos(mData);
            if (eData) setEstados(eData);

            // 2. Fetch Órdenes en bucle para saltar el límite de 1000 de Supabase
            let allData: any[] = [];
            let from = 0;
            const step = 1000;
            let finished = false;

            while (!finished) {
                const { data: chunk, error: chunkError } = await supabase
                    .from('v_ordenes_detalladas')
                    .select('*')
                    .order('id_orden', { ascending: false })
                    .range(from, from + step - 1);

                if (chunkError) throw chunkError;

                if (chunk && chunk.length > 0) {
                    allData = [...allData, ...chunk];
                    if (chunk.length < step) finished = true;
                    else from += step;
                } else {
                    finished = true;
                }
                if (allData.length > 10000) finished = true;
            }

            const data = allData;
            console.log('Total de órdenes recuperadas (paginado):', data.length);

            const mappedData: OrderMapData[] = (data || []).map(o => {
                const clean = (val: any) => {
                    if (!val) return null;
                    const n = parseFloat(val.toString().replace(',', '.').trim());
                    return isNaN(n) ? null : n;
                };

                // PRIORIDAD: 1. Coordenada de cambio, 2. Coordenada del Cliente
                const lat = clean(o.latcambio) || clean(o.latitud);
                const lng = clean(o.longcambio) || clean(o.longitud);

                return {
                    id_orden: o.id_orden,
                    created_at: o.created_at,
                    cliente_nombre: o.cliente_nombre || '',
                    cliente_apellido: o.cliente_apellido || '',
                    cliente_calle: o.cliente_calle || '',
                    cliente_numero: o.cliente_numero || '',
                    cliente_medidor: o.cliente_medidor || '',
                    lat_final: lat,
                    long_final: lng,
                    estado_nombre: o.estado_nombre || 'SIN ESTADO',
                    motivo_cierre_nombre: o.motivo_cierre_nombre || '',
                    agente_nombre: `${o.agente_nombre || ''} ${o.agente_apellido || ''}`.trim() || 'Sin Agente',
                    id_estado_orden: o.id_estado_orden,
                    id_motivo_cierre: o.motivo_de_cierre
                };
            });

            console.log('Órdenes cargadas:', mappedData.length);
            setOrders(mappedData);

            // Auto-center
            const firstWithCoord = mappedData.find(o => o.lat_final && o.long_final);
            if (firstWithCoord && firstWithCoord.lat_final && firstWithCoord.long_final) {
                setMapCenter([firstWithCoord.lat_final, firstWithCoord.long_final]);
            }
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredOrders = useMemo(() => {
        return orders.filter(o => {
            const matchesSearch = searchTerm === '' ||
                o.id_orden.toString().includes(searchTerm) ||
                `${o.cliente_nombre} ${o.cliente_apellido}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                o.cliente_calle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                o.cliente_medidor.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus = statusFilter === '' || o.id_estado_orden === statusFilter;
            const matchesMotive = motiveFilter === '' || o.id_motivo_cierre?.toString() === motiveFilter.toString();

            return matchesSearch && matchesStatus && matchesMotive;
        });
    }, [orders, searchTerm, statusFilter, motiveFilter]);

    const getStatusColor = (status: string) => {
        const s = status.toUpperCase();
        if (s.includes('PENDIENTE')) return '#f97316';
        if (s.includes('VERIFICADO')) return '#22c55e';
        if (s.includes('CERRADO')) return '#ef4444';
        if (s.includes('ASIGNADO')) return '#3b82f6';
        if (s.includes('PROCESO')) return '#eab308';
        return '#64748b';
    };

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
            <div className="bg-white border-b border-gray-100 p-4 flex flex-wrap items-center gap-4 z-20 shadow-sm">
                <div className="flex items-center space-x-2 text-blue-600">
                    <MapIcon className="w-5 h-5" />
                    <h1 className="text-sm font-black uppercase tracking-tighter">Monitoreo</h1>
                </div>

                <div className="flex-1 flex flex-wrap items-center gap-3">
                    <div className="relative min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-xl text-xs font-bold outline-none"
                        />
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-gray-50 border-none rounded-xl px-4 py-2 text-xs font-black uppercase outline-none cursor-pointer"
                    >
                        <option value="">Todos los Estados</option>
                        {estados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                    </select>

                    <select
                        value={motiveFilter}
                        onChange={(e) => setMotiveFilter(e.target.value)}
                        className="bg-gray-50 border-none rounded-xl px-4 py-2 text-xs font-black uppercase outline-none cursor-pointer"
                    >
                        <option value="">Todos los Motivos</option>
                        {motivos.map(m => <option key={m.id} value={m.id}>{m.Motivo}</option>)}
                    </select>

                    {(searchTerm || statusFilter || motiveFilter) && (
                        <button onClick={() => { setSearchTerm(''); setStatusFilter(''); setMotiveFilter(''); }} className="p-2 text-red-500 hover:bg-red-50 rounded-xl">
                            <FilterX className="w-5 h-5" />
                        </button>
                    )}
                </div>

                <div className="flex items-center space-x-4">
                    <button onClick={fetchData} className="p-2 hover:bg-gray-100 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase text-gray-400">
                        <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                        Actualizar
                    </button>
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 bg-gray-50 hover:bg-gray-100 rounded-xl">
                        {isSidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            <div className="flex-1 flex relative overflow-hidden">
                <div className="flex-1 h-full relative z-10">
                    <MapContainer center={mapCenter} zoom={mapZoom} className="w-full h-full" style={{ background: '#f8fafc' }}>
                        <ChangeView center={mapCenter} zoom={mapZoom} />
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        {filteredOrders.map(order => {
                            if (!order.lat_final || !order.long_final) return null;
                            return (
                                <CircleMarker
                                    key={order.id_orden}
                                    center={[order.lat_final, order.long_final]}
                                    radius={8}
                                    pathOptions={{
                                        fillColor: getStatusColor(order.estado_nombre),
                                        fillOpacity: 0.8,
                                        color: '#ffffff',
                                        weight: 2
                                    }}
                                    eventHandlers={{ click: () => setSelectedOrderId(order.id_orden) }}
                                >
                                    <Popup>
                                        <div className="p-1 min-w-[180px]">
                                            <p className="text-[10px] font-black text-blue-600 mb-1">#{order.id_orden}</p>
                                            <h3 className="text-xs font-black text-slate-800 uppercase leading-tight">{order.cliente_nombre} {order.cliente_apellido}</h3>
                                            <p className="text-[9px] text-gray-500 mt-1">{order.cliente_calle} {order.cliente_numero}</p>
                                            <div className="mt-2 pt-2 border-t border-gray-100">
                                                <span className="text-[8px] font-black uppercase px-2 py-1 rounded-full bg-slate-100 text-slate-600">{order.estado_nombre}</span>
                                            </div>
                                            {order.motivo_cierre_nombre && (
                                                <p className="mt-2 text-[9px] font-bold text-red-500 bg-red-50 p-1 rounded">{order.motivo_cierre_nombre}</p>
                                            )}
                                            <a href={`/ordenes/${order.id_orden}`} className="block mt-3 text-center py-2 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase">Ver Detalle</a>
                                        </div>
                                    </Popup>
                                </CircleMarker>
                            );
                        })}
                    </MapContainer>
                </div>

                <div className={cn("bg-white border-l transition-all duration-300 z-10", isSidebarOpen ? "w-[320px]" : "w-0 overflow-hidden")}>
                    <div className="p-4 border-b">
                        <h2 className="text-xs font-black uppercase text-slate-800">Órdenes ({filteredOrders.length})</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {filteredOrders.map(order => (
                            <button
                                key={order.id_orden}
                                onClick={() => {
                                    if (order.lat_final && order.long_final) {
                                        setMapCenter([order.lat_final, order.long_final]);
                                        setMapZoom(18);
                                        setSelectedOrderId(order.id_orden);
                                    }
                                }}
                                className={cn(
                                    "w-full text-left p-3 rounded-2xl border-2 transition-all flex flex-col gap-1",
                                    selectedOrderId === order.id_orden ? "bg-blue-50 border-blue-200" : "bg-white border-transparent hover:bg-slate-50"
                                )}
                            >
                                <div className="flex justify-between items-center">
                                    <span className="text-[8px] font-black text-blue-600">#{order.id_orden}</span>
                                    <span className="text-[8px] font-black uppercase text-gray-400">{order.estado_nombre}</span>
                                </div>
                                <p className="text-[10px] font-black uppercase text-slate-800 leading-tight">{order.cliente_nombre} {order.cliente_apellido}</p>
                                <p className="text-[8px] text-gray-400">{order.cliente_calle} {order.cliente_numero}</p>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
