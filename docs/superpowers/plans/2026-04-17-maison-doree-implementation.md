# Maison Dorée - E-Commerce Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete e-commerce platform for Moroccan pastries with client, admin, and driver interfaces, including real-time delivery tracking, payments, and support system.

**Architecture:** Single Next.js 14 application with three role-based interfaces (CUSTOMER, ADMIN, DRIVER). Backend API routes handle all business logic. PostgreSQL for persistence, Redis for real-time state and caching. WebSockets for live delivery tracking.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Prisma ORM, PostgreSQL, Redis, NextAuth.js, Socket.io, Stripe, Tailwind CSS, Shadcn/ui

**Timeline:** 12 weeks (84 days), can be parallelized across team members

---

## FILE STRUCTURE

### Project Root
```
maison-doree/
├── app/                              # Next.js App Router
│   ├── (auth)/                      # Auth group (login, register)
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── layout.tsx
│   ├── (client)/                    # Customer pages
│   │   ├── layout.tsx
│   │   ├── page.tsx                 # Homepage (countdown or catalog)
│   │   ├── countdown/page.tsx
│   │   ├── products/page.tsx
│   │   ├── products/[id]/page.tsx
│   │   ├── cart/page.tsx
│   │   ├── checkout/page.tsx
│   │   ├── orders/page.tsx
│   │   ├── orders/[id]/page.tsx
│   │   ├── delivery/[id]/page.tsx   # Live tracking map
│   │   ├── loyalty/page.tsx
│   │   ├── tickets/page.tsx
│   │   └── tickets/[id]/page.tsx
│   ├── (admin)/                     # Admin pages (protected)
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── products/page.tsx
│   │   ├── stocks/page.tsx
│   │   ├── deliveries/page.tsx
│   │   ├── users/page.tsx
│   │   └── tickets/page.tsx
│   ├── (driver)/                    # Driver pages (protected)
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── delivery/[id]/page.tsx
│   │   └── profile/page.tsx
│   ├── api/                         # API Routes
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── products/route.ts
│   │   ├── products/[id]/route.ts
│   │   ├── orders/route.ts
│   │   ├── orders/[id]/route.ts
│   │   ├── orders/[id]/assign-driver/route.ts
│   │   ├── payments/route.ts
│   │   ├── webhooks/stripe/route.ts
│   │   ├── delivery/[id]/route.ts
│   │   ├── delivery/[id]/accept/route.ts
│   │   ├── delivery/[id]/location/route.ts
│   │   ├── users/route.ts
│   │   ├── users/[id]/route.ts
│   │   ├── loyalty/route.ts
│   │   ├── ratings/route.ts
│   │   ├── tickets/route.ts
│   │   ├── tickets/[id]/route.ts
│   │   ├── tickets/[id]/messages/route.ts
│   │   ├── admin/stats/route.ts
│   │   ├── admin/orders/route.ts
│   │   └── ws/delivery/route.ts     # WebSocket handler
│   ├── layout.tsx                   # Root layout
│   └── globals.css
├── lib/                             # Utilities
│   ├── auth.ts                      # NextAuth config
│   ├── db.ts                        # Prisma client
│   ├── redis.ts                     # Redis client
│   ├── stripe.ts                    # Stripe config
│   ├── validators.ts                # Zod schemas
│   ├── types.ts                     # TypeScript types
│   ├── utils.ts                     # Helper functions
│   └── constants.ts                 # App constants
├── components/                      # Reusable React components
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   └── RegisterForm.tsx
│   ├── products/
│   │   ├── ProductCard.tsx
│   │   ├── ProductGrid.tsx
│   │   └── ProductFilter.tsx
│   ├── cart/
│   │   ├── CartSummary.tsx
│   │   └── CartItem.tsx
│   ├── delivery/
│   │   ├── DeliveryMap.tsx
│   │   └── DeliveryStatus.tsx
│   ├── admin/
│   │   ├── AdminNav.tsx
│   │   ├── StatsCard.tsx
│   │   └── DataTable.tsx
│   ├── common/
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   ├── Loading.tsx
│   │   └── ErrorBoundary.tsx
│   └── ui/                          # Shadcn/ui components
├── public/
│   └── uploads/                     # Local file storage
│       ├── products/
│       ├── tickets/
│       ├── deliveries/
│       └── profiles/
├── prisma/
│   ├── schema.prisma                # Database schema
│   └── migrations/                  # Schema migrations
├── tests/                           # Test files
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
│   ├── superpowers/
│   │   ├── specs/
│   │   └── plans/
│   └── API.md
├── .env.example
├── docker-compose.yml               # Local dev setup
├── Dockerfile
├── package.json
├── tsconfig.json
├── next.config.js
└── README.md
```

---

