import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, CreditCard, LockKeyhole, PackageCheck, Wallet } from 'lucide-react'
import { api, messageOf } from '../services/api'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { currency, imageUrl } from '../utils/format'
import { useToast } from '../context/ToastContext'
import type { Address } from '../types'

declare global { interface Window { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } } }
const schema = z.object({ fullName: z.string().trim().min(2, 'Enter the name for this delivery.'), phone: z.string().trim().min(8, 'Enter a valid phone number.'), line1: z.string().trim().min(3, 'Add a street address.'), line2: z.string().optional(), city: z.string().trim().min(2, 'Add your city.'), state: z.string().trim().min(2, 'Add your state.'), postalCode: z.string().trim().min(4, 'Add your postal code.'), country: z.string().trim().min(2), label: z.string().default('Home'), isDefault: z.boolean().default(false) })
type FormInput = z.input<typeof schema>
type FormData = z.output<typeof schema>
export function CheckoutPage() {
  const cart = useCart(), { user } = useAuth(), navigate = useNavigate(), queryClient = useQueryClient(), toast = useToast(), [method, setMethod] = useState<'cod' | 'razorpay'>('cod'), [formError, setFormError] = useState(''), [pendingOrderId, setPendingOrderIdState] = useState(''), [addressId, setAddressId] = useState('new'), [saveAddress, setSaveAddress] = useState(true)
  const paymentStorageKey = user?.id ? `atelier_pending_payment_${user.id}` : ''
  const setPendingOrderId = (id: string) => { setPendingOrderIdState(id); if (!paymentStorageKey) return; if (id) sessionStorage.setItem(paymentStorageKey, id); else sessionStorage.removeItem(paymentStorageKey) }
  useEffect(() => { if (paymentStorageKey) { const savedOrderId = sessionStorage.getItem(paymentStorageKey) || ''; setPendingOrderIdState(savedOrderId); if (savedOrderId) setMethod('razorpay') } }, [paymentStorageKey])
  const addressesQuery = useQuery({ queryKey: ['addresses'], queryFn: async () => (await api.get('/auth/addresses')).data.addresses as Address[], enabled: !!user })
  const storeConfig = useQuery({ queryKey: ['store-config'], queryFn: async () => (await api.get('/config')).data as { name?: string; primaryColor?: string; razorpayEnabled?: boolean }, staleTime: 300000 })
  const form = useForm<FormInput, unknown, FormData>({ resolver: zodResolver(schema), defaultValues: { fullName: user?.name || '', phone: user?.phone || '', line1: '', line2: '', city: '', state: '', postalCode: '', country: 'India', label: 'Home', isDefault: false } })
  useEffect(() => { if (user) { form.setValue('fullName', user.name); if (user.phone) form.setValue('phone', user.phone) } }, [user, form])
  useEffect(() => {
    if (!addressesQuery.data?.length || addressId !== 'new' || form.formState.isDirty) return
    const address = addressesQuery.data.find((item) => item.isDefault) || addressesQuery.data[0]
    if (!address?._id) return
    setAddressId(address._id)
    setSaveAddress(false)
    form.reset({ ...address, line2: address.line2 || '', label: address.label || 'Home', isDefault: Boolean(address.isDefault) })
  }, [addressesQuery.data, addressId, form, form.formState.isDirty])
  const chooseAddress = (id: string) => {
    setAddressId(id)
    if (id === 'new') {
      setSaveAddress(true)
      form.reset({ fullName: user?.name || '', phone: user?.phone || '', line1: '', line2: '', city: '', state: '', postalCode: '', country: 'India', label: 'Home', isDefault: !(addressesQuery.data?.length) })
      return
    }
    const address = addressesQuery.data?.find((item) => item._id === id)
    if (address) {
      setSaveAddress(false)
      form.reset({ ...address, line2: address.line2 || '', label: address.label || 'Home', isDefault: Boolean(address.isDefault) })
    }
  }
  if (!user) return <div className="page-wrap auth-checkout"><span className="empty-icon"><LockKeyhole size={25} /></span><span className="eyebrow">One small step</span><h1>Sign in to finish up.</h1><p>Your bag is safe. Sign in or create an account and we’ll bring you right back here.</p><div><Link className="button button-dark" to="/login?next=%2Fcheckout">Sign in <ArrowRight size={15} /></Link><Link className="button button-outline" to="/register?next=%2Fcheckout">Create an account</Link></div></div>
  if (!cart.items.length) return <div className="page-wrap auth-checkout"><span className="empty-icon"><PackageCheck size={25} /></span><h1>Your bag is empty.</h1><Link className="button button-dark" to="/shop">Find something good <ArrowRight size={15} /></Link></div>
  const submit = form.handleSubmit(async (values) => {
    setFormError('')
    try {
      if (addressId === 'new' && saveAddress) {
        try {
          await api.post('/auth/addresses', { ...values, isDefault: !(addressesQuery.data?.length) })
          await queryClient.invalidateQueries({ queryKey: ['addresses'] })
          toast('Address saved for next time.')
        } catch {
          toast('Your order can continue, but this address was not saved.', 'error')
        }
      }
      let orderId = pendingOrderId
      if (!orderId) {
        const { data } = await api.post('/orders', { shippingAddress: values, paymentMethod: method })
        orderId = data.order._id
        if (method === 'razorpay') setPendingOrderId(orderId)
      }
      if (method === 'cod') { await cart.clear(); navigate(`/orders/${orderId}?placed=1`); return }
      const payment = await api.post(`/orders/${orderId}/razorpay`)
      if (!window.Razorpay) { await new Promise<void>((resolve, reject) => { const script = document.createElement('script'); script.src = 'https://checkout.razorpay.com/v1/checkout.js'; script.onload = () => resolve(); script.onerror = () => reject(new Error('Unable to load secure checkout. Try again.')); document.body.appendChild(script) }) }
      if (!window.Razorpay) throw new Error('Secure online checkout is unavailable right now.')
      const options = payment.data
      let paymentReturned = false
      const gateway = new window.Razorpay({ key: options.keyId, amount: options.amount, currency: options.currency, name: storeConfig.data?.name || 'Atelier', description: `Order ${options.orderNumber}`, order_id: options.razorpayOrderId, prefill: options.prefill, theme: { color: storeConfig.data?.primaryColor || '#2b3028' }, modal: { ondismiss: () => { if (paymentReturned) return; void api.post(`/orders/${orderId}/cancel`, { reason: 'Payment window closed before payment completed.' }).then(() => queryClient.invalidateQueries({ queryKey: ['cart'] })).catch(() => {}).finally(() => setPendingOrderId('')) } }, handler: async (response: Record<string, string>) => { paymentReturned = true; try { await api.post('/payments/razorpay/verify', response); setPendingOrderId(''); await cart.refresh(); navigate(`/orders/${orderId}?placed=1`) } catch (error) { setFormError(messageOf(error)) } } })
      gateway.open()
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status
      if (pendingOrderId && status === 409) { setPendingOrderId(''); await cart.refresh() }
      setFormError(messageOf(error))
    }
  })
  const cancelPaymentAttempt = async () => {
    if (!pendingOrderId) return
    try {
      await api.post(`/orders/${pendingOrderId}/cancel`, { reason: 'Customer cancelled the payment attempt.' })
      setPendingOrderId('')
      await cart.refresh()
      setFormError('Payment attempt cancelled. Your bag is safe and ready when you are.')
    } catch (error) { setFormError(messageOf(error)) }
  }
  return <div className="page-wrap checkout-page"><div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><Link to="/cart">Your bag</Link><span>/</span><span>Checkout</span></div><div className="page-title-row"><div><span className="eyebrow">Almost there</span><h1>Make it yours.</h1></div><Link to="/cart" className="text-link"><ArrowLeft size={15} /> Back to your bag</Link></div><form className="checkout-layout" onSubmit={submit} noValidate><div className="checkout-form"><section className="checkout-section"><div className="checkout-section-heading"><span className="step-number">01</span><div><h2>Where to send it</h2><p>We’ll take good care of your order on the way.</p></div></div>{Boolean(addressesQuery.data?.length) && <label className="field checkout-address-select"><span>Use a saved address</span><select value={addressId} onChange={(event) => chooseAddress(event.target.value)}><option value="new">Enter a new address</option>{addressesQuery.data?.map((address) => <option key={address._id} value={address._id}>{address.label || "Address"} · {address.city}{address.isDefault ? " · Default" : ""}</option>)}</select></label>}<div className="form-grid"><Field label="Full name" error={form.formState.errors.fullName?.message}><input autoComplete="name" {...form.register('fullName')} placeholder="Full name" /></Field><Field label="Phone number" error={form.formState.errors.phone?.message}><input autoComplete="tel" {...form.register('phone')} placeholder="+91 98765 43210" /></Field><Field label="Street address" error={form.formState.errors.line1?.message} full><input autoComplete="address-line1" {...form.register('line1')} placeholder="House number and street" /></Field><Field label="Apartment, floor, etc." full><input autoComplete="address-line2" {...form.register('line2')} placeholder="Optional" /></Field><Field label="Town / City" error={form.formState.errors.city?.message}><input autoComplete="address-level2" {...form.register('city')} placeholder="City" /></Field><Field label="State" error={form.formState.errors.state?.message}><input autoComplete="address-level1" {...form.register('state')} placeholder="State" /></Field><Field label="Postal code" error={form.formState.errors.postalCode?.message}><input autoComplete="postal-code" {...form.register('postalCode')} placeholder="Postal code" /></Field><Field label="Country" error={form.formState.errors.country?.message}><input autoComplete="country-name" {...form.register('country')} /></Field></div>{addressId === "new" && <label className="checkout-save-address"><input type="checkbox" checked={saveAddress} onChange={(event) => setSaveAddress(event.target.checked)} /><span>Save this address to my account for next time</span></label>}</section>
    <section className="checkout-section"><div className="checkout-section-heading"><span className="step-number">02</span><div><h2>How would you like to pay?</h2><p>All your details stay safe and secure.</p></div></div><div className="payment-options"><label className={`payment-option ${method === 'cod' ? 'selected' : ''} ${pendingOrderId ? 'payment-unavailable' : ''}`}><input type="radio" name="payment" checked={method === 'cod'} disabled={Boolean(pendingOrderId)} onChange={() => setMethod('cod')} /><span className="payment-icon"><Wallet size={18} /></span><span><b>Cash on delivery</b><small>Pay when your order arrives</small></span><span className="payment-radio" /></label><label className={`payment-option ${method === 'razorpay' ? 'selected' : ''} ${!storeConfig.data?.razorpayEnabled || pendingOrderId ? 'payment-unavailable' : ''}`}><input type="radio" name="payment" checked={method === 'razorpay'} disabled={!storeConfig.data?.razorpayEnabled || Boolean(pendingOrderId)} onChange={() => setMethod('razorpay')} /><span className="payment-icon"><CreditCard size={18} /></span><span><b>Pay online</b><small>{storeConfig.data?.razorpayEnabled ? 'Cards, UPI and netbanking via Razorpay' : 'Temporarily unavailable — choose cash on delivery'}</small></span><span className="payment-radio" /></label></div></section>
    {formError && <div className="form-alert">{formError}{pendingOrderId && <button type="button" className="admin-text-button cancel-pending-payment" onClick={() => void cancelPaymentAttempt()}>Cancel payment attempt and return to your bag</button>}</div>}</div><aside className="order-summary checkout-summary"><h2>Your little bundle</h2><div className="checkout-items">{cart.items.map((item) => <div className="checkout-item" key={item.id}><div className="checkout-item-image"><img src={imageUrl(item.product.images?.[0])} alt="" /><i>{item.quantity}</i></div><span>{item.product.name}<small>{item.variant?.name || Object.values(item.variant?.options || {}).join(' / ') || item.size || item.color || item.product.brand || 'Atelier selection'}</small></span><b>{currency(item.lineTotal)}</b></div>)}</div><div className="summary-lines"><div><span>Subtotal</span><span>{currency(cart.subtotal)}</span></div>{cart.discount > 0 && <div className="discount-line"><span>Savings</span><span>−{currency(cart.discount)}</span></div>}<div><span>Shipping</span><span>{cart.shipping ? currency(cart.shipping) : 'On us'}</span></div><div><span>Estimated tax</span><span>{currency(cart.tax)}</span></div></div><div className="summary-total"><span>Total</span><span>{currency(cart.total)}</span></div><button className="button button-dark checkout-button" disabled={form.formState.isSubmitting || (method === 'razorpay' && !storeConfig.data?.razorpayEnabled)}>{form.formState.isSubmitting ? 'Preparing your order…' : method === 'cod' ? 'Place your order' : 'Continue to secure payment'} <ArrowRight size={16} /></button><div className="secure-note"><LockKeyhole size={13} /> Secure, encrypted checkout</div><p className="checkout-thankyou">Thank you for choosing something thoughtful. We’ll make sure it gets to you safely.</p></aside></form></div>
}
function Field({ label, error, full, children }: { label: string; error?: string; full?: boolean; children: React.ReactNode }) { return <label className={`field ${full ? 'field-full' : ''}`}><span>{label}</span>{children}{error && <small className="field-error">{error}</small>}</label> }
