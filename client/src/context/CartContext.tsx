import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { CartItem, CartState, Product } from '../types'
import { api, messageOf } from '../services/api'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import { setStoreCurrency } from '../utils/format'

type StoreConfig = { taxRate?: number; shippingFlat?: number; freeShippingFrom?: number; currency?: string }
type CartValue = CartState & {
  loading: boolean
  freeShippingFrom: number
  currencyCode: string
  refresh: () => Promise<unknown>
  add: (product: Product, quantity?: number, variantId?: string, color?: string, size?: string) => Promise<void>
  setQuantity: (id: string, quantity: number) => Promise<void>
  remove: (id: string) => Promise<void>
  applyCoupon: (code: string) => Promise<void>
  clear: () => Promise<void>
}

const CartContext = createContext<CartValue | null>(null)
const storageKey = 'atelier_guest_cart_v1'

function readGuest(): CartItem[] {
  try { return JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { return [] }
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function guestTotals(items: CartItem[], config?: StoreConfig): CartState {
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0))
  const discount = 0
  const taxable = Math.max(0, subtotal - discount)
  const freeShippingFrom = Number(config?.freeShippingFrom ?? 4999)
  const shipping = taxable >= freeShippingFrom || taxable === 0 ? 0 : Number(config?.shippingFlat ?? 99)
  const tax = roundMoney(taxable * Number(config?.taxRate ?? 0.05))
  return { items, subtotal, discount, tax, shipping, total: roundMoney(taxable + tax + shipping) }
}

function sameChoice(a: CartItem, b: CartItem) {
  return a.product._id === b.product._id && (a.variantId || '') === (b.variantId || '') && (a.size || '') === (b.size || '') && (a.color || '') === (b.color || '')
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [guestItems, setGuestItems] = useState<CartItem[]>(readGuest)
  const mergedFor = useRef('')
  const storeConfig = useQuery({ queryKey: ['store-config'], queryFn: async () => (await api.get('/config')).data as StoreConfig, staleTime: 300000 })
  const query = useQuery({ queryKey: ['cart'], queryFn: async () => (await api.get('/cart')).data as CartState, enabled: !!user, retry: false })

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(guestItems)) }, [guestItems])
  useEffect(() => { setStoreCurrency(storeConfig.data?.currency) }, [storeConfig.data?.currency])

  useEffect(() => {
    if (!user?.id) { mergedFor.current = ''; return }
    if (mergedFor.current === user.id) return
    mergedFor.current = user.id
    const mergeGuestCart = async () => {
      let changed = false
      for (const guestItem of readGuest()) {
        try {
          const { data: remoteCart } = await api.get('/cart')
          const existing = remoteCart.items.find((item: CartItem) => sameChoice(item, guestItem))
          if (existing) {
            const available = existing.variant ? Math.min(existing.product.stock, existing.variant.stock) : existing.product.stock
            const quantity = existing.quantity + guestItem.quantity
            if (quantity > available) throw new Error(`Only ${available} of ${guestItem.product.name} are currently available. Review your bag before checkout.`)
            await api.patch(`/cart/items/${existing.id}`, { quantity })
          } else {
            await api.post('/cart/items', { productId: guestItem.product._id, variantId: guestItem.variantId, size: guestItem.size, color: guestItem.color, quantity: guestItem.quantity })
          }
          const remaining = readGuest().filter((item) => item.id !== guestItem.id)
          localStorage.setItem(storageKey, JSON.stringify(remaining))
          setGuestItems(remaining)
          changed = true
        } catch (error) {
          toast(messageOf(error), 'error')
          mergedFor.current = ''
          break
        }
      }
      if (changed) await queryClient.invalidateQueries({ queryKey: ['cart'] })
    }
    void mergeGuestCart()
  }, [user?.id, queryClient, toast])

  const guestState = useMemo(() => guestTotals(guestItems, storeConfig.data), [guestItems, storeConfig.data])
  const state = user ? query.data || { items: [], subtotal: 0, discount: 0, tax: 0, shipping: 0, total: 0 } : guestState
  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: ['cart'] }), [queryClient])

  const add = useCallback(async (product: Product, quantity = 1, variantId?: string, color?: string, size?: string) => {
    if (!Number.isInteger(quantity) || quantity < 1) throw new Error('Choose a valid quantity.')
    if (user) {
      try { await api.post('/cart/items', { productId: product._id, variantId, size, color, quantity }); await refresh() }
      catch (error) { throw new Error(messageOf(error)) }
      return
    }
    const variant = product.variants?.find((option) => option._id === variantId)
    const available = variant ? Math.min(product.stock, variant.stock) : product.stock
    const existing = guestItems.find((item) => item.product._id === product._id && item.variantId === variantId && item.size === size && item.color === color)
    if (product.isAvailable === false || available < (existing?.quantity || 0) + quantity) {
      throw new Error(available > 0 ? `Only ${available} of ${product.name} are available.` : `${product.name} is currently out of stock.`)
    }
    const unitPrice = Number(variant?.price ?? product.discountPrice ?? product.price)
    if (existing) {
      setGuestItems((items) => items.map((item) => item.id === existing.id ? { ...item, quantity: item.quantity + quantity, lineTotal: unitPrice * (item.quantity + quantity) } : item))
    } else {
      setGuestItems((items) => [...items, { id: `${product._id}-${variantId || 'default'}-${size || ''}-${color || ''}`, product, variantId, size, color, variant, quantity, unitPrice, lineTotal: unitPrice * quantity }])
    }
  }, [user, refresh, guestItems])

  const setQuantity = useCallback(async (id: string, quantity: number) => {
    if (!Number.isInteger(quantity) || quantity < 1) throw new Error('Quantity must be at least one.')
    if (user) { await api.patch(`/cart/items/${id}`, { quantity }); await refresh(); return }
    const item = guestItems.find((entry) => entry.id === id)
    if (!item) return
    const variant = item.product.variants?.find((option) => option._id === item.variantId)
    const available = variant ? Math.min(item.product.stock, variant.stock) : item.product.stock
    if (quantity > available) throw new Error(`Only ${available} of ${item.product.name} are currently available.`)
    setGuestItems((items) => items.map((entry) => entry.id === id ? { ...entry, quantity, lineTotal: entry.unitPrice * quantity } : entry))
  }, [user, refresh, guestItems])

  const remove = useCallback(async (id: string) => {
    if (user) { await api.delete(`/cart/items/${id}`); await refresh() }
    else setGuestItems((items) => items.filter((item) => item.id !== id))
  }, [user, refresh])

  const applyCoupon = useCallback(async (code: string) => {
    if (!user) throw new Error('Sign in to apply a coupon at checkout.')
    try { await api.post('/cart/coupon', { code }); await refresh() }
    catch (error) { throw new Error(messageOf(error)) }
  }, [user, refresh])

  const clear = useCallback(async () => {
    if (user) { await api.delete('/cart'); await refresh() }
    else setGuestItems([])
  }, [user, refresh])

  const freeShippingFrom = Number(storeConfig.data?.freeShippingFrom ?? 4999)
  const currencyCode = storeConfig.data?.currency || 'INR'
  const value = useMemo(() => ({ ...state, freeShippingFrom, currencyCode, loading: user ? query.isLoading : false, refresh, add, setQuantity, remove, applyCoupon, clear }), [state, freeShippingFrom, currencyCode, user, query.isLoading, refresh, add, setQuantity, remove, applyCoupon, clear])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const value = useContext(CartContext)
  if (!value) throw new Error('useCart must be used inside CartProvider')
  return value
}
