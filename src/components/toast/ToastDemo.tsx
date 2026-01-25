import React from 'react';
import { useToast } from '../../hooks/useToast';

/**
 * Componente de demostración para probar los toasts
 * Puedes agregarlo temporalmente a cualquier página para ver cómo funcionan
 */
export const ToastDemo: React.FC = () => {
    const toast = useToast();

    return (
        <div className="fixed bottom-4 left-4 z-[9999] bg-white dark:bg-gray-800 p-4 rounded-xl shadow-xl border-2 border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-bold mb-3 text-gray-900 dark:text-white">Toast Demo</h3>
            <div className="flex flex-col gap-2">
                <button
                    onClick={() => toast.success('¡Operación exitosa!', 'Los cambios se guardaron correctamente')}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                    Success Toast
                </button>
                <button
                    onClick={() => toast.error('Error al guardar', 'No se pudo conectar con el servidor')}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                    Error Toast
                </button>
                <button
                    onClick={() => toast.warning('Campos incompletos', 'Por favor completa todos los campos obligatorios')}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                    Warning Toast
                </button>
                <button
                    onClick={() => toast.info('Procesando...', 'Esta operación puede tardar unos minutos')}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                    Info Toast
                </button>
            </div>
        </div>
    );
};
