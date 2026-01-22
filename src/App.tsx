import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/useAuthStore'
import { MainLayout } from './layouts/MainLayout'
import { Login } from './pages/Login'
import { Orders } from './pages/Orders'
import { Users } from './pages/Users'
import { VerificationQueue } from './pages/VerificationQueue'
import { OrderDetail } from './pages/OrderDetail'
import AgentDashboard from './pages/AgentDashboard'
import OrderExecution from './pages/OrderExecution'

// Placeholder components
const Dashboard = () => (
  <div className="p-4 lg:p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
    <h1 className="text-3xl font-extrabold tracking-tight text-[#121617] dark:text-white">Panel de Control</h1>
    <p className="text-muted-foreground text-lg">Visualización general del estado de las órdenes de trabajo.</p>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 text-left">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-6 bg-white dark:bg-[#2d3238] rounded-xl border border-[#dde2e4] dark:border-white/10 shadow-sm relative overflow-hidden group">
          <div className="h-4 w-24 bg-muted rounded mb-4"></div>
          <div className="h-8 w-16 bg-primary/20 rounded"></div>
        </div>
      ))}
    </div>
  </div>
)

const Clients = () => <div className="p-8 text-left"><h1 className="text-2xl font-bold">Clientes (Próximamente)</h1></div>
const MapView = () => <div className="p-8 text-left"><h1 className="text-2xl font-bold">Mapa Real-time (Próximamente)</h1></div>
const SettingsPage = () => <div className="p-8 text-left"><h1 className="text-2xl font-bold">Configuración (Próximamente)</h1></div>

function App() {
  const setSession = useAuthStore(state => state.setSession)
  const session = useAuthStore(state => state.session)
  const isLoading = useAuthStore(state => state.isLoading)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [setSession])

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />

        <Route path="/" element={session ? <MainLayout /> : <Navigate to="/login" />}>

          <Route index element={<Dashboard />} />
          <Route path="ordenes" element={<Orders />} />
          <Route path="ordenes/:id" element={<OrderDetail />} />
          <Route path="verificacion" element={<VerificationQueue />} />
          <Route path="agente/dashboard" element={<AgentDashboard />} />
          <Route path="orden/:id/ejecutar" element={<OrderExecution />} />
          <Route path="clientes" element={<Clients />} />
          <Route path="usuarios" element={<Users />} />
          <Route path="mapa" element={<MapView />} />
          <Route path="config" element={<SettingsPage />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
