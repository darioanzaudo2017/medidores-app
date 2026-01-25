import React, { useRef, useEffect } from 'react';
import { useNotificationStore } from '../../store/useNotificationStore';
import { NotificationItem } from './NotificationItem';
import { Bell, Check } from 'lucide-react';

interface NotificationPanelProps {
    onClose: () => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ onClose }) => {
    const { notifications, markAsRead, markAllAsRead, loading } = useNotificationStore();
    const panelRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div
            ref={panelRef}
            className="absolute right-0 top-14 w-80 md:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-[9999] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-gray-500" />
                    <h3 className="text-sm font-bold text-gray-900">Notificaciones</h3>
                </div>
                {notifications.some(n => !n.leida) && (
                    <button
                        onClick={() => markAllAsRead()}
                        className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors"
                    >
                        <Check className="w-3 h-3" />
                        Marcar todo leído
                    </button>
                )}
            </div>

            {/* List */}
            <div className="max-h-[400px] overflow-y-auto">
                {loading && notifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-sm">
                        Cargando...
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                            <Bell className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-900">Sin notificaciones</p>
                        <p className="text-xs text-gray-500 mt-1">
                            Te avisaremos cuando haya novedades importantes.
                        </p>
                    </div>
                ) : (
                    notifications.map(notification => (
                        <NotificationItem
                            key={notification.id}
                            notification={notification}
                            onRead={markAsRead}
                        />
                    ))
                )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-gray-50 text-center border-t border-gray-100">
                <button
                    className="text-xs font-semibold text-gray-600 hover:text-primary transition-colors"
                    onClick={() => {
                        // Future: Navigate to full page
                        onClose();
                    }}
                >
                    Ver todas las notificaciones
                </button>
            </div>
        </div>
    );
};
