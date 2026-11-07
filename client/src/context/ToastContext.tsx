import { createContext, useCallback, useContext, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, CircleAlert, X } from 'lucide-react'

type Toast = { id: number; message: string; kind: 'success' | 'error' }
const ToastContext = createContext<(message: string, kind?: Toast['kind']) => void>(() => undefined)
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const toast = useCallback((message: string, kind: Toast['kind'] = 'success') => {
    const id = Date.now() + Math.random(); setToasts((current) => [...current, { id, message, kind }]); window.setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 3400)
  }, [])
  return <ToastContext.Provider value={toast}>{children}<div className="toast-stack" aria-live="polite"><AnimatePresence>{toasts.map((t) => <motion.div key={t.id} className={`toast toast-${t.kind}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 20 }}><span className="toast-icon">{t.kind === 'success' ? <Check size={15} /> : <CircleAlert size={15} />}</span><span>{t.message}</span><button aria-label="Dismiss notification" onClick={() => setToasts((items) => items.filter((item) => item.id !== t.id))}><X size={15} /></button></motion.div>)}</AnimatePresence></div></ToastContext.Provider>
}
export const useToast = () => useContext(ToastContext)
