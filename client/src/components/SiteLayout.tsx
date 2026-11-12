import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'

export function SiteLayout() {
  const location = useLocation()
  const reduceMotion = useReducedMotion()

  return <div className="storefront-frame"><ScrollRestoration /><Header /><AnimatePresence mode="wait" initial={false}><motion.main key={location.pathname} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -6 }} transition={{ duration: reduceMotion ? 0 : 0.24, ease: 'easeOut' }}><Outlet /></motion.main></AnimatePresence><Footer /></div>
}
