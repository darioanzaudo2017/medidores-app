import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
    ChevronRight,
    Printer,
    History,
    User,
    MapPin,
    Gauge,
    ImageIcon,
    ClipboardList,
    CheckCircle,
    Edit3,
    ArrowLeft,
    Clock,
    Map as MapIcon,
    AlertTriangle,
    CheckSquare,
    Share2,
    Activity,
    Hash,
    Briefcase
} from 'lucide-react';
import { cn } from '../lib/utils';

interface OrderDetailData {
    id_orden: number;
    created_at: string;
    clase_orden: string;
    cliente_nombre: string;
    cliente_apellido: string;
    cliente_calle: string;
    cliente_numero: number;
    cliente_piso: string;
    cliente_depto: string;
    cliente_localidad: string;
    cliente_telefono: string;
    cliente_medidor: string;
    cliente_lectura: number;
    lectura_nueva: number;
    diferencia: number;
    cliente_latitud: number;
    cliente_longitud: number;
    cliente_cuenta_contrato: string;
    cliente_punto_suministro: string;
    estado_nombre: string;
    agente_nombre: string;
    agente_apellido: string;
    agente_email: string;
    motivo_cierre_nombre: string;
    fecha_primera_visita: string;
    // Checklist fields
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

export const OrderDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState<OrderDetailData | null>(null);
    const [loading, setLoading] = useState(true);
    const [verificationComment, setVerificationComment] = useState('');
    const [updating, setUpdating] = useState(false);
    const [infoCorrect, setInfoCorrect] = useState(false);
    const [photosCorrect, setPhotosCorrect] = useState(false);

    const fetchOrderData = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('v_ordenes_detalladas')
                .select('*')
                .eq('id_orden', id)
                .single();

            if (error) throw error;
            setOrder(data);

