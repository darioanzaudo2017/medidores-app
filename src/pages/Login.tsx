import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';

export const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const setSession = useAuthStore(state => state.setSession);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) throw authError;

            if (data.session) {
                // Check if user is active in our custom records
                const { data: userData, error: userError } = await supabase
                    .from('t_usuarios')
                    .select('activo')
                    .eq('auth_user_id', data.session.user.id)
                    .single();

                if (userError || (userData && !userData.activo)) {
                    await supabase.auth.signOut();
                    throw new Error('Su cuenta ha sido desactivada. Por favor, contacte con el administrador.');
                }

                setSession(data.session);
                navigate('/');
            }
        } catch (err: unknown) {
            const error = err as Error;
            setError(error.message || 'Error al iniciar sesión. Por favor, intenta de nuevo.');
            console.error('Login error:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen w-full flex flex-col items-center justify-center industrial-overlay px-6 py-12">
            {/* Login Container */}
            <div className="w-full max-w-[440px] flex flex-col gap-8">

                {/* Logo Section */}
                <div className="flex flex-col items-center gap-3">
                    <div className="bg-primary p-3 rounded-xl shadow-lg shadow-primary/20">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                            <path clipRule="evenodd" d="M47.2426 24L24 47.2426L0.757355 24L24 0.757355L47.2426 24ZM12.2426 21H35.7574L24 9.24264L12.2426 21Z" fill="currentColor" fillRule="evenodd"></path>
                        </svg>
                    </div>
                    <div className="text-center">
                        <h1 className="text-[#121617] dark:text-white text-2xl font-bold tracking-tight">Portal de Gestión Operativa</h1>
                        <p className="text-[#677c83] dark:text-gray-400 text-sm mt-1">Sistema de Administración de Servicios</p>
                    </div>
                </div>

                {/* Login Card */}
                <div className="bg-white dark:bg-[#2d3238] rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[#dde2e4] dark:border-gray-700 overflow-hidden">
                    <div className="p-8">
                        <div className="mb-8">
                            <h2 className="text-[#121617] dark:text-white text-xl font-bold">Bienvenido de nuevo</h2>
                            <p className="text-[#677c83] dark:text-gray-400 text-sm mt-1">Por favor, ingresá tus datos para iniciar sesión.</p>
                        </div>

                        {/* Error State */}
                        {error && (
                            <div className="mb-6 flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 animate-in fade-in slide-in-from-top-2 duration-300">
                                <span className="material-symbols-outlined text-red-600 dark:text-red-400 text-xl">error</span>
                                <p className="text-red-700 dark:text-red-300 text-sm font-medium">{error}</p>
                            </div>
                        )}

                        <form className="space-y-5" onSubmit={handleLogin}>
                            {/* Email Field */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[#121617] dark:text-gray-200 text-sm font-semibold leading-none">Correo Electrónico</label>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#677c83] dark:text-gray-500 text-xl">mail</span>
                                    <input
                                        className="w-full pl-12 pr-4 py-3.5 rounded-lg text-[#121617] dark:text-white border border-[#dde2e4] dark:border-gray-600 bg-white dark:bg-[#22262a] focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-[#677c83] dark:placeholder:text-gray-500 outline-none"
                                        placeholder="admin@utility.com"
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Password Field */}
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-[#121617] dark:text-gray-200 text-sm font-semibold leading-none">Contraseña</label>
                                    <button type="button" className="text-primary text-xs font-semibold hover:underline">¿Olvidaste tu contraseña?</button>
                                </div>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#677c83] dark:text-gray-500 text-xl">lock</span>
                                    <input
                                        className="w-full pl-12 pr-4 py-3.5 rounded-lg text-[#121617] dark:text-white border border-[#dde2e4] dark:border-gray-600 bg-white dark:bg-[#22262a] focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-[#677c83] dark:placeholder:text-gray-500 outline-none"
                                        placeholder="••••••••"
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Remember Me */}
                            <div className="flex items-center gap-3 py-1">
                                <input
                                    className="w-4 h-4 rounded text-primary focus:ring-primary border-[#dde2e4] dark:border-gray-600 bg-white dark:bg-[#22262a]"
                                    id="remember"
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                />
                                <label className="text-[#677c83] dark:text-gray-400 text-sm cursor-pointer select-none" htmlFor="remember">Recordar este dispositivo por 30 días</label>
                            </div>

                            {/* Login Button */}
                            <button
                                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-lg shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
                                type="submit"
                                disabled={loading}
                            >
                                <span>{loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}</span>
                                {!loading && <span className="material-symbols-outlined text-xl group-hover:translate-x-1 transition-transform">arrow_forward</span>}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Footer Meta */}
                <div className="flex flex-col items-center gap-6">
                    <div className="flex items-center gap-2 text-[#677c83] dark:text-gray-500 text-xs font-medium uppercase tracking-widest">
                        <span className="h-px w-8 bg-[#dde2e4] dark:bg-gray-700"></span>
                        <span>Acceso Seguro de Administración</span>
                        <span className="h-px w-8 bg-[#dde2e4] dark:bg-gray-700"></span>
                    </div>
                    <div className="flex items-center gap-2 opacity-60 grayscale hover:grayscale-0 transition-all duration-300">
                        <span className="text-[#677c83] dark:text-gray-400 text-xs font-medium">Desarrollado con</span>
                        <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5">
                                <svg className="text-[#3ecf8e]" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M13.352 2.512C13.064 1.832 12.11 1.832 11.822 2.512L5.808 16.712C5.522 17.388 6.018 18.154 6.748 18.154H11.532V21.488C11.532 22.168 12.486 22.168 12.774 21.488L18.788 7.288C19.074 6.612 18.578 5.846 17.848 5.846H13.352V2.512Z" fill="currentColor"></path>
                                </svg>
                            </div>
                            <span className="text-[#121617] dark:text-white text-sm font-bold tracking-tight">Supabase Auth</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
