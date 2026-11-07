import { Link } from 'react-router-dom'
import { ArrowRight, Heart, Trash2 } from 'lucide-react'
import { useWishlist } from '../context/WishlistContext'
import { ProductCard } from '../components/ProductCard'
import { useToast } from '../context/ToastContext'
import { messageOf } from '../services/api'

export function WishlistPage() {
  const { products, toggle } = useWishlist(), toast = useToast()
  const remove = async (product: (typeof products)[number]) => { try { await toggle(product); toast('Removed from your saved finds.') } catch (error) { toast(messageOf(error), 'error') } }
  return <div className="page-wrap wishlist-page"><div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><span>Your saved finds</span></div><div className="page-title-row"><div><span className="eyebrow">A little list of lovely things</span><h1>Your saved finds<span> ({products.length})</span></h1></div><Link className="text-link" to="/shop">Keep looking <ArrowRight size={15} /></Link></div>{products.length ? <div className="product-grid columns-4">{products.map((product, i) => <div className="wishlist-card-wrap" key={product._id}><ProductCard product={product} index={i} /><button className="wishlist-remove" onClick={() => void remove(product)}><Trash2 size={14} /> Remove from saved</button></div>)}</div> : <div className="cart-empty"><span className="empty-icon"><Heart size={26} /></span><span className="eyebrow">A little something to look forward to</span><h2>Your saved list is waiting.</h2><p>Tap the heart on the things you love and they’ll be right here, whenever you need a little inspiration.</p><Link to="/shop" className="button button-dark">Find a few good things <ArrowRight size={15} /></Link></div>}</div>
}