            // Initial reset of toggles if it's already verified? 
            // Actually they only show for CERRADO AGENTE so it's fine.
        } catch (err) {
            console.error('Error fetching order details:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrderData();
    }, [id]);

    const handleUpdateStatus = async (newStatus: string) => {
        if (!order || !id) return;

        // If verifying, we require the toggles
        if (newStatus === 'VERIFICADO' && (!infoCorrect || !photosCorrect)) {
            alert('Por favor, confirme que la información y las fotos son correctas.');
            return;
        }

        setUpdating(true);
        try {
            const STATUS_MAP: Record<string, string> = {
                'VERIFICADO': '71d96e8b-18b5-41c8-9aff-cfd0c708f526',
                'REASIGNADO': '3945416a-775d-412b-b05b-86a582934aaf'
            };

            const statusId = STATUS_MAP[newStatus];
            if (!statusId) throw new Error('Estado inválido');

            const { error } = await supabase
                .from('t_ordenes')
                .update({
                    id_estado_orden: statusId,
                    orden_verificada: newStatus === 'VERIFICADO' ? 'SI' : 'NO',
                    observacion_verificacion: verificationComment,
                    fotos_verificadas: photosCorrect ? 'SI' : 'NO'
                })
                .eq('id_orden', id);

            if (error) throw error;

            // Refetch to see changes
            await fetchOrderData();
            setVerificationComment('');
            setInfoCorrect(false);
            setPhotosCorrect(false);
        } catch (err) {
            console.error('Error updating status:', err);
            alert('Error al actualizar el estado de la orden');
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center p-20">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    <p className="text-sm font-bold text-[#618789] animate-pulse uppercase tracking-widest">Cargando detalles de la orden...</p>
                </div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="p-8 text-center flex flex-col items-center justify-center h-[60vh]">
                <AlertTriangle className="w-16 h-16 text-orange-500 mb-4" />
                <h2 className="text-2xl font-black">Orden no encontrada</h2>
                <p className="text-[#618789] mb-6">El ID de orden #{id} no existe o no tienes acceso.</p>
                <Link to="/ordenes" className="px-6 py-2 bg-primary text-[#121617] font-black rounded-lg hover:bg-primary/90 transition-all">
                    Volver a Órdenes
                </Link>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark text-[#121617] dark:text-gray-100 transition-colors duration-200 text-left">
            <main className="flex-1 px-4 lg:px-8 py-8 w-full max-w-7xl mx-auto pb-32">
                {/* Breadcrumbs */}
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
                    <Link to="/ordenes" className="hover:text-primary transition-colors font-medium">Órdenes</Link>
                    <ChevronRight className="w-4 h-4" />
                    <span className="font-bold text-[#121617] dark:text-white truncate">ORD-{order.id_orden}</span>
                </div>

                {/* Page Heading */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                            <button
                                onClick={() => navigate(-1)}
                                className="p-2 hover:bg-white dark:hover:bg-white/5 rounded-xl border border-transparent hover:border-gray-200 dark:hover:border-white/10 transition-all"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
                                <span className="text-primary opacity-50">#</span>{order.id_orden}
                            </h1>
                            <StatusBadge status={order.estado_nombre} />
                        </div>
                        <p className="text-[#618789] font-medium pl-12 md:pl-0">
                            Capturado el {new Date(order.created_at).toLocaleString()}
                            <span className="mx-2 opacity-30">•</span>
                            Asignado a: <span className="text-[#121617] dark:text-white font-bold">{order.agente_nombre} {order.agente_apellido}</span>
                        </p>
                    </div>
                    <div className="flex gap-3 pr-2 font-mono">
                        <button className="flex items-center gap-2 px-5 py-3 border border-[#dbe5e6] dark:border-[#2d4546] bg-white dark:bg-[#1a2e2f] rounded-xl font-black text-[10px] tracking-widest hover:shadow-lg hover:scale-[1.02] transition-all">
                            <Printer className="w-4 h-4 text-primary" />
                            IMPRIMIR REPORTE
                        </button>
                        <button className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-[#1a2e2f] border border-[#dbe5e6] dark:border-[#2d4546] rounded-xl font-black text-[10px] tracking-widest hover:shadow-lg hover:scale-[1.02] transition-all">
                            <History className="w-4 h-4 text-primary" />
                            VER LÍNEA DE TIEMPO
                        </button>
                    </div>
                </div>

                {/* Main Grid Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column (65%) */}
                    <div className="lg:col-span-8 flex flex-col gap-8">

                        {/* Summary Stats for Detailed View */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <SmallStat label="Clase" value={order.clase_orden} icon={Briefcase} />
                            <SmallStat label="Localidad" value={order.cliente_localidad} icon={MapPin} />
                            <SmallStat label="Dif." value={`${order.diferencia || 0} m³`} icon={Gauge} color={order.diferencia > 0 ? 'text-green-500' : 'text-gray-400'} />
                            <SmallStat label="Contrato" value={order.cliente_cuenta_contrato} icon={ClipboardList} />
                        </div>

                        {/* Client Information Card */}
                        <div className="bg-white dark:bg-[#1a2e2f] rounded-2xl shadow-xl shadow-black/5 border border-[#dbe5e6] dark:border-[#2d4546] overflow-hidden">
                            <div className="p-6 border-b border-[#f1f3f4] dark:border-white/5 flex justify-between items-center bg-[#f9fafa] dark:bg-white/[0.02]">
                                <h3 className="font-black text-xs uppercase tracking-widest flex items-center gap-2">
                                    <User className="w-5 h-5 text-primary" />
                                    Perfil del Cliente y Cuenta
                                </h3>
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                    <span className="text-[10px] font-black text-[#618789] uppercase tracking-widest">Sitio Activo</span>
                                </div>
                            </div>
                            <div className="grid md:grid-cols-2">
                                <div className="p-8 space-y-8">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
                                        <InfoItem label="Nombre Legal Completo" value={`${order.cliente_nombre} ${order.cliente_apellido}`} />
                                        <InfoItem label="Celular / Teléfono" value={order.cliente_telefono} isPhone />
                                        <InfoItem label="Punto de Suministro" value={order.cliente_punto_suministro} />
                                        <InfoItem label="Distribución Local" value={order.cliente_localidad} />
                                    </div>
                                    <div className="pt-2">
                                        <p className="text-[10px] text-[#618789] uppercase font-black tracking-widest mb-2 px-1">Dirección de Servicio de Instalación</p>
                                        <p className="font-extrabold text-lg leading-tight">
                                            {order.cliente_calle} {order.cliente_numero}
                                            {(order.cliente_piso || order.cliente_depto) && (
                                                <span className="text-primary font-black ml-2 text-sm">
                                                    (Piso {order.cliente_piso || '-'} / Dpto {order.cliente_depto || '-'})
                                                </span>
                                            )}
                                        </p>
                                        <div className="mt-4 flex items-center gap-3">
                                            <div className="px-3 py-1.5 bg-[#f1f3f4] dark:bg-white/5 rounded-lg border border-transparent dark:border-white/10 flex items-center gap-2">
                                                <MapPin className="w-3.5 h-3.5 text-primary" />
                                                <span className="text-[11px] font-bold tabular-nums italic">
                                                    {order.cliente_latitud?.toFixed(5) || '0.00000'}, {order.cliente_longitud?.toFixed(5) || '0.00000'}
                                                </span>
                                            </div>
                                            <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${order.cliente_latitud},${order.cliente_longitud}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-all"
                                                title="Ver Ubicación Precisa"
                                            >
                                                <MapIcon className="w-5 h-5" />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-[#f1f3f4] dark:bg-white/5 relative group cursor-crosshair overflow-hidden border-l border-[#f1f3f4] dark:border-white/5">
                                    <div className="absolute inset-0 bg-cover bg-center opacity-40 group-hover:opacity-60 transition-opacity flex items-center justify-center text-gray-400">
                                        <MapIcon className="w-20 h-20 opacity-10" />
                                    </div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="relative">
                                            <div className="absolute -inset-4 bg-primary/20 rounded-full animate-ping"></div>
                                            <div className="w-10 h-10 bg-primary rounded-xl shadow-2xl flex items-center justify-center text-[#121617] border-2 border-white dark:border-background-dark transform rotate-3 group-hover:rotate-0 transition-transform">
                                                <MapPin className="w-6 h-6" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="absolute bottom-4 right-4 px-3 py-1 bg-black/80 rounded-full text-[10px] font-black text-white tracking-widest backdrop-blur-md italic">
                                        SITIO GEOLOCALIZADO
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Meter Data Card */}
                        <div className="bg-white dark:bg-[#1a2e2f] rounded-2xl shadow-xl shadow-black/5 border border-[#dbe5e6] dark:border-[#2d4546] overflow-hidden">
                            <div className="p-6 border-b border-[#f1f3f4] dark:border-white/5 bg-[#f9fafa] dark:bg-white/[0.02]">
                                <h3 className="font-black text-xs uppercase tracking-widest flex items-center gap-2">
                                    <Gauge className="w-5 h-5 text-primary" />
                                    Discrepancia de Flujo y Medición
                                </h3>
                            </div>
                            <div className="p-8">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <MeterBlock
                                        label="LECTURA ANTERIOR"
                                        serial={order.cliente_medidor}
                                        value={order.cliente_lectura}
                                        type="Estándar"
                                    />
                                    <MeterBlock
                                        label="LECTURA CAPTURADA"
                                        serial={order.cliente_medidor}
                                        value={order.lectura_nueva}
                                        type="Entrada de Campo"
                                        primary
                                    />
                                    <div className="p-6 bg-[#f1f3f4] dark:bg-white/5 rounded-2xl border border-transparent dark:border-white/10 flex flex-col justify-center items-center text-center group hover:border-primary/20 transition-all">
                                        <div className={cn(
                                            "w-12 h-12 rounded-2xl flex items-center justify-center mb-3 shadow-lg transform rotate-3 group-hover:rotate-0 transition-transform",
                                            order.diferencia > 0 ? "bg-green-500/20 text-green-500" : "bg-gray-500/20 text-gray-500"
                                        )}>
                                            <Activity className="w-6 h-6" />
                                        </div>
                                        <p className="text-[10px] font-black text-[#618789] uppercase tracking-widest mb-1 leading-none">DIF. CONSUMO</p>
                                        <p className={cn(
                                            "text-4xl font-black tabular-nums tracking-tighter",
                                            order.diferencia > 0 ? "text-green-500" : "text-[#121617] dark:text-white"
                                        )}>
                                            {order.diferencia > 0 ? `+${order.diferencia}` : order.diferencia || '0.0'}
                                        </p>
                                        <p className="text-[10px] font-bold text-[#618789] mt-2 italic italic opacity-60 px-2 leading-none border-t border-gray-500/10 pt-2 w-full">Medido en m³</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Photo Gallery Section */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="font-black text-xs uppercase tracking-widest flex items-center gap-2">
                                    <ImageIcon className="w-5 h-5 text-primary" />
                                    Evidencias de Inspección Visual
                                </h3>
                                <button className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline transition-all">
                                    Ver Archivos Originales
                                </button>
                            </div>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {[
                                    { label: 'ANTES', icon: Clock },
                                    { label: 'DESPUÉS', icon: CheckCircle },
                                    { label: 'ENTORNO', icon: MapIcon },
                                    { label: 'ID MEDIDOR', icon: Hash }
                                ].map((photo, i) => (
                                    <div key={i} className="group relative aspect-square rounded-2xl overflow-hidden cursor-zoom-in border-4 border-white dark:border-[#1a2e2f] shadow-lg shadow-black/5 bg-[#f1f3f4] dark:bg-white/5 transition-transform hover:-translate-y-1">
                                        <div className="absolute inset-0 flex items-center justify-center opacity-20 group-hover:opacity-40 transition-opacity">
                                            <photo.icon className="w-12 h-12 text-[#618789]" />
                                        </div>
                                        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 text-white transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all backdrop-blur-sm">
                                            <p className="text-[9px] font-black uppercase tracking-widest leading-none">{photo.label}</p>
                                            <p className="text-[8px] opacity-60 mt-1 font-bold italic">CAPTURE_ID_{i + 1523}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column (35%) */}
                    <div className="lg:col-span-4 flex flex-col gap-8">
                        {/* Order Details Card */}
                        <div className="bg-white dark:bg-[#1a2e2f] rounded-2xl shadow-xl shadow-black/5 border border-[#dbe5e6] dark:border-[#2d4546] p-8">
                            <h3 className="font-black text-xs uppercase tracking-widest mb-8 flex items-center gap-2">
                                <ClipboardList className="w-5 h-5 text-primary" />
                                Metadatos del Servicio
                            </h3>
                            <div className="space-y-5">
                                <DetailItem label="Agente de Campo Asignado" value={`${order.agente_nombre} ${order.agente_apellido}`} />
                                <DetailItem label="Contacto del Agente" value={order.agente_email} isPhone={false} muted />
                                <DetailItem label="Motivo de Cierre" value={order.motivo_cierre_nombre} />
                                <DetailItem label="Primera Visita" value={order.fecha_primera_visita ? new Date(order.fecha_primera_visita).toLocaleString() : '---'} />
                                <div className="flex justify-between py-2 items-center">
                                    <span className="text-[11px] font-bold text-[#618789] uppercase tracking-widest">Índice de Prioridad</span>
                                    <span className="px-3 py-1 bg-green-500/10 text-green-500 rounded-lg text-[10px] font-black uppercase tracking-widest">Normal</span>
                                </div>
                                <div className="flex justify-between py-2 items-center">
                                    <span className="text-[11px] font-bold text-[#618789] uppercase tracking-widest">Estado SLA</span>
                                    <span className="px-3 py-1 bg-blue-500/10 text-blue-500 rounded-lg text-[10px] font-black uppercase tracking-widest italic font-mono">A Tiempo</span>
                                </div>
                            </div>
                        </div>

                        {/* Detailed Field Checklist Card */}
                        <div className="bg-white dark:bg-[#1a2e2f] rounded-2xl shadow-xl shadow-black/5 border border-[#dbe5e6] dark:border-[#2d4546] p-8 overflow-hidden relative group">
                            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-all">
                                <CheckSquare className="w-32 h-32" />
                            </div>
                            <h3 className="font-black text-xs uppercase tracking-widest mb-8 flex items-center gap-2 relative z-10 transition-colors group-hover:text-primary">
                                <CheckSquare className="w-5 h-5 text-primary" />
                                Protocolo de Verificación de Campo
                            </h3>
                            <div className="space-y-2.5 relative z-10">
                                <FieldCheck label="Morador Presente" status={order.morador} />
                                <FieldCheck label="Estado del Gabinete" status={order.gabinete_linea} />
                                <FieldCheck label="Acceso Concedido" status={order.cliente_accede_cambio} />
                                <FieldCheck label="Estado del Medidor" status={order.medidor_mal_estado} />
                                <FieldCheck label="Protección de Reja" status={order.posee_reja_soldadura} />
                                <FieldCheck label="Puede retirar medidor" status={order.puede_retirar} />
                                <FieldCheck label="Fuga Verificada" status={order.fugas} danger={order.fugas?.toUpperCase() === 'SI'} />
                                <FieldCheck label="Pérdida en Válvula" status={order.perdida_valvula} danger={order.perdida_valvula?.toUpperCase() === 'SI'} />
                                <FieldCheck label="Puede operar válvula" status={order.operar_valvula} />
                                <FieldCheck label="Acceso Interno" status={order.accede_vivienda} />
                            </div>

                            <div className="mt-10 pt-6 border-t border-[#f1f3f4] dark:border-white/5">
                                <div className="flex items-center gap-3 p-4 bg-[#f9fafa] dark:bg-white/[0.02] rounded-xl border border-transparent dark:border-white/5">
                                    <div className="size-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 shadow-sm">
                                        <AlertTriangle className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-[9px] font-black text-[#121617] dark:text-white uppercase tracking-widest leading-tight">Comentarios de Campo</p>
                                        <p className="text-[11px] text-[#618789] font-medium leading-normal mt-1 italic italic italic">
                                            {order.motivo_cierre_nombre ? `"${order.motivo_cierre_nombre}"` : 'No se proporcionaron comentarios adicionales por el agente de campo...'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Sticky Bottom Verification Bar */}
            {order.estado_nombre === 'CERRADO AGENTE' && (
                <footer className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#1a2e2f]/95 border-t border-[#dbe5e6] dark:border-[#2d4546] p-4 shadow-[0_-4px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl z-[40]">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-6 px-4">
                        <div className="flex-1 w-full space-y-3">
                            {/* Confirmation Toggles */}
                            <div className="flex flex-wrap gap-4 mb-1">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div
                                        onClick={() => setInfoCorrect(!infoCorrect)}
                                        className={cn(
                                            "w-10 h-5 rounded-full transition-colors relative",
                                            infoCorrect ? "bg-green-500" : "bg-gray-300 dark:bg-white/10"
                                        )}
                                    >
                                        <div className={cn(
                                            "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                                            infoCorrect ? "left-6" : "left-1"
                                        )} />
                                    </div>
                                    <span className="text-[11px] font-black uppercase tracking-widest text-[#618789] group-hover:text-primary transition-colors">
                                        Información Correcta
                                    </span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div
                                        onClick={() => setPhotosCorrect(!photosCorrect)}
                                        className={cn(
                                            "w-10 h-5 rounded-full transition-colors relative",
                                            photosCorrect ? "bg-green-500" : "bg-gray-300 dark:bg-white/10"
                                        )}
                                    >
                                        <div className={cn(
                                            "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                                            photosCorrect ? "left-6" : "left-1"
                                        )} />
                                    </div>
                                    <span className="text-[11px] font-black uppercase tracking-widest text-[#618789] group-hover:text-primary transition-colors">
                                        Fotos Correctas
                                    </span>
                                </label>
                            </div>

                            <div className="relative group">
                                <textarea
                                    value={verificationComment}
                                    onChange={(e) => setVerificationComment(e.target.value)}
                                    className="w-full bg-[#f1f3f4]/50 dark:bg-background-dark/30 border-[#dbe5e6] dark:border-[#2d4546] rounded-2xl text-sm focus:ring-4 focus:ring-primary/10 focus:border-primary pr-20 resize-none py-4 px-6 outline-none transition-all border font-bold text-[#121617] dark:text-white placeholder:text-[#618789]/50"
                                    placeholder="Agregar feedback de verificación o notas de auditoría..."
                                    rows={1}
                                    disabled={updating}
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1">
                                    <button className="p-2 text-[#618789] hover:text-primary transition-all rounded-lg hover:bg-white dark:hover:bg-white/10 group-hover:scale-110">
                                        <Share2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto no-scrollbar pb-2 md:pb-0">
                            <button
                                onClick={() => handleUpdateStatus('REASIGNADO')}
                                disabled={updating}
                                className="flex-1 md:flex-none px-6 py-4 border border-amber-500/20 text-amber-500 hover:bg-amber-500/5 rounded-2xl font-black text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 group whitespace-nowrap disabled:opacity-50"
                            >
                                <Edit3 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                REPROCESAR / OBSERVAR
                            </button>
                            <button
                                onClick={() => handleUpdateStatus('VERIFICADO')}
                                disabled={updating || !infoCorrect || !photosCorrect}
                                className={cn(
                                    "flex-1 md:flex-none px-12 py-4 rounded-2xl font-black text-[10px] tracking-widest transition-all flex items-center justify-center gap-3 group active:scale-95 whitespace-nowrap",
                                    (infoCorrect && photosCorrect)
                                        ? "bg-primary text-[#121617] hover:bg-primary/90 hover:shadow-2xl hover:shadow-primary/40 shadow-lg shadow-primary/20"
                                        : "bg-gray-200 dark:bg-white/5 text-gray-400 cursor-not-allowed border dark:border-white/5"
                                )}
                            >
                                {updating ? (
                                    <Clock className="w-4 h-4 animate-spin" />
                                ) : (
                                    <CheckCircle className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                )}
                                VERIFICAR Y ARCHIVAR
                            </button>
                        </div>
                    </div>
                </footer>
            )}
        </div>
    );
};

const SmallStat = ({ label, value, icon: Icon, color = 'text-[#121617] dark:text-white' }: any) => (
    <div className="bg-white dark:bg-[#1a2e2f] p-4 rounded-2xl border border-[#dbe5e6] dark:border-[#2d4546] shadow-sm hover:border-primary/30 transition-all group">
        <div className="flex items-center gap-2 mb-2">
            <div className="size-6 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-[#121617] transition-all">
                <Icon className="w-3 h-3" />
            </div>
            <span className="text-[10px] font-black text-[#618789] uppercase tracking-widest font-mono">{label}</span>
        </div>
        <p className={cn("text-xs font-black truncate max-w-full", color)}>{value || '---'}</p>
    </div>
);

const InfoItem = ({ label, value, isPhone, muted }: { label: string, value?: string | number, isPhone?: boolean, muted?: boolean }) => (
    <div>
        <p className="text-[9px] text-[#618789] uppercase font-black tracking-widest mb-1.5 px-0.5 opacity-60">{label}</p>
        <p className={cn(
            "font-black text-[13px] tracking-tight",
            muted ? "text-[#618789] font-bold" : "text-[#121617] dark:text-white",
            isPhone && "text-primary tabular-nums italic decoration-primary/20 underline underline-offset-4"
        )}>
            {value || 'N/A'}
        </p>
    </div>
);

const DetailItem = ({ label, value, isPhone, muted }: { label: string, value?: string | number, isPhone?: boolean, muted?: boolean }) => (
    <div className="flex justify-between py-2.5 border-b border-[#f1f3f4] dark:border-white/5 items-center group">
        <span className="text-[10px] font-black text-[#618789] uppercase tracking-widest group-hover:text-primary transition-colors">{label}</span>
        <span className={cn(
            "text-[11px] font-black underline-offset-4 decoration-primary/30 truncate max-w-[180px] text-right tabular-nums",
            muted ? "text-[#618789] font-medium" : "text-[#121617] dark:text-white",
            isPhone && "text-primary italic"
        )}>
            {value || '---'}
        </span>
    </div>
);

const MeterBlock = ({ label, serial, value, type, primary }: { label: string, serial: string, value?: number, type: string, primary?: boolean }) => (
    <div className={cn(
        "p-6 rounded-2xl border transition-all duration-300 transform hover:scale-[1.02]",
        primary
            ? "bg-primary/5 border-primary/30 ring-4 ring-primary/[0.03] shadow-xl shadow-primary/5"
            : "bg-[#f9fafa] dark:bg-white/[0.02] border-[#dbe5e6] dark:border-[#2d4546]"
    )}>
        <p className={cn("text-[9px] font-black uppercase tracking-widest mb-5", primary ? "text-primary" : "text-[#618789]")}>{label}</p>
        <div className="space-y-5">
            <div>
                <p className="text-[8px] text-[#618789] uppercase font-black tracking-widest mb-1 opacity-50 font-mono">Nro de Serie / ID</p>
                <div className="flex items-center gap-2">
                    <Hash className={cn("size-3", primary ? "text-primary" : "text-gray-400")} />
                    <p className={cn("font-mono font-black text-sm tabular-nums tracking-widest px-2 py-0.5 rounded-lg border",
                        primary ? "bg-primary/10 border-primary/20 text-primary" : "bg-white dark:bg-white/5 border-[#dbe5e6] dark:border-[#2d4546] text-[#121617] dark:text-white")}>
                        {serial || 'SIN_SERIE'}
                    </p>
                </div>
            </div>
            <div>
                <p className="text-[8px] text-[#618789] uppercase font-black tracking-widest mb-1 opacity-50 font-mono">Análisis de Flujo (m³)</p>
                <p className="text-3xl font-black tabular-nums tracking-tighter">
                    {value?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}<span className="text-[10px] font-black ml-1 uppercase opacity-30 italic">Vol</span>
                </p>
            </div>
            <div className="pt-2 border-t border-gray-500/5">
                <span className={cn(
                    "px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-widest inline-flex items-center gap-1.5",
                    primary ? "bg-primary text-[#121617]" : "bg-[#f1f3f4] dark:bg-white/10 text-[#618789]"
                )}>
                    <Activity className="size-2.5" />
                    Datos de {type}
                </span>
            </div>
        </div>
    </div>
);

const FieldCheck = ({ label, status, danger }: { label: string, status?: string, danger?: boolean }) => {
    const s = status?.toUpperCase() || '';
    const isOk = s === 'SI' || s === 'BUENO' || s === 'SI AGENTE' || s === 'ACCEDE';
    const isNeutral = !s || s === '---';

    return (
        <div className={cn(
            "flex items-center justify-between p-3.5 rounded-xl transition-all border group/check",
            danger
                ? "bg-red-500/10 border-red-500/20 shadow-lg shadow-red-500/5"
                : isOk
                    ? "bg-green-500/5 border-green-500/10"
                    : isNeutral
                        ? "bg-gray-500/5 border-gray-500/10 opacity-60"
                        : "bg-orange-500/5 border-orange-500/10"
        )}>
            <div className="flex items-center gap-3">
                <div className={cn(
                    "size-5 rounded-lg flex items-center justify-center transition-all",
                    danger ? "bg-red-500 text-white animate-pulse" : isOk ? "bg-green-500 text-white" : "bg-gray-200 dark:bg-white/10 text-gray-500"
                )}>
                    {danger ? (
                        <AlertTriangle className="w-3 h-3" />
                    ) : isOk ? (
                        <CheckCircle className="w-3 h-3" />
                    ) : (
                        <Clock className="w-3 h-3" />
                    )}
                </div>
                <span className={cn(
                    "text-[10px] font-black tracking-widest uppercase",
                    danger ? "text-red-700 dark:text-red-400 font-black" : isOk ? "text-green-700 dark:text-green-400" : "text-[#618789]"
                )}>
                    {label}
                </span>
            </div>
            <span className={cn(
                "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border",
                danger
                    ? "bg-red-500/20 border-red-500/30 text-red-600"
                    : isOk
                        ? "bg-green-500/20 border-green-500/30 text-green-600"
                        : "bg-gray-500/10 border-gray-500/10 text-gray-400"
            )}>
                {status || 'PEND'}
            </span>
        </div>
    );
};

const StatusBadge = ({ status = '' }: { status?: string }) => {
    const s = status?.toUpperCase();
    const styles: any = {
        'PENDIENTE': 'bg-orange-500/10 text-orange-500 border-orange-500/20 shadow-orange-500/10',
        'VERIFICADO': 'bg-green-500/10 text-green-500 border-green-500/20 shadow-green-500/10',
        'CERRADO AGENTE': 'bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-blue-500/10',
        'ASIGNADO': 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20 shadow-cyan-500/10',
    };

    const badgeStyle = styles[s] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';

    return (
        <div className="relative group">
            <div className={cn("absolute -inset-1 rounded-2xl opacity-0 group-hover:opacity-20 blur transition-opacity",
                s === 'PENDIENTE' ? 'bg-orange-500' : s === 'VERIFICADO' ? 'bg-green-500' : 'bg-primary')}></div>
            <span className={cn(
                "relative px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] border shadow-sm transition-all flex items-center gap-2",
                badgeStyle
            )}>
                <span className={cn("size-1.5 rounded-full animate-pulse",
                    s === 'PENDIENTE' ? 'bg-orange-500' : s === 'VERIFICADO' ? 'bg-green-500' : 'bg-primary')}></span>
                {status || 'DESCONOCIDO'}
            </span>
        </div>
    );
};
