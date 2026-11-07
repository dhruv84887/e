export function notFound(req, res) { res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` }) }
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err)
  const status = err.status || (err.name === 'ValidationError' || err.name === 'ZodError' || err.name === 'CastError' ? 400 : err.code === 11000 ? 409 : 500)
  if (process.env.NODE_ENV !== 'production') console.error(err)
  const message = err.code === 11000 ? 'A record with that value already exists.' : status >= 500 ? 'Something went wrong. Please try again.' : err.message
  res.status(status).json({ message, ...(err.issues ? { issues: err.issues } : {}) })
}