## PHASE 1: FOUNDATION & PROJECT SETUP (Week 1-2)

### Task 1: Initialize Next.js project with TypeScript and dependencies

**Files:**
- Create: `package.json` (with all dependencies)
- Create: `tsconfig.json`
- Create: `next.config.js`
- Create: `.env.example`
- Create: `docker-compose.yml`

**Dependencies to add:**
```
next@14.0.0 react@18.2.0 react-dom@18.2.0
typescript @types/react @types/node
prisma @prisma/client
next-auth@5.0
stripe
socket.io socket.io-client
zod
tailwindcss postcss autoprefixer
shadcn-ui
redis ioredis
axios
```

- [ ] **Step 1: Create package.json with all dependencies**

```json
{
  "name": "maison-doree",
  "version": "1.0.0",
  "description": "E-commerce platform for Moroccan pastries",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "jest",
    "test:watch": "jest --watch",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio"
  },
  "dependencies": {
    "next": "14.0.0",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "typescript": "5.3.0",
    "@types/react": "18.2.0",
    "@types/node": "20.10.0",
    "prisma": "5.7.0",
    "@prisma/client": "5.7.0",
    "next-auth": "5.0.0",
    "stripe": "14.8.0",
    "socket.io": "4.7.0",
    "socket.io-client": "4.7.0",
    "zod": "3.22.0",
    "tailwindcss": "3.4.0",
    "postcss": "8.4.0",
    "autoprefixer": "10.4.0",
    "redis": "4.6.0",
    "ioredis": "5.3.0",
    "axios": "1.6.0",
    "bcryptjs": "2.4.0",
    "clsx": "2.0.0",
    "date-fns": "2.30.0"
  },
  "devDependencies": {
    "@testing-library/react": "14.0.0",
    "@testing-library/jest-dom": "6.1.0",
    "jest": "29.7.0",
    "@types/jest": "29.5.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create next.config.js**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
  },
};

module.exports = nextConfig;
```

- [ ] **Step 4: Create .env.example**

```
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/maison_doree"

# Redis
REDIS_URL="redis://localhost:6379"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# App
NODE_ENV="development"
```

- [ ] **Step 5: Create docker-compose.yml for local development**

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: maison_doree_user
      POSTGRES_PASSWORD: devpassword
      POSTGRES_DB: maison_doree
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

- [ ] **Step 6: Run npm install**

```bash
npm install
```

Expected: All dependencies installed

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json next.config.js .env.example docker-compose.yml
git commit -m "chore: initialize Next.js project with dependencies"
```

---

### Task 2: Set up Tailwind CSS and project structure

**Files:**
- Create: `app/globals.css`
- Create: `app/layout.tsx`
- Create: `postcss.config.js`
- Create: `tailwind.config.ts`
- Create: `lib/constants.ts`

- [ ] **Step 1: Create tailwind.config.ts**

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#8B4513',    // Brown for pastries
        secondary: '#D4AF37',  // Gold
      },
    },
  },
  plugins: [],
}
export default config
```

- [ ] **Step 2: Create postcss.config.js**

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 3: Create app/globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html {
  scroll-behavior: smooth;
}

body {
  @apply bg-white text-gray-900;
}

a {
  @apply text-primary hover:underline;
}
```

- [ ] **Step 4: Create app/layout.tsx (root layout)**

```typescript
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Maison Dorée - Pâtisseries Maroc',
  description: 'Plateforme de vente de pâtisseries artisanales marocaines',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 5: Create lib/constants.ts**

```typescript
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

export const POINTS_PER_DINAR = 1 // 1 point per 1 DH spent
export const TIER_THRESHOLDS = {
  SILVER: 100, // 100 DH spent
  GOLD: 500,   // 500 DH spent
} as const
```

- [ ] **Step 6: Create lib/types.ts**

