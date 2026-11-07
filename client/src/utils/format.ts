import type { Product, ProductImage } from '../types'
let storeCurrency = 'INR'
export const setStoreCurrency = (code?: string) => { if (code && /^[A-Z]{3}$/.test(code)) storeCurrency = code }
export const storeCurrencyCode = () => storeCurrency
export const currency = (amount: number, code = storeCurrency) => {
  const locale = code === 'INR' ? 'en-IN' : code === 'USD' ? 'en-US' : code === 'GBP' ? 'en-GB' : code === 'EUR' ? 'de-DE' : 'en'
  return new Intl.NumberFormat(locale, { style: 'currency', currency: code, maximumFractionDigits: code === 'INR' ? 0 : 2 }).format(Number(amount) || 0)
}
export const imageUrl = (image?: ProductImage) => typeof image === 'string' ? image : image?.url || ''
export const priceOf = (product: Product) => Number(product.discountPrice ?? product.price ?? 0)
export const errorText = (error: unknown) => (error as { userMessage?: string })?.userMessage || (error as Error)?.message || 'Please try again.'
