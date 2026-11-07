export const validate = (schema, source = 'body') => (req, res, next) => {
  const parsed = schema.safeParse(req[source])
  if (!parsed.success) return res.status(400).json({ message: 'Please check the highlighted fields.', issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) })
  req[source] = parsed.data
  next()
}
