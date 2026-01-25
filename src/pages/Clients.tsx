import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
    Download,
    Upload,
    Search,
    ChevronLeft,
    ChevronRight,
    Plus,
    FileSpreadsheet,
    AlertCircle,
    CheckCircle,
    X
} from 'lucide-react';
import { cn } from '../lib/utils';

// Basic CSV Columns expected by the backend
const CSV_COLUMNS = [
    'cuenta_contrato', 'nombre_cliente', 'calle', 'numero', 'piso', 'depto',
    'barrio', 'localidad', 'ruta', 'medidor', 'lectura', 'lote', 'telefono',
    'latitud', 'longitud', 'orden', 'hora_cumplimiento', 'fecha_visita',
    'hora_visita', 'cepo', 'punto_suministro', 'caudal_existente',
    'caudal_nuevo', 'verificar_caudal', 'interloc_comercial'
];

interface Client {
    id: string;
    cuenta_contrato: string;
    nombre_cliente: string;
    calle: string;
    numero: string;
    piso: string;
    depto: string;
    barrio: string;
    localidad: string;
    medidor: string;
}

export const Clients = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importLoading, setImportLoading] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importResults, setImportResults] = useState<{ total: number, ok: number, err: number, first_error: string | null } | null>(null);

    const pageSize = 10;

    const fetchClients = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('t_clientes')
                .select('*', { count: 'exact' });

            if (searchTerm) {
                query = query.or(`nombre_cliente.ilike.%${searchTerm}%,cuenta_contrato.ilike.%${searchTerm}%,calle.ilike.%${searchTerm}%`);
            }

            const { data, count, error } = await query
                .range((currentPage - 1) * pageSize, currentPage * pageSize - 1)
                .order('nombre_cliente', { ascending: true });

            if (error) throw error;
            setClients(data || []);
            setTotalPages(Math.ceil((count || 0) / pageSize));
        } catch (err) {
            console.error('Error fetching clients:', err);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, currentPage, pageSize]);

    useEffect(() => {
        const timer = setTimeout(fetchClients, 400);
        return () => clearTimeout(timer);
    }, [fetchClients]);

    const handleDownloadTemplate = () => {
        const templateUrl = 'https://qtfivfifskeagrfsgyav.supabase.co/storage/v1/object/public/template_carga_clientelote/Copia_de_JMEZA0000128210.csv';
        window.open(templateUrl, '_blank');
    };

    const handleImportFile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!importFile) return;

        setImportLoading(true);
        setImportResults(null);

        try {
            // Read as ArrayBuffer to handle encoding manually
            const buffer = await importFile.arrayBuffer();

            // Try UTF-8 first
            let decoder = new TextDecoder('utf-8', { fatal: true });
            let text = '';
            try {
                text = decoder.decode(buffer);
            } catch {
                // If UTF-8 fails (e.g. contains invalid bytes for UTF-8 like Excel's Windows-1252), 
                // use Windows-1252 which is common for Spanish Excel CSVs
                decoder = new TextDecoder('windows-1252');
                text = decoder.decode(buffer);
            }

            const lines = text.split(/\r?\n/);
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

            const rows = lines.slice(1)
                .filter(line => line.trim() !== '')
                .map(line => {
                    const values = line.split(',').map(v => v.trim());
                    const obj: Record<string, string | null> = {};
                    headers.forEach((header, index) => {
                        obj[header] = values[index] || null;
                    });
                    // Only keep keys that are in CSV_COLUMNS
                    const cleanObj: Record<string, unknown> = { procesado: false };
                    CSV_COLUMNS.forEach(col => {
                        cleanObj[col] = obj[col] || null;
                    });
                    return cleanObj;
                });

            // 1. Bulk insert into temp_carga_csv
            const { error: insertError } = await supabase
                .from('temp_carga_csv')
                .insert(rows);

            if (insertError) throw insertError;

            // 2. Call RPC
            const { data: rpcData, error: rpcError } = await supabase
                .rpc('procesar_temp_carga_csv');

            if (rpcError) throw rpcError;

            // RPC returns v_total, v_ok, v_err, v_primer_error
            if (rpcData && rpcData.length > 0) {
                setImportResults({
                    total: rpcData[0].v_total,
                    ok: rpcData[0].v_ok,
                    err: rpcData[0].v_err,
                    first_error: rpcData[0].v_primer_error
                });
            }

            // Refresh client list
            fetchClients();
        } catch (err: unknown) {
            const error = err as Error;
            console.error('Error during import:', error);
            setImportResults({
                total: 0,
                ok: 0,
                err: 1,
                first_error: error.message || 'Error desconocido durante la importación.'
            });
        } finally {
            setImportLoading(false);
        }
    };

    return (
        <div className="p-4 lg:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
            <div className="flex flex-wrap justify-between items-end gap-4">
                <div className="space-y-1">
                    <h2 className="text-[#111818] dark:text-white text-3xl font-black tracking-tight">Gestión de Clientes</h2>
                    <p className="text-[#618789] text-base font-medium">Administre la base de datos de usuarios y cargue nuevos lotes de trabajo.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="flex items-center gap-2 px-6 py-2 bg-primary rounded-lg text-sm font-black text-[#111818] hover:bg-primary/80 transition-all shadow-md active:scale-95"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        Importar Lote (CSV)
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#1a2e2f] border border-[#dbe5e6] dark:border-[#2d4546] rounded-lg text-sm font-bold text-[#111818] dark:text-white hover:bg-background-light transition-colors shadow-sm">
                        <Plus className="w-4 h-4" />
                        Nuevo Cliente
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-[#1a2e2f] p-4 rounded-xl border border-[#dbe5e6] dark:border-[#2d4546] shadow-sm">
                <div className="max-w-md relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#618789] w-4 h-4" />
                    <input
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        placeholder="Buscar por nombre, contrato o dirección..."
                        className="w-full pl-10 pr-4 py-2.5 bg-[#f1f3f4] dark:bg-white/5 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none font-medium"
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-[#1a2e2f] rounded-2xl border border-[#dbe5e6] dark:border-[#2d4546] shadow-xl shadow-black/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-[#f9fafa] dark:bg-white/[0.02] border-b border-[#dbe5e6] dark:border-[#2d4546]">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-black text-[#618789] uppercase tracking-widest">Cuenta Contrato</th>
                                <th className="px-6 py-4 text-[10px] font-black text-[#618789] uppercase tracking-widest">Nombre del Cliente</th>
                                <th className="px-6 py-4 text-[10px] font-black text-[#618789] uppercase tracking-widest">Dirección</th>
                                <th className="px-6 py-4 text-[10px] font-black text-[#618789] uppercase tracking-widest">Medidor Actual</th>
                                <th className="px-6 py-4 text-[10px] font-black text-[#618789] uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#dbe5e6] dark:divide-[#2d4546]">
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={5} className="px-6 py-8"><div className="h-4 bg-gray-100 dark:bg-white/5 rounded w-full"></div></td>
                                    </tr>
                                ))
                            ) : clients.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <AlertCircle className="w-10 h-10 text-gray-300" />
                                            <p className="text-sm font-bold text-[#618789]">No se encontraron clientes en la base de datos.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                clients.map((client) => (
                                    <tr key={client.id} className="hover:bg-primary/[0.02] transition-colors group">
                                        <td className="px-6 py-5">
                                            <span className="text-sm font-black text-[#111818] dark:text-white tabular-nums tracking-wider">{client.cuenta_contrato}</span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="size-8 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 font-black text-[10px]">
                                                    {client.nombre_cliente?.[0] || 'C'}
                                                </div>
                                                <span className="text-sm font-bold text-[#111818] dark:text-white">{client.nombre_cliente}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-sm font-medium text-[#618789]">
                                            {client.calle} {client.numero}, {client.localidad}
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="text-xs font-mono font-black py-1 px-2 bg-[#f1f3f4] dark:bg-white/5 rounded-md text-slate-700 dark:text-slate-300">
                                                {client.medidor || '---'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <button className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">Ver Historial</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-6 bg-[#f9fafa] dark:bg-white/[0.02] border-t border-[#dbe5e6] dark:border-[#2d4546] flex items-center justify-between">
                    <p className="text-[10px] font-black text-[#618789] uppercase tracking-widest tabular-nums">
                        Total en base: {totalPages * pageSize} registros aprox.
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
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => p + 1)}
                            className="p-2 border border-[#dbe5e6] dark:border-[#2d4546] rounded-lg disabled:opacity-30 hover:bg-white dark:hover:bg-white/5 transition-colors"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#121617]/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-[#1a2e2f] w-full max-w-xl rounded-[2.5rem] border border-[#dbe5e6] dark:border-[#2d4546] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-[#f1f3f4] dark:border-white/5 flex justify-between items-center bg-[#f9fafa] dark:bg-white/[0.02]">
                            <div>
                                <h3 className="text-xl font-black text-[#111818] dark:text-white">Importar Lote de Clientes</h3>
                                <p className="text-xs text-[#618789] font-medium mt-1">Carga masiva de puntos de medición y generación de órdenes.</p>
                            </div>
                            <button onClick={() => { setShowImportModal(false); setImportResults(null); }} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-8">
                            {!importResults ? (
                                <form onSubmit={handleImportFile} className="space-y-6">
                                    <div className="bg-blue-50/50 dark:bg-blue-500/5 p-6 rounded-2xl border border-blue-100 dark:border-blue-500/20">
                                        <div className="flex items-center gap-4">
                                            <div className="size-12 rounded-2xl bg-white dark:bg-white/5 shadow-sm flex items-center justify-center text-blue-600">
                                                <Download className="w-6 h-6" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-black text-[#111818] dark:text-white">1. Descarga la plantilla</p>
                                                <p className="text-xs text-[#618789] font-medium">Usa este archivo para asegurar que las columnas sean correctas.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleDownloadTemplate}
                                                className="px-4 py-2 bg-white dark:bg-white/10 border border-blue-200 dark:border-blue-500/20 rounded-xl text-[10px] font-black uppercase text-blue-600 hover:bg-blue-50 transition-colors"
                                            >
                                                Descargar .CSV
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <p className="text-sm font-black text-[#111818] dark:text-white">2. Sube tu archivo con datos</p>
                                        <div
                                            className={cn(
                                                "border-4 border-dashed rounded-[2rem] p-10 flex flex-col items-center justify-center text-center transition-all",
                                                importFile ? "border-primary bg-primary/5" : "border-[#f1f3f4] dark:border-white/5 hover:border-primary/30"
                                            )}
                                        >
                                            <Upload className={cn("w-12 h-12 mb-4", importFile ? "text-primary" : "text-[#618789]")} />
                                            <input
                                                type="file"
                                                accept=".csv"
                                                id="csv-upload"
                                                className="hidden"
                                                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                                            />
                                            <label htmlFor="csv-upload" className="cursor-pointer">
                                                <span className="text-sm font-black text-primary block mb-1 underline underline-offset-4">
                                                    {importFile ? importFile.name : 'Haz clic para seleccionar archivo'}
                                                </span>
                                                <span className="text-[10px] font-bold text-[#618789]">Solo archivos .CSV son permitidos</span>
                                            </label>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={importLoading || !importFile}
                                        className="w-full py-4 bg-primary text-[#111818] rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {importLoading ? 'Procesando Lote...' : 'Comenzar Importación y Generar Órdenes'}
                                    </button>
                                </form>
                            ) : (
                                <div className="space-y-8 animate-in zoom-in-95 duration-300">
                                    <div className="flex flex-col items-center justify-center text-center py-6">
                                        {importResults.err === 0 ? (
                                            <div className="size-20 rounded-[2rem] bg-green-100 flex items-center justify-center text-green-600 mb-6 shadow-lg shadow-green-500/10">
                                                <CheckCircle className="w-10 h-10" />
                                            </div>
                                        ) : (
                                            <div className="size-20 rounded-[2rem] bg-orange-100 flex items-center justify-center text-orange-600 mb-6 shadow-lg shadow-orange-500/10">
                                                <AlertCircle className="w-10 h-10" />
                                            </div>
                                        )}
                                        <h4 className="text-2xl font-black text-[#111818] dark:text-white">Procesamiento Finalizado</h4>
                                        <p className="text-[#618789] font-medium max-w-sm mt-2">
                                            Se han procesado un total de <span className="text-primary font-black">{importResults.total}</span> registros del archivo.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-6 bg-green-50/50 dark:bg-green-500/5 rounded-2xl border border-green-100 dark:border-green-500/20 text-center">
                                            <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Cargas Exitosas</p>
                                            <p className="text-3xl font-black text-green-700">{importResults.ok}</p>
                                        </div>
                                        <div className="p-6 bg-red-50/50 dark:bg-red-500/5 rounded-2xl border border-red-100 dark:border-red-500/20 text-center">
                                            <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Errores</p>
                                            <p className="text-3xl font-black text-red-700">{importResults.err}</p>
                                        </div>
                                    </div>

                                    {importResults.first_error && (
                                        <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                                            <p className="text-[9px] font-black text-[#618789] uppercase tracking-widest mb-2">Detalle del Primer Error</p>
                                            <p className="text-xs font-mono font-bold text-red-500 leading-relaxed italic">
                                                "{importResults.first_error}"
                                            </p>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => { setShowImportModal(false); setImportResults(null); }}
                                        className="w-full py-4 bg-[#111818] dark:bg-white text-white dark:text-[#111818] rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95"
                                    >
                                        Cerrar y Ver Resultados
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
