import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
    Search,
    Download,
    UserPlus,
    Filter,
    ChevronDown,
    RotateCw,
    UserCheck,
    Clock,
    ChevronLeft,
    ChevronRight,
    MoreHorizontal
} from 'lucide-react';
import { cn } from '../lib/utils';

interface UserRole {
    usuario_id: string;
    nombre_usuario: string;
    email: string;
    telefono: string;
    rol: string;
    activo: boolean;
    legajo?: string;
}

export const Users = () => {
    const [users, setUsers] = useState<UserRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [stats, setStats] = useState({
        total: 0,
        agents: 0,
        pending: 12, // Placeholder from template
        systemLoad: 24 // Placeholder from template
    });

    const fetchUsers = async () => {
        setLoading(true);
        try {
            // We use the view vt_usuarios_roles which also should include legajo if we updated it, 
            // but let's check t_usuarios join to be safe and get all fields.
            const { data, error } = await supabase
                .from('t_usuarios')
                .select(`
                    id,
                    nombre,
                    apellido,
                    email,
                    telefono,
                    legajo,
                    activo,
                    t_tipos_usuario (nombre)
                `)
                .order('nombre');

            if (error) throw error;

            const formattedUsers: UserRole[] = (data as any[]).map(u => ({
                usuario_id: u.id,
                nombre_usuario: `${u.nombre} ${u.apellido}`,
                email: u.email,
                telefono: u.telefono,
                rol: u.t_tipos_usuario?.nombre || 'UNSET',
                activo: u.activo,
                legajo: u.legajo
            }));

            setUsers(formattedUsers);

            // Calculate real stats
            setStats(prev => ({
                ...prev,
                total: formattedUsers.length,
                agents: formattedUsers.filter(u => u.rol.toUpperCase() === 'AGENTE').length
            }));

        } catch (err) {
            console.error('Error fetching users:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('t_usuarios')
                .update({ activo: !currentStatus })
                .eq('id', userId);

            if (error) throw error;

            // Update local state
            setUsers(prev => prev.map(u =>
                u.usuario_id === userId ? { ...u, activo: !currentStatus } : u
            ));
        } catch (err) {
            console.error('Error toggling status:', err);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const filteredUsers = users.filter(u =>
        u.nombre_usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.legajo?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 lg:p-10 space-y-8 animate-in fade-in duration-500 text-left">
            {/* Page Heading & Actions */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black tracking-tight text-[#121617] dark:text-white">Users</h1>
                    <p className="text-[#688182] dark:text-gray-400 font-medium flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary"></span>
                        {stats.total.toLocaleString()} Total Staff Members
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#2d3238] border border-[#dde3e4] dark:border-white/10 rounded-xl font-bold text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-all">
                        <Download className="w-5 h-5" />
                        Export CSV
                    </button>
                    <button className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all">
                        <UserPlus className="w-5 h-5" />
                        Add User
                    </button>
                </div>
            </div>

            {/* Filter & Search Bar Section */}
            <div className="bg-white dark:bg-[#2d3238] border border-[#dde2e4] dark:border-white/10 rounded-2xl p-4 shadow-sm">
                <div className="flex flex-col xl:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-[#f1f4f4] dark:bg-white/5 border-none rounded-xl text-base focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                            placeholder="Search by name, email, or legajo (Staff ID)..."
                            type="text"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <button className="flex items-center gap-2 px-4 py-3 bg-[#f1f4f4] dark:bg-white/5 rounded-xl text-sm font-semibold hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                            <Filter className="text-gray-500 w-4 h-4" />
                            All User Types
                            <ChevronDown className="w-4 h-4" />
                        </button>
                        <button className="flex items-center gap-2 px-4 py-3 bg-[#f1f4f4] dark:bg-white/5 rounded-xl text-sm font-semibold hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                            <Activity className="text-gray-500 w-4 h-4" />
                            Status: All
                            <ChevronDown className="w-4 h-4" />
                        </button>
                        <div className="h-10 w-[1px] bg-gray-200 dark:bg-white/10 mx-2 hidden xl:block"></div>
                        <button
                            onClick={fetchUsers}
                            className="p-3 text-[#688182] hover:text-primary transition-colors"
                        >
                            <RotateCw className={cn("w-5 h-5", loading && "animate-spin")} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Data Table Container */}
            <div className="bg-white dark:bg-[#2d3238] border border-[#dde2e4] dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-white/2 border-b border-[#dde2e4] dark:border-white/10">
                                <th className="px-6 py-4 text-xs font-extrabold text-[#688182] uppercase tracking-widest">User Details</th>
                                <th className="px-6 py-4 text-xs font-extrabold text-[#688182] uppercase tracking-widest">Staff ID (Legajo)</th>
                                <th className="px-6 py-4 text-xs font-extrabold text-[#688182] uppercase tracking-widest">Contact</th>
                                <th className="px-6 py-4 text-xs font-extrabold text-[#688182] uppercase tracking-widest">Role</th>
                                <th className="px-6 py-4 text-xs font-extrabold text-[#688182] uppercase tracking-widest text-center">Status</th>
                                <th className="px-6 py-4 text-xs font-extrabold text-[#688182] uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#dde2e4] dark:divide-white/10">
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="px-6 py-5 border-b"><div className="h-12 bg-gray-100 dark:bg-white/5 rounded-xl w-full"></div></td>
                                    </tr>
                                ))
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center text-gray-500">No users found matching your search.</td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user.usuario_id} className="hover:bg-gray-50 dark:hover:bg-white/2 transition-colors">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className={cn(
                                                    "size-10 rounded-full flex items-center justify-center font-bold",
                                                    user.rol.toUpperCase() === 'SUPERADMIN' ? "bg-[#C06BE1]/20 text-[#C06BE1]" :
                                                        user.rol.toUpperCase() === 'SUPERVISOR' ? "bg-[#CCE16B]/20 text-[#CCE16B]" :
                                                            "bg-primary/20 text-primary"
                                                )}>
                                                    {user.nombre_usuario.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-[#121617] dark:text-white capitalize">{user.nombre_usuario}</p>
                                                    <p className="text-sm text-[#688182] dark:text-gray-400">{user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="font-mono text-sm bg-gray-100 dark:bg-white/5 px-2 py-1 rounded-lg text-gray-700 dark:text-gray-300 border border-[#dde2e4] dark:border-white/10 uppercase">
                                                {user.legajo || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{user.telefono || 'No phone'}</p>
                                        </td>
                                        <td className="px-6 py-5">
                                            <RoleBadge role={user.rol} />
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    checked={user.activo}
                                                    onChange={() => toggleUserStatus(user.usuario_id, user.activo)}
                                                    className="sr-only peer"
                                                    type="checkbox"
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#3D9B3D]"></div>
                                            </label>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <button className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl text-gray-400 transition-colors">
                                                <MoreHorizontal className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#dde2e4] dark:border-white/10 bg-gray-50 dark:bg-white/2">
                    <p className="text-sm font-medium text-[#688182] dark:text-gray-400">
                        Showing <span className="text-[#121617] dark:text-white">1 - {filteredUsers.length}</span> of <span className="text-[#121617] dark:text-white">{stats.total}</span> users
                    </p>
                    <div className="flex items-center gap-2">
                        <button className="p-2 rounded-xl border border-[#dde2e4] dark:border-white/10 bg-white dark:bg-white/5 text-gray-500 hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-50" disabled>
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/20">1</button>
                        {/* More pages placeholders if needed */}
                        <button className="p-2 rounded-xl border border-[#dde2e4] dark:border-white/10 bg-white dark:bg-white/5 text-gray-500 hover:bg-gray-50 dark:hover:bg-white/10">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Utility Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-primary/5 dark:bg-primary/10 p-6 rounded-2xl border border-primary/20 transition-transform hover:scale-[1.02]">
                    <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Active Agents</p>
                    <div className="flex items-center justify-between">
                        <h3 className="text-3xl font-black text-[#121617] dark:text-white">{stats.agents}</h3>
                        <UserCheck className="w-8 h-8 text-primary opacity-50" />
                    </div>
                </div>
                <div className="bg-gray-100/50 dark:bg-white/5 p-6 rounded-2xl border border-[#dde2e4] dark:border-white/10 transition-transform hover:scale-[1.02]">
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Pending Verification</p>
                    <div className="flex items-center justify-between">
                        <h3 className="text-3xl font-black text-[#121617] dark:text-white">{stats.pending}</h3>
                        <Clock className="w-8 h-8 text-gray-400 opacity-50" />
                    </div>
                </div>
                <div className="bg-gray-100/50 dark:bg-white/5 p-6 rounded-2xl border border-[#dde2e4] dark:border-white/10 transition-transform hover:scale-[1.02]">
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">System Load</p>
                    <div className="flex items-center justify-between">
                        <h3 className="text-3xl font-black text-[#121617] dark:text-white">{stats.systemLoad}%</h3>
                        <div className="w-24 h-2 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${stats.systemLoad}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const RoleBadge = ({ role = '' }: { role?: string }) => {
    const r = role?.toUpperCase();
    const styleMap: any = {
        'AGENT': 'bg-[#6BB0E1]/15 text-[#6BB0E1] border-[#6BB0E1]/20',
        'AGENTE': 'bg-[#6BB0E1]/15 text-[#6BB0E1] border-[#6BB0E1]/20',
        'SUPERVISOR': 'bg-[#CCE16B]/15 text-[#CCE16B] border-[#CCE16B]/30',
        'SUPERADMIN': 'bg-[#C06BE1]/15 text-[#C06BE1] border-[#C06BE1]/20',
    };

    const badgeStyle = styleMap[r] || 'bg-gray-100 text-gray-700 border-gray-200';

    return (
        <span className={cn(
            "inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border",
            badgeStyle
        )}>
            {role}
        </span>
    );
};

const Activity = (props: any) => (
    <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24" height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
);
