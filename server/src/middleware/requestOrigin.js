const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function requestOriginGuard(allowedOrigins) {
  const allowed = new Set(allowedOrigins)
  return (req, res, next) => {
    if (!writeMethods.has(req.method)) return next()
    let origin = req.get('origin')
    const referer = req.get('referer')
    if (!origin && referer) {
      try { origin = new URL(referer).origin }
      catch { return res.status(403).json({ message: 'This request origin is not allowed.' }) }
    }
    if (origin && !allowed.has(origin)) return res.status(403).json({ message: 'This request origin is not allowed.' })
    next()
  }
}
