import React from 'react';
import {
    Bell,
    CheckCircle2,
    Clock,
    Info
} from 'lucide-react';
import type { AppNotification, NotificationType } from '../../types/notification';
import { cn } from '../../lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface NotificationItemProps {
    notification: AppNotification;
    onRead: (id: string) => void;
}

const getIcon = (type: NotificationType) => {
    switch (type) {
        case 'ORDER_ASSIGNED':
            return <Bell className="w-5 h-5 text-blue-500" />;
        case 'ORDER_STATUS_CHANGED':
            return <CheckCircle2 className="w-5 h-5 text-green-500" />;
        case 'REMINDER':
            return <Clock className="w-5 h-5 text-amber-500" />;
        case 'SYSTEM':
        default:
            return <Info className="w-5 h-5 text-gray-500" />;
    }
};

export const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onRead }) => {
    return (
        <div
            onClick={() => !notification.leida && onRead(notification.id)}
            className={cn(
                "flex gap-3 p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer relative",
                !notification.leida ? "bg-blue-50/50" : "bg-white"
            )}
        >
            <div className="mt-1 shrink-0">
                {getIcon(notification.tipo)}
            </div>
            <div className="flex-1 min-w-0">
                <p className={cn(
                    "text-sm font-medium text-gray-900 truncate pr-4",
                    !notification.leida && "font-bold"
                )}>
                    {notification.titulo}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {notification.mensaje}
                </p>
                <p className="text-[10px] text-gray-400 mt-1.5 capitalize">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: es })}
                </p>
            </div>
            {!notification.leida && (
                <div className="absolute right-3 top-4 w-2 h-2 bg-blue-500 rounded-full"></div>
            )}
        </div>
    );
};
