import { Link } from 'react-router-dom'
import { ArrowRight, CircleAlert, PackageSearch, RefreshCw } from 'lucide-react'
import type { Product } from '../types'
import { ProductCard } from './ProductCard'

export function ProductGrid({ products, loading, error = false, onRetry, columns = 4, emptyTitle = 'Nothing here just yet', emptyText = 'Check back soon. We are always adding new finds.' }: { products?: Product[]; loading?: boolean; error?: boolean; onRetry?: () => void; columns?: 2 | 3 | 4; emptyTitle?: string; emptyText?: string }) {
  if (loading) return <div className={`product-grid columns-${columns}`}>{Array.from({ length: 8 }, (_, i) => <div className="product-skeleton" key={i}><div className="skeleton-image" /><div className="skeleton-line short" /><div className="skeleton-line" /></div>)}</div>
  if (error) return <div className="empty-state" role="status"><span className="empty-icon"><CircleAlert size={24} /></span><h3>We couldn’t load these finds.</h3><p>Check your connection and try once more. Your filters will stay right where you left them.</p>{onRetry && <button className="button button-outline button-small" onClick={onRetry}><RefreshCw size={14} /> Try again</button>}</div>
  if (!products?.length) return <div className="empty-state"><span className="empty-icon"><PackageSearch size={24} /></span><h3>{emptyTitle}</h3><p>{emptyText}</p><Link to="/shop" className="button button-dark button-small">Browse the collection <ArrowRight size={14} /></Link></div>
  return <div className={`product-grid columns-${columns}`}>{products.map((product, index) => <ProductCard key={product._id} product={product} index={index} />)}</div>
}
