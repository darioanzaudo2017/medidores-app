# Sistema Unificado de Toasts

Este documento explica cómo usar el nuevo sistema de toasts para reemplazar los `alert()` nativos del navegador.

## 🎨 Características

- **4 tipos de toasts**: success, error, warning, info
- **Diseño coherente** con la estética de la aplicación
- **Animaciones suaves** de entrada y salida
- **Auto-dismiss** configurable
- **Posicionamiento fijo** en la esquina superior derecha
- **Apilamiento** de múltiples toasts

## 📦 Uso Básico

### 1. Importar el hook

```tsx
import { useToast } from '../hooks/useToast';
```

### 2. Usar en el componente

```tsx
const MyComponent = () => {
    const toast = useToast();

    const handleSuccess = () => {
        toast.success('¡Operación exitosa!', 'Los cambios se guardaron correctamente');
    };

    const handleError = () => {
        toast.error('Error al guardar', 'Por favor intenta nuevamente');
    };

    const handleWarning = () => {
        toast.warning('Atención', 'Algunos campos están incompletos');
    };

    const handleInfo = () => {
        toast.info('Información', 'Esta acción puede tardar unos segundos');
    };

    return (
        <button onClick={handleSuccess}>Guardar</button>
    );
};
```

## 🔄 Reemplazar alerts existentes

### Antes (alert nativo)
```tsx
alert('Error al subir el archivo: ' + error.message);
```

### Después (toast)
```tsx
toast.error('Error al subir archivo', error.message);
```

### Antes (alert de éxito)
```tsx
alert('✅ Primera visita registrada. Se programó segunda visita para: ' + fecha);
```

### Después (toast)
```tsx
toast.success('Primera visita registrada', `Se programó segunda visita para: ${fecha}`);
```

### Antes (alert de validación)
```tsx
alert('Por favor completa la inspección o selecciona un motivo de cierre');
```

### Después (toast)
```tsx
toast.warning('Campos incompletos', 'Por favor completa la inspección o selecciona un motivo de cierre');
```

## 🎯 Parámetros

Cada método acepta los siguientes parámetros:

```tsx
toast.success(
    title: string,           // Título del toast (requerido)
    message?: string,        // Mensaje detallado (opcional)
    duration?: number        // Duración en ms (opcional, default: 5000)
);
```

### Ejemplo con duración personalizada

```tsx
// Toast que dura 10 segundos
toast.info('Procesando...', 'Esta operación puede tardar varios minutos', 10000);

// Toast que dura 3 segundos
toast.success('¡Listo!', undefined, 3000);
```

## 📝 Guía de Migración

### Archivos a actualizar

1. **OrderExecution.tsx** ✅ (ya tiene el import)
   - Línea 272: Error al subir archivo
   - Línea 302: Error al eliminar
   - Línea 348: Validación de inspección
   - Línea 354: Validación de fecha
   - Línea 382: Validación de firma
   - Línea 429: Éxito de primera visita
   - Línea 436: Error al finalizar

2. **OrderDetail.tsx**
   - Línea 142: Validación de confirmación
   - Línea 175: Error al actualizar estado
   - Línea 206: Error al eliminar
   - Línea 623: Validación de observación

3. **VerificationQueue.tsx**
   - Línea 201: No hay datos para exportar
   - Línea 224: No se encontraron datos
   - Línea 235: Error al exportar

4. **Orders.tsx**
   - Línea 197: Error al asignar órdenes

## 🎨 Tipos de Toast y Cuándo Usarlos

### ✅ Success (Verde)
- Operaciones completadas exitosamente
- Guardado de datos
- Asignaciones exitosas
- Confirmaciones

```tsx
toast.success('Orden asignada', 'La orden se asignó correctamente al agente');
```

### ❌ Error (Rojo)
- Errores de red
- Errores de validación del servidor
- Operaciones fallidas
- Errores inesperados

```tsx
toast.error('Error al guardar', 'No se pudo conectar con el servidor');
```

### ⚠️ Warning (Naranja)
- Validaciones de formulario
- Campos faltantes
- Advertencias antes de acciones
- Datos incompletos

```tsx
toast.warning('Campos requeridos', 'Por favor completa todos los campos obligatorios');
```

### ℹ️ Info (Azul)
- Información general
- Procesos en curso
- Consejos y sugerencias
- Notificaciones informativas

```tsx
toast.info('Procesando', 'La exportación puede tardar unos minutos');
```

## 🚀 Ejemplo Completo

```tsx
import React from 'react';
import { useToast } from '../hooks/useToast';
import { supabase } from '../lib/supabase';

export const MyForm = () => {
    const toast = useToast();

    const handleSubmit = async (data: FormData) => {
        // Validación
        if (!data.name) {
            toast.warning('Campo requerido', 'El nombre es obligatorio');
            return;
        }

        // Información de proceso
        toast.info('Guardando...', 'Por favor espera');

        try {
            const { error } = await supabase
                .from('table')
                .insert(data);

            if (error) throw error;

            // Éxito
            toast.success('¡Guardado!', 'Los datos se guardaron correctamente');
            
        } catch (error: any) {
            // Error
            toast.error('Error al guardar', error.message);
        }
    };

    return <form onSubmit={handleSubmit}>...</form>;
};
```

## 🎯 Beneficios

1. **Consistencia visual** - Todos los mensajes tienen el mismo estilo
2. **Mejor UX** - No bloquean la interfaz como `alert()`
3. **Más información** - Permiten título + mensaje detallado
4. **Apilamiento** - Múltiples toasts pueden aparecer simultáneamente
5. **Accesibilidad** - Mejor para lectores de pantalla
6. **Personalización** - Duración configurable por toast

## 📌 Notas Importantes

- El `ToastContainer` ya está agregado en `MainLayout.tsx`
- Los toasts se auto-eliminan después de 5 segundos (configurable)
- Se pueden mostrar múltiples toasts al mismo tiempo
- Los toasts más nuevos aparecen arriba
- El z-index es 10000 para estar sobre todo el contenido
