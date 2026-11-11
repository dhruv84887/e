import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronDown, Heart, Menu, Search, ShoppingBag, UserRound, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useWishlist } from '../context/WishlistContext'
import type { Category, Product } from '../types'
import { currency, priceOf, setStoreCurrency } from '../utils/format'

export function Header() {
  const { user } = useAuth(), cart = useCart(), wishlist = useWishlist(), navigate = useNavigate()
  const [menu, setMenu] = useState(false), [mobileSearchOpen, setMobileSearchOpen] = useState(false), [query, setQuery] = useState(''), [focus, setFocus] = useState(false), [suggestions, setSuggestions] = useState<{ _id: string; name: string; slug: string; brand?: string; price: number; discountPrice?: number; images?: { url: string }[] }[]>([])
  const searchRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { data } = useQuery({ queryKey: ['categories'], queryFn: async () => (await api.get('/categories')).data.categories as Category[], staleTime: 300000 })
  const { data: config } = useQuery({ queryKey: ['store-config'], queryFn: async () => (await api.get('/config')).data as { name?: string; logoUrl?: string; currency?: string; primaryColor?: string; accentColor?: string; freeShippingFrom?: number; instagramUrl?: string }, staleTime: 300000 })
  useEffect(() => { if (query.trim().length < 2) { setSuggestions([]); return } const timer = window.setTimeout(() => api.get('/products/suggestions', { params: { q: query } }).then((r) => setSuggestions(r.data.suggestions)).catch(() => setSuggestions([])), 220); return () => window.clearTimeout(timer) }, [query])
  useEffect(() => { const handler = (e: MouseEvent) => { if (!searchRef.current?.contains(e.target as Node)) setFocus(false) }; document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler) }, [])
  useEffect(() => { if (mobileSearchOpen) { setFocus(true); searchInputRef.current?.focus() } else setFocus(false) }, [mobileSearchOpen])
  const submit = (value = query) => { if (!value.trim()) return; setFocus(false); setMobileSearchOpen(false); navigate(`/search?q=${encodeURIComponent(value.trim())}`) }
  const name = config?.name || 'Atelier'
  useEffect(() => { document.title = `${name} — Objects for everyday`; setStoreCurrency(config?.currency); if (config?.primaryColor) document.documentElement.style.setProperty('--olive', config.primaryColor); if (config?.accentColor) document.documentElement.style.setProperty('--terra', config.accentColor) }, [name, config?.currency, config?.primaryColor, config?.accentColor])
  return <>
    <div className="announcement"><span>Good things, thoughtfully made</span><span className="announcement-dot">•</span><span>Complimentary shipping on orders over {currency(config?.freeShippingFrom ?? 4999, config?.currency || 'INR')}</span><Link to="/shipping">Details <ArrowRight size={11} /></Link></div>
    <header className="site-header">
      <div className={`header-main page-wrap ${mobileSearchOpen ? 'mobile-search-open' : ''}`}>
        <button className="icon-button mobile-menu-toggle" aria-label={menu ? 'Close menu' : 'Open menu'} aria-expanded={menu} onClick={() => { setMobileSearchOpen(false); setMenu((v) => !v) }}>{menu ? <X /> : <Menu />}</button>
        <Link className="wordmark" to="/" aria-label={`${name} home`}>{config?.logoUrl ? <img className="store-logo-img" src={config.logoUrl} alt="" /> : <span className="wordmark-symbol">{name.slice(0, 1).toLowerCase()}</span>}<span>{name}<small>OBJECTS FOR EVERYDAY</small></span></Link>
        <div className="search-wrap" ref={searchRef}><form className="search-box" onSubmit={(e) => { e.preventDefault(); submit() }}><Search size={17} strokeWidth={1.7} /><input ref={searchInputRef} aria-label="Search products" placeholder="Find something lovely..." value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => setFocus(true)} /><kbd>↵</kbd></form>
          {focus && suggestions.length > 0 && <div className="search-suggestions">{suggestions.map((item) => <button key={item._id} onClick={() => { setQuery(''); setFocus(false); setMobileSearchOpen(false); navigate(`/product/${item.slug}`) }}><img src={item.images?.[0]?.url} alt="" /><span>{item.name}<small>{item.brand || 'Atelier selection'}</small></span><b>{currency(priceOf(item as Product))}</b></button>)}<button className="search-all" onClick={() => submit()}>See all results for “{query}” <ArrowRight size={14} /></button></div>}</div>
        <div className="header-actions"><button className="icon-button mobile-search-toggle" type="button" aria-label={mobileSearchOpen ? 'Close search' : 'Open search'} aria-expanded={mobileSearchOpen} onClick={() => { setMenu(false); setMobileSearchOpen((open) => !open) }}>{mobileSearchOpen ? <X size={19} /> : <Search size={19} />}</button><Link className="header-action account-action" to={user ? '/account' : '/login'} aria-label="My account"><UserRound size={19} strokeWidth={1.6} /><span>{user ? 'Account' : 'Sign in'}</span></Link><Link className="header-action wishlist-action" to="/wishlist" aria-label="Wishlist"><Heart size={19} strokeWidth={1.6} /><span>Saved</span>{wishlist.products.length > 0 && <i className="action-count">{wishlist.products.length}</i>}</Link><Link className="header-action cart-action" to="/cart" aria-label="Shopping bag"><ShoppingBag size={19} strokeWidth={1.6} /><span>Bag</span><i className="action-count">{cart.items.reduce((sum, item) => sum + item.quantity, 0)}</i></Link></div>
      </div>
      <nav className={`nav-row ${menu ? 'nav-open' : ''}`} aria-label="Main navigation"><div className="page-wrap nav-inner"><Link to="/shop" onClick={() => setMenu(false)}>Shop all</Link><div className="nav-categories"><Link to="/categories" onClick={() => setMenu(false)}>Collections <ChevronDown size={12} /></Link><div className="nav-dropdown">{(data || []).flatMap((item) => [item, ...(item.children || [])]).map((category) => <Link className={category.parent ? 'nav-child' : undefined} key={category._id} to={`/shop?category=${category.slug}`} onClick={() => setMenu(false)}>{category.name}</Link>)}</div></div>{(data || []).slice(0, 4).map((category) => <Link key={category._id} to={`/shop?category=${category.slug}`} onClick={() => setMenu(false)}>{category.name}</Link>)}<Link to="/about" onClick={() => setMenu(false)} className="nav-story">Our story</Link></div></nav>
    </header>
  </>
}
