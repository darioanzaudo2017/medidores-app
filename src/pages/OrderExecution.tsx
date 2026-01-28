import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
    ArrowLeft,
    CheckCircle2,
    ChevronRight,
    Camera,
    FileText,
    MapPin,
    Loader2,
    User,
    Hash,
    PenTool,
    MessageSquare,
    Eraser,
    Wrench,
    Video,
    Play,
    X,
    AlertTriangle,
    Check,
    Scan,
    Image as ImageIcon,
    Upload
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { cn } from '../lib/utils';
import { useToast } from '../hooks/useToast';

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
    fimardigital: string;
    longcambio: string;
    id_estado_orden: string;
    latcambio: string;
    observacion_verificacion: string;
    diferencialectura: number;
    fecha_finalizacion_agente: string;
}

interface MotivoCierre {
    id: number;
    Motivo: string;
}

interface DBPhoto {
    id: string;
    url_foto: string;
    video: boolean;
}

const shouldShow = (field: string, ord: OrderData) => {
    if (!ord) return false;
    switch (field) {
        case 'morador':
            return true;
        case 'gabinete_linea':
            return ord.morador === 'NO';
        case 'cliente_accede_cambio':
            return ord.morador === 'SI';
        case 'coincidenummedidor':
            return ord.morador === 'SI' && ord.cliente_accede_cambio === 'SI';
        case 'medidor_mal_estado':
            return ord.morador === 'SI' &&
                ord.cliente_accede_cambio === 'SI' &&
                ord.coincidenummedidor === 'SI';
        case 'posee_reja_soldadura':
            return (ord.morador === 'SI' && ord.cliente_accede_cambio === 'SI' && ord.coincidenummedidor === 'SI' && ord.medidor_mal_estado === 'NO');
        case 'puede_retirar':
            return ord.posee_reja_soldadura === 'SI';
        case 'fuga_fuera_zona':
            return ord.medidor_mal_estado === 'NO' &&
                (ord.posee_reja_soldadura === 'NO' || ord.puede_retirar === 'SI');
        case 'perdida_valvula':
            return ord.fuga_fuera_zona === 'SI';
        case 'operar_valvula':
            return ord.fuga_fuera_zona === 'SI' && ord.perdida_valvula === 'SI';
        case 'continua_perdida_valvula':
            return ord.operar_valvula === 'SI';
        case 'existe_litracion':
            return (ord.morador === 'SI' && ord.fuga_fuera_zona === 'NO') || (ord.operar_valvula === 'SI' && ord.continua_perdida_valvula === 'NO');
        default:
            return false;
    }
};

const checklistItems = [
    { field: 'morador', label: '¿Hay morador presente?' },
    { field: 'gabinete_linea', label: '¿Gabinete en Línea Municipal?' },
    { field: 'cliente_accede_cambio', label: '¿Cliente accede a que se realice el cambio?' },
    { field: 'coincidenummedidor', label: 'Coincide con medidor Num' },
    { field: 'medidor_mal_estado', label: '¿Gabinete deteriorado o conexión irregular?' },
    { field: 'posee_reja_soldadura', label: '¿Posee reja o soldadura?' },
    { field: 'puede_retirar', label: '¿Se puede retirar la reja/soldadura?' },
    { field: 'fuga_fuera_zona', label: '¿Se detectan fugas fuera de la zona de intervención?' },
    { field: 'perdida_valvula', label: '¿Pérdida en válvula?' },
    { field: 'operar_valvula', label: '¿Se puede operar la válvula?' },
    { field: 'continua_perdida_valvula', label: '¿Se detectan pérdidas luego de operar válvula?' },
    { field: 'existe_litracion', label: '¿Existe Litración?' },
];

