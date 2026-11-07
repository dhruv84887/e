import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Product } from '../types'
import { api, messageOf } from '../services/api'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'

type Value = { products: Product[]; has: (id: string) => boolean; toggle: (product: Product) => Promise<void> }
const Context = createContext<Value | null>(null)
const storageKey = 'atelier_wishlist_v1'

function readGuest(): Product[] {
  try { return JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { return [] }
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const client = useQueryClient()
  const toast = useToast()
  const [guest, setGuest] = useState<Product[]>(readGuest)
  const mergedFor = useRef('')
  const query = useQuery({ queryKey: ['wishlist'], queryFn: async () => (await api.get('/wishlist')).data.products as Product[], enabled: !!user, retry: false })

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(guest)) }, [guest])

  useEffect(() => {
    if (!user?.id) { mergedFor.current = ''; return }
    if (mergedFor.current === user.id) return
    mergedFor.current = user.id
    const mergeGuestWishlist = async () => {
      try {
        const { data } = await api.get('/wishlist')
        const known = new Set<string>(data.products.map((product: Product) => product._id))
        for (const product of readGuest()) {
          if (!known.has(product._id)) await api.put(`/wishlist/${product._id}`)
          known.add(product._id)
          const remaining = readGuest().filter((item) => item._id !== product._id)
          localStorage.setItem(storageKey, JSON.stringify(remaining))
          setGuest(remaining)
        }
        await client.invalidateQueries({ queryKey: ['wishlist'] })
      } catch (error) {
        toast(messageOf(error), 'error')
        mergedFor.current = ''
      }
    }
    void mergeGuestWishlist()
  }, [user?.id, client, toast])

  const products = user ? query.data || [] : guest
  const has = useCallback((id: string) => products.some((product) => product._id === id), [products])
  const toggle = useCallback(async (product: Product) => {
    if (user) {
      try { await api.put(`/wishlist/${product._id}`); await client.invalidateQueries({ queryKey: ['wishlist'] }) }
      catch (error) { throw new Error(messageOf(error)) }
    } else {
      setGuest((items) => items.some((item) => item._id === product._id) ? items.filter((item) => item._id !== product._id) : [...items, product])
    }
  }, [user, client])

  const value = useMemo(() => ({ products, has, toggle }), [products, has, toggle])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useWishlist() {
  const value = useContext(Context)
  if (!value) throw new Error('useWishlist must be used inside WishlistProvider')
  return value
}
