import React, { useState } from 'react';
import { useNavigate, Link, useLocation, Outlet } from 'react-router-dom';
import {
    LayoutDashboard,
    ClipboardList,
    Users,
    UserCircle,
    Settings,
    LogOut,
    Menu,
    X,
    ChevronRight,
    MapPin,
    Search,
    Bolt,
    CheckCircle
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { cn } from '../lib/utils';
import { NotificationBell } from '../components/notifications/NotificationBell';
import { ToastContainer } from '../components/toast/ToastContainer';

interface SidebarItemProps {
    icon: React.ElementType;
    label: string;
    href: string;
    active?: boolean;
    collapsed?: boolean;
}

const SidebarItem = ({ icon: Icon, label, href, active, collapsed }: SidebarItemProps) => (
    <Link
        to={href}
        className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200 group",
            active
                ? "bg-primary/10 text-primary"
                : "text-[#677c83] hover:text-primary hover:bg-primary/5"
        )}
    >
        <Icon className={cn("w-5 h-5 shrink-0", active && "fill-current")} />
        {!collapsed && <span className="text-sm font-semibold">{label}</span>}
        {active && !collapsed && <ChevronRight className="w-4 h-4 ml-auto" />}
    </Link>
);

export const MainLayout = () => {
    const [isCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const { role, user, signOut } = useAuthStore();
    const location = useLocation();
    const navigate = useNavigate();

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    const menuItems = [
        { icon: LayoutDashboard, label: 'Panel', href: '/', roles: ['Superadmin', 'Supervisor', 'Agente'] },
        { icon: ClipboardList, label: 'Órdenes', href: '/ordenes', roles: ['Superadmin', 'Supervisor'] },
        { icon: CheckCircle, label: 'Verificación', href: '/verificacion', roles: ['Superadmin', 'Supervisor'] },
        { icon: UserCircle, label: 'Clientes', href: '/clientes', roles: ['Superadmin', 'Supervisor'] },
        { icon: Users, label: 'Gestión Usuarios', href: '/usuarios', roles: ['Superadmin', 'Supervisor'] },
        { icon: MapPin, label: 'Mapa Real-time', href: '/mapa', roles: ['Superadmin', 'Supervisor'] },
        { icon: Settings, label: 'Configuración', href: '/config', roles: ['Superadmin'] },
    ];

    const filteredMenuItems = menuItems.filter(item =>
        !item.roles || item.roles.some(r => r.toLowerCase() === role?.toLowerCase())
    );

    return (
        <div className="flex h-screen bg-background-light dark:bg-background-dark overflow-hidden font-display transition-colors duration-200">
            {/* Sidebar - Desktop */}
            <aside
                className={cn(
                    "hidden lg:flex flex-col border-r border-[#dde2e4] dark:border-white/10 bg-white dark:bg-background-dark transition-all duration-300 ease-in-out",
                    isCollapsed ? "w-20" : "w-64"
                )}
            >
                <div className="p-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-primary/20">
                            <Bolt className="w-6 h-6" />
                        </div>
                        {!isCollapsed && (
                            <div className="overflow-hidden">
                                <h1 className="text-base font-bold leading-none truncate">UtilityAdmin</h1>
                                <p className="text-[#677c83] text-xs font-medium mt-1 truncate">Portal de Gestión</p>
                            </div>
                        )}
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-1 overflow-y-auto pt-2 no-scrollbar">
                    {filteredMenuItems.map((item) => (
                        <SidebarItem
                            key={item.href}
                            {...item}
                            active={location.pathname === item.href}
                            collapsed={isCollapsed}
                        />
                    ))}
                </nav>

                <div className="p-4 border-t border-[#dde2e4] dark:border-white/10 space-y-4 text-center">
                    {!isCollapsed && (
                        <div className="bg-primary/5 rounded-xl p-4 text-left">
                            <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Soporte</p>
                            <p className="text-xs text-[#677c83]">¿Necesitás ayuda con las órdenes? Contactanos.</p>
                            <button className="mt-3 text-xs font-bold text-primary flex items-center gap-1 hover:underline">
                                Ver Documentación <ChevronRight className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                    <button
                        onClick={handleSignOut}
                        className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[#677c83] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors duration-200 font-semibold text-sm",
                            isCollapsed && "justify-center px-0"
                        )}
                    >
                        <LogOut className="w-5 h-5" />
                        {!isCollapsed && <span>Cerrar Sesión</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {/* Header */}
                <header className="h-16 border-b border-[#dde2e4] dark:border-white/10 bg-white dark:bg-background-dark flex items-center justify-between px-4 lg:px-8 sticky top-0 z-20 shrink-0">
                    <div className="flex items-center gap-4 flex-1">
                        <button
                            onClick={() => setIsMobileOpen(true)}
                            className="lg:hidden p-2 text-[#677c83] hover:bg-[#f1f3f4] dark:hover:bg-white/5 rounded-lg"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <div className="relative w-full max-w-md hidden md:block text-left">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#677c83] w-4 h-4" />
                            <input
                                className="w-full pl-10 pr-4 py-2 bg-[#f1f3f4] dark:bg-white/5 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-[#677c83] outline-none"
                                placeholder="Buscar órdenes, clientes o IDs..."
                                type="text"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 lg:gap-4">
                        <NotificationBell />
                        <button className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#f1f3f4] dark:hover:bg-white/5 text-[#677c83]">
                            <Settings className="w-5 h-5" />
                        </button>
                        <div className="h-8 w-[1px] bg-[#dde2e4] dark:bg-white/10 mx-2"></div>
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-bold leading-none">{user?.email?.split('@')[0] || 'Usuario'}</p>
                                <p className="text-[10px] text-[#677c83] font-medium mt-1 uppercase tracking-wider">{role || 'Rol'}</p>
                            </div>
                            <div
                                className="w-10 h-10 rounded-full bg-primary/20 ring-2 ring-primary/20 flex items-center justify-center text-primary font-bold overflow-hidden"
                            >
                                {user?.email?.[0].toUpperCase()}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto no-scrollbar">
                    <Outlet />
                </div>
            </main>

            {/* Mobile Sidebar Overlay */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 z-50 bg-[#121617]/40 backdrop-blur-sm lg:hidden"
                    onClick={() => setIsMobileOpen(false)}
                >
                    <div
                        className="fixed inset-y-0 left-0 w-[280px] bg-card border-r p-6 shadow-xl animate-in slide-in-from-left duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white">
                                    <Bolt className="w-6 h-6" />
                                </div>
                                <div>
                                    <h1 className="text-base font-bold leading-none">UtilityAdmin</h1>
                                    <p className="text-[#677c83] text-xs font-medium mt-1">Portal de Gestión</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsMobileOpen(false)}
                                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <nav className="space-y-1">
                            {filteredMenuItems.map((item) => (
                                <SidebarItem
                                    key={item.href}
                                    {...item}
                                    active={location.pathname === item.href}
                                    collapsed={false}
                                />
                            ))}
                        </nav>
                    </div>
                </div>
            )}

            {/* Toast Container */}
            <ToastContainer />
        </div>
    );
};
