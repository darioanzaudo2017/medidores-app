import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { AppNotification } from '../types/notification';
import { useAuthStore } from './useAuthStore';

interface NotificationState {
    notifications: AppNotification[];
    unreadCount: number;
    loading: boolean;
    initialized: boolean;

    // Actions
    fetchNotifications: () => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    addNotification: (notification: AppNotification) => void;
    subscribeToNotifications: () => Promise<() => void>;
    unsubscribeFromNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
    notifications: [],
    unreadCount: 0,
    loading: false,
    initialized: false,

    fetchNotifications: async () => {
        const user = useAuthStore.getState().user;
        if (!user) return;

        set({ loading: true });
        try {
            // Primero obtener el ID de t_usuarios usando auth_user_id
            const { data: userData, error: userError } = await supabase
                .from('t_usuarios')
                .select('id')
                .eq('auth_user_id', user.id)
                .single();

            if (userError || !userData) {
                console.error('Error fetching user ID:', userError);
                set({ loading: false });
                return;
            }

            // Ahora buscar notificaciones con el ID correcto
            const { data, error } = await supabase
                .from('t_notificaciones')
                .select('*')
                .eq('usuario_id', userData.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            const notifications = data as AppNotification[];
            const unreadCount = notifications.filter(n => !n.leida).length;

            set({ notifications, unreadCount, initialized: true });
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            set({ loading: false });
        }
    },

    markAsRead: async (id: string) => {
        // Optimistic update
        set(state => {
            const notifications = state.notifications.map(n =>
                n.id === id ? { ...n, leida: true } : n
            );
            const unreadCount = notifications.filter(n => !n.leida).length;
            return { notifications, unreadCount };
        });

        try {
            await supabase
                .from('t_notificaciones')
                .update({ leida: true })
                .eq('id', id);
        } catch (error) {
            console.error('Error marking notification as read:', error);
            // Revert on error could be implemented here
        }
    },

    markAllAsRead: async () => {
        const user = useAuthStore.getState().user;
        if (!user) return;

        // Optimistic update
        set(state => ({
            notifications: state.notifications.map(n => ({ ...n, leida: true })),
            unreadCount: 0
        }));

        try {
            await supabase
                .from('t_notificaciones')
                .update({ leida: true })
                .eq('usuario_id', user.id)
                .eq('leida', false);
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    },

    addNotification: (notification: AppNotification) => {
        set(state => {
            // Evitar duplicados si vienen del realtime y fetch simultáneo
            if (state.notifications.some(n => n.id === notification.id)) return state;

            const newNotifications = [notification, ...state.notifications];
            return {
                notifications: newNotifications,
                unreadCount: state.unreadCount + 1
            };
        });

        // Opcional: Reproducir sonido
        try {
            const audio = new Audio('/notification-sound.mp3'); // Necesitarás agregar este archivo a public/
            audio.play().catch(() => { }); // Ignorar error de autoplay
        } catch {
            // Ignorar error de audio
        }
    },

    subscribeToNotifications: async () => {
        const user = useAuthStore.getState().user;
        if (!user) return () => { };

        try {
            // Obtener el ID de t_usuarios usando auth_user_id
            const { data: userData, error: userError } = await supabase
                .from('t_usuarios')
                .select('id')
                .eq('auth_user_id', user.id)
                .single();

            if (userError || !userData) {
                console.error('Error fetching user ID for subscription:', userError);
                return () => { };
            }

            const channel = supabase
                .channel('public:t_notificaciones')
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 't_notificaciones',
                        filter: `usuario_id=eq.${userData.id}`
                    },
                    (payload) => {
                        const newNotification = payload.new as AppNotification;
                        get().addNotification(newNotification);
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        } catch (error) {
            console.error('Error subscribing to notifications:', error);
            return () => { };
        }
    },

    unsubscribeFromNotifications: () => {
        supabase.removeAllChannels();
    }
}));
