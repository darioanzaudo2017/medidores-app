export type NotificationType = 'ORDER_ASSIGNED' | 'ORDER_STATUS_CHANGED' | 'SYSTEM' | 'REMINDER';

export interface AppNotification {
    id: string;
    usuario_id: string;
    tipo: NotificationType;
    titulo: string;
    mensaje: string;
    leida: boolean;
    created_at: string;
    metadata?: Record<string, unknown>;
}
