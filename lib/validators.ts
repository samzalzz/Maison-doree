import { z } from 'zod'

// ============================================================================
// AUTH SCHEMAS
// ============================================================================

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export type LoginInput = z.infer<typeof LoginSchema>

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  phone: z.string().min(10, 'Invalid phone number').optional(),
})

export type RegisterInput = z.infer<typeof RegisterSchema>

// ============================================================================
// USER SCHEMAS
// ============================================================================

export const UserProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional().nullable(),
  lastName: z.string().min(1).max(100).optional().nullable(),
  phone: z.string().min(10).optional().nullable(),
  address: z.string().min(1).max(255).optional().nullable(),
  city: z.string().min(1).max(100).optional().nullable(),
  zipCode: z.string().min(1).max(20).optional().nullable(),
  profilePhoto: z.string().optional().nullable(),
})

export type UserProfileInput = z.infer<typeof UserProfileSchema>

// ============================================================================
// PRODUCT SCHEMAS
// ============================================================================

export const ProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(255),
  description: z.string().max(2000).optional().nullable(),
  price: z.number().positive('Price must be positive'),
  category: z.enum([
    'PATES',
    'COOKIES',
    'GATEAU',
    'BRIOUATES',
    'CHEBAKIA',
    'AUTRES',
  ]),
  stock: z.number().int().nonnegative('Stock cannot be negative').default(0),
  minimumStock: z.number().int().nonnegative().default(10),
  photos: z.array(z.string().url()).optional().default([]),
  isFeatured: z.boolean().default(false),
})

export type ProductInput = z.infer<typeof ProductSchema>

export const ProductUpdateSchema = ProductSchema.partial()

export type ProductUpdateInput = z.infer<typeof ProductUpdateSchema>

/**
 * Admin-facing create schema — mirrors ProductSchema with the name and
 * constraints specified in the admin API contract.
 * Exported as CreateProductSchema for use in /api/admin/products routes.
 */
export const CreateProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(100),
  description: z.string().max(1000).optional(),
  price: z.number().positive('Price must be positive'),
  category: z.enum([
    'PATES',
    'COOKIES',
    'GATEAU',
    'BRIOUATES',
    'CHEBAKIA',
    'AUTRES',
  ]),
  stock: z.number().int().min(0, 'Stock cannot be negative').default(0),
  minimumStock: z.number().int().min(0).default(10),
  isFeatured: z.boolean().default(false),
  photos: z.array(z.string()).optional(),
})

export type CreateProductInput = z.infer<typeof CreateProductSchema>

/**
 * Admin-facing update schema — all fields from CreateProductSchema are optional.
 */
export const UpdateProductSchema = CreateProductSchema.partial()

export type UpdateProductInput = z.infer<typeof UpdateProductSchema>

// ============================================================================
// PACKAGING SCHEMAS
// ============================================================================

export const PackagingSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  name: z.string().min(1, 'Packaging name is required').max(100),
  priceModifier: z.number().default(0),
})

export type PackagingInput = z.infer<typeof PackagingSchema>

// ============================================================================
// ORDER SCHEMAS
// ============================================================================

export const OrderItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  packaging: z.string().optional().nullable(),
})

export type OrderItemInput = z.infer<typeof OrderItemSchema>

export const CreateOrderSchema = z.object({
  items: z.array(OrderItemSchema).min(1, 'At least one item is required'),
  deliveryAddress: z.string().min(1, 'Delivery address is required').max(255),
  deliveryCity: z.string().min(1, 'City is required').max(100),
  deliveryZipCode: z.string().min(1, 'Zip code is required').max(20),
  paymentMethod: z.enum(['STRIPE', 'CASH_ON_DELIVERY']),
})

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>

export const UpdateOrderStatusSchema = z.object({
  status: z.enum([
    'PENDING',
    'CONFIRMED',
    'ASSIGNED',
    'IN_PROGRESS',
    'DELIVERED',
    'CANCELLED',
  ]),
})

export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>

// Admin-facing create order schema.
// Delivery address fields are optional because the admin may be creating an
// in-store/phone order where a physical address is not yet known.
export const CreateAdminOrderSchema = z.object({
  userId: z.string().min(1, 'Customer ID is required'),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'Product ID is required'),
        quantity: z.number().int().positive('Quantity must be at least 1'),
        packaging: z.string().optional().nullable(),
      }),
    )
    .min(1, 'At least one item is required'),
  paymentMethod: z.enum(['STRIPE', 'CASH_ON_DELIVERY']),
  deliveryAddress: z.string().min(1).max(255).optional().default('Admin order'),
  deliveryCity: z.string().min(1).max(100).optional().default('N/A'),
  deliveryZipCode: z.string().min(1).max(20).optional().default('00000'),
})

