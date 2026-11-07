import { z } from 'zod'

export const registerSchema = z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().email(), password: z.string().min(8).max(128) })
export const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1) })
export const addressSchema = z.object({ label: z.string().trim().max(40).optional(), fullName: z.string().trim().min(2), phone: z.string().trim().min(8).max(20), line1: z.string().trim().min(3), line2: z.string().trim().optional(), city: z.string().trim().min(2), state: z.string().trim().min(2), postalCode: z.string().trim().min(4), country: z.string().trim().default('India'), isDefault: z.boolean().optional() })
const variantSchema = z.object({ name: z.string().trim().min(1).max(120), sku: z.string().trim().optional(), price: z.coerce.number().min(0).optional(), stock: z.coerce.number().int().min(0), options: z.record(z.string(), z.string()).optional() })
const productFields = { name: z.string().trim().min(2), description: z.string().min(10), price: z.coerce.number().min(0), compareAtPrice: z.coerce.number().min(0).nullable().optional(), discountPrice: z.coerce.number().min(0).nullable().optional(), sku: z.string().trim().optional(), category: z.string(), subcategory: z.string().optional().nullable(), brand: z.string().trim().optional(), stock: z.coerce.number().int().min(0), images: z.array(z.union([z.string().url(), z.object({ url: z.string().url(), alt: z.string().optional() })])).optional(), variants: z.array(variantSchema).optional(), sizes: z.array(z.string()).optional(), colors: z.array(z.string()).optional(), specifications: z.record(z.string(), z.string()).optional(), featured: z.boolean().optional(), isNewArrival: z.boolean().optional(), isAvailable: z.boolean().optional(), isActive: z.boolean().optional() }
const validateProductPrice = (product, context) => {
  if (product.discountPrice != null && product.price !== undefined && product.discountPrice > product.price) context.addIssue({ code: 'custom', path: ['discountPrice'], message: 'Discount price cannot be higher than the regular price.' })
}
export const productSchema = z.object(productFields).superRefine(validateProductPrice)
export const productUpdateSchema = z.object(productFields).partial().superRefine(validateProductPrice)
export const categorySchema = z.object({ name: z.string().trim().min(2), description: z.string().optional(), image: z.string().optional(), parent: z.string().nullable().optional(), isActive: z.boolean().optional(), sortOrder: z.coerce.number().optional() })
export const checkoutSchema = z.object({ shippingAddress: addressSchema, paymentMethod: z.enum(['cod', 'razorpay']), couponCode: z.string().trim().optional() })
