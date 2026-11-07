import crypto from 'node:crypto'
import Payment from '../models/Payment.js'
import Order from '../models/Order.js'
import { asyncHandler } from '../utils/http.js'
import { completeOrderRefund } from '../services/orderRefunds.js'

export const razorpayWebhook = asyncHandler(async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  const signature = String(req.get('x-razorpay-signature') || '')
  if (!secret) return res.status(503).json({ message: 'Payment webhook verification is not configured.' })
  if (!req.rawBody || !signature) return res.status(400).json({ message: 'Webhook signature is required.' })
  const expected = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex')
  const expectedBuffer = Buffer.from(expected), signatureBuffer = Buffer.from(signature)
  if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) return res.status(400).json({ message: 'Webhook signature is invalid.' })

  const event = req.body?.event
  if (!['refund.processed', 'refund.failed'].includes(event)) return res.json({ received: true })
  const refund = req.body?.payload?.refund?.entity
  if (!refund?.id || !refund.payment_id) return res.status(400).json({ message: 'Refund event is incomplete.' })
  const payment = await Payment.findOne({ provider: 'razorpay', providerPaymentId: refund.payment_id })
  if (!payment) return res.json({ received: true })
  if (payment.refundStatus === 'processed') return res.json({ received: true })
  if (payment.refundId && payment.refundId !== refund.id) return res.json({ received: true })
  const order = await Order.findById(payment.order)
  if (!order) return res.json({ received: true })

  if (event === 'refund.processed' || refund.status === 'processed') {
    await completeOrderRefund(order, payment, refund)
  } else {
    payment.refundId = refund.id
    payment.refundStatus = 'failed'
    payment.raw = { ...(payment.raw || {}), refund }
    order.refundStatus = 'failed'
    await Promise.all([payment.save(), order.save()])
  }
  res.json({ received: true })
})
