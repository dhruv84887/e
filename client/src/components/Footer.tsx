import { useState } from 'react'
import { ArrowRight, Instagram, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import { useToast } from '../context/ToastContext'
import { useQuery } from '@tanstack/react-query'

export function Footer() {
  const [email, setEmail] = useState(''), [busy, setBusy] = useState(false), toast = useToast()
  const { data: config } = useQuery({ queryKey: ['store-config'], queryFn: async () => (await api.get('/config')).data, staleTime: 300000 })
  const storeName = config?.name || 'Atelier'
  const subscribe = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); try { const { data } = await api.post('/newsletter', { email }); toast(data.message); setEmail('') } catch (error) { toast((error as { userMessage?: string }).userMessage || 'Please try again.', 'error') } finally { setBusy(false) } }
  return <footer className="site-footer"><div className="page-wrap"><section className="footer-newsletter"><div><span className="eyebrow">A letter from us</span><h2>A little good in your inbox.</h2><p>New finds, considered notes, and the occasional lovely surprise.</p></div><form onSubmit={subscribe} className="newsletter-form"><Mail size={17} /><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email address" aria-label="Email address" /><button disabled={busy} aria-label="Subscribe"><ArrowRight size={18} /></button></form></section>
    <div className="footer-main"><div className="footer-brand"><Link className="wordmark wordmark-light" to="/">{config?.logoUrl ? <img className="store-logo-img" src={config.logoUrl} alt="" /> : <span className="wordmark-symbol">{storeName.slice(0, 1).toLowerCase()}</span>}<span>{storeName}<small>OBJECTS FOR EVERYDAY</small></span></Link><p>Good things, chosen with care. A considered collection for living well, every day.</p><a href={config?.instagramUrl || "https://www.instagram.com/"} target="_blank" rel="noreferrer" className="social-link"><Instagram size={17} /> Follow along</a></div>
      <div className="footer-links"><h3>Explore</h3><Link to="/shop">Shop all</Link><Link to="/categories">Collections</Link><Link to="/shop?sort=newest">New arrivals</Link><Link to="/shop?featured=true">Best sellers</Link><Link to="/about">Our story</Link></div>
      <div className="footer-links"><h3>Help & information</h3><Link to="/contact">Contact us</Link><Link to="/faq">Frequently asked questions</Link><Link to="/shipping">Shipping & returns</Link><Link to="/account">My account</Link><Link to="/orders">Order tracking</Link></div>
      <div className="footer-links"><h3>The fine print</h3><Link to="/privacy">Privacy policy</Link><Link to="/terms">Terms & conditions</Link><p className="footer-contact">{config?.email || 'hello@atelier.store'}<br />{config?.address || 'Mumbai, India'}</p></div></div>
    <div className="footer-bottom"><span>© {new Date().getFullYear()} {storeName}. Made for everyday.</span><span>Thoughtful things. Thoughtfully found.</span><span>{config?.currency || 'INR'} · India</span></div></div></footer>
}