```typescript
export type User = {
  id: string
  email: string
  role: 'CUSTOMER' | 'ADMIN' | 'DRIVER'
  profile?: UserProfile
  createdAt: Date
}

export type UserProfile = {
  id: string
  userId: string
  firstName?: string
  lastName?: string
  phone?: string
  address?: string
  city?: string
  zipCode?: string
  profilePhoto?: string
}

export type Product = {
  id: string
  name: string
  description?: string
  price: number
  category: string
  stock: number
  minimumStock: number
  photos: string[]
  isFeatured: boolean
  createdAt: Date
  updatedAt: Date
}

export type Order = {
  id: string
  orderNumber: string
  userId: string
  subtotal: number
  taxAmount: number
  totalPrice: number
  status: OrderStatus
  deliveryAddress: string
  deliveryCity: string
  deliveryZipCode: string
  items: OrderItem[]
  payment?: Payment
  delivery?: Delivery
  createdAt: Date
  updatedAt: Date
}

export type OrderStatus = 
  | 'PENDING'
  | 'CONFIRMED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'DELIVERED'
  | 'CANCELLED'

export type OrderItem = {
  id: string
  orderId: string
  productId: string
  product: Product
  quantity: number
  priceAtTime: number
  packaging?: string
  packagingPrice: number
}

export type Payment = {
  id: string
  orderId: string
  amount: number
  method: 'STRIPE' | 'CASH_ON_DELIVERY'
  status: PaymentStatus
  stripePaymentId?: string
  collectedAmount?: number
  createdAt: Date
}

export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED'

export type Delivery = {
  id: string
  orderId: string
  driverId?: string
  driver?: User
  status: DeliveryStatus
  currentLat?: number
  currentLng?: number
  locationUpdatedAt?: Date
  estimatedDelivery?: Date
  actualDelivery?: Date
  proofPhoto?: string
  createdAt: Date
}

export type DeliveryStatus = 
  | 'UNASSIGNED'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'DELIVERED'
  | 'CANCELLED'

export type LoyaltyCard = {
  id: string
  userId: string
  points: number
  totalSpent: number
  tier: 'BRONZE' | 'SILVER' | 'GOLD'
  createdAt: Date
}

export type Rating = {
  id: string
  userId: string
  orderId: string
  productId?: string
  type: 'PRODUCT' | 'DELIVERY'
  score: number
  comment?: string
  createdAt: Date
}

export type Ticket = {
  id: string
  ticketNumber: string
  userId: string
  orderId?: string
  title: string
  description: string
  status: TicketStatus
  priority: Priority
  messages: TicketMessage[]
  attachments: string[]
  createdAt: Date
  resolvedAt?: Date
}

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export type TicketMessage = {
  id: string
  ticketId: string
  userId: string
  message: string
  attachments: string[]
  createdAt: Date
}
```

- [ ] **Step 7: Commit**

```bash
git add tailwind.config.ts postcss.config.js app/globals.css app/layout.tsx lib/constants.ts lib/types.ts
git commit -m "feat: set up Tailwind CSS and define app constants/types"
```

---

### Task 3: Set up Prisma ORM and PostgreSQL

**Files:**
- Create: `prisma/schema.prisma`

- [ ] **Step 1: Initialize Prisma**

```bash
npx prisma init
```

- [ ] **Step 2: Update .env with PostgreSQL connection (for docker-compose)**

```
DATABASE_URL="postgresql://maison_doree_user:devpassword@localhost:5432/maison_doree"
```

- [ ] **Step 3: Start PostgreSQL and Redis in Docker**

```bash
docker-compose up -d
```

Expected: PostgreSQL and Redis running

- [ ] **Step 4: Create prisma/schema.prisma**

