import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
    ArrowLeft,
    CheckCircle2,
    ChevronRight,
    Camera,
    FileText,
    MapPin,
    Save,
    Loader2,
    User,
    Hash,
    Check,
    Plus,
    PenTool,
    MessageSquare,
    QrCode,
    Eraser,
    Calendar
} from 'lucide-react';
import { cn } from '../lib/utils';

interface OrderData {
    id_orden: number;
    cliente_nombre: string;
    cliente_apellido: string;
    cliente_calle: string;
    cliente_numero: string;
    cliente_localidad: string;
    cliente_telefono: string;
    cliente_medidor: string;
    cliente_lectura: number;
    cliente_cuenta_contrato: string;
    estado_nombre: string;
    paso_actual: number;
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
    medidor_nuevo: string;
    lectura_nueva: number;
    motivo_de_cierre: number;
    fuga_fuera_zona: string;
    existe_litracion: string;
    continua_perdida_valvula: string;
    fecha_primera_visita: string;
    fecha_segunda_visita: string;
    coincidenummedidor: string;
    regulador: string;
    flexible: string;
    observaciones_agente: string;
    diferencialectura: number;
    fimardigital: string;
}

interface MotivoCierre {
    id: number;
    Motivo: string;
}

interface DBPhoto {
    id: string;
    url_foto: string;
}

