export type Category = { _id: string; name: string; slug: string; description?: string; image?: string; isActive?: boolean; parent?: string | Category | null; children?: Category[] }
export type ProductImage = { url: string; alt?: string } | string
export type Variant = { _id: string; name: string; sku?: string; price?: number; stock: number; options?: Record<string, string> }
export type Product = {
  _id: string; name: string; slug: string; sku?: string; description: string; price: number; discountPrice?: number; compareAtPrice?: number;
  images: ProductImage[]; category: Category | string; subcategory?: Category | string; brand?: string; stock: number; variants?: Variant[];
  sizes?: string[]; colors?: string[]; specifications?: Record<string, string>; rating?: number; reviewCount?: number; soldCount?: number;
  featured?: boolean; isNewArrival?: boolean; isAvailable?: boolean; isActive?: boolean; createdAt?: string;
}
export type Address = { _id?: string; label?: string; fullName: string; phone: string; line1: string; line2?: string; city: string; state: string; postalCode: string; country: string; isDefault?: boolean }
export type User = { id: string; name: string; email: string; phone?: string; role: 'customer' | 'admin'; addresses?: Address[] }
export type CartItem = { id: string; product: Product; variantId?: string; color?: string; variant?: Variant | null; quantity: number; unitPrice: number; lineTotal: number }
export type CartState = { items: CartItem[]; subtotal: number; discount: number; tax: number; shipping: number; total: number; coupon?: { code: string; discount: number } }