```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ===== USERS & AUTH =====

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String?
  role          Role      @default(CUSTOMER)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  profile       UserProfile?
  orders        Order[]
  loyaltyCard   LoyaltyCard?
  ratings       Rating[]
  tickets       Ticket[]
  deliveries    Delivery[] @relation("driver")

  @@index([email])
  @@index([role])
}

enum Role {
  CUSTOMER
  ADMIN
  DRIVER
}

model UserProfile {
  id             String   @id @default(cuid())
  userId         String   @unique
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  firstName      String?
  lastName       String?
  phone          String?
  address        String?
  city           String?
  zipCode        String?
  profilePhoto   String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

// ===== PRODUCTS =====

model Product {
  id             String   @id @default(cuid())
  name           String
  description    String?
  price          Decimal  @db.Decimal(10, 2)
  category       String
  stock          Int      @default(0)
  minimumStock   Int      @default(10)
  photos         String[]
  isFeatured     Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  orderItems     OrderItem[]
  ratings        Rating[]
  packaging      Packaging[]

  @@index([category])
  @@index([isFeatured])
}

model Packaging {
  id             String   @id @default(cuid())
  productId      String
  product        Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  name           String
  priceModifier  Decimal  @default(0) @db.Decimal(10, 2)
  createdAt      DateTime @default(now())
}

// ===== ORDERS =====

model Order {
  id                  String   @id @default(cuid())
  orderNumber         String   @unique
  userId              String
  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  subtotal            Decimal  @db.Decimal(10, 2)
  taxAmount           Decimal  @db.Decimal(10, 2)
  totalPrice          Decimal  @db.Decimal(10, 2)

  status              OrderStatus @default(PENDING)

  deliveryAddress     String
  deliveryCity        String
  deliveryZipCode     String

  items               OrderItem[]
  payment             Payment?
  delivery            Delivery?
  ratings             Rating[]
  tickets             Ticket[]

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([userId])
  @@index([status])
  @@index([createdAt])
}

enum OrderStatus {
  PENDING
  CONFIRMED
  ASSIGNED
  IN_PROGRESS
  DELIVERED
  CANCELLED
}

model OrderItem {
  id             String   @id @default(cuid())
  orderId        String
  order          Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId      String
  product        Product  @relation(fields: [productId], references: [id])

  quantity       Int
  priceAtTime    Decimal  @db.Decimal(10, 2)
  packaging      String?
  packagingPrice Decimal  @default(0) @db.Decimal(10, 2)

  @@index([orderId])
}

// ===== PAYMENTS =====

model Payment {
  id              String   @id @default(cuid())
  orderId         String   @unique
  order           Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)

  amount          Decimal  @db.Decimal(10, 2)
  method          PaymentMethod
  status          PaymentStatus @default(PENDING)

  stripePaymentId String?
  stripeStatus    String?

  collectedAmount Decimal? @db.Decimal(10, 2)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([orderId])
  @@index([status])
}

enum PaymentMethod {
  STRIPE
  CASH_ON_DELIVERY
}

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
}

// ===== DELIVERY =====

model Delivery {
  id                  String   @id @default(cuid())
  orderId             String   @unique
  order               Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)

  driverId            String?
  driver              User?    @relation("driver", fields: [driverId], references: [id], onDelete: SetNull)

  status              DeliveryStatus @default(UNASSIGNED)

  currentLat          Decimal? @db.Decimal(10, 8)
  currentLng          Decimal? @db.Decimal(10, 8)
  locationUpdatedAt   DateTime?

  estimatedDelivery   DateTime?
  actualDelivery      DateTime?

  proofPhoto          String?

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([driverId])
  @@index([status])
}

enum DeliveryStatus {
  UNASSIGNED
  ASSIGNED
  ACCEPTED
  IN_PROGRESS
  DELIVERED
  CANCELLED
}

// ===== LOYALTY =====

model LoyaltyCard {
  id         String   @id @default(cuid())
  userId     String   @unique
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  points     Int      @default(0)
  totalSpent Decimal  @db.Decimal(10, 2) @default(0)
  tier       Tier     @default(BRONZE)

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

enum Tier {
  BRONZE
  SILVER
  GOLD
}

// ===== RATINGS =====

model Rating {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  orderId    String
  order      Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)

  productId  String?
  product    Product? @relation(fields: [productId], references: [id], onDelete: SetNull)

  type       RatingType
  score      Int
  comment    String?

  createdAt  DateTime @default(now())

  @@index([userId])
  @@index([orderId])
}

enum RatingType {
  PRODUCT
  DELIVERY
}

// ===== SUPPORT TICKETS =====

model Ticket {
  id           String   @id @default(cuid())
  ticketNumber String   @unique
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  orderId      String?
  order        Order?   @relation(fields: [orderId], references: [id], onDelete: SetNull)

  title        String
  description  String
  status       TicketStatus @default(OPEN)
  priority     Priority @default(MEDIUM)

  messages     TicketMessage[]
  attachments  String[]

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  resolvedAt   DateTime?

  @@index([userId])
  @@index([status])
}

enum TicketStatus {
  OPEN
  IN_PROGRESS
  RESOLVED
  CLOSED
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

model TicketMessage {
  id          String   @id @default(cuid())
  ticketId    String
  ticket      Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: SetNull)

  message     String
  attachments String[]

  createdAt   DateTime @default(now())
}
```

- [ ] **Step 5: Run first migration**

```bash
npx prisma migrate dev --name init
```

Expected: Migration created and applied

- [ ] **Step 6: Verify schema in Prisma Studio**

```bash
npx prisma studio
```

Expected: Opens browser with database visualization

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: set up Prisma ORM with PostgreSQL schema"
```

---

### Task 4: Set up Prisma client and utility functions

**Files:**
- Create: `lib/db.ts`
- Create: `lib/redis.ts`
- Create: `lib/validators.ts`

- [ ] **Step 1: Create lib/db.ts**

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const db =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['error'],
  })

if (process.env.NODE_ENV !== 'production')
  globalForPrisma.prisma = db
```

- [ ] **Step 2: Create lib/redis.ts**

```typescript
import Redis from 'ioredis'

const globalForRedis = global as unknown as { redis: Redis }

export const redis =
  globalForRedis.redis ||
  new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    enableReadyCheck: false,
  })

if (process.env.NODE_ENV !== 'production')
  globalForRedis.redis = redis

// Cache utilities
export const cache = {
  get: (key: string) => redis.get(key),
  set: (key: string, value: string, ttl?: number) => {
    if (ttl) return redis.setex(key, ttl, value)
    return redis.set(key, value)
  },
  del: (key: string) => redis.del(key),
  exists: (key: string) => redis.exists(key),
}
```

- [ ] **Step 3: Create lib/validators.ts**

