import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { User } from '../types'
import { api, messageOf } from '../services/api'

type AuthValue = { user: User | null; loading: boolean; login: (email: string, password: string) => Promise<User>; register: (name: string, email: string, password: string) => Promise<User>; logout: () => Promise<void>; updateUser: (data: Partial<User>) => Promise<void> }
const AuthContext = createContext<AuthValue | null>(null)
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null), [loading, setLoading] = useState(true)
  useEffect(() => { api.get('/auth/me').then((r) => setUser(r.data.user)).catch(() => setUser(null)).finally(() => setLoading(false)) }, [])
  const login = useCallback(async (email: string, password: string) => { try { const { data } = await api.post('/auth/login', { email, password }); setUser(data.user); return data.user as User } catch (e) { throw new Error(messageOf(e)) } }, [])
  const register = useCallback(async (name: string, email: string, password: string) => { try { const { data } = await api.post('/auth/register', { name, email, password }); setUser(data.user); return data.user as User } catch (e) { throw new Error(messageOf(e)) } }, [])
  const logout = useCallback(async () => { try { await api.post('/auth/logout') } finally { setUser(null) } }, [])
  const updateUser = useCallback(async (fields: Partial<User>) => { const { data } = await api.patch('/auth/me', fields); setUser(data.user) }, [])
  const value = useMemo(() => ({ user, loading, login, register, logout, updateUser }), [user, loading, login, register, logout, updateUser])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used inside AuthProvider'); return value }
