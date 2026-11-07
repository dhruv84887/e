export function storeCurrencyCode() {
  const candidate = (process.env.STORE_CURRENCY || 'INR').toUpperCase()
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency: candidate })
    return candidate
  } catch {
    return 'INR'
  }
}
