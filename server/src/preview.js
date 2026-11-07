import 'dotenv/config'
import crypto from 'node:crypto'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import app from './app.js'
import { connectDB } from './config/db.js'
import { seedDemoData } from './seed.js'
import { sweepExpiredReservations } from './services/orderReservations.js'

const port = Number(process.env.PORT || 4000)
const mongo = await MongoMemoryServer.create()
let server, reservationSweep

try {
  process.env.MONGODB_URI = mongo.getUri('atelier-preview')
  process.env.JWT_SECRET ||= crypto.randomBytes(48).toString('hex')
  await connectDB()
  await seedDemoData()
  await sweepExpiredReservations()
  reservationSweep = setInterval(() => { void sweepExpiredReservations().catch((error) => console.error(`Reservation cleanup failed: ${error.message}`)) }, 60_000)
  reservationSweep.unref()
  globalThis.mongoReady = true
  server = app.listen(port, '127.0.0.1', () => {
    console.info(`Local preview API listening at http://127.0.0.1:${port}`)
    console.info('Preview database is in memory. Changes are discarded when this process stops.')
  })
} catch (error) {
  console.error(`Local preview could not start: ${error.message}`)
  await mongoose.disconnect().catch(() => {})
  await mongo.stop()
  process.exitCode = 1
}

let closing = false
async function shutdown() {
  if (closing) return
  closing = true
  globalThis.mongoReady = false
  if (reservationSweep) clearInterval(reservationSweep)
  if (server) await new Promise((resolve) => server.close(resolve))
  await mongoose.disconnect()
  await mongo.stop()
}
process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())