export type CreateAdminOrderInput = z.infer<typeof CreateAdminOrderSchema>

// ============================================================================
// PAYMENT SCHEMAS
// ============================================================================

export const PaymentSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  amount: z.number().positive('Amount must be positive'),
  method: z.enum(['STRIPE', 'CASH_ON_DELIVERY']),
})

export type PaymentInput = z.infer<typeof PaymentSchema>

export const ConfirmPaymentSchema = z.object({
  status: z.enum(['COMPLETED', 'FAILED', 'REFUNDED']),
  stripePaymentId: z.string().optional(),
  collectedAmount: z.number().optional(),
})

export type ConfirmPaymentInput = z.infer<typeof ConfirmPaymentSchema>

// ============================================================================
// DELIVERY SCHEMAS
// ============================================================================

export const AssignDriverSchema = z.object({
  driverId: z.string().min(1, 'Driver ID is required'),
})

export type AssignDriverInput = z.infer<typeof AssignDriverSchema>

export const UpdateDeliveryStatusSchema = z.object({
  status: z.enum([
    'UNASSIGNED',
    'ASSIGNED',
    'ACCEPTED',
    'IN_PROGRESS',
    'DELIVERED',
    'CANCELLED',
  ]),
})

export type UpdateDeliveryStatusInput = z.infer<typeof UpdateDeliveryStatusSchema>

export const UpdateDeliveryLocationSchema = z.object({
  lat: z.number().min(-90).max(90, 'Invalid latitude'),
  lng: z.number().min(-180).max(180, 'Invalid longitude'),
})

export type UpdateDeliveryLocationInput = z.infer<
  typeof UpdateDeliveryLocationSchema
>

export const CompleteDeliverySchema = z.object({
  proofPhoto: z.string().optional(),
})

export type CompleteDeliveryInput = z.infer<typeof CompleteDeliverySchema>

// ============================================================================
// RATING SCHEMAS
// ============================================================================

export const RatingSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  productId: z.string().optional(),
  type: z.enum(['PRODUCT', 'DELIVERY']),
  score: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional().nullable(),
})

export type RatingInput = z.infer<typeof RatingSchema>

// ============================================================================
// TICKET SCHEMAS
// ============================================================================

export const CreateTicketSchema = z.object({
  orderId: z.string().optional().nullable(),
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().min(10, 'Description must be at least 10 characters').max(5000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
})

export type CreateTicketInput = z.infer<typeof CreateTicketSchema>

export const UpdateTicketStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
})

export type UpdateTicketStatusInput = z.infer<typeof UpdateTicketStatusSchema>

export const AddTicketMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(5000),
})

export type AddTicketMessageInput = z.infer<typeof AddTicketMessageSchema>

// ============================================================================
// LOYALTY CARD SCHEMAS
// ============================================================================

export const LoyaltyCardSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
})

export type LoyaltyCardInput = z.infer<typeof LoyaltyCardSchema>

// ============================================================================
// ADMIN SCHEMAS
// ============================================================================

export const CreateAdminSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
})

export type CreateAdminInput = z.infer<typeof CreateAdminSchema>

export const UpdateStockSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().min(0, 'Quantity cannot be negative'),
})

export type UpdateStockInput = z.infer<typeof UpdateStockSchema>

// ============================================================================
// PAGINATION SCHEMAS
// ============================================================================

export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
})

export type PaginationInput = z.infer<typeof PaginationSchema>

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

export const ProductFilterSchema = z.object({
  category: z.enum([
    'PATES',
    'COOKIES',
    'GATEAU',
    'BRIOUATES',
    'CHEBAKIA',
    'AUTRES',
  ]).optional(),
  minPrice: z.number().nonnegative().optional(),
  maxPrice: z.number().nonnegative().optional(),
  search: z.string().optional(),
  isFeatured: z.boolean().optional(),
})

export type ProductFilterInput = z.infer<typeof ProductFilterSchema>

export const OrderFilterSchema = z.object({
  status: z.enum([
    'PENDING',
    'CONFIRMED',
    'ASSIGNED',
    'IN_PROGRESS',
    'DELIVERED',
    'CANCELLED',
  ]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

export type OrderFilterInput = z.infer<typeof OrderFilterSchema>
