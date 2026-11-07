import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown, Mail, MapPin, Phone } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { useToast } from '../context/ToastContext'
import { currency } from '../utils/format'

const details = {
  about: { eyebrow: 'A little about us', title: 'Good things,\nchosen with care.', intro: 'Atelier is a collection for the everyday. The things you reach for without thinking, and the ones you keep because they make a day feel just right.', image: 'photo-1616486338812-3dadae4b4ace' },
  privacy: { eyebrow: 'The fine print', title: 'Your privacy,\nheld with care.', intro: 'We use the details you share to take care of your orders and make your experience feel a little more personal. We never sell your personal information.', image: 'photo-1494438639946-1ebd1d20bf85' },
  terms: { eyebrow: 'The fine print', title: 'A few things\nto know.', intro: 'These terms help us make shopping here clear and fair for everyone. By placing an order, you agree to the notes below.', image: 'photo-1618221195710-dd6b41faaea6' },
  shipping: { eyebrow: 'Getting good things to you', title: 'On its way,\nwith a little care.', intro: 'We pack each order thoughtfully and send it on its way as soon as we can. Here’s what to expect when something good is headed to you.', image: 'photo-1600210492486-724fe5c67fb0' }
}
const policyContent: Record<string, { title: string; text: string }[]> = {
  privacy: [
    { title: 'The details we keep', text: 'When you shop or write to us, we collect only the details needed to help with your order and your account: your name, contact details, delivery address, and order history.' },
    { title: 'How we use them', text: 'We use your information to process payments, deliver orders, answer questions, prevent fraud, and send the occasional note if you have chosen to hear from us.' },
    { title: 'Keeping things safe', text: 'Passwords are hashed, payments are handled by our payment partners, and card details are never stored on our servers. Access to personal information is limited to the people who need it to serve you.' },
    { title: 'Your choices', text: 'You can update your account details at any time, unsubscribe from marketing emails, or contact us to ask about the information associated with your account.' },
  ],
  terms: [
    { title: 'Shopping with us', text: 'We do our best to keep product descriptions, images, availability, and pricing current. Occasionally a listing may need correction. If that happens after you place an order, we’ll get in touch and make it right with you.' },
    { title: 'Orders and payment', text: 'An order is confirmed once you receive an order number. Prices are shown in Indian rupees and include applicable charges shown at checkout. Online payment is processed securely by Razorpay; cash on delivery is available on eligible orders.' },
    { title: 'Returns', text: 'Unused products in their original condition can be returned within 14 days of delivery. Please contact us before sending anything back so we can help with the next step.' },
    { title: 'The little things', text: 'Our content, brand, and original photography belong to Atelier or their respective creators. These terms may be updated as the shop grows; the version shown here applies to your order.' },
  ],
  shipping: [
    { title: 'When will it arrive?', text: 'Orders are usually prepared within 1–2 working days. Delivery typically takes 3–7 working days depending on where you are in India. You’ll see tracking details here as soon as your order ships.' },
    { title: 'Delivery charges', text: 'A flat ₹99 delivery charge applies to orders under ₹4,999. We cover standard shipping on orders above that amount. Any applicable tax is calculated and shown before you place your order.' },
    { title: 'A change of heart', text: 'If a piece isn’t quite right, let us know within 14 days of delivery. We’ll help arrange a return for unused items in their original packaging. Some personal care items and made-to-order pieces may not be eligible for return.' },
    { title: 'Something not quite right?', text: 'If your order arrives damaged or something is missing, please write to us within 48 hours with your order number and a photo. We’ll work with you to sort it out.' },
  ]
}
export function ContentPage({ kind }: { kind: 'about' | 'faq' | 'privacy' | 'terms' | 'shipping' }) {
  const info = details[kind as keyof typeof details]
  if (kind === 'faq') return <FaqPage />
  if (kind === 'about') return <AboutPage info={info} />
  return <PolicyPage kind={kind} info={info} />
}
function AboutPage({ info }: { info: typeof details.about }) {
  return <div className="story-page page-wrap"><div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><span>Our story</span></div><section className="story-hero"><div><span className="eyebrow">{info.eyebrow}</span><h1>{info.title.split('\n').map((line, i) => <span key={line}>{i === 1 ? <em>{line}</em> : line}<br /></span>)}</h1><p>{info.intro}</p><Link to="/shop" className="button button-dark">Explore our collection <ArrowRight size={15} /></Link></div><img src={`https://images.unsplash.com/${info.image}?auto=format&fit=crop&w=1400&q=88`} alt="A considered, welcoming home" /></section><section className="story-values"><div><span className="eyebrow">A point of view</span><h2>Useful can be<br /><em>beautiful, too.</em></h2></div><div className="story-values-copy"><p>We started Atelier with a simple idea: a well-made everyday object can make a small difference to the way a day feels. The cup you reach for each morning. The bag that’s always by the door. A lamp that makes evenings a little softer.</p><p>So we look for pieces with a story in their materials, a little thought in their design, and enough usefulness to earn their place. We’re glad you found us.</p><span>With care,<br /><b>The Atelier team</b></span></div></section><section className="story-principles"><article><span>01</span><h3>Good to use.</h3><p>Useful things, made to fit the rhythm of real life.</p></article><article><span>02</span><h3>Made with thought.</h3><p>Materials and makers chosen with a little more care.</p></article><article><span>03</span><h3>Worth keeping.</h3><p>Pieces you’ll reach for long after the newness fades.</p></article></section></div>
}
function PolicyPage({ kind, info }: { kind: 'privacy' | 'terms' | 'shipping'; info: typeof details.privacy }) {
  const config = useQuery({ queryKey: ['store-config'], queryFn: async () => (await api.get('/config')).data as { shippingFlat: number; freeShippingFrom: number; currency: string }, staleTime: 300000 })
  const sections = policyContent[kind].map((item) => kind === 'shipping' && item.title === 'Delivery charges' ? {
    ...item,
    text: `A flat ${currency(config.data?.shippingFlat ?? 99, config.data?.currency)} delivery charge applies to orders under ${currency(config.data?.freeShippingFrom ?? 4999, config.data?.currency)}. We cover standard shipping on orders above that amount. Any applicable tax is calculated and shown before you place your order.`
  } : item)
  return <div className="policy-page page-wrap"><div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><span>{kind === 'shipping' ? 'Shipping & returns' : `${kind[0].toUpperCase()}${kind.slice(1)} policy`}</span></div><section className="policy-hero"><div><span className="eyebrow">{info.eyebrow}</span><h1>{info.title.split('\n').map((line, i) => <span key={line}>{i === 1 ? <em>{line}</em> : line}<br /></span>)}</h1><p>{info.intro}</p><small>Last updated 4 November 2026</small></div><img src={`https://images.unsplash.com/${info.image}?auto=format&fit=crop&w=1300&q=85`} alt="" /></section><div className="policy-sections">{sections.map((item, i) => <article key={item.title}><span>{String(i + 1).padStart(2, '0')}</span><div><h2>{item.title}</h2><p>{item.text}</p></div></article>)}</div><div className="policy-contact">A question? We’re just a note away. <Link to="/contact">Write to us <ArrowRight size={14} /></Link></div></div>
}
const faqItems = [
  { q: 'How long will my order take to arrive?', a: 'We usually prepare orders within 1–2 working days. Delivery then takes around 3–7 working days depending on your location. We’ll send tracking information as soon as your order is on its way.' },
  { q: 'What does delivery cost?', a: 'Delivery is a flat ₹99 on orders under ₹4,999. Orders above ₹4,999 ship on us.' },
  { q: 'Can I return something?', a: 'Of course. If a piece isn’t quite right, unused items in their original condition can be returned within 14 days of delivery. Get in touch and we’ll help with the next step.' },
  { q: 'What payment methods can I use?', a: 'You can pay online using cards, UPI, or netbanking through Razorpay, or choose cash on delivery where available.' },
  { q: 'Can I change my order after placing it?', a: 'Write to us as soon as you can with your order number. We can usually help before the order has been prepared for dispatch.' },
  { q: 'How do I keep track of my order?', a: 'Sign in and visit Your orders to see the latest status and tracking details. We’ll also keep you posted as your order moves along.' },
  { q: 'How do I get in touch?', a: 'Write to us using the contact form or email hello@atelier.store. Our team usually replies within one working day.' },
]
function FaqPage() {
  const [open, setOpen] = useState(0)
  const config = useQuery({ queryKey: ['store-config'], queryFn: async () => (await api.get('/config')).data as { email: string; shippingFlat: number; freeShippingFrom: number; currency: string }, staleTime: 300000 })
  const threshold = config.data?.freeShippingFrom ?? 4999
  const items = faqItems.map((item) => item.q === 'What does delivery cost?' ? { ...item, a: `Delivery is a flat ${currency(config.data?.shippingFlat ?? 99, config.data?.currency)} on orders under ${currency(threshold, config.data?.currency)}. Orders above ${currency(threshold, config.data?.currency)} ship on us.` } : item.q === 'How do I get in touch?' ? { ...item, a: `Write to us using the contact form or email ${config.data?.email || 'hello@atelier.store'}. Our team usually replies within one working day.` } : item)
  return <div className="faq-page page-wrap"><div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><span>FAQ</span></div><section className="faq-heading"><span className="eyebrow">A few things you might wonder</span><h1>Good to know.</h1><p>Answers to the little things. If there’s something else, <Link to="/contact">we’re here</Link>.</p></section><div className="faq-list">{items.map((item, i) => <article className={open === i ? 'faq-item open' : 'faq-item'} key={item.q}><button onClick={() => setOpen((v) => v === i ? -1 : i)} aria-expanded={open === i}><span className="faq-number">{String(i + 1).padStart(2, '0')}</span><b>{item.q}</b><ChevronDown size={18} /></button>{open === i && <p>{item.a}</p>}</article>)}</div><div className="faq-bottom"><span>✳</span><div><h2>Still wondering about something?</h2><p>We’re happy to help with the little details.</p></div><Link to="/contact" className="button button-outline">Say hello <ArrowRight size={14} /></Link></div></div>
}
const contactSchema = z.object({ name: z.string().trim().min(2), email: z.string().email(), subject: z.string().trim().min(3), message: z.string().trim().min(10) })
type Contact = z.infer<typeof contactSchema>
export function ContactPage() {
  const toast = useToast(), form = useForm<Contact>({ resolver: zodResolver(contactSchema), defaultValues: { name: '', email: '', subject: '', message: '' } }), config = useQuery({ queryKey: ['store-config'], queryFn: async () => (await api.get('/config')).data })
  const submit = form.handleSubmit(async (values) => { try { const { data } = await api.post('/contact', values); toast(data.message); form.reset() } catch (e) { toast((e as { userMessage?: string }).userMessage || 'Could not send your note. Please try again.', 'error') } })
  return <div className="contact-page page-wrap"><div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><span>Contact us</span></div><div className="contact-layout"><section className="contact-copy"><span className="eyebrow">We’re just a note away</span><h1>Say hello.<br /><em>We’re listening.</em></h1><p>Questions about an order, a product, or anything else? Send us a note and our little team will get back to you, usually within one working day.</p><div className="contact-details"><a href={`mailto:${config.data?.email || 'hello@atelier.store'}`}><span><Mail size={16} /></span><div><small>Write to us</small><b>{config.data?.email || 'hello@atelier.store'}</b></div></a><a href={`tel:${config.data?.phone || '+919876543210'}`}><span><Phone size={16} /></span><div><small>Call us</small><b>{config.data?.phone || '+91 98765 43210'}</b></div></a><div><span><MapPin size={16} /></span><div><small>Find us</small><b>{config.data?.address || 'Mumbai, India'}</b></div></div></div><div className="contact-hours"><span className="hours-dot" /> We’re here Monday–Saturday, 10 am–6 pm IST</div></section><section className="contact-form-panel"><span className="eyebrow">Leave a little note</span><h2>How can we help?</h2><form onSubmit={submit} className="contact-form"><Field label="Your name" error={form.formState.errors.name?.message}><input {...form.register('name')} placeholder="Your name" /></Field><Field label="Email address" error={form.formState.errors.email?.message}><input type="email" {...form.register('email')} placeholder="you@example.com" /></Field><Field label="What’s it about?" error={form.formState.errors.subject?.message}><input {...form.register('subject')} placeholder="Order, product, or anything else" /></Field><Field label="Your message" error={form.formState.errors.message?.message}><textarea rows={5} {...form.register('message')} placeholder="Write a little more here…" /></Field><button className="button button-dark" disabled={form.formState.isSubmitting}>Send your note <ArrowRight size={15} /></button></form></section></div></div>
}
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}{error && <small className="field-error">{error}</small>}</label> }
