import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
}

interface ToastState {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, 'id'>) => void;
    removeToast: (id: string) => void;
    success: (title: string, message?: string, duration?: number) => void;
    error: (title: string, message?: string, duration?: number) => void;
    warning: (title: string, message?: string, duration?: number) => void;
    info: (title: string, message?: string, duration?: number) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
    toasts: [],

    addToast: (toast) => {
        const id = Math.random().toString(36).substring(7);
        const newToast = { ...toast, id };

        set((state) => ({
            toasts: [...state.toasts, newToast]
        }));

        // Auto remove after duration
        const duration = toast.duration || 5000;
        setTimeout(() => {
            get().removeToast(id);
        }, duration);
    },

    removeToast: (id) => {
        set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id)
        }));
    },

    success: (title, message, duration) => {
        get().addToast({ type: 'success', title, message, duration });
    },

    error: (title, message, duration) => {
        get().addToast({ type: 'error', title, message, duration });
    },

    warning: (title, message, duration) => {
        get().addToast({ type: 'warning', title, message, duration });
    },

    info: (title, message, duration) => {
        get().addToast({ type: 'info', title, message, duration });
    }
}));
