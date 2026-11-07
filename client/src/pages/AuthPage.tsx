import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Resolver } from 'react-hook-form'
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const credentials = z.object({ email: z.string().email('Enter a valid email address.'), password: z.string().min(8, 'Use at least 8 characters.') })
const registerSchema = credentials.extend({ name: z.string().trim().min(2, 'Tell us your name.'), confirm: z.string() }).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Those passwords do not match.' })
export function AuthPage({ mode }: { mode: 'login' | 'register' | 'forgot' | 'reset' }) {
  const { login, register } = useAuth(), [search] = useSearchParams(), navigate = useNavigate(), toast = useToast(), [busy, setBusy] = useState(false), [showPassword, setShowPassword] = useState(false), [notice, setNotice] = useState('')
  const schema = mode === 'register' ? registerSchema : mode === 'forgot' ? z.object({ email: z.string().email('Enter a valid email address.') }) : mode === 'reset' ? z.object({ password: z.string().min(8, 'Use at least 8 characters.'), confirm: z.string() }).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Those passwords do not match.' }) : credentials
  type AuthFields = { name: string; email: string; password: string; confirm: string }
  const form = useForm<AuthFields>({ resolver: zodResolver(schema) as unknown as Resolver<AuthFields>, defaultValues: { name: '', email: '', password: '', confirm: '' } })
  const destination = (role: string) => {
    const requested = search.get('next')
    return requested?.startsWith('/') && !requested.startsWith('//') ? requested : role === 'admin' ? '/admin' : '/account'
  }
  const isReset = mode === 'reset', title = mode === 'login' ? 'Welcome back.' : mode === 'register' ? 'A good thing starts here.' : mode === 'forgot' ? 'Forgot your password?' : 'Choose a new password.'
  const subtitle = mode === 'login' ? 'Sign in to pick up where you left off.' : mode === 'register' ? 'Make an account for a little more everyday good.' : mode === 'forgot' ? 'We’ll send a reset link if we find an account for that email.' : 'Make it something you’ll remember.'
  const submit = form.handleSubmit(async (values) => {
    setBusy(true); setNotice('')
    try {
      if (mode === 'login') { const user = await login(values.email, values.password); navigate(destination(user.role), { replace: true }) }
      else if (mode === 'register') { const user = await register(values.name, values.email, values.password); navigate(destination(user.role), { replace: true }) }
      else if (mode === 'forgot') { const { data } = await api.post('/auth/forgot-password', { email: values.email }); setNotice(data.message) }
      else { await api.post('/auth/reset-password', { token: search.get('token'), password: values.password }); toast('Your password has been updated.'); navigate('/account', { replace: true }) }
    } catch (error) { form.setError('root', { message: (error as { userMessage?: string; message?: string }).userMessage || (error as Error).message || 'Something went wrong.' }) } finally { setBusy(false) }
  })
  return <div className="auth-page page-wrap"><div className="auth-side"><span className="eyebrow">A little room for good things</span><h2>Good things,<br /><em>come around.</em></h2><p>Your place for saved finds, new arrivals, and the little details that make it yours.</p><div className="auth-side-note"><span>✳</span><div><b>Thoughtfully found.</b><small>Here when you’re ready.</small></div></div><img src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=85" alt="A considered, sunlit home" /></div>
    <section className="auth-form-side"><div className="auth-form-wrap"><Link to="/" className="auth-back"><ArrowLeft size={14} /> Back to the shop</Link><span className="eyebrow">{mode === 'login' ? 'Your Atelier account' : mode === 'register' ? 'A new beginning' : 'Account help'}</span><h1>{title}</h1><p className="auth-subtitle">{subtitle}</p>
      {notice ? <div className="form-success"><ShieldCheck size={19} />{notice}</div> : <form onSubmit={submit} className="auth-form" noValidate>
        {mode === 'register' && <label className="field"><span>Your name</span><input placeholder="How should we call you?" {...form.register('name')} />{form.formState.errors.name && <small className="field-error">{form.formState.errors.name.message}</small>}</label>}
        {!isReset && <label className="field"><span>Email address</span><div className="input-icon"><Mail size={16} /><input type="email" autoComplete="email" placeholder="you@example.com" {...form.register('email')} /></div>{form.formState.errors.email && <small className="field-error">{form.formState.errors.email.message}</small>}</label>}
        {mode !== 'forgot' && <label className="field"><span>{isReset ? 'New password' : 'Password'}</span><div className="input-icon"><LockKeyhole size={16} /><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="At least 8 characters" {...form.register('password')} /><button type="button" className="password-toggle" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>{form.formState.errors.password && <small className="field-error">{form.formState.errors.password.message}</small>}</label>}
        {(mode === 'register' || isReset) && <label className="field"><span>Confirm password</span><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Enter it once more" {...form.register('confirm')} />{form.formState.errors.confirm && <small className="field-error">{form.formState.errors.confirm.message}</small>}</label>}
        {mode === 'login' && <div className="form-under"><span>Good to see you again</span><Link to="/forgot-password">Forgot password?</Link></div>}
        {form.formState.errors.root && <div className="form-alert">{form.formState.errors.root.message}</div>}
        <button className="button button-dark auth-submit" disabled={busy}>{busy ? 'One moment…' : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create your account' : mode === 'forgot' ? 'Send reset link' : 'Reset password'} <ArrowRight size={16} /></button>
      </form>}
      {mode === 'login' && <p className="auth-alternate">New around here? <Link to="/register">Create an account</Link></p>}{mode === 'register' && <p className="auth-alternate">Already have an account? <Link to="/login">Sign in</Link></p>}{mode === 'forgot' && <p className="auth-alternate"><Link to="/login">Back to sign in</Link></p>}
    </div></section></div>
}
