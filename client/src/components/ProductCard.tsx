import { Heart, Star, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import type { Product } from '../types'
import { currency, imageUrl, priceOf } from '../utils/format'
import { useWishlist } from '../context/WishlistContext'
import { useToast } from '../context/ToastContext'

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { has, toggle } = useWishlist(), toast = useToast(), favorite = has(product._id)
  const reduceMotion = useReducedMotion()
  const category = typeof product.category === 'string' ? product.brand : product.category?.name
  return <motion.article className="product-card" initial={reduceMotion ? false : { opacity: 0, y: 14 }} whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, amount: .15 }} transition={{ delay: reduceMotion ? 0 : Math.min(index * .045, .22), duration: reduceMotion ? 0 : .45 }}>
    <div className="product-card-media">
      <Link to={`/product/${product.slug}`} aria-label={`View ${product.name}`} className="product-image-link"><img src={imageUrl(product.images?.[0])} alt={product.images?.[0] && typeof product.images[0] === 'object' ? product.images[0].alt || product.name : product.name} loading="lazy" /></Link>
      {product.discountPrice && product.discountPrice < product.price && <span className="product-badge">Thoughtful price</span>}
      <button className={`favorite-button ${favorite ? 'is-favorite' : ''}`} aria-label={favorite ? 'Remove from wishlist' : 'Add to wishlist'} onClick={() => void toggle(product).then(() => toast(favorite ? 'Removed from your wishlist.' : 'Saved to your wishlist.')).catch((e) => toast(e.message, 'error'))}><Heart size={17} fill={favorite ? 'currentColor' : 'none'} strokeWidth={1.6} /></button>
      <Link className="quick-view" to={`/product/${product.slug}`}>Explore <ArrowUpRight size={14} /></Link>
    </div>
    <div className="product-card-copy"><p className="eyebrow product-brand">{category || product.brand || 'Atelier selection'}</p><Link to={`/product/${product.slug}`} className="product-name">{product.name}</Link>
      <div className="product-meta"><div className="price-group"><span>{currency(priceOf(product))}</span>{product.compareAtPrice && product.compareAtPrice > priceOf(product) && <del>{currency(product.compareAtPrice)}</del>}</div>
      {(product.rating || 0) > 0 && <span className="product-rating"><Star size={12} fill="currentColor" /> {Number(product.rating).toFixed(1)}</span>}</div>
    </div>
  </motion.article>
}