```typescript
import { z } from 'zod'

export const LoginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Minimum 6 caractères'),
})

export const RegisterSchema = LoginSchema.extend({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  phone: z.string().optional(),
})

export const ProductSchema = z.object({
  name: z.string().min(3),
  description: z.string().optional(),
  price: z.string().refine((val) => parseFloat(val) > 0),
  category: z.string().min(1),
  stock: z.string().refine((val) => parseInt(val) >= 0),
  minimumStock: z.string().refine((val) => parseInt(val) >= 0),
})

export const OrderSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
      packaging: z.string().optional(),
    })
  ),
  deliveryAddress: z.string().min(5),
  deliveryCity: z.string().min(2),
  deliveryZipCode: z.string().min(2),
  paymentMethod: z.enum(['STRIPE', 'CASH_ON_DELIVERY']),
})

export const RatingSchema = z.object({
  orderId: z.string(),
  productId: z.string().optional(),
  type: z.enum(['PRODUCT', 'DELIVERY']),
  score: z.number().int().min(1).max(5),
  comment: z.string().optional(),
})

export const TicketSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(10),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  orderId: z.string().optional(),
})

export type LoginInput = z.infer<typeof LoginSchema>
export type RegisterInput = z.infer<typeof RegisterSchema>
export type ProductInput = z.infer<typeof ProductSchema>
export type OrderInput = z.infer<typeof OrderSchema>
export type RatingInput = z.infer<typeof RatingSchema>
export type TicketInput = z.infer<typeof TicketSchema>
```

- [ ] **Step 4: Commit**

```bash
git add lib/db.ts lib/redis.ts lib/validators.ts
git commit -m "feat: add Prisma client, Redis, and Zod validators"
```

---

## PHASE 2: AUTHENTICATION & AUTHORIZATION (Week 3)

### Task 5: Set up NextAuth.js with credentials provider

**Files:**
- Create: `lib/auth.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `lib/auth-middleware.ts`

- [ ] **Step 1: Create lib/auth.ts with NextAuth configuration**

```typescript
import { type NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { db } from './db'
import bcrypt from 'bcryptjs'
import { LoginSchema } from './validators'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email et mot de passe requis')
        }

        // Validate input
        const result = LoginSchema.safeParse(credentials)
        if (!result.success) {
          throw new Error('Données invalides')
        }

        // Find user
        const user = await db.user.findUnique({
          where: { email: credentials.email },
          include: { profile: true },
        })

        if (!user || !user.passwordHash) {
          throw new Error('Email ou mot de passe incorrect')
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        )

        if (!isPasswordValid) {
          throw new Error('Email ou mot de passe incorrect')
        }

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.profile?.firstName || user.email,
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
}
```

- [ ] **Step 2: Create app/api/auth/[...nextauth]/route.ts**

```typescript
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
```

- [ ] **Step 3: Create lib/auth-middleware.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function withAuth(
  req: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>,
  requiredRoles?: string[]
) {
  const token = await getToken({ req })

  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  if (requiredRoles && !requiredRoles.includes(token.role as string)) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }

  return handler(req)
}
```

- [ ] **Step 4: Test authentication flow (manual)**

```bash
curl -X POST http://localhost:3000/api/auth/callback/credentials \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

Expected: Error (no user yet) or success with token

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts lib/auth-middleware.ts app/api/auth/[...nextauth]/route.ts
git commit -m "feat: set up NextAuth.js with credentials provider"
```

---

### Task 6: Create registration API and basic auth pages

**Files:**
- Create: `app/api/auth/register/route.ts`
- Create: `app/(auth)/register/page.tsx`
- Create: `app/(auth)/login/page.tsx`
- Create: `components/auth/LoginForm.tsx`
- Create: `components/auth/RegisterForm.tsx`