const OrderExecution: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [order, setOrder] = useState<OrderData | null>(null);
    const [motivos, setMotivos] = useState<MotivoCierre[]>([]);
    const [photos, setPhotos] = useState<DBPhoto[]>([]);
    const [step, setStep] = useState(1);
    const [saving, setSaving] = useState(false);
    const [lecturaRetirado, setLecturaRetirado] = useState<string>('');

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    const steps = [
        { title: 'Resumen', icon: FileText },
        { title: 'Inspección', icon: MapPin },
        { title: 'Instalación', icon: Camera },
        { title: 'Cierre', icon: CheckCircle2 },
    ];

    const fetchOrderDetails = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('v_ordenes_detalladas')
                .select('*')
                .eq('id_orden', id)
                .single();

            if (error) throw error;
            setOrder(data);
            if (data.paso_actual > 0) {
                setStep(data.paso_actual);
            }

            if (data.diferencialectura !== undefined && data.diferencialectura !== null) {
                setLecturaRetirado((data.cliente_lectura + data.diferencialectura).toString());
            }

            // Motivos
            const { data: motivosData } = await supabase
                .from('t_motivos_cierre')
                .select('id, Motivo')
                .order('id');
            if (motivosData) setMotivos(motivosData);

            // Photos
            const { data: photosData } = await supabase
                .from('t_fotos')
                .select('id, url_foto')
                .eq('orden_id', id);
            if (photosData) setPhotos(photosData);

        } catch (err) {
            console.error('Error fetching order details:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrderDetails();
    }, [id]);

    const isClosed = order?.estado_nombre === 'CERRADO AGENTE';

    const updateField = async (field: string, value: any) => {
        if (isClosed) return; // Bloquear edición si está cerrada
        try {
            setSaving(true);
            const { error } = await supabase
                .from('t_ordenes')
                .update({ [field]: value })
                .eq('id_orden', id);

            if (error) throw error;
            setOrder(prev => prev ? { ...prev, [field]: value } : null);
        } catch (err) {
            console.error('Error updating field:', err);
        } finally {
            setSaving(false);
        }
    };

    const updateProgress = async (nextStep: number) => {
        let finalNextStep = nextStep;

        // Lógica de salto: Al avanzar del paso 2 al 3, verificamos el motivo
        if (step === 2 && nextStep === 3) {
            const suggested = suggestClosureMotive(order);
            // Si el motivo NO es 'Cambio de medidor completo' (ID 8), saltamos directamente al paso 4 (Cierre)
            if (suggested && suggested !== 8) {
                finalNextStep = 4;
            }
        }

        try {
            setSaving(true);
            const { error } = await supabase
                .from('t_ordenes')
                .update({
                    paso_actual: finalNextStep,
                    ...(step === 1 && { fecha_inicio_ejecucion: new Date().toISOString() }),
                    id_estado_orden: '60804b07-3287-45b4-b4f2-622884f519d2'
                })
                .eq('id_orden', id);

            if (error) throw error;
            setStep(finalNextStep);
        } catch (err) {
            console.error('Error updating progress:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${id}_${Date.now()}.${fileExt}`;
        const filePath = `fotos/${fileName}`;

        try {
            setSaving(true);
            const { error: uploadError } = await supabase.storage
                .from('fotomedidor')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('fotomedidor')
                .getPublicUrl(filePath);

            const { data: newPhoto, error: dbError } = await supabase
                .from('t_fotos')
                .insert({
                    orden_id: id,
                    url_foto: publicUrl,
                    video: false
                })
                .select()
                .single();

            if (dbError) throw dbError;
            setPhotos(prev => [...prev, newPhoto]);
        } catch (err: any) {
            console.error('Error uploading file:', err);
            alert(`Error al subir la imagen: ${err.message || 'Error desconocido'}. Verifique su conexión y que el archivo sea una imagen válida.`);
        } finally {
            setSaving(false);
        }
    };

    const suggestClosureMotive = (ord: OrderData | null): number | null => {
        if (!ord) return null;
        if (ord.morador === 'NO') return 1;
        if (ord.cliente_accede_cambio === 'NO') return 2;
        if (ord.medidor_mal_estado === 'SI') return 3;
        if (ord.posee_reja_soldadura === 'SI' && ord.puede_retirar === 'NO') return 7;
        if (ord.operar_valvula === 'NO') return 5;
        if (ord.continua_perdida_valvula === 'SI') return 6;
        if (ord.fuga_fuera_zona === 'SI' && ord.perdida_valvula === 'NO') return 4;
        if (ord.medidor_nuevo && ord.lectura_nueva > 0) return 8;
        return null;
    };

    const finalizeOrder = async () => {
        const suggested = suggestClosureMotive(order);
        const selectedMotive = order?.motivo_de_cierre || suggested;

        if (!selectedMotive) {
            alert('Por favor selecciona un motivo de cierre');
            return;
        }

        // Validación según feedback del usuario: si es primera visita sin morador (ID 1), requiere fecha segunda visita
        if (selectedMotive === 1 && !order?.fecha_segunda_visita) {
            alert('Debe establecer una fecha de segunda visita para este motivo');
            return;
        }

        try {
            setSaving(true);

            let signatureUrl = order?.fimardigital;
            if (canvasRef.current) {
                const canvas = canvasRef.current;
                const signatureData = canvas.toDataURL('image/png');
                if (signatureData.length > 2000) {
                    const blob = await (await fetch(signatureData)).blob();
                    const fileName = `firma_${id}_${Date.now()}.png`;
                    const { error: uploadError } = await supabase.storage
                        .from('fotomedidor')
                        .upload(`firmas/${fileName}`, blob);

                    if (!uploadError) {
                        const { data: { publicUrl } } = supabase.storage
                            .from('fotomedidor')
                            .getPublicUrl(`firmas/${fileName}`);
                        signatureUrl = publicUrl;
                    }
                }
            }

            // Si el motivo es 1 (Sin morador), mantenemos el estado como "ASIGNADO" o el estado actual de ejecución
            // Si no, lo pasamos a "CERRADO AGENTE"
            const nuevoEstado = selectedMotive === 1
                ? '60804b07-3287-45b4-b4f2-622884f519d2' // Ejecucion
                : 'b28d55bb-f885-4cfa-a181-88c1d80ac118'; // Cerrado Agente

            const { error } = await supabase
                .from('t_ordenes')
                .update({
                    id_estado_orden: nuevoEstado,
                    paso_actual: 4,
                    fecha_primera_visita: order?.fecha_primera_visita || new Date().toISOString(),
                    motivo_de_cierre: selectedMotive,
                    fimardigital: signatureUrl
                })
                .eq('id_orden', id);

            if (error) throw error;
            navigate('/agente/dashboard');
        } catch (err) {
            console.error('Error finalizing order:', err);
        } finally {
            setSaving(false);
        }
    };

    // Drawing Logic
    const startDrawing = (e: any) => {
        setIsDrawing(true);
        draw(e);
    };
    const stopDrawing = () => {
        setIsDrawing(false);
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx?.beginPath();
        }
    };
    const draw = (e: any) => {
        if (!isDrawing || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX || e.touches?.[0]?.clientX) - rect.left) * (canvas.width / rect.width);
        const y = ((e.clientY || e.touches?.[0]?.clientY) - rect.top) * (canvas.height / rect.height);
        ctx.lineTo(x, y);
        ctx.stroke();
    };
    const clearSignature = () => {
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    };

    if (loading) return (
        <div className="h-screen flex flex-col items-center justify-center bg-gray-50 uppercase font-black text-xs tracking-widest text-gray-400">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600" />
            Cargando Datos...
        </div>
    );
    if (!order) return null;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col animate-in fade-in duration-500">
            {/* Header */}
            <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-20 shadow-sm">
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <button onClick={() => navigate('/agente/dashboard')} className="p-3 hover:bg-gray-50 rounded-2xl transition-all text-gray-600"><ArrowLeft className="w-5 h-5" /></button>
                        <div className="text-left">
                            <h1 className="font-black text-gray-900 text-lg leading-none">Orden #{id}</h1>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1.5">{order.estado_nombre}</p>
                        </div>
                    </div>
                    <div className={cn("flex items-center space-x-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all", saving ? "bg-blue-50 text-blue-600 animate-pulse" : "bg-green-50 text-green-600")}>
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        <span>{saving ? 'Guardando' : 'Guardado'}</span>
                    </div>
                </div>
            </header>

            {/* Stepper */}
            <div className="bg-white border-b border-gray-100 px-6 py-6 overflow-x-auto no-scrollbar">
                <div className="max-w-3xl mx-auto flex items-center justify-between min-w-[320px]">
                    {steps.map((s, i) => {
                        const stepNum = i + 1;
                        const isActive = step === stepNum;
                        const isCompleted = step > stepNum;
                        const suggested = suggestClosureMotive(order);
                        const isSkipped = stepNum === 3 && step === 4 && suggested !== 8;

                        return (
                            <React.Fragment key={s.title}>
                                <div className="flex flex-col items-center space-y-2">
                                    <div className={cn(
                                        "w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black transition-all duration-500",
                                        isCompleted ? 'bg-green-500 text-white' :
                                            isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' :
                                                isSkipped ? 'bg-gray-100 text-gray-300' : 'bg-gray-100 text-gray-400'
                                    )}>
                                        {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : stepNum}
                                    </div>
                                    <span className={cn(
                                        "text-[9px] uppercase font-black tracking-widest",
                                        isActive ? 'text-blue-600' : isSkipped ? 'text-gray-300 line-through' : 'text-gray-400'
                                    )}>
                                        {s.title}
                                    </span>
                                </div>
                                {i < steps.length - 1 && (
                                    <div className={cn(
                                        "flex-1 h-0.5 mx-4 rounded-full transition-all duration-700",
                                        step > stepNum ? 'bg-green-500' : 'bg-gray-100'
                                    )} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {/* Content */}
            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-3xl mx-auto">
                    {step === 1 && <SummaryStep order={order} />}
                    {step === 2 && <InspectionStep order={order} onUpdate={updateField} readOnly={isClosed} />}
                    {step === 3 && <WorkStep order={order} onUpdate={updateField} lecturaRetirado={lecturaRetirado} setLecturaRetirado={setLecturaRetirado} photos={photos} handleFileUpload={handleFileUpload} readOnly={isClosed} />}
                    {step === 4 && <ClosingStep order={order} motivos={motivos} onUpdate={updateField} suggested={suggestClosureMotive(order)} canvasRef={canvasRef} startDrawing={startDrawing} stopDrawing={stopDrawing} draw={draw} clearSignature={clearSignature} readOnly={isClosed} />}
                </div>
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-100 p-4 sticky bottom-0 z-20">
                <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
                    <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1 || saving} className="flex-1 py-4 rounded-2xl font-black text-xs uppercase bg-gray-100 text-gray-500 disabled:opacity-30">Anterior</button>
                    {isClosed ? (
                        <button onClick={() => step < 4 ? setStep(step + 1) : navigate('/agente/dashboard')} className="flex-1 py-4 rounded-2xl font-black text-xs uppercase bg-gray-900 text-white shadow-xl flex items-center justify-center space-x-2">
                            <span>{step === 4 ? 'Volver al Dashboard' : 'Siguiente'}</span>
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    ) : (
                        <button onClick={() => step < 4 ? updateProgress(step + 1) : finalizeOrder()} disabled={saving} className="flex-1 py-4 rounded-2xl font-black text-xs uppercase bg-blue-600 text-white shadow-xl flex items-center justify-center space-x-2">
                            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>{step === 4 ? 'Finalizar' : 'Siguiente'}</span>{step < 4 && <ChevronRight className="w-5 h-5" />}</>}
                        </button>
                    )}
                </div>
            </footer>
        </div>
    );
};

const SummaryStep = ({ order }: { order: OrderData }) => (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 text-left">
        <section className="bg-white rounded-3xl p-6 shadow-xl shadow-black/5 border border-gray-50 space-y-6">
            <div className="flex items-center space-x-3 border-b border-gray-50 pb-4">
                <div className="p-2 bg-blue-50 rounded-lg"><User className="w-5 h-5 text-blue-600" /></div>
                <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">Datos del Servicio</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoItem label="Titular" value={`${order.cliente_nombre} ${order.cliente_apellido}`} />
                <InfoItem label="Contrato" value={order.cliente_cuenta_contrato} />
                <InfoItem label="Medidor Actual" value={order.cliente_medidor} />
                <InfoItem label="Última Lectura" value={order.cliente_lectura} />
            </div>
            <div className="pt-4 border-t border-gray-50 flex items-start space-x-3 font-bold text-gray-900">
                <MapPin className="w-5 h-5 text-gray-400 shrink-0" />
                <span>{order.cliente_calle} {order.cliente_numero}, {order.cliente_localidad}</span>
            </div>
        </section>
    </div>
);

const InspectionStep = ({ order, onUpdate, readOnly }: { order: OrderData, onUpdate: (f: string, v: string) => void, readOnly?: boolean }) => {
    const shouldShow = (field: string): boolean => {
        switch (field) {
            case 'morador': return true;
            case 'cliente_accede_cambio': return order.morador === 'SI';
            case 'coincidenummedidor': return order.cliente_accede_cambio === 'SI';
            case 'medidor_mal_estado': return order.cliente_accede_cambio === 'SI';
            case 'posee_reja_soldadura': return order.medidor_mal_estado === 'NO';
            case 'puede_retirar': return order.posee_reja_soldadura === 'SI';
            case 'fuga_fuera_zona': return order.medidor_mal_estado === 'NO';
            case 'perdida_valvula': return order.medidor_mal_estado === 'NO';
            case 'operar_valvula': return order.medidor_mal_estado === 'NO' && (order.puede_retirar === 'SI' || order.posee_reja_soldadura === 'NO');
            case 'continua_perdida_valvula': return order.operar_valvula === 'SI';
            default: return false;
        }
    };

    const checklistItems = [
        { field: 'morador', label: '¿Hay morador presente?' },
        { field: 'cliente_accede_cambio', label: '¿Cliente Accede a que se realice el cambio?' },
        { field: 'coincidenummedidor', label: `Coincide con medidor Num: ${order.cliente_medidor}` },
        { field: 'medidor_mal_estado', label: '¿Gabinete/Medidor Deteriorado o Manipulado?' },
        { field: 'posee_reja_soldadura', label: '¿Posee reja o soldadura?' },
        { field: 'puede_retirar', label: '¿Se puede retirar?' },
        { field: 'fuga_fuera_zona', label: '¿Se detectan fugas fuera de la zona?' },
        { field: 'perdida_valvula', label: '¿Perdida en válvula?' },
        { field: 'operar_valvula', label: '¿Se puede operar la válvula?' },
        { field: 'continua_perdida_valvula', label: '¿Se detectan perdidas luego de operar válvula?' },
    ];

    return (
        <div className="bg-white rounded-3xl p-6 shadow-xl shadow-black/5 border border-gray-50 space-y-6 text-left animate-in slide-in-from-bottom-4">
            <div className="flex items-center space-x-3 border-b border-gray-50 pb-4">
                <div className="p-2 bg-blue-50 rounded-lg"><MapPin className="w-5 h-5 text-blue-600" /></div>
                <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">Inicio de Visita</h2>
            </div>
            <div className="space-y-5">
                {checklistItems.map((item) => shouldShow(item.field) && (
                    <div key={item.field} className="space-y-3 animate-in fade-in slide-in-from-left-2 duration-300">
                        <span className="text-[11px] font-black text-gray-500 uppercase tracking-widest leading-tight block">{item.label}</span>
                        <div className="grid grid-cols-2 gap-2">
                            {['SI', 'NO'].map((val) => (
                                <button
                                    key={val}
                                    onClick={() => !readOnly && onUpdate(item.field, val)}
                                    disabled={readOnly}
                                    className={cn(
                                        "py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                                        (order as any)[item.field] === val
                                            ? (val === 'SI' ? "bg-cyan-400 text-white shadow-lg shadow-cyan-100" : "bg-red-400 text-white shadow-lg shadow-red-100")
                                            : "bg-gray-50 text-gray-400 hover:bg-gray-100",
                                        readOnly && "opacity-80 cursor-default"
                                    )}
                                >
                                    {val === 'SI' ? 'Si' : 'No'}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const WorkStep = ({ order, onUpdate, lecturaRetirado, setLecturaRetirado, photos, handleFileUpload, readOnly }: any) => {
    const diff = lecturaRetirado ? parseFloat(lecturaRetirado) - order.cliente_lectura : 0;

    return (
        <div className="space-y-6 text-left animate-in slide-in-from-bottom-4">
            <section className="bg-white rounded-3xl p-6 shadow-xl shadow-black/5 border border-gray-50 space-y-6">
                <div className="flex items-center space-x-3 border-b border-gray-50 pb-4">
                    <div className="p-2 bg-blue-50 rounded-lg"><Hash className="w-5 h-5 text-blue-600" /></div>
                    <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">Instalación</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="px-4 py-3 bg-gray-50 rounded-2xl">
                            <span className="text-[9px] font-black text-gray-400 uppercase">Lectura Previa</span>
                            <p className="text-lg font-black text-gray-900">{order.cliente_lectura} m³</p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-gray-400 px-1">Lectura Retirado</label>
                            <input type="number" readOnly={readOnly} value={lecturaRetirado} onChange={(e) => setLecturaRetirado(e.target.value)} placeholder="0.000" className="w-full px-5 py-4 bg-gray-50 rounded-2xl font-black text-lg focus:ring-2 focus:ring-blue-500/10 outline-none disabled:opacity-50" />
                        </div>
                        <div className="px-4 py-2 bg-blue-50 rounded-xl flex items-center justify-between">
                            <span className="text-[9px] font-black text-blue-400 uppercase">Diferencia</span>
                            <p className="text-sm font-black text-blue-600">{diff.toFixed(3)} m³</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-gray-400 px-1">Nueva Serie Medidor</label>
                            <div className="relative">
                                <input type="text" readOnly={readOnly} value={order.medidor_nuevo || ''} onChange={(e) => onUpdate('medidor_nuevo', e.target.value)} className="w-full px-5 py-4 bg-gray-50 rounded-2xl font-black text-lg focus:ring-2 focus:ring-blue-500/10 outline-none disabled:opacity-50" />
                                <button disabled={readOnly} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-xl disabled:opacity-50"><QrCode className="w-5 h-5" /></button>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-gray-400 px-1">Lectura Colocación</label>
                            <input type="number" readOnly={readOnly} value={order.lectura_nueva || ''} onChange={(e) => onUpdate('lectura_nueva', parseFloat(e.target.value))} placeholder="0.000" className="w-full px-5 py-4 bg-gray-50 rounded-2xl font-black text-lg focus:ring-2 focus:ring-blue-500/10 outline-none disabled:opacity-50" />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <span className="text-[9px] font-black text-gray-400 uppercase px-1">Regulador</span>
                        <div className="grid grid-cols-2 gap-2">
                            {['SI', 'NO'].map(v => (
                                <button key={v} disabled={readOnly} onClick={() => onUpdate('regulador', v)} className={cn("py-3 rounded-xl text-[10px] font-black uppercase", order.regulador === v ? "bg-blue-600 text-white shadow-lg" : "bg-gray-50 text-gray-400", readOnly && "opacity-80")}>{v}</button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <span className="text-[9px] font-black text-gray-400 uppercase px-1">Flexible</span>
                        <div className="grid grid-cols-3 gap-2">
                            {['SI', 'NO', 'DIN'].map(v => (
                                <button key={v} disabled={readOnly} onClick={() => onUpdate('flexible', v === 'DIN' ? 'Dinatecnica' : v)} className={cn("py-3 rounded-xl text-[10px] font-black uppercase", (v === 'DIN' ? order.flexible === 'Dinatecnica' : order.flexible === v) ? "bg-blue-600 text-white shadow-lg" : "bg-gray-50 text-gray-400", readOnly && "opacity-80")}>{v}</button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <span className="text-[9px] font-black text-gray-400 uppercase px-1">Observaciones</span>
                    <textarea readOnly={readOnly} value={order.observaciones_agente || ''} onChange={(e) => onUpdate('observaciones_agente', e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl text-xs font-bold border-none outline-none min-h-[100px] disabled:opacity-50" placeholder="Detalles técnicos adicionales..." />
                </div>
            </section>

            <section className="bg-white rounded-3xl p-6 shadow-xl shadow-black/5 border border-gray-50 space-y-6">
                <div className="flex items-center justify-between border-b border-gray-50 pb-4">
                    <div className="flex items-center space-x-3">
                        <Camera className="w-5 h-5 text-blue-600" />
                        <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">Archivos Multimedia</h2>
                    </div>
                    <span className="text-[9px] font-black text-blue-600 uppercase">Min 2 Fotos</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {!readOnly && (
                        <label className="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl flex items-center justify-center group hover:bg-blue-50 transition-all cursor-pointer">
                            <input type="file" accept="image/*" capture="environment" onChange={handleFileUpload} className="hidden" />
                            <Plus className="w-6 h-6 text-gray-300 group-hover:text-blue-400" />
                        </label>
                    )}
                    {photos.map((p: any) => (
                        <div key={p.id} className="aspect-square rounded-3xl overflow-hidden border border-gray-100 shadow-sm relative group">
                            <img src={p.url_foto} className="w-full h-full object-cover" alt="Evidencia" />
                            {!readOnly && (
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                                    <button className="p-2 bg-red-500 text-white rounded-lg shadow-lg"><Eraser className="w-4 h-4" /></button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

const ClosingStep = ({ order, motivos, onUpdate, suggested, canvasRef, startDrawing, stopDrawing, draw, clearSignature, readOnly }: any) => {
    const isFirstVisitNoMorador = (order.motivo_de_cierre === 1 || (!order.motivo_de_cierre && suggested === 1));

    useEffect(() => {
        if (canvasRef.current && !isFirstVisitNoMorador) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.strokeStyle = '#1e293b';
                ctx.lineWidth = 4;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
            }
        }
    }, [canvasRef, isFirstVisitNoMorador]);

    return (
        <div className="space-y-6 text-left animate-in slide-in-from-bottom-4 duration-500">
            <section className="bg-white rounded-3xl p-6 shadow-xl shadow-black/5 border border-gray-50 space-y-6">
                <div className="flex items-center justify-between border-b border-gray-50 pb-4">
                    <div className="flex items-center space-x-3">
                        <MessageSquare className="w-5 h-5 text-blue-600" />
                        <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">Tipo de Cierre</h2>
                    </div>
                    {suggested && <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-[9px] font-black uppercase tracking-widest rounded-lg">Analizado</span>}
                </div>

                <div className="space-y-2">
                    {motivos.map((m: any) => (
                        <button
                            key={m.id}
                            disabled={readOnly}
                            onClick={() => onUpdate('motivo_de_cierre', m.id)}
                            className={cn(
                                "w-full text-left p-4 rounded-2xl border transition-all text-xs font-bold",
                                order.motivo_de_cierre === m.id ? "bg-blue-600 border-blue-600 text-white shadow-lg" :
                                    m.id === suggested && !order.motivo_de_cierre ? "bg-yellow-50 border-yellow-200 text-gray-700" :
                                        "bg-gray-50 border-transparent text-gray-600 hover:bg-gray-100",
                                readOnly && "opacity-80"
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <span>{m.Motivo}</span>
                                {order.motivo_de_cierre === m.id && <Check className="w-4 h-4" />}
                            </div>
                        </button>
                    ))}
                </div>

                {isFirstVisitNoMorador && (
                    <div className="pt-6 border-t border-gray-50 space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center space-x-2 text-blue-600">
                            <Calendar className="w-5 h-5" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Programar Segunda Visita</span>
                        </div>
                        <p className="text-[11px] text-gray-400 font-medium">Al no encontrarse el morador en la primera visita, la orden permanecerá abierta. Por favor, programe el re-intento:</p>
                        <input
                            type="date"
                            readOnly={readOnly}
                            value={order.fecha_segunda_visita?.split('T')[0] || ''}
                            onChange={(e) => onUpdate('fecha_segunda_visita', e.target.value)}
                            className="w-full px-5 py-4 bg-blue-50/50 rounded-2xl font-black text-blue-900 border-none outline-none focus:ring-2 focus:ring-blue-500/10 disabled:opacity-50"
                        />
                    </div>
                )}
            </section>

            {!isFirstVisitNoMorador && (
                <section className="bg-white rounded-3xl p-6 shadow-xl shadow-black/5 border border-gray-50 space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-50 pb-4">
                        <div className="flex items-center space-x-3">
                            <PenTool className="w-5 h-5 text-blue-600" />
                            <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">Firma del Titular</h2>
                        </div>
                        {!readOnly && <button onClick={clearSignature} className="p-2 text-gray-400 hover:text-red-500 transition-all"><Eraser className="w-4 h-4" /></button>}
                    </div>
                    <div className="bg-gray-50 rounded-3xl overflow-hidden border border-gray-100 touch-none shadow-inner relative">
                        <canvas
                            ref={canvasRef}
                            width={800}
                            height={300}
                            onMouseDown={(e) => !readOnly && startDrawing(e)}
                            onMouseUp={stopDrawing}
                            onMouseMove={(e) => !readOnly && draw(e)}
                            onTouchStart={(e) => !readOnly && startDrawing(e)}
                            onTouchEnd={stopDrawing}
                            onTouchMove={(e) => !readOnly && draw(e)}
                            className={cn("w-full h-[250px]", readOnly ? "cursor-default" : "cursor-crosshair")}
                        />
                        {order.fimardigital && readOnly && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/10 pointer-events-none">
                                <img src={order.fimardigital} className="max-h-full object-contain opacity-80" alt="Firma Guardada" />
                            </div>
                        )}
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl text-[10px] font-black text-gray-400 text-center uppercase tracking-widest">
                        {readOnly ? 'Vista de Firma Guardada' : 'Pulse y arrastre para dibujar la firma'}
                    </div>
                </section>
            )}
        </div>
    );
};

const InfoItem = ({ label, value, icon: Icon }: any) => (
    <div className="space-y-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 leading-none">{label}</p>
        <div className="flex items-center space-x-2">
            {Icon && <Icon className="w-3.5 h-3.5 text-gray-300" />}
            <p className="text-gray-900 font-bold">{value || '---'}</p>
        </div>
    </div>
);

export default OrderExecution;
