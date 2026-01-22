import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
    session: Session | null
    user: User | null
    role: string | null
    isLoading: boolean
    setSession: (session: Session | null) => void
    signOut: () => Promise<void>
    fetchRole: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
    session: null,
    user: null,
    role: null,
    isLoading: true,
    setSession: (session) => {
        set({ session, user: session?.user ?? null, isLoading: false })
        if (session) {
            get().fetchRole()
        } else {
            set({ role: null })
        }
    },
    fetchRole: async () => {
        const { user } = get()
        if (!user) return

        try {
            const { data, error } = await supabase
                .from('t_usuarios')
                .select('t_tipos_usuario(nombre)')
                .eq('auth_user_id', user.id)
                .single()

            if (error) throw error

            // @ts-ignore - Handle nested relation type
            const roleName = data?.t_tipos_usuario?.nombre ?? null
            set({ role: roleName })
        } catch (error) {
            console.error('Error fetching role:', error)
            set({ role: null })
        }
    },
    signOut: async () => {
        await supabase.auth.signOut()
        set({ session: null, user: null, role: null, isLoading: false })
    }
}))
