import React from 'react';
import { useToastStore, type Toast as ToastType } from '../../store/useToastStore';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';

const iconMap = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertTriangle,
    info: Info
};

const colorMap = {
    success: {
        bg: 'bg-green-50 dark:bg-green-950/30',
        border: 'border-green-200 dark:border-green-800',
        icon: 'text-green-600 dark:text-green-400',
        iconBg: 'bg-green-500',
        title: 'text-green-900 dark:text-green-100',
        message: 'text-green-700 dark:text-green-300'
    },
    error: {
        bg: 'bg-red-50 dark:bg-red-950/30',
        border: 'border-red-200 dark:border-red-800',
        icon: 'text-red-600 dark:text-red-400',
        iconBg: 'bg-red-500',
        title: 'text-red-900 dark:text-red-100',
        message: 'text-red-700 dark:text-red-300'
    },
    warning: {
        bg: 'bg-orange-50 dark:bg-orange-950/30',
        border: 'border-orange-200 dark:border-orange-800',
        icon: 'text-orange-600 dark:text-orange-400',
        iconBg: 'bg-orange-500',
        title: 'text-orange-900 dark:text-orange-100',
        message: 'text-orange-700 dark:text-orange-300'
    },
    info: {
        bg: 'bg-blue-50 dark:bg-blue-950/30',
        border: 'border-blue-200 dark:border-blue-800',
        icon: 'text-blue-600 dark:text-blue-400',
        iconBg: 'bg-blue-500',
        title: 'text-blue-900 dark:text-blue-100',
        message: 'text-blue-700 dark:text-blue-300'
    }
};

interface ToastItemProps {
    toast: ToastType;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast }) => {
    const { removeToast } = useToastStore();
    const Icon = iconMap[toast.type];
    const colors = colorMap[toast.type];

    return (
        <div
            className={cn(
                'flex items-start gap-3 p-4 rounded-xl border-2 shadow-lg backdrop-blur-sm animate-in slide-in-from-right-full fade-in duration-300',
                colors.bg,
                colors.border
            )}
        >
            <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-xl', colors.iconBg, 'shadow-' + toast.type + '-500/20')}>
                <Icon className="w-5 h-5 text-white" />
            </div>

            <div className="flex-1 min-w-0">
                <h4 className={cn('text-sm font-bold', colors.title)}>
                    {toast.title}
                </h4>
                {toast.message && (
                    <p className={cn('text-xs mt-1 font-medium', colors.message)}>
                        {toast.message}
                    </p>
                )}
            </div>

            <button
                onClick={() => removeToast(toast.id)}
                className={cn(
                    'flex-shrink-0 w-6 h-6 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center transition-colors',
                    colors.icon
                )}
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};

export const ToastContainer: React.FC = () => {
    const { toasts } = useToastStore();

    return (
        <div className="fixed top-4 right-4 z-[10000] flex flex-col gap-3 max-w-md w-full pointer-events-none">
            <div className="pointer-events-auto space-y-3">
                {toasts.map((toast) => (
                    <ToastItem key={toast.id} toast={toast} />
                ))}
            </div>
        </div>
    );
};
