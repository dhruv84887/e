import 'dotenv/config'
import app from './app.js'
import { connectDB } from './config/db.js'
import { sweepExpiredReservations } from './services/orderReservations.js'

const port = Number(process.env.PORT || 4000)
try {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be set to at least 32 characters.')
  await connectDB()
  await sweepExpiredReservations()
  const reservationSweep = setInterval(() => { void sweepExpiredReservations().catch((error) => console.error(`Reservation cleanup failed: ${error.message}`)) }, 60_000)
  reservationSweep.unref()
  globalThis.mongoReady = true
  app.listen(port, () => console.info(`Atelier API listening on http://localhost:${port}`))
} catch (error) {
  console.error(`Server startup failed: ${error.message}`)
  process.exit(1)
}
