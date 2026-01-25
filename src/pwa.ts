import { registerSW } from 'virtual:pwa-register'

export function setupPWA() {
    if ('serviceWorker' in navigator) {
        registerSW({
            onNeedRefresh() {
                // We could use a custom event or a store to notify the UI
                console.log('New content available, please refresh.')
                if (window.confirm('Nueva versión disponible. ¿Desea actualizar?')) {
                    window.location.reload()
                }
            },
            onOfflineReady() {
                console.log('App ready to work offline')
            },
        })
    }
}
