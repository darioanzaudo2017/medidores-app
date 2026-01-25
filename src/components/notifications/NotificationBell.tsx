import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNotificationStore } from '../../store/useNotificationStore';
import { NotificationPanel } from './NotificationPanel';
import { cn } from '../../lib/utils'; // Adjust path if needed

export const NotificationBell: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const {
        unreadCount,
        fetchNotifications,
        subscribeToNotifications,
        initialized
    } = useNotificationStore();

    // Init store on mount
    useEffect(() => {
        if (!initialized) {
            fetchNotifications();

            // Suscribirse a notificaciones en tiempo real
            let unsubscribe: (() => void) | undefined;
            subscribeToNotifications().then((unsub) => {
                unsubscribe = unsub;
            });

            return () => {
                if (unsubscribe) unsubscribe();
            };
        }
    }, [initialized, fetchNotifications, subscribeToNotifications]);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 relative",
                    isOpen
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-[#f1f3f4] dark:hover:bg-white/5 text-[#677c83]"
                )}
                aria-label="Notificaciones"
            >
                <Bell className={cn("w-5 h-5", isOpen && "fill-current")} />

                {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border-2 border-white dark:border-[#121617]"></span>
                    </span>
                )}
            </button>

            {isOpen && (
                <NotificationPanel onClose={() => setIsOpen(false)} />
            )}
        </div>
    );
};
