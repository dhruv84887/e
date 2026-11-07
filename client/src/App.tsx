import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SiteLayout } from './components/SiteLayout'
import { HomePage } from './pages/HomePage'
import { CategoriesPage, CollectionPage } from './pages/CollectionPage'
import { ProductPage } from './pages/ProductPage'
import { WishlistPage } from './pages/WishlistPage'
import { CartPage } from './pages/CartPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { AuthPage } from './pages/AuthPage'
import { AccountPage } from './pages/AccountPage'
import { OrdersPage } from './pages/OrdersPage'
import { ContactPage, ContentPage } from './pages/ContentPages'
import { AdminPage } from './pages/AdminPage'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { WishlistProvider } from './context/WishlistContext'
import { ToastProvider } from './context/ToastContext'
import { ArrowRight, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 20_000 } } })
function Gate({ admin = false }: { admin?: boolean }) {
  const { user, loading } = useAuth(), location = useLocation()
  if (loading) return <div className="page-loading"><LoaderCircle className="spin" size={25} /> <span>One moment…</span></div>
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  if (admin && user.role !== 'admin') return <div className="page-wrap access-denied"><span className="eyebrow">A members-only corner</span><h1>This door is for the studio team.</h1><p>Your account doesn’t have administrator access.</p><Link className="button button-dark" to="/">Back to the shop <ArrowRight size={15} /></Link></div>
  if (admin) return <Outlet />
  return <Outlet />
}
const router = createBrowserRouter([
  { element: <SiteLayout />, children: [
    { index: true, element: <HomePage /> }, { path: 'shop', element: <CollectionPage /> }, { path: 'categories', element: <CategoriesPage /> }, { path: 'search', element: <CollectionPage /> }, { path: 'product/:slug', element: <ProductPage /> },
    { path: 'wishlist', element: <WishlistPage /> }, { path: 'cart', element: <CartPage /> }, { path: 'checkout', element: <CheckoutPage /> },
    { path: 'login', element: <AuthPage mode="login" /> }, { path: 'register', element: <AuthPage mode="register" /> }, { path: 'forgot-password', element: <AuthPage mode="forgot" /> }, { path: 'reset-password', element: <AuthPage mode="reset" /> },
    { element: <Gate />, children: [{ path: 'account', element: <AccountPage /> }, { path: 'orders', element: <OrdersPage /> }, { path: 'orders/:id', element: <OrdersPage /> }] },
    { path: 'about', element: <ContentPage kind="about" /> }, { path: 'contact', element: <ContactPage /> }, { path: 'faq', element: <ContentPage kind="faq" /> }, { path: 'privacy', element: <ContentPage kind="privacy" /> }, { path: 'terms', element: <ContentPage kind="terms" /> }, { path: 'shipping', element: <ContentPage kind="shipping" /> },
    { path: '*', element: <NotFound /> }
  ] },
  { element: <Gate admin />, children: [{ path: 'admin', element: <AdminPage /> }, { path: 'admin/:section', element: <AdminPage /> }] }
])
function NotFound() { return <div className="not-found page-wrap"><span className="not-found-number">404</span><span className="eyebrow">A little detour</span><h1>Nothing here but<br /><em>good intentions.</em></h1><p>This page seems to have wandered somewhere else.</p><Link className="button button-dark" to="/">Let’s get you home <ArrowRight size={15} /></Link><Link to="/shop" className="not-found-shop">Or browse the collection</Link></div> }
export function App() { return <QueryClientProvider client={queryClient}><ToastProvider><AuthProvider><CartProvider><WishlistProvider><RouterProvider router={router} /></WishlistProvider></CartProvider></AuthProvider></ToastProvider></QueryClientProvider> }
