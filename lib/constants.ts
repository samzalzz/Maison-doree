export const APP_NAME = 'Maison Dorée'
export const APP_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000'

export const ROLES = {
  CUSTOMER: 'CUSTOMER',
  ADMIN: 'ADMIN',
  DRIVER: 'DRIVER',
} as const

export const ORDER_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const

export const DELIVERY_STATUS = {
  UNASSIGNED: 'UNASSIGNED',
  ASSIGNED: 'ASSIGNED',
  ACCEPTED: 'ACCEPTED',
  IN_PROGRESS: 'IN_PROGRESS',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const

export const PAYMENT_METHOD = {
  STRIPE: 'STRIPE',
  CASH_ON_DELIVERY: 'CASH_ON_DELIVERY',
} as const

export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const

export const TICKET_STATUS = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const

export const PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const

export const TIER = {
  BRONZE: 'BRONZE',
  SILVER: 'SILVER',
  GOLD: 'GOLD',
} as const

export const RATING_TYPE = {
  PRODUCT: 'PRODUCT',
  DELIVERY: 'DELIVERY',
} as const

export const PRODUCT_CATEGORY = {
  PATES: 'PATES',
  COOKIES: 'COOKIES',
  GATEAU: 'GATEAU',
  BRIOUATES: 'BRIOUATES',
  CHEBAKIA: 'CHEBAKIA',
  AUTRES: 'AUTRES',
} as const

export const POINTS_PER_DINAR = 1
export const TIER_THRESHOLDS = {
  SILVER: 100,
  GOLD: 500,
} as const