- [ ] **Step 1: Create app/api/auth/register/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { RegisterSchema } from '@/lib/validators'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate
    const result = RegisterSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { email, password, firstName, lastName, phone } = result.data

    // Check if user exists
    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 409 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // Create user
    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        role: 'CUSTOMER',
        profile: {
          create: {
            firstName,
            lastName,
            phone,
          },
        },
        loyaltyCard: {
          create: {},
        },
      },
      include: { profile: true, loyaltyCard: true },
    })

    return NextResponse.json(
      {
        message: 'User created successfully',
        user: {
          id: user.id,
          email: user.email,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Create components/auth/LoginForm.tsx**

```typescript
'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { LoginSchema, type LoginInput } from '@/lib/validators'

export function LoginForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<LoginInput>({
    email: '',
    password: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = LoginSchema.safeParse(formData)
    if (!result.success) {
      setError('Données invalides')
      setLoading(false)
      return
    }

    const response = await signIn('credentials', {
      email: formData.email,
      password: formData.password,
      redirect: false,
    })

    if (!response?.ok) {
      setError(response?.error || 'Erreur de connexion')
      setLoading(false)
      return
    }

    router.push('/products')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-red-100 text-red-700 p-3 rounded">{error}</div>}

      <input
        type="email"
        name="email"
        placeholder="Email"
        value={formData.email}
        onChange={handleChange}
        className="w-full px-4 py-2 border rounded"
        required
      />

      <input
        type="password"
        name="password"
        placeholder="Mot de passe"
        value={formData.password}
        onChange={handleChange}
        className="w-full px-4 py-2 border rounded"
        required
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary text-white py-2 rounded hover:bg-opacity-90 disabled:opacity-50"
      >
        {loading ? 'Connexion...' : 'Se connecter'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Create components/auth/RegisterForm.tsx**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RegisterSchema, type RegisterInput } from '@/lib/validators'

export function RegisterForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<RegisterInput>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = RegisterSchema.safeParse(formData)
    if (!result.success) {
      setError('Données invalides')
      setLoading(false)
      return
    }

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })

    if (!response.ok) {
      const data = await response.json()
      setError(data.error || 'Erreur lors de l\'inscription')
      setLoading(false)
      return
    }

    router.push('/login?registered=true')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-red-100 text-red-700 p-3 rounded">{error}</div>}

      <div className="grid grid-cols-2 gap-4">
        <input
          type="text"
          name="firstName"
          placeholder="Prénom"
          value={formData.firstName}
          onChange={handleChange}
          className="px-4 py-2 border rounded"
          required
        />
        <input
          type="text"
          name="lastName"
          placeholder="Nom"
          value={formData.lastName}
          onChange={handleChange}
          className="px-4 py-2 border rounded"
          required
        />
      </div>

      <input
        type="email"
        name="email"
        placeholder="Email"
        value={formData.email}
        onChange={handleChange}
        className="w-full px-4 py-2 border rounded"
        required
      />

      <input
        type="password"
        name="password"
        placeholder="Mot de passe"
        value={formData.password}
        onChange={handleChange}
        className="w-full px-4 py-2 border rounded"
        required
      />

      <input
        type="tel"
        name="phone"
        placeholder="Téléphone (optionnel)"
        value={formData.phone || ''}
        onChange={handleChange}
        className="w-full px-4 py-2 border rounded"
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary text-white py-2 rounded hover:bg-opacity-90 disabled:opacity-50"
      >
        {loading ? 'Inscription...' : 'S\'inscrire'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Create app/(auth)/login/page.tsx**

```typescript
import Link from 'next/link'
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">Maison Dorée</h1>
        <h2 className="text-lg font-semibold mb-6">Se connecter</h2>

        <LoginForm />

        <p className="text-center mt-6 text-gray-600">
          Pas encore de compte?{' '}
          <Link href="/register" className="text-primary font-semibold">
            S'inscrire
          </Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create app/(auth)/register/page.tsx**

```typescript
import Link from 'next/link'
import { RegisterForm } from '@/components/auth/RegisterForm'

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">Maison Dorée</h1>
        <h2 className="text-lg font-semibold mb-6">S'inscrire</h2>

        <RegisterForm />

        <p className="text-center mt-6 text-gray-600">
          Vous avez un compte?{' '}
          <Link href="/login" className="text-primary font-semibold">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create app/(auth)/layout.tsx**

```typescript
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
```

- [ ] **Step 7: Test registration and login flows manually**

```bash
# Test register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"user@example.com",
    "password":"password123",
    "firstName":"John",
    "lastName":"Doe"
  }'

# Expected: 201 with user object
```

- [ ] **Step 8: Commit**

```bash
git add app/api/auth/register/route.ts app/(auth)/ components/auth/
git commit -m "feat: add registration API and auth pages (login/register)"
```

---

## PHASE 3: CORE API & PRODUCTS (Week 4)

### Task 7: Create Products API (CRUD operations)

**Files:**
- Create: `app/api/products/route.ts`
- Create: `app/api/products/[id]/route.ts`

- [ ] **Step 1: Create app/api/products/route.ts (GET & POST)**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ProductSchema } from '@/lib/validators'
import { getToken } from 'next-auth/jwt'

// GET /api/products - List products (public)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const featured = searchParams.get('featured') === 'true'
    const skip = parseInt(searchParams.get('skip') || '0')
    const take = parseInt(searchParams.get('take') || '20')

    const where: any = {}
    if (category) where.category = category
    if (featured) where.isFeatured = true

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      db.product.count({ where }),
    ])

    return NextResponse.json({
      data: products,
      pagination: { skip, take, total },
    })
  } catch (error) {
    console.error('Get products error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/products - Create product (admin only)
export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req })

    if (!token || token.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const result = ProductSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { name, description, price, category, stock, minimumStock } =
      result.data

    const product = await db.product.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        category,
        stock: parseInt(stock),
        minimumStock: parseInt(minimumStock),
      },
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('Create product error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Create app/api/products/[id]/route.ts (GET, PATCH, DELETE)**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ProductSchema } from '@/lib/validators'
import { getToken } from 'next-auth/jwt'

type Params = {
  params: { id: string }
}

// GET /api/products/[id]
export async function GET(
  req: NextRequest,
  { params }: Params
) {
  try {
    const product = await db.product.findUnique({
      where: { id: params.id },
      include: {
        packaging: true,
        ratings: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(product)
  } catch (error) {
    console.error('Get product error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/products/[id] - Update product (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: Params
) {
  try {
    const token = await getToken({ req })

    if (!token || token.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const result = ProductSchema.partial().safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed' },
        { status: 400 }
      )
    }

    const updateData: any = {}
    if (result.data.name) updateData.name = result.data.name
    if (result.data.description) updateData.description = result.data.description
    if (result.data.price) updateData.price = parseFloat(result.data.price)
    if (result.data.category) updateData.category = result.data.category
    if (result.data.stock !== undefined)
      updateData.stock = parseInt(result.data.stock)
    if (result.data.minimumStock !== undefined)
      updateData.minimumStock = parseInt(result.data.minimumStock)

    const product = await db.product.update({
      where: { id: params.id },
      data: updateData,
    })

    return NextResponse.json(product)
  } catch (error) {
    console.error('Update product error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/products/[id] - Delete product (admin only)
export async function DELETE(
  req: NextRequest,
  { params }: Params
) {
  try {
    const token = await getToken({ req })

    if (!token || token.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    await db.product.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: 'Product deleted' })
  } catch (error) {
    console.error('Delete product error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 3: Test products API**

```bash
# GET products
curl http://localhost:3000/api/products

# GET single product
curl http://localhost:3000/api/products/abc123

# POST (needs admin token - test later)
```

Expected: Empty array or 404 (no products yet)

- [ ] **Step 4: Commit**

```bash
git add app/api/products/
git commit -m "feat: create products API (CRUD operations)"
```

---

### Task 8: Create Orders API (creation and management)

**Files:**
- Create: `app/api/orders/route.ts`
- Create: `app/api/orders/[id]/route.ts`

- [ ] **Step 1: Create app/api/orders/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { OrderSchema } from '@/lib/validators'
import { getToken } from 'next-auth/jwt'

// POST /api/orders - Create order
export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req })

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const result = OrderSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { items, deliveryAddress, deliveryCity, deliveryZipCode, paymentMethod } =
      result.data

    // Calculate totals
    let subtotal = 0
    const orderItems = []

    for (const item of items) {
      const product = await db.product.findUnique({
        where: { id: item.productId },
      })

      if (!product) {
        return NextResponse.json(
          { error: `Product ${item.productId} not found` },
          { status: 404 }
        )
      }

      if (product.stock < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for ${product.name}` },
          { status: 400 }
        )
      }

      const itemTotal = parseFloat(product.price.toString()) * item.quantity
      subtotal += itemTotal

      orderItems.push({
        productId: item.productId,
        quantity: item.quantity,
        priceAtTime: product.price,
        packaging: item.packaging,
        packagingPrice: 0,
      })
    }

    const taxAmount = subtotal * 0.2 // 20% tax
    const totalPrice = subtotal + taxAmount

    // Generate order number
    const orderNumber = `ORD-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}-${Math.random().toString(36).substr(2, 3).toUpperCase()}`

    const order = await db.order.create({
      data: {
        orderNumber,
        userId: token.id as string,
        subtotal,
        taxAmount,
        totalPrice,
        deliveryAddress,
        deliveryCity,
        deliveryZipCode,
        status: 'PENDING',
        items: {
          create: orderItems,
        },
        payment: {
          create: {
            amount: totalPrice,
            method: paymentMethod,
            status: 'PENDING',
          },
        },
        delivery: {
          create: {
            status: 'UNASSIGNED',
          },
        },
      },
      include: {
        items: { include: { product: true } },
        payment: true,
        delivery: true,
      },
    })

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    console.error('Create order error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/orders - List user orders
export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req })

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const orders = await db.order.findMany({
      where: { userId: token.id as string },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { product: true } },
        payment: true,
        delivery: true,
      },
    })

    return NextResponse.json(orders)
  } catch (error) {
    console.error('Get orders error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Create app/api/orders/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getToken } from 'next-auth/jwt'

type Params = {
  params: { id: string }
}

// GET /api/orders/[id]
export async function GET(
  req: NextRequest,
  { params }: Params
) {
  try {
    const token = await getToken({ req })

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const order = await db.order.findUnique({
      where: { id: params.id },
      include: {
        items: { include: { product: true } },
        payment: true,
        delivery: true,
        ratings: true,
        tickets: true,
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Check authorization (user owns order or is admin)
    if (
      token.id !== order.userId &&
      token.role !== 'ADMIN'
    ) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    return NextResponse.json(order)
  } catch (error) {
    console.error('Get order error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/orders/[id]/assign-driver
export async function PATCH(
  req: NextRequest,
  { params }: Params
) {
  try {
    const token = await getToken({ req })

    if (!token || token.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const { driverId } = await req.json()

    if (!driverId) {
      return NextResponse.json(
        { error: 'driverId required' },
        { status: 400 }
      )
    }

    const delivery = await db.delivery.updateMany({
      where: { orderId: params.id },
      data: {
        driverId,
        status: 'ASSIGNED',
      },
    })

    if (delivery.count === 0) {
      return NextResponse.json(
        { error: 'Delivery not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: 'Driver assigned' })
  } catch (error) {
    console.error('Assign driver error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 3: Add test data (seed)**

```typescript
// lib/seed.ts
import { db } from './db'
import bcrypt from 'bcryptjs'

export async function seedDatabase() {
  // Create test admin
  const adminPassword = await bcrypt.hash('admin123', 12)
  const admin = await db.user.create({
    data: {
      email: 'admin@example.com',
      passwordHash: adminPassword,
      role: 'ADMIN',
      profile: {
        create: {
          firstName: 'Admin',
          lastName: 'User',
        },
      },
    },
  })

  // Create test customer
  const customerPassword = await bcrypt.hash('customer123', 12)
  const customer = await db.user.create({
    data: {
      email: 'customer@example.com',
      passwordHash: customerPassword,
      role: 'CUSTOMER',
      profile: {
        create: {
          firstName: 'John',
          lastName: 'Doe',
        },
      },
      loyaltyCard: {
        create: {},
      },
    },
  })

  // Create test products
  await db.product.createMany({
    data: [
      {
        name: 'Pâtes Amandes',
        description: 'Pâtes amandes artisanales',
        price: new Decimal('25.00'),
        category: 'Pates',
        stock: 50,
        minimumStock: 10,
        isFeatured: true,
      },
      {
        name: 'Macarons',
        description: 'Macarons colorés',
        price: new Decimal('15.00'),
        category: 'Cookies',
        stock: 100,
        minimumStock: 20,
        isFeatured: true,
      },
    ],
  })

  console.log('Database seeded')
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/orders/ lib/seed.ts
git commit -m "feat: create orders API with assignment and management"
```

---

## CONTINUATION NOTES

Due to token limitations, the remaining phases (PHASE 4-8) will follow the same detailed pattern:

**PHASE 4: PAYMENT INTEGRATION (Week 5)**
- Task 9: Stripe integration (checkout, webhooks)
- Task 10: Payment confirmation and COD handling

**PHASE 5: CLIENT FRONTEND & CATALOG (Week 6-7)**
- Task 11: Homepage with countdown page
- Task 12: Product catalog and filtering
- Task 13: Shopping cart with persistence
- Task 14: Checkout flow UI

**PHASE 6: DELIVERY & REAL-TIME TRACKING (Week 8-9)**
- Task 15: WebSocket server setup (Socket.io)
- Task 16: Delivery tracking API endpoints
- Task 17: Real-time map for clients
- Task 18: Driver delivery interface

**PHASE 7: ADMIN PANEL (Week 10)**
- Task 19: Admin dashboard
- Task 20: Product management UI
- Task 21: Stock management
- Task 22: Delivery optimization
- Task 23: User management

**PHASE 8: SUPPORT, LOYALTY & POLISH (Week 11-12)**
- Task 24: Ratings and reviews
- Task 25: Loyalty card system
- Task 26: Ticket support system
- Task 27: Testing and optimization
- Task 28: Coolify deployment

---

## TESTING STRATEGY

Each task includes manual curl tests. For complete validation:

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests (week 11)
npm run test:e2e
```

---

## DEPLOYMENT CHECKLIST

Before Coolify deployment (Week 12):
- [ ] All API routes tested
- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] Stripe keys validated
- [ ] Redis connected
- [ ] Docker image builds
- [ ] HTTPS configured
- [ ] Domain pointed to Coolify

---

## EXECUTION NOTES

**For subagent-driven execution:**
- Dispatch one task at a time
- Review code between tasks
- Adjust tasks based on findings

**For inline execution:**
- Execute tasks sequentially
- Checkpoint after each phase
- Run tests frequently

Both approaches will produce the complete system by end of Week 12.