const OrderExecution: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [order, setOrder] = useState<OrderData | null>(null);
    const [motivos, setMotivos] = useState<MotivoCierre[]>([]);
    const [photos, setPhotos] = useState<DBPhoto[]>([]);
    const [step, setStep] = useState(1);
    const [saving, setSaving] = useState(false);
    const [lecturaRetirado, setLecturaRetirado] = useState<string>('');
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // Optimización de guardado: Debounce y Batching
    const pendingUpdates = useRef<Record<string, unknown>>({});
    const saveTimeoutRef = useRef<number | null>(null);

    const savePendingUpdates = useCallback(async () => {
        if (!id || Object.keys(pendingUpdates.current).length === 0) return;

        try {
            const { error } = await supabase
                .from('t_ordenes')
                .update(pendingUpdates.current)
                .eq('id_orden', id);

            if (error) throw error;
            pendingUpdates.current = {};
        } catch (err) {
            console.error('Error in auto-save:', err);
        }
    }, [id]);

    const updateField = (field: string, value: unknown, immediate = false) => {
        if (!order) return;

        const newOrder = { ...order, [field]: value };

        // 1. Limpieza de campos condicionales
        checklistItems.forEach(item => {
            if (!shouldShow(item.field, newOrder)) {
                const key = item.field as keyof OrderData;
                if (newOrder[key] !== null && newOrder[key] !== undefined && newOrder[key] !== '') {
                    (newOrder as unknown as Record<string, unknown>)[key] = null;
                    pendingUpdates.current[key] = null;
                }
            }
        });

        // 2. Sincronización automática de Motivo de Cierre
        const suggested = suggestClosureMotive(newOrder);
        if (suggested && suggested !== 8) {
            newOrder.motivo_de_cierre = suggested;
            pendingUpdates.current.motivo_de_cierre = suggested;
        }

        setOrder(newOrder);
        pendingUpdates.current[field] = value;

        if (immediate) {
            savePendingUpdates();
        } else {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = window.setTimeout(savePendingUpdates, 2000);
        }
    };

    const fetchOrderDetails = useCallback(async () => {
        if (!id) return;
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
            const { data: motivosData, error: motivosError } = await supabase
                .from('t_motivos_cierre')
                .select('*')
                .order('id');

            if (motivosError) throw motivosError;
            setMotivos(motivosData as MotivoCierre[]);

            // Photos
            const { data: photosData } = await supabase
                .from('t_fotos')
                .select('*') // Select all to see what IDs we get
                .eq('orden_id', parseInt(id!));

            if (photosData) {
                // Map the data to ensure we have an 'id' property even if the column is named differently
                const mappedPhotos = photosData.map((p) => {
                    const photoData = p as { id?: string; id_foto?: string; id_fotos?: string };
                    return {
                        ...p,
                        id: photoData.id || photoData.id_foto || photoData.id_fotos || Object.values(p)[0]
                    };
                });
                setPhotos(mappedPhotos as DBPhoto[]);
            }

        } catch (err: unknown) {
            const error = err as Error;
            console.error('Error fetching order details:', error);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchOrderDetails();
        return () => {
            if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
        };
    }, [fetchOrderDetails]);

    const isClosed = order?.estado_nombre === 'CERRADO AGENTE';

    const suggestClosureMotive = (ord: OrderData | null): number | null => {
        if (!ord) return null;

        // 1. Morador NO
        if (ord.morador === 'NO') {
            // Si NO está en línea municipal -> Cierre ID 13 (Mapeo manual ya que no existe en DB)
            if (ord.gabinete_linea === 'NO') return 13;
            // Si está en línea municipal -> Flujo de Visitas
            // El ID 1 es "Cierre segunda visita sin morador"
            if (ord.gabinete_linea === 'SI') return ord.fecha_primera_visita ? 1 : null;
            return null;
        }

        // 2. Cliente accede NO -> ID 2
        if (ord.cliente_accede_cambio === 'NO') return 2;

        // 3. Coincide medidor NO -> ID 9
        if (ord.coincidenummedidor === 'NO') return 9;

        // 4. Mal estado / Conexión irregular -> ID 3
        if (ord.medidor_mal_estado === 'SI') return 3;

        // 5. Reja -> Si NO puede retirar -> ID 7
        if (ord.posee_reja_soldadura === 'SI' && ord.puede_retirar === 'NO') return 7;

        // 6. Fugas Fuera de Zona
        if (ord.fuga_fuera_zona === 'SI') {
            // SI Fuga fuera Y NO pérdida en válvula -> ID 4 (Pérdida Interna)
            if (ord.perdida_valvula === 'NO') return 4;
            // SI Fuga fuera Y SI pérdida en válvula -> Continúa a Operar Válvula
        }

        // 7. Válvula
        if (ord.operar_valvula === 'NO') return 5;
        if (ord.continua_perdida_valvula === 'SI') return 6;

        // 8. Litración -> ID 4 (Pérdida Interna)
        if (ord.existe_litracion === 'SI') return 4;

        // Especial: Pérdida en válvula previa (si no se pudo operar por ejemplo)
        if (ord.perdida_valvula === 'SI' && ord.operar_valvula === 'SI' && ord.continua_perdida_valvula === 'NO') {
            // Este es el camino de éxito tras reparar/operar, pero si el flujo marca pérdida crítica:
            // return 7; // Solo si se decide cerrar por pérdida en válvula sin intentar operar
        }

        // 8. Litración (Pregunta final antes del cierre)
        if (ord.existe_litracion === 'SI') return 12; // ID 12 (Pérdida Interna)

        return 8; // Normal (Continúa a Instalación o Cierre Exitoso)
    };

    const updateProgress = async (nextStep: number) => {
        if (!id || !order) return;

        let targetStep = nextStep;
        const suggested = suggestClosureMotive(order);

        // Si detectamos un motivo de cierre en el paso 2, saltamos directo al paso 4
        if (step === 2 && nextStep === 3 && suggested && suggested !== 8) {
            targetStep = 4;
        }

        setStep(targetStep);
        updateField('paso_actual', targetStep, true);
    };

    const handlePrevious = () => {
        if (!order || step === 1) return;

        let targetStep = step - 1;
        const suggested = suggestClosureMotive(order);

        // Si estamos en el paso 4 y el paso 3 fue saltado por un motivo de cierre, volvemos directo al 2
        if (step === 4 && suggested && suggested !== 8) {
            targetStep = 2;
        }

        setStep(targetStep);
    };

    const finalizeOrder = async () => {
        if (!id || !order) return;

        // Validaciones Finales
        if (suggestClosureMotive(order) === 8) {
            if (!order.medidor_nuevo || !order.lectura_nueva) {
                toast.warning('Datos Incompletos', 'Debe ingresar el nuevo medidor y su lectura');
                setStep(3);
                return;
            }
        } else {
            if (!order.motivo_de_cierre) {
                toast.warning('Falta Motivo', 'Debe seleccionar un motivo de cierre');
                return;
            }
        }

        if (photos.length < 2) {
            toast.warning('Faltan Fotos', 'Debe subir al menos 2 evidencias (Fotos/Video)');
            return;
        }

        const suggested = suggestClosureMotive(order);
        const isFirstNoMorador = (order.motivo_de_cierre === 1 || (!order.motivo_de_cierre && suggested === 1));

        if (!isFirstNoMorador && !order.fimardigital) {
            const signature = canvasRef.current?.toDataURL();
            if (!signature || signature.length < 1000) {
                toast.warning('Firma Requerida', 'El titular debe firmar para finalizar el proceso');
                return;
            }
            updateField('fimardigital', signature);
        }

        try {
            setSaving(true);

            // Capturar coordenadas GPS al momento del cierre
            let lat = order.latcambio;
            let lng = order.longcambio;

            if (!lat || !lng) {
                try {
                    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                            enableHighAccuracy: true,
                            timeout: 5000
                        });
                    });
                    lat = pos.coords.latitude.toString();
                    lng = pos.coords.longitude.toString();

                    // Actualizamos localmente para el guardado final
                    pendingUpdates.current.latcambio = lat;
                    pendingUpdates.current.longcambio = lng;
                } catch (geoErr) {
                    console.warn('No se pudo capturar la ubicación GPS:', geoErr);
                }
            }

            await savePendingUpdates();

            // Determinar estado final: SEGUNDA VISITA o CERRADO AGENTE
            let targetStatusName = 'CERRADO AGENTE';
            if (isFirstNoMorador) {
                targetStatusName = 'SEGUNDA VISITA';
            }

            const { data: statusData } = await supabase
                .from('t_estados')
                .select('id')
                .eq('nombre', targetStatusName)
                .single();

            if (!statusData) throw new Error(`Estado ${targetStatusName} no encontrado`);

            const updateData: any = {
                id_estado_orden: statusData.id,
                fecha_finalizacion_agente: new Date().toISOString()
            };

            // Si es la primera visita sin morador, guardamos la fecha
            if (isFirstNoMorador) {
                updateData.fecha_primera_visita = new Date().toISOString();
            }

            const { error } = await supabase
                .from('t_ordenes')
                .update(updateData)
                .eq('id_orden', id);

            if (error) throw error;

            toast.success('Orden Finalizada', 'La orden ha sido enviada correctamente');
            navigate('/agente/dashboard');
        } catch (err: unknown) {
            const error = err as Error;
            console.error('Error finalizing:', error);
            toast.error('Error al Finalizar', error.message);
        } finally {
            setSaving(false);
        }
    };

    // Signature Canvas logic
    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDrawing(true);
        draw(e);
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        if (canvasRef.current) {
            updateField('fimardigital', canvasRef.current.toDataURL());
        }
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;

        const x = (clientX - rect.left) * (canvas.width / rect.width);
        const y = (clientY - rect.top) * (canvas.height / rect.height);

        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const clearSignature = () => {
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            updateField('fimardigital', '');
        }
    };

    const compressImage = async (file: File): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    const max_size = 1200; // Resolución optimizada para móviles
                    if (width > height) {
                        if (width > max_size) {
                            height *= max_size / width;
                            width = max_size;
                        }
                    } else {
                        if (height > max_size) {
                            width *= max_size / height;
                            height = max_size;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error('Error al comprimir imagen'));
                    }, 'image/jpeg', 0.85); // 85% calidad es el punto dulce entre peso y nitidez
                };
            };
            reader.onerror = (error) => reject(error);
        });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isVideo: boolean) => {
        const file = e.target.files?.[0];
        if (!file || !id) return;

        try {
            setSaving(true);

            // Validation: Max size (50MB videos, 10MB images)
            const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
            if (file.size > maxSize) {
                throw new Error(`El archivo es muy pesado (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo permitido: ${isVideo ? '50MB' : '10MB'}.`);
            }

            // Dynamic extension based on file type if name is generic (common on mobile)
            let fileExt = file.name.split('.').pop();
            if (fileExt === file.name || !fileExt) {
                fileExt = isVideo ? 'mp4' : 'jpg';
            }

            const fileName = `${id}_${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            let fileData: File | Blob = file;
            if (!isVideo) {
                try {
                    fileData = await compressImage(file);
                } catch (compErr) {
                    console.warn('Compression failed, uploading original:', compErr);
                }
            }

            // Explicitly set contentType for better PWA/Mobile compatibility
            const { error: uploadError } = await supabase.storage
                .from('fotomedidor')
                .upload(filePath, fileData, {
                    contentType: isVideo ? (file.type || 'video/mp4') : 'image/jpeg',
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from('fotomedidor')
                .getPublicUrl(filePath);

            const { data: newPhoto, error: dbError } = await supabase
                .from('t_fotos')
                .insert({
                    orden_id: parseInt(id!),
                    url_foto: urlData.publicUrl,
                    video: isVideo
                })
                .select()
                .single();

            if (dbError) throw dbError;

            // Re-map the new photo to ensure ID consistency
            const mappedNewPhoto = {
                ...newPhoto,
                id: (newPhoto as Record<string, any>).id || (newPhoto as Record<string, any>).id_foto || (newPhoto as Record<string, any>).id_fotos
            };
            setPhotos(prev => [...prev, mappedNewPhoto as DBPhoto]);
        } catch (err: unknown) {
            const error = err as Error;
            console.error('Error uploading file:', error);
            let errorMessage = error.message || 'Error desconocido';

            if (errorMessage.includes('aborted')) {
                errorMessage = 'La subida fue cancelada por el navegador. Esto sucede a veces si la señal móvil es muy débil. Intentá de nuevo.';
            }

            toast.error(
                `Error al subir ${isVideo ? 'video' : 'archivo'}`,
                `${errorMessage} Verificá tu conexión.`
            );
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteFile = async (photo: DBPhoto) => {
        if (!window.confirm('¿Está seguro de eliminar esta evidencia?')) return;

        try {
            setSaving(true);
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

            setPhotos(prev => prev.filter(p => p.id !== photo.id));
        } catch (err: unknown) {
            const error = err as Error;
            console.error('Error deleting file:', error);
            toast.error('Error al eliminar', error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading || !order) {
        return (
            <div className="min-h-screen bg-[#f9fafa] flex items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            </div>
        );
    }

    const steps = [
        { title: 'Resumen', icon: FileText },
        { title: 'Inspección', icon: MapPin },
        { title: 'Instalación', icon: Wrench },
        { title: 'Cierre', icon: Camera },
    ];

    return (
        <div className="min-h-screen bg-[#f9fafa] flex flex-col font-sans">
            {/* Header */}
            <header className="bg-white border-b border-gray-100 p-4 sticky top-0 z-20">
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-50 rounded-xl transition-colors">
                        <ArrowLeft className="w-5 h-5 text-gray-500" />
                    </button>
                    <div className="text-center">
                        <h1 className="text-sm font-black uppercase tracking-widest text-gray-900 leading-none">Ejecutar Orden</h1>
                        <p className="text-[10px] font-bold text-blue-600 mt-1 uppercase tracking-widest">Orden #{id}</p>
                    </div>
                    <div className={cn(
                        "flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest",
                        saving ? "text-orange-500" : "text-green-500"
                    )}>
                        <div className={cn("w-2 h-2 rounded-full", saving ? "bg-orange-500 animate-pulse" : "bg-green-500")} />
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
            <main className="flex-1 p-4 md:p-8 pb-32">
                <div className="max-w-3xl mx-auto">
                    {step === 1 && <SummaryStep order={order} />}
                    {step === 2 && (
                        <InspectionStep
                            order={order}
                            onUpdate={(f: keyof OrderData, v: string) => updateField(f, v, true)}
                            readOnly={isClosed}
                            suggestClosureMotive={suggestClosureMotive}
                            motivos={motivos}
                        />
                    )}
                    {step === 3 && (
                        <WorkStep
                            order={order}
                            onUpdate={updateField}
                            lecturaRetirado={lecturaRetirado}
                            setLecturaRetirado={(val: string) => {
                                setLecturaRetirado(val);
                                if (order) {
                                    const floatVal = parseFloat(val);
                                    if (!isNaN(floatVal)) {
                                        updateField('diferencialectura', floatVal - order.cliente_lectura);
                                    }
                                }
                            }}
                            readOnly={isClosed}
                            onOpenScanner={() => setIsScannerOpen(true)}
                        />
                    )}
                    {step === 4 && (
                        <ClosingStep
                            order={order}
                            motivos={motivos}
                            onUpdate={updateField}
                            suggested={suggestClosureMotive(order)}
                            canvasRef={canvasRef}
                            startDrawing={startDrawing}
                            stopDrawing={stopDrawing}
                            draw={draw}
                            clearSignature={clearSignature}
                            photos={photos}
                            handleFileUpload={handleFileUpload}
                            handleDeleteFile={handleDeleteFile}
                            saving={saving}
                            isDrawing={isDrawing}
                            readOnly={isClosed}
                        />
                    )}
                </div>

                <ScannerModal
                    isOpen={isScannerOpen}
                    onClose={() => setIsScannerOpen(false)}
                    onScan={(result) => {
                        updateField('medidor_nuevo', result, true);
                        setIsScannerOpen(false);
                        toast.success('Escaneo Exitoso', `Medidor: ${result}`);
                    }}
                />
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-100 p-4 sticky bottom-0 z-20 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
                    <button onClick={handlePrevious} disabled={step === 1 || saving} className="flex-1 py-4 rounded-2xl font-black text-xs uppercase bg-gray-100 text-gray-500 disabled:opacity-30">Anterior</button>
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
        {order.id_estado_orden === '3945416a-775d-412b-b05b-86a582934aaf' && order.observacion_verificacion && (
            <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 flex gap-4 items-start shadow-sm animate-in zoom-in-95 duration-300">
                <div className="p-3 bg-amber-500 rounded-2xl text-white shadow-lg shadow-amber-500/20">
                    <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest leading-none">Observación del Supervisor</p>
                    <p className="text-sm font-black text-amber-900 leading-tight pr-4">
                        "{order.observacion_verificacion}"
                    </p>
                </div>
            </div>
        )}
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


const InspectionStep = ({ order, onUpdate, readOnly, suggestClosureMotive, motivos }: { order: OrderData, onUpdate: (f: keyof OrderData, v: string) => void, readOnly?: boolean, suggestClosureMotive: (ord: OrderData | null) => number | null, motivos: MotivoCierre[] }) => {

    // Función de visibilidad local que usa la global
    const localShouldShow = (field: string) => shouldShow(field, order);

    const displayChecklist = [
        { ...checklistItems[0], info: 'Verificar presencia de personas en el domicilio' },
        { ...checklistItems[1], info: 'Si NO es primera visita y NO está en línea, se cierra' },
        { ...checklistItems[2], info: 'Si NO acepta, se cierra la orden por negativa del cliente' },
        { ...checklistItems[3], label: `Coincide con medidor Num: ${order.cliente_medidor}`, info: 'Verificar que el número de serie coincida' },
        { ...checklistItems[4], info: 'Si está deteriorado o manipulado, se cierra la orden' },
        { ...checklistItems[5], info: 'Verificar obstáculos físicos' },
        { ...checklistItems[6], info: 'Si NO se puede retirar, se cierra la orden' },
        { ...checklistItems[7], info: 'Fugas en tramos fuera de nuestra intervención' },
        { ...checklistItems[8], info: 'Solo si se detectó fuga fuera de zona' },
        { ...checklistItems[9], info: 'Intentar maniobrar la llave de paso' },
        { ...checklistItems[10], info: 'Verificar estanqueidad post-maniobra' },
        { ...checklistItems[11], info: 'Verificar si el medidor registra consumo sin demanda' },
    ];

    // Calcular progreso
    const totalVisibleQuestions = checklistItems.filter(item => localShouldShow(item.field)).length;
    const answeredQuestions = checklistItems.filter(item => {
        const key = item.field as keyof OrderData;
        return localShouldShow(item.field) && order[key] !== null && order[key] !== undefined && order[key] !== '';
    }).length;

    return (
        <div className="bg-white rounded-3xl p-6 shadow-xl shadow-black/5 border border-gray-50 space-y-6 text-left animate-in slide-in-from-bottom-4">

            {/* Header con progreso */}
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-50 pb-4">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <MapPin className="w-5 h-5 text-blue-600" />
                        </div>
                        <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">
                            Inicio de Visita
                        </h2>
                    </div>

                    {/* Indicador de progreso */}
                    <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-black text-gray-400 uppercase">
                            {answeredQuestions}/{totalVisibleQuestions}
                        </span>
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-600 transition-all duration-500"
                                style={{ width: `${(answeredQuestions / totalVisibleQuestions) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Alerta si se detecta motivo de cierre */}
                {suggestClosureMotive(order) && suggestClosureMotive(order) !== 8 && (
                    <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-xl animate-in slide-in-from-top-2">
                        <div className="flex items-start space-x-3">
                            <div className="p-1 bg-yellow-400 rounded-lg">
                                <CheckCircle2 className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] font-black text-yellow-800 uppercase tracking-widest">
                                    Inspección Completada
                                </p>
                                <p className="text-[11px] text-yellow-700 font-medium mt-1">
                                    Se detectó: <span className="font-bold text-yellow-900 uppercase">
                                        {(() => {
                                            const suggestedId = suggestClosureMotive(order);
                                            if (suggestedId === 13) return 'GABINETE FUERA DE LÍNEA MUNICIPAL';
                                            const motive = motivos.find(m => m.id === suggestedId);
                                            return motive ? motive.Motivo : `MOTIVO DE CIERRE (ID: ${suggestedId})`;
                                        })()}
                                    </span>.
                                    Al presionar "Siguiente" se saltará directo al paso de Cierre.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Preguntas */}
            <div className="space-y-5">
                {displayChecklist.map((item, index) => localShouldShow(item.field) && (
                    <div
                        key={item.field}
                        className="space-y-3 animate-in fade-in slide-in-from-left-2 duration-300"
                        style={{ animationDelay: `${index * 50}ms` }}
                    >
                        {/* Label con número */}
                        <div className="flex items-start space-x-2">
                            <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-[10px] font-black">
                                {checklistItems.findIndex(i => i.field === item.field) + 1}
                            </span>
                            <div className="flex-1">
                                <span className="text-[11px] font-black text-gray-700 leading-tight block">
                                    {item.label}
                                </span>
                                {item.info && (
                                    <span className="text-[9px] text-gray-400 font-medium mt-1 block">
                                        {item.info}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {['SI', 'NO'].map((val) => {
                                const isSelected = order[item.field as keyof OrderData] === val;
                                const shouldHighlight =
                                    (item.field === 'morador' && val === 'NO') ||
                                    (item.field === 'gabinete_linea') || // Ambos caminos (SI/NO) son cierres si no hay morador
                                    (item.field === 'cliente_accede_cambio' && val === 'NO') ||
                                    (item.field === 'coincidenummedidor' && val === 'NO') ||
                                    (item.field === 'medidor_mal_estado' && val === 'SI') ||
                                    (item.field === 'puede_retirar' && val === 'NO') ||
                                    (item.field === 'operar_valvula' && val === 'NO') ||
                                    (item.field === 'continua_perdida_valvula' && val === 'SI') ||
                                    (item.field === 'existe_litracion' && val === 'SI');

                                return (
                                    <button
                                        key={val}
                                        onClick={() => !readOnly && onUpdate(item.field as keyof OrderData, val)}
                                        disabled={readOnly}
                                        className={cn(
                                            "py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all relative overflow-hidden",
                                            isSelected
                                                ? (val === 'SI'
                                                    ? "bg-cyan-400 text-white shadow-lg shadow-cyan-100"
                                                    : "bg-red-400 text-white shadow-lg shadow-red-100")
                                                : "bg-gray-50 text-gray-400 hover:bg-gray-100",
                                            readOnly && "opacity-80 cursor-default",
                                            isSelected && shouldHighlight && "ring-2 ring-yellow-400 ring-offset-2"
                                        )}
                                    >
                                        <span className="relative z-10 flex items-center justify-center space-x-2">
                                            {isSelected && <Check className="w-4 h-4" />}
                                            <span>{val}</span>
                                        </span>
                                        {isSelected && shouldHighlight && (
                                            <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-transparent animate-pulse" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

interface WorkStepProps {
    order: OrderData;
    onUpdate: (f: string, v: unknown, immediate?: boolean) => void;
    lecturaRetirado: string;
    setLecturaRetirado: (val: string) => void;
    readOnly?: boolean;
    onOpenScanner: () => void;
}

const WorkStep = ({ order, onUpdate, lecturaRetirado, setLecturaRetirado, readOnly, onOpenScanner }: WorkStepProps) => {
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
                                <button
                                    type="button"
                                    disabled={readOnly}
                                    onClick={onOpenScanner}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-xl disabled:opacity-50 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                                >
                                    <Scan className="w-5 h-5" />
                                </button>
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
                                <button key={v} disabled={readOnly} onClick={() => onUpdate('regulador', v, true)} className={cn("py-3 rounded-xl text-[10px] font-black uppercase", order.regulador === v ? "bg-blue-600 text-white shadow-lg" : "bg-gray-50 text-gray-400", readOnly && "opacity-80")}>{v}</button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <span className="text-[9px] font-black text-gray-400 uppercase px-1">Flexible</span>
                        <div className="grid grid-cols-3 gap-2">
                            {['SI', 'NO', 'DIN'].map(v => (
                                <button key={v} disabled={readOnly} onClick={() => onUpdate('flexible', v === 'DIN' ? 'Dinatecnica' : v, true)} className={cn("py-3 rounded-xl text-[10px] font-black uppercase", (v === 'DIN' ? order.flexible === 'Dinatecnica' : order.flexible === v) ? "bg-blue-600 text-white shadow-lg" : "bg-gray-50 text-gray-400", readOnly && "opacity-80")}>{v}</button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <span className="text-[9px] font-black text-gray-400 uppercase px-1">Observaciones</span>
                    <textarea readOnly={readOnly} value={order.observaciones_agente || ''} onChange={(e) => onUpdate('observaciones_agente', e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl text-xs font-bold border-none outline-none min-h-[100px] disabled:opacity-50" placeholder="Detalles técnicos adicionales..." />
                </div>
            </section>
        </div>
    );
};

interface ClosingStepProps {
    order: OrderData;
    motivos: MotivoCierre[];
    onUpdate: (f: string, v: unknown, immediate?: boolean) => void;
    suggested: number | null;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    startDrawing: (e: React.MouseEvent | React.TouchEvent) => void;
    stopDrawing: () => void;
    draw: (e: React.MouseEvent | React.TouchEvent) => void;
    clearSignature: () => void;
    photos: DBPhoto[];
    handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, isVideo: boolean) => void;
    handleDeleteFile: (photo: DBPhoto) => void;
    saving: boolean;
    isDrawing: boolean;
    readOnly?: boolean;
}

const ClosingStep = ({ order, motivos, onUpdate, suggested, canvasRef, startDrawing, stopDrawing, draw, clearSignature, photos, handleFileUpload, handleDeleteFile, saving, isDrawing, readOnly }: ClosingStepProps) => {
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
                        <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">Feedback y Evidencia</h2>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-gray-400 px-1">Motivo de Cierre</label>
                        <select
                            disabled={readOnly}
                            value={order.motivo_de_cierre || ''}
                            onChange={(e) => onUpdate('motivo_de_cierre', parseInt(e.target.value), true)}
                            className="w-full px-5 py-4 bg-gray-50 rounded-2xl font-black text-sm focus:ring-2 focus:ring-blue-500/10 outline-none disabled:opacity-50 appearance-none"
                        >
                            <option value="">Seleccione un motivo...</option>
                            {motivos.map(m => (
                                <option key={m.id} value={m.id}>{m.Motivo}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <label className="text-[10px] font-black uppercase text-gray-400">Evidencias ({photos.length})</label>
                            <div className="flex gap-2">
                                {/* Opciones de Foto */}
                                <div className="flex bg-blue-50 rounded-2xl overflow-hidden border border-blue-100 shadow-sm shadow-blue-100/50">
                                    <label title="Sacar Foto" className="cursor-pointer p-4 text-blue-600 hover:bg-blue-100 transition-colors border-r border-blue-100">
                                        <Camera className="w-6 h-6" />
                                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileUpload(e, false)} disabled={saving || readOnly} />
                                    </label>
                                    <label title="Subir de Galería" className="cursor-pointer p-4 text-blue-500 hover:bg-blue-100 transition-colors">
                                        <ImageIcon className="w-6 h-6" />
                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, false)} disabled={saving || readOnly} />
                                    </label>
                                </div>

                                {/* Opciones de Video */}
                                <div className="flex bg-purple-50 rounded-2xl overflow-hidden border border-purple-100 shadow-sm shadow-purple-100/50">
                                    <label title="Grabar Video" className="cursor-pointer p-4 text-purple-600 hover:bg-purple-100 transition-colors border-r border-purple-100">
                                        <Video className="w-6 h-6" />
                                        <input type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => handleFileUpload(e, true)} disabled={saving || readOnly} />
                                    </label>
                                    <label title="Subir Video" className="cursor-pointer p-4 text-purple-500 hover:bg-purple-100 transition-colors">
                                        <Upload className="w-6 h-6" />
                                        <input type="file" accept="video/*" className="hidden" onChange={(e) => handleFileUpload(e, true)} disabled={saving || readOnly} />
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            {photos.map(p => (
                                <div key={p.id} className="relative aspect-square rounded-2xl overflow-hidden border border-gray-100 group">
                                    {p.video ? (
                                        <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                                            <Play className="w-6 h-6 text-white" />
                                        </div>
                                    ) : (
                                        <img src={p.url_foto} className="w-full h-full object-cover" alt="Evidencia" />
                                    )}
                                    {!readOnly && (
                                        <button onClick={() => handleDeleteFile(p)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {photos.length === 0 && (
                                <div className="col-span-3 py-10 text-center border-2 border-dashed border-gray-100 rounded-3xl">
                                    <Camera className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Sin archivos capturados</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {!isFirstVisitNoMorador && (
                        <div className="space-y-3 pt-4 border-t border-gray-50">
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center space-x-2">
                                    <PenTool className="w-4 h-4 text-gray-400" />
                                    <label className="text-[10px] font-black uppercase text-gray-400">Firma del Cliente</label>
                                </div>
                                <button disabled={readOnly} onClick={clearSignature} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                    <Eraser className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 overflow-hidden touch-none relative">
                                {order.fimardigital && !isDrawing && (
                                    <img src={order.fimardigital} className="absolute inset-0 w-full h-full object-contain pointer-events-none opacity-50" alt="Firma guardada" />
                                )}
                                <canvas
                                    ref={canvasRef}
                                    width={600}
                                    height={300}
                                    className="w-full h-[200px]"
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseOut={stopDrawing}
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={stopDrawing}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

const InfoItem = ({ label, value }: { label: string, value: string | number }) => (
    <div className="space-y-1">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">{label}</p>
        <p className="text-sm font-black text-gray-900 truncate">{value || '---'}</p>
    </div>
);

interface ScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (result: string) => void;
}

const ScannerModal = ({ isOpen, onClose, onScan }: ScannerModalProps) => {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const regionId = "reader";

    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                scannerRef.current = new Html5Qrcode(regionId);
                const config = {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0
                };

                scannerRef.current.start(
                    { facingMode: "environment" },
                    config,
                    (decodedText: string) => {
                        onScan(decodedText);
                    },
                    () => { }
                ).catch(err => {
                    console.error("Scanner start error:", err);
                });
            }, 300);

            return () => {
                clearTimeout(timer);
                if (scannerRef.current && scannerRef.current.isScanning) {
                    scannerRef.current.stop().then(() => {
                        if (scannerRef.current) {
                            scannerRef.current.clear();
                        }
                    }).catch(err => console.error("Scanner stop error:", err));
                }
            };
        }
    }, [isOpen, onScan]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-gray-900">Escanear Medidor</h3>
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">Apunta al código de barras</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-gray-50 text-gray-400 rounded-2xl hover:bg-gray-100 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    <div id={regionId} className="w-full aspect-square rounded-[24px] overflow-hidden bg-gray-900 border-4 border-gray-50 shadow-inner relative">
                        <div className="absolute inset-0 border-2 border-blue-500/30 rounded-[20px] pointer-events-none z-10" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] border-2 border-blue-400 border-dashed rounded-3xl pointer-events-none z-10 opacity-50" />
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-scan-line z-10" />
                    </div>
                </div>

                <div className="p-6 bg-gray-50/50 flex flex-col items-center">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center mb-0">
                        Asegúrese de tener buena iluminación
                    </p>
                </div>
            </div>

            <style>{`
                @keyframes scan-line {
                    0% { top: 0%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }
                .animate-scan-line {
                    animation: scan-line 2s ease-in-out infinite;
                }
                #reader__scan_region video {
                    object-fit: cover !important;
                    border-radius: 20px;
                }
            `}</style>
        </div>
    );
};

export default OrderExecution;
