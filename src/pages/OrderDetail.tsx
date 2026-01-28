import { useEffect, useState, useCallback, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
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
    Activity,
    Hash,
    Briefcase,
    Maximize2,
    Trash2,
    RefreshCw,
    Play,
    Loader2,
    X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useToast } from '../hooks/useToast';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface OrderDetailData {
    id_orden: number;
    created_at: string;
    clase_orden: string;
    cliente_nombre: string;
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
    latcambio: string;
    longcambio: string;
    fimardigital: string;
    medidor_nuevo: string;
    observaciones_agente: string;
    observacionmotivo: string;
}

interface DBPhoto {
    id: string;
    url_foto: string;
    video: boolean;
}

export const OrderDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const [order, setOrder] = useState<OrderDetailData | null>(null);
    const [loading, setLoading] = useState(true);
    const [verificationComment, setVerificationComment] = useState('');
    const [updating, setUpdating] = useState(false);
    const [infoCorrect, setInfoCorrect] = useState(false);
    const [photosCorrect, setPhotosCorrect] = useState(false);
    const [photos, setPhotos] = useState<DBPhoto[]>([]);
    const [selectedMedia, setSelectedMedia] = useState<DBPhoto | null>(null);
    const [showReassignModal, setShowReassignModal] = useState(false);
    const [generatingPDF, setGeneratingPDF] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);

    const handleGeneratePDF = async () => {
        if (!reportRef.current || !order) return;

        try {
            setGeneratingPDF(true);
            toast.info('Generando PDF', 'Estamos preparando el documento...');

            // Hide things that shouldn't appear in PDF if any (e.g. tooltips, maps sometimes need special care)
            const canvas = await html2canvas(reportRef.current, {
                scale: 2,
                useCORS: true,
                logging: false,
                allowTaint: true,
                ignoreElements: (element) => {
                    return element.classList.contains('no-pdf');
                }
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Reporte_Orden_${order.id_orden}.pdf`);

            toast.success('PDF Generado', 'El reporte se ha descargado correctamente.');
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast.error('Error', 'No se pudo generar el PDF. Reintente por favor.');
        } finally {
            setGeneratingPDF(false);
        }
    };

    const fetchOrderData = useCallback(async () => {
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

            // Fetch actual photos
            const { data: photosData } = await supabase
                .from('t_fotos')
                .select('*')
                .eq('orden_id', parseInt(id!));

            if (photosData) {
                const mappedPhotos = photosData.map((p: Record<string, any>) => ({
                    ...p,
                    id: p.id || p.id_foto || p.id_fotos || Object.values(p)[0]
                }));
                setPhotos(mappedPhotos as DBPhoto[]);
            }

        } catch (err) {
            console.error('Error fetching order details:', err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchOrderData();
    }, [fetchOrderData]);

    const handleUpdateStatus = async (newStatus: string) => {
        if (!order || !id) return;

        // If verifying, we require the toggles
        if (newStatus === 'VERIFICADO' && (!infoCorrect || !photosCorrect)) {
            toast.warning('Validación requerida', 'Por favor, confirme que la información y las fotos son correctas.');
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

            // Success message
            if (newStatus === 'VERIFICADO') {
                toast.success('Orden Verificada', `La orden #${id} ha sido verificada y archivada correctamente.`);
            } else if (newStatus === 'REASIGNADO') {
                toast.success('Orden Reasignada', `La orden #${id} ha sido enviada nuevamente al agente.`);
            }

            // Refetch to see changes
            await fetchOrderData();
            setVerificationComment('');
            setInfoCorrect(false);
            setPhotosCorrect(false);
        } catch (err) {
            console.error('Error updating status:', err);
            toast.error('Error de actualización', 'No se pudo actualizar el estado de la orden');
        } finally {
            setUpdating(false);
        }
    };

    const handleDeleteFile = async (photo: DBPhoto) => {
        if (!window.confirm('¿Está seguro de eliminar esta evidencia?')) return;

        try {
            setUpdating(true);
            const urlParts = photo.url_foto.split('/fotomedidor/');
            if (urlParts.length < 2) throw new Error('Formato de URL inválido');
            const filePath = urlParts[1];

            const { error: storageError } = await supabase.storage
                .from('fotomedidor')
                .remove([filePath]);

            if (storageError) throw storageError;

            const { error: dbError } = await supabase
                .from('t_fotos')
                .delete()
                .eq('id', photo.id);

            if (dbError) throw dbError;

            toast.success('Archivo eliminado', 'La evidencia ha sido eliminada correctamente.');
            setPhotos(prev => prev.filter(p => p.id !== photo.id));
        } catch (err: unknown) {
            const error = err as Error;
            console.error('Error deleting file:', error);
            toast.error('Error al eliminar', error.message);
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
            <main ref={reportRef} className="flex-1 px-4 lg:px-8 py-8 w-full max-w-7xl mx-auto pb-32">
                {/* Breadcrumbs */}
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6 no-pdf">
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
                    <div className="flex gap-3 pr-2 font-mono no-pdf">
                        <button
                            onClick={handleGeneratePDF}
                            disabled={generatingPDF}
                            className="flex items-center gap-2 px-5 py-3 border border-[#dbe5e6] dark:border-[#2d4546] bg-white dark:bg-[#1a2e2f] rounded-xl font-black text-[10px] tracking-widest hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50"
                        >
                            {generatingPDF ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Printer className="w-4 h-4 text-primary" />}
                            {generatingPDF ? 'GENERANDO...' : 'IMPRIMIR REPORTE'}
                        </button>
                        <button className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-[#1a2e2f] border border-[#dbe5e6] dark:border-[#2d4546] rounded-xl font-black text-[10px] tracking-widest hover:shadow-lg hover:scale-[1.02] transition-all">
                            <History className="w-4 h-4 text-primary" />
                            VER LÍNEA DE TIEMPO
                        </button>
                    </div>
                </div>

                {/* Main Grid Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-8 flex flex-col gap-8">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <SmallStat label="Clase" value={order.clase_orden} icon={Briefcase} />
                            <SmallStat label="Localidad" value={order.cliente_localidad} icon={MapPin} />
                            <SmallStat label="Dif." value={`${order.diferencia || 0} m³`} icon={Gauge} color={order.diferencia > 0 ? 'text-green-500' : 'text-gray-400'} />
                            <SmallStat label="Contrato" value={order.cliente_cuenta_contrato} icon={ClipboardList} />
                        </div>

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
                                        <InfoItem label="Nombre Legal Completo" value={order.cliente_nombre} />
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
                                <div className="bg-[#f1f3f4] dark:bg-white/5 relative group overflow-hidden border-l border-[#f1f3f4] dark:border-white/5 h-[300px] md:h-auto">
                                    {(order.latcambio && order.longcambio && !isNaN(parseFloat(order.latcambio)) && !isNaN(parseFloat(order.longcambio))) ? (
                                        <div className="absolute inset-0 z-0">
                                            <MapContainer
                                                center={[parseFloat(order.latcambio), parseFloat(order.longcambio)]}
                                                zoom={15}
                                                style={{ height: '100%', width: '100%' }}
                                                scrollWheelZoom={false}
                                            >
                                                <TileLayer
                                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                                />
                                                <Marker position={[parseFloat(order.latcambio), parseFloat(order.longcambio)]}>
                                                    <Popup>
                                                        <div className="font-sans">
                                                            <p className="font-black text-slate-800 m-0">Punto de Inspección</p>
                                                            <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">Orden #{order.id_orden}</p>
                                                        </div>
                                                    </Popup>
                                                </Marker>
                                            </MapContainer>
                                        </div>
                                    ) : (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/20 p-8 text-center text-gray-400">
                                            <MapIcon className="w-12 h-12 mb-3 opacity-20" />
                                            <p className="text-[10px] font-black uppercase tracking-widest leading-none">Sin coordenadas de captura</p>
                                            <p className="text-[9px] mt-2 italic opacity-60">El agente no registró posición GPS al cerrar la orden.</p>
                                        </div>
                                    )}
                                    <div className="absolute bottom-4 right-4 z-10 px-3 py-1 bg-black/80 rounded-full text-[10px] font-black text-white tracking-widest backdrop-blur-md italic">
                                        PUNTO DE INSPECCIÓN
                                    </div>
                                </div>
                            </div>
                        </div>

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
                                        serial={order.medidor_nuevo || order.cliente_medidor}
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
                                        <p className="text-[10px] font-bold text-[#618789] mt-2 italic opacity-60 px-2 leading-none border-t border-gray-500/10 pt-2 w-full">Medido en m³</p>
                                    </div>
                                </div>
                            </div>
                        </div>

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
                                {photos.length === 0 ? (
                                    [...Array(4)].map((_, i) => (
                                        <div key={i} className="aspect-square rounded-2xl bg-[#f1f3f4] dark:bg-white/5 border border-dashed border-gray-200 dark:border-white/10 flex items-center justify-center">
                                            <ImageIcon className="w-8 h-8 text-gray-300" />
                                        </div>
                                    ))
                                ) : (
                                    photos.map((photo) => (
                                        <div
                                            key={photo.id}
                                            className="group relative aspect-square rounded-2xl overflow-hidden border-4 border-white dark:border-[#1a2e2f] shadow-lg shadow-black/5 bg-[#f1f3f4] dark:bg-white/5 transition-transform hover:-translate-y-1"
                                        >
                                            <div onClick={() => setSelectedMedia(photo)} className="absolute inset-0 z-0 cursor-zoom-in">
                                                {photo.video ? (
                                                    <div className="w-full h-full relative">
                                                        <video src={photo.url_foto} className="w-full h-full object-cover" muted playsInline />
                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-all">
                                                            <Play className="w-10 h-10 text-white drop-shadow-lg" />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <img src={photo.url_foto} className="w-full h-full object-cover" alt="Evidencia" />
                                                )}
                                            </div>

                                            <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[8px] font-black text-white uppercase tracking-widest border border-white/10 pointer-events-none">
                                                {photo.video ? 'VIDEO' : 'FOTO'}
                                            </div>

                                            <div className="absolute top-3 right-3 flex gap-2 translate-y-[-10px] opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all z-10">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteFile(photo); }}
                                                    className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-lg transition-colors border border-red-400"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => setSelectedMedia(photo)}
                                                    className="p-1.5 bg-white/20 backdrop-blur-md rounded-lg border border-white/20 text-white hover:bg-white/40 transition-all"
                                                    title="Ampliar"
                                                >
                                                    <Maximize2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>

                                            <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 text-white transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all backdrop-blur-sm pointer-events-none">
                                                <p className="text-[9px] font-black uppercase tracking-widest leading-none">
                                                    {photo.video ? 'Registro de Video' : 'Captura Fotográfica'}
                                                </p>
                                                <p className="text-[8px] opacity-60 mt-1 font-bold italic">ID_{String(photo.id).substring(0, 8).toUpperCase()}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-4 flex flex-col gap-8">
                        <div className="bg-white dark:bg-[#1a2e2f] rounded-2xl shadow-xl shadow-black/5 border border-[#dbe5e6] dark:border-[#2d4546] p-8">
                            <h3 className="font-black text-xs uppercase tracking-widest mb-8 flex items-center gap-2">
                                <ClipboardList className="w-5 h-5 text-primary" />
                                Metadatos del Servicio
                            </h3>
                            <div className="space-y-5">
                                <DetailItem label="Agente de Campo Asignado" value={`${order.agente_nombre} ${order.agente_apellido}`} />
                                <DetailItem label="Contacto del Agente" value={order.agente_email} muted />
                                <DetailItem label="Nueva Serie Medidor" value={order.medidor_nuevo} />
                                <DetailItem label="Motivo de Cierre" value={order.motivo_cierre_nombre} />
                                <DetailItem label="Primera Visita" value={order.fecha_primera_visita ? new Date(order.fecha_primera_visita).toLocaleString() : '---'} />
                                <div className="flex justify-between py-2 items-center">
                                    <span className="text-[11px] font-bold text-[#618789] uppercase tracking-widest">Índice de Prioridad</span>
                                    <span className="px-3 py-1 bg-green-500/10 text-green-500 rounded-lg text-[10px] font-black uppercase tracking-widest">Normal</span>
                                </div>
                                {order.observaciones_agente && (
                                    <div className="pt-4 border-t border-gray-100 dark:border-white/5">
                                        <p className="text-[10px] font-black text-[#618789] uppercase tracking-widest mb-2">Observaciones del Agente</p>
                                        <div className="p-3 bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-100 dark:border-white/10">
                                            <p className="text-xs font-bold text-[#121617] dark:text-white leading-relaxed">
                                                {order.observaciones_agente}
                                                {order.observacionmotivo && (
                                                    <span className="block mt-2 pt-2 border-t border-gray-200 dark:border-white/5 italic opacity-80">
                                                        Detalles motivo: {order.observacionmotivo}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-[#1a2e2f] rounded-2xl shadow-xl shadow-black/5 border border-[#dbe5e6] dark:border-[#2d4546] p-8">
                            <h3 className="font-black text-xs uppercase tracking-widest mb-8 flex items-center gap-2">
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

                            {order.fimardigital && (
                                <div className="mt-10 pt-6 border-t border-[#f1f3f4] dark:border-white/5">
                                    <p className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-tight mb-3">Conformidad del Cliente (Firma)</p>
                                    <div className="bg-gray-50 dark:bg-black/20 rounded-lg p-3 flex items-center justify-center border border-dashed border-gray-200 dark:border-white/10">
                                        <img src={order.fimardigital} alt="Firma del Cliente" className="max-h-24 object-contain invert dark:invert-0 opacity-80" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {order.estado_nombre === 'CERRADO AGENTE' && (
                <footer className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#1a2e2f]/95 border-t border-[#dbe5e6] dark:border-[#2d4546] p-4 shadow-[0_-4px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl z-[40]">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-6 px-4">
                        <div className="flex-1 w-full space-y-3">
                            <div className="flex flex-wrap gap-4 mb-1">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div onClick={() => setInfoCorrect(!infoCorrect)} className={cn("w-10 h-5 rounded-full transition-colors relative", infoCorrect ? "bg-green-500" : "bg-gray-300 dark:bg-white/10")}>
                                        <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", infoCorrect ? "left-6" : "left-1")} />
                                    </div>
                                    <span className="text-[11px] font-black uppercase tracking-widest text-[#618789]">Información Correcta</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div onClick={() => setPhotosCorrect(!photosCorrect)} className={cn("w-10 h-5 rounded-full transition-colors relative", photosCorrect ? "bg-green-500" : "bg-gray-300 dark:bg-white/10")}>
                                        <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", photosCorrect ? "left-6" : "left-1")} />
                                    </div>
                                    <span className="text-[11px] font-black uppercase tracking-widest text-[#618789]">Fotos Correctas</span>
                                </label>
                            </div>
                            <textarea
                                value={verificationComment}
                                onChange={(e) => setVerificationComment(e.target.value)}
                                className="w-full bg-[#f1f3f4]/50 dark:bg-background-dark/30 border-[#dbe5e6] dark:border-[#2d4546] rounded-2xl text-sm py-4 px-6 outline-none transition-all border font-bold text-[#121617] dark:text-white placeholder:text-[#618789]/50"
                                placeholder="Feedback rápido (opcional)..."
                                rows={1}
                                disabled={updating}
                            />
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto self-end md:self-center">
                            <button
                                onClick={() => setShowReassignModal(true)}
                                disabled={updating}
                                className="flex-1 md:flex-none px-6 py-4 border border-amber-500/20 text-amber-500 hover:bg-amber-500/5 rounded-2xl font-black text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <Edit3 className="w-4 h-4" />
                                REPROCESAR / OBSERVAR
                            </button>
                            <button
                                onClick={() => handleUpdateStatus('VERIFICADO')}
                                disabled={updating || !infoCorrect || !photosCorrect}
                                className={cn(
                                    "flex-1 md:flex-none px-12 py-4 rounded-2xl font-black text-[10px] tracking-widest transition-all shadow-lg",
                                    (infoCorrect && photosCorrect) ? "bg-primary text-[#121617] hover:bg-primary/90" : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                )}
                            >
                                {updating ? <Clock className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2 inline" />}
                                VERIFICAR Y ARCHIVAR
                            </button>
                        </div>
                    </div>
                </footer>
            )}

            {/* Reassign Modal */}
            {showReassignModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-[#1a2e2f] w-full max-w-lg rounded-3xl shadow-2xl border border-[#dbe5e6] dark:border-[#2d4546] overflow-hidden">
                        <div className="p-8 border-b border-[#f1f3f4] dark:border-white/5 flex justify-between items-center bg-[#f9fafa] dark:bg-white/[0.02]">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                                    <Edit3 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-black text-xs uppercase tracking-widest text-[#121617] dark:text-white">Reasignar a Operario</h3>
                                    <p className="text-[10px] font-bold text-[#618789] uppercase mt-0.5">La orden volverá a la cola del agente</p>
                                </div>
                            </div>
                            <button onClick={() => setShowReassignModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all">
                                <X className="w-5 h-5 text-[#618789]" />
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest text-[#618789] flex items-center gap-2">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    Observaciones para el Agente
                                </label>
                                <textarea
                                    value={verificationComment}
                                    onChange={(e) => setVerificationComment(e.target.value)}
                                    placeholder="Indique qué debe corregir o revisar el operario..."
                                    className="w-full bg-[#f1f3f4]/50 dark:bg-background-dark/30 border-[#dbe5e6] dark:border-[#2d4546] rounded-2xl text-sm p-5 min-h-[150px] outline-none transition-all font-bold resize-none text-[#121617] dark:text-white placeholder:text-[#618789]/50"
                                />
                                <p className="text-[9px] text-amber-600 font-bold italic">Este comentario será visible para el agente en su dispositivo.</p>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setShowReassignModal(false)} className="flex-1 py-4 bg-gray-100 dark:bg-white/5 text-[#618789] rounded-2xl font-black text-[10px] tracking-widest uppercase">Cancelar</button>
                                <button
                                    onClick={async () => {
                                        if (!verificationComment.trim()) {
                                            toast.warning('Observación requerida', 'Ingrese una observación para el agente.');
                                            return;
                                        }
                                        await handleUpdateStatus('REASIGNADO');
                                        setShowReassignModal(false);
                                    }}
                                    disabled={updating}
                                    className="flex-[2] py-4 bg-amber-500 text-white rounded-2xl font-black text-[10px] tracking-widest uppercase shadow-lg hover:bg-amber-600 flex items-center justify-center gap-2"
                                >
                                    {updating ? <Clock className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                    Confirmar y Reasignar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Media Viewer Modal */}
            {selectedMedia && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl">
                    <button onClick={() => setSelectedMedia(null)} className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all border border-white/10"><X className="w-6 h-6" /></button>
                    <div className="w-full max-w-5xl px-4 flex flex-col items-center">
                        <div className="w-full aspect-video md:aspect-auto md:max-h-[80vh] bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/5 flex items-center justify-center">
                            {selectedMedia.video ? <video src={selectedMedia.url_foto} className="max-h-full w-full object-contain" controls autoPlay /> : <img src={selectedMedia.url_foto} className="max-h-full w-full object-contain" alt="Evidencia Full" />}
                        </div>
                        <div className="mt-8 text-center">
                            <p className="text-white text-lg font-black tracking-tight">{selectedMedia.video ? 'Registro de Video' : 'Captura Fotográfica'}</p>
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-[0.2em] mt-2">ORD-{id} • EVIDENCE_ID_{String(selectedMedia.id).toUpperCase().substring(0, 12)}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

interface SmallStatProps {
    label: string;
    value: string | number;
    icon: React.ElementType;
    color?: string;
}

const SmallStat = ({ label, value, icon: Icon, color = 'text-[#121617] dark:text-white' }: SmallStatProps) => (
    <div className="bg-white dark:bg-[#1a2e2f] p-4 rounded-2xl border border-[#dbe5e6] dark:border-[#2d4546] shadow-sm flex flex-col gap-2">
        <div className="flex items-center gap-2">
            <div className="size-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><Icon className="w-3 h-3" /></div>
            <span className="text-[10px] font-black text-[#618789] uppercase tracking-widest">{label}</span>
        </div>
        <p className={cn("text-xs font-black truncate", color)}>{value || '---'}</p>
    </div>
);

const InfoItem = ({ label, value, isPhone }: { label: string, value?: string | number, isPhone?: boolean }) => (
    <div>
        <p className="text-[9px] text-[#618789] uppercase font-black tracking-widest mb-1 opacity-60">{label}</p>
        <p className={cn("font-black text-[13px] tracking-tight text-[#121617] dark:text-white", isPhone && "text-primary italic underline underline-offset-4 decoration-primary/20")}>{value || 'N/A'}</p>
    </div>
);

const DetailItem = ({ label, value, muted }: { label: string, value?: string | number, muted?: boolean }) => (
    <div className="flex justify-between py-2.5 border-b border-[#f1f3f4] dark:border-white/5 items-center">
        <span className="text-[10px] font-black text-[#618789] uppercase tracking-widest">{label}</span>
        <span className={cn("text-[11px] font-black text-right truncate max-w-[180px]", muted ? "text-[#618789] font-medium" : "text-[#121617] dark:text-white")}>{value || '---'}</span>
    </div>
);

const MeterBlock = ({ label, serial, value, type, primary }: { label: string, serial: string, value?: number, type: string, primary?: boolean }) => (
    <div className={cn("p-6 rounded-2xl border transition-all", primary ? "bg-primary/5 border-primary/30" : "bg-[#f9fafa] dark:bg-white/[0.02] border-[#dbe5e6] dark:border-[#2d4546]")}>
        <p className={cn("text-[9px] font-black uppercase tracking-widest mb-5", primary ? "text-primary" : "text-[#618789]")}>{label}</p>
        <div className="space-y-5">
            <div>
                <p className="text-[8px] text-[#618789] uppercase font-black tracking-widest mb-1 opacity-50">Nro de Serie</p>
                <div className="flex items-center gap-2">
                    <Hash className={cn("size-3", primary ? "text-primary" : "text-gray-400")} />
                    <p className={cn("font-mono font-black text-sm tabular-nums tracking-widest px-2 py-0.5 rounded-lg border", primary ? "bg-primary/10 border-primary/20 text-primary" : "bg-white dark:bg-white/5 border-[#dbe5e6] dark:border-[#2d4546] text-[#121617] dark:text-white")}>{serial || '---'}</p>
                </div>
            </div>
            <div>
                <p className="text-[8px] text-[#618789] uppercase font-black tracking-widest mb-1 opacity-50">Lectura (m³)</p>
                <p className="text-3xl font-black tabular-nums tracking-tighter">{value?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}</p>
            </div>
            <div className="pt-2 border-t border-gray-500/5">
                <span className={cn("px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-widest inline-flex items-center gap-1.5", primary ? "bg-primary text-[#121617]" : "bg-[#f1f3f4] dark:bg-white/10 text-[#618789]")}>
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
        <div className={cn("flex items-center justify-between p-3.5 rounded-xl border", danger ? "bg-red-500/10 border-red-500/20" : isOk ? "bg-green-500/5 border-green-500/10" : isNeutral ? "bg-gray-500/5 border-gray-500/10 opacity-60" : "bg-orange-500/5 border-orange-500/10")}>
            <div className="flex items-center gap-3">
                <div className={cn("size-5 rounded-lg flex items-center justify-center", danger ? "bg-red-500 text-white" : isOk ? "bg-green-500 text-white" : "bg-gray-200 dark:bg-white/10 text-gray-500")}>
                    {danger ? <AlertTriangle className="w-3 h-3" /> : isOk ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                </div>
                <span className={cn("text-[10px] font-black uppercase tracking-widest", danger ? "text-red-700 dark:text-red-400" : isOk ? "text-green-700 dark:text-green-400" : "text-[#618789]")}>{label}</span>
            </div>
            <span className={cn("text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border", danger ? "bg-red-500/20 border-red-500/30 text-red-600" : isOk ? "bg-green-500/20 border-green-500/30 text-green-600" : "bg-gray-500/20 border-gray-500/30 text-gray-500")}>{s || '---'}</span>
        </div>
    );
};

const StatusBadge = ({ status }: { status: string }) => {
    const s = status?.toUpperCase();
    const isClosed = s === 'VERIFICADO' || s === 'CERRADO AGENTE';
    return (
        <div className={cn("px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border flex items-center gap-2", isClosed ? "bg-green-500/10 border-green-500/20 text-green-600" : "bg-blue-500/10 border-blue-500/20 text-blue-600")}>
            <div className={cn("size-1.5 rounded-full", isClosed ? "bg-green-500" : "bg-blue-500")} />
            {status}
        </div>
    );
};
