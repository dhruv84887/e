import { ArrowUpRight, CircleAlert, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Category } from '../types'

const fallbackImages = [
  'https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=900&q=85',
  'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=85',
  'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=85',
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85',
]

export function CategoryTiles({ categories, loading, error, onRetry }: { categories?: Category[]; loading: boolean; error: boolean; onRetry: () => void }) {
  if (loading) return <>{Array.from({ length: 4 }, (_, index) => <div className="category-skeleton" key={index} />)}</>
  if (error) return <div className="empty-state home-category-state" role="status"><span className="empty-icon"><CircleAlert size={24} /></span><h3>Collections aren’t available right now.</h3><p>Check your connection, then try loading them again.</p><button className="button button-outline button-small" onClick={onRetry}><RefreshCw size={14} /> Try again</button></div>
  if (!categories?.length) return <div className="empty-state home-category-state"><h3>New collections are on their way.</h3><p>Take a look through the full shop while we get them ready.</p><Link className="button button-dark button-small" to="/shop">Browse the shop</Link></div>
  return <>{categories.slice(0, 4).map((category, index) => <Link to={`/shop?category=${category.slug}`} className={`category-tile category-tile-${index + 1}`} key={category._id}><img src={category.image || fallbackImages[index % fallbackImages.length]} alt="" loading="lazy" /><div className="category-tile-copy"><span>{String(index + 1).padStart(2, '0')} / COLLECTION</span><h3>{category.name}</h3><div>{category.description || 'Thoughtfully selected for your everyday.'}<ArrowUpRight size={16} /></div></div></Link>)}</>
}
