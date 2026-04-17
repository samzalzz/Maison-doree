# Maison Dorée - E-Commerce Pâtisseries Maroc
## Design Specification Document

**Date:** 2026-04-17  
**Project:** Plateforme e-commerce complet pour vente de pâtisseries au Maroc  
**Scope:** Front-end client + Admin panel + Livreur panel  
**Target:** MVP complet en production sur Coolify

---

## 1. OVERVIEW & OBJECTIVES

### Business Goals
- Lancer une plateforme e-commerce complète pour vendre des pâtisseries
- Inclure un système de livraison avec suivi temps réel
- Gérer fidélité client et support par tickets
- Pouvoir gérer l'inventaire et les livreurs via admin panel

### Technical Objectives
- Single codebase (Next.js) pour tous les interfaces
- Scalable et performant dès le départ
- Déployable sur serveur Coolify existant
- Real-time capabilities (tracking livreurs, notifications)

---

## 2. ARCHITECTURE

### 2.1 Overall Architecture

```
┌─────────────────────────────────────────────────────┐
│          NEXT.JS 14 (Frontend + Backend API)         │
├─────────────────────────────────────────────────────┤
│                                                       │
│  CLIENT PAGES          ADMIN PAGES      DRIVER PAGES │
│  ├─ Countdown         ├─ Dashboard      ├─ Orders   │
│  ├─ Produits          ├─ Produits       ├─ Map      │
│  ├─ Panier            ├─ Stocks         └─ Profile  │
│  ├─ Fidélité          ├─ Livraisons              │
│  ├─ Commandes         ├─ Utilisateurs           │
│  ├─ Notes/Rating      └─ Analytics              │
│  └─ Tickets                                       │
│                                                       │
├─────────────────────────────────────────────────────┤
│         BACKEND API ROUTES + WebSockets              │
│  ├─ /api/auth                                       │
│  ├─ /api/products                                   │
│  ├─ /api/orders                                     │
│  ├─ /api/delivery (geolocation + WebSockets)       │
│  ├─ /api/users                                      │
│  ├─ /api/loyalty                                    │
│  ├─ /api/ratings                                    │
│  ├─ /api/tickets                                    │
│  └─ /api/payments (Stripe + COD)                    │
├─────────────────────────────────────────────────────┤
│              DATABASE & CACHE LAYER                   │
│  ├─ PostgreSQL (Coolify managed)                     │
│  └─ Redis (sessions, stocks, real-time tracking)   │
└─────────────────────────────────────────────────────┘
```

### 2.2 Tech Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| **Frontend** | Next.js 14 App Router + TypeScript | Full-stack integration, Server Components |
| **Styling** | Tailwind CSS + Shadcn/ui | Fast development, consistent design |
| **Backend** | Next.js API Routes + TypeScript | Single codebase, serverless-compatible |
| **ORM** | Prisma | Type-safe, powerful, PostgreSQL native |
| **Database** | PostgreSQL | ACID compliance, scalable, Coolify support |
| **Cache** | Redis | Real-time tracking, sessions, stock cache |
| **Auth** | NextAuth.js | Open source, JWT + sessions, role-based |
| **Payments** | Stripe SDK + Custom COD | Flexible payment options |
| **Real-time** | WebSockets (Socket.io) | Live delivery tracking, notifications |
| **File Storage** | Local `/public/uploads` | Simplicity, Coolify-friendly |
| **Deployment** | Docker + Coolify | Self-hosted, full control |

---

## 3. FEATURES & MODULES

### 3.1 Client Panel (Public Routes)

#### A. Countdown Page
- Affiche date de lancement + countdown timer
- Email signup pour notifications à l'ouverture
- Design attractif avec theme pâtisserie marocaine

#### B. Product Catalog
- Affichage produits avec photos (local storage)
- Filtres par catégorie, prix, rating
- Recherche par nom
- Détails produits + avis clients

#### C. Shopping Cart
- Ajouter/retirer produits
- Sélection packaging (si applicable)
- Calcul totaux (prix + taxes)
- Panier persiste en session

#### D. Checkout & Payments
- **Stripe:** Intégration complète checkout Stripe
- **COD (Cash On Delivery):** Confirmation simple, paiement à la livraison
- Adresse de livraison
- Récapitulatif commande

#### E. Order History
- Liste commandes passées
- Détails de chaque commande
- Statut de livraison

#### F. Delivery Tracking
- Map interactive (Leaflet + OpenStreetMap)
- Position livreur en temps réel (WebSockets)
- ETA estimé
- Historique positions

#### G. Loyalty Card
- Points gagnés par commande
- Solde actuel et historique
- Réductions applicables
- Tier system (Bronze/Silver/Gold)

#### H. Product Ratings
- Noter produit (1-5 stars) + commentaire
- Noter livraison
- Voir notes d'autres clients

#### I. Support Tickets
- Créer ticket (problème, question, etc.)
- Upload photos (locale)
- Chat avec support
- Voir statut ticket

### 3.2 Admin Panel (/admin/*)

#### Access Control
- Protected by NextAuth.js (role = ADMIN)
- Middleware authentication sur toutes routes /admin/*

#### A. Dashboard
- KPIs: Revenue, Commandes (jour/mois), Clients actifs
- Graphiques ventes par produit
- Commandes en attente
- Tickets non résolus

#### B. Product Management
- CRUD produits: Nom, description, prix, catégories
- Packaging options
- Upload photos (local)
- Stock initial et seuil d'alerte
- Featured products pour homepage

#### C. Stock Management
- Vue globale stocks
- Alertes produits bas-stock
- Ajustements manuels
- Historique mouvements

#### D. Delivery Management
- Liste commandes à assigner
- Assigner à livreur
- Tracker progession (Confirmée → En cours → Livrée)
- Optimiser routes (TBD: algorithme simple ou algo avancé)
- Voir position livreurs temps réel

#### E. User Management
- Liste clients: email, tel, adresse, historique
- Liste livreurs: email, tel, performance, ratings
- Assigner/retirer role livreur
- Suspendre compte si nécessaire

#### F. Ticket Management
- Voir tous tickets non résolus
- Ajouter messages/réponses
- Marquer comme résolu
- Historique par client

#### G. Analytics & Reports
- Revenue trends
- Top produits
- Livreur performance
- Customer lifetime value
- Churn analysis

### 3.3 Livreur Panel (/driver/*)

#### Access Control
- Protected by NextAuth.js (role = DRIVER)

#### A. Dashboard
- Liste commandes assignées
- Statut commandes (Assignée → Acceptée → En cours → Livrée)
- Nombre de livraisons aujourd'hui

#### B. Active Delivery
- Commande à livrer actuellement
- Adresse destination
- Contact client
- Bouton "Démarrer livraison" → Activer tracking
- Localisation client affichée

#### C. Delivery Tracking
- Map interactive
- Position propre (auto-update via GPS)
- Envoi position client (WebSockets)
- Confirmation arrivée
- Upload photo preuve livraison

#### D. Profile
- Infos personnelles
- Historique livraisons
- Ratings (de clients)
- Documents (license, assurance, etc. - TBD)

---

## 4. DATA MODEL (Prisma Schema)

### 4.1 Core Models

```prisma
// Users (Clients, Admins, Drivers)
model User {
  id                String    @id @default(cuid())
  email             String    @unique
  passwordHash      String?   // null pour OAuth later
  role              Role      @default(CUSTOMER)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  // Relations
  profile           UserProfile?
  orders            Order[]
  loyaltyCard       LoyaltyCard?
  ratings           Rating[]
  tickets           Ticket[]
  deliveries        Delivery[] @relation("driver")
  
  @@index([email])
  @@index([role])
}

enum Role {
  CUSTOMER
  ADMIN
  DRIVER
}

model UserProfile {
  id                String    @id @default(cuid())
  userId            String    @unique
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  firstName         String?
  lastName          String?
  phone             String?
  address           String?
  city              String?
  zipCode           String?
  profilePhoto      String?   // local path
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}

// Products
model Product {
  id                String    @id @default(cuid())
  name              String
  description       String?
  price             Decimal   @db.Decimal(10, 2)
  category          String
  stock             Int       @default(0)
  minimumStock      Int       @default(10)
  photos            String[]  // local paths
  isFeatured        Boolean   @default(false)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  // Relations
  orderItems        OrderItem[]
  ratings           Rating[]
  packaging         Packaging[]
  
  @@index([category])
  @@index([isFeatured])
}

model Packaging {
  id                String    @id @default(cuid())
  productId         String
  product           Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  name              String    // "Box", "Gift Box", etc.
  priceModifier     Decimal   @default(0) @db.Decimal(10, 2)
  createdAt         DateTime  @default(now())
}

// Orders
model Order {
  id                String    @id @default(cuid())
  orderNumber       String    @unique // Auto-generated: ORD-2026-04-17-001
  userId            String
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Pricing
  subtotal          Decimal   @db.Decimal(10, 2)
  taxAmount         Decimal   @db.Decimal(10, 2)
  totalPrice        Decimal   @db.Decimal(10, 2)
  
  // Status
  status            OrderStatus @default(PENDING)
  
  // Address
  deliveryAddress   String
  deliveryCity      String
  deliveryZipCode   String
  
  // Relations
  items             OrderItem[]
  payment           Payment?
  delivery          Delivery?
  ratings           Rating[]
  tickets           Ticket[]
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@index([userId])
  @@index([status])
  @@index([createdAt])
}

enum OrderStatus {
  PENDING            // En attente paiement/confirmation
  CONFIRMED          // Confirmée, prête pour livraison
  ASSIGNED           // Assignée à un livreur
  IN_PROGRESS        // En cours de livraison
  DELIVERED          // Livrée
  CANCELLED          // Annulée
}

model OrderItem {
  id                String    @id @default(cuid())
  orderId           String
  order             Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId         String
  product           Product   @relation(fields: [productId], references: [id])
  
  quantity          Int
  priceAtTime       Decimal   @db.Decimal(10, 2)
  packaging         String?   // "Box", "Gift Box", etc.
  packagingPrice    Decimal   @default(0) @db.Decimal(10, 2)
  
  @@index([orderId])
}

// Payments
model Payment {
  id                String    @id @default(cuid())
  orderId           String    @unique
  order             Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)
  
  amount            Decimal   @db.Decimal(10, 2)
  method            PaymentMethod
  status            PaymentStatus @default(PENDING)
  
  // Stripe specific
  stripePaymentId   String?
  stripeStatus      String?
  
  // COD specific
  collectedAmount   Decimal?  @db.Decimal(10, 2)
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
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

// Delivery
model Delivery {
  id                String    @id @default(cuid())
  orderId           String    @unique
  order             Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)
  
  driverId          String?
  driver            User?     @relation("driver", fields: [driverId], references: [id])
  
  status            DeliveryStatus @default(UNASSIGNED)
  
  // Location tracking
  currentLat        Decimal?  @db.Decimal(10, 8)
  currentLng        Decimal?  @db.Decimal(10, 8)
  locationUpdatedAt DateTime?
  
  // Timing
  estimatedDelivery DateTime?
  actualDelivery    DateTime?
  
  // Proof
  proofPhoto        String?   // local path
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@index([driverId])
  @@index([status])
}

enum DeliveryStatus {
  UNASSIGNED        // Pas encore assignée
  ASSIGNED          // Assignée à un livreur
  ACCEPTED          // Acceptée par livreur
  IN_PROGRESS       // En cours (livreur a commencé)
  DELIVERED         // Livrée
  CANCELLED         // Annulée
}

// Loyalty Card
model LoyaltyCard {
  id                String    @id @default(cuid())
  userId            String    @unique
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  points            Int       @default(0)
  totalSpent        Decimal   @db.Decimal(10, 2) @default(0)
  tier              Tier      @default(BRONZE)
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}

enum Tier {
  BRONZE            // 0-100 orders
  SILVER            // 100-500 spent
  GOLD              // 500+ spent
}

// Ratings
model Rating {
  id                String    @id @default(cuid())
  userId            String
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  orderId           String
  order             Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)
  
  productId         String?
  product           Product?  @relation(fields: [productId], references: [id], onDelete: SetNull)
  
  type              RatingType
  score             Int       // 1-5
  comment           String?
  
  createdAt         DateTime  @default(now())
  
  @@index([userId])
  @@index([orderId])
}

enum RatingType {
  PRODUCT
  DELIVERY
}

// Support Tickets
model Ticket {
  id                String    @id @default(cuid())
  ticketNumber      String    @unique // AUTO-GENERATED
  userId            String
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  orderId           String?
  order             Order?    @relation(fields: [orderId], references: [id], onDelete: SetNull)
  
  title             String
  description       String
  status            TicketStatus @default(OPEN)
  priority          Priority  @default(MEDIUM)
  
  // Relations
  messages          TicketMessage[]
  attachments       String[]  // local paths
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  resolvedAt        DateTime?
  
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
  id                String    @id @default(cuid())
  ticketId          String
  ticket            Ticket    @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  
  userId            String
  user              User      @relation(fields: [userId], references: [id], onDelete: SetNull)
  
  message           String
  attachments       String[]  // local paths
  
  createdAt         DateTime  @default(now())
}
```

### 4.2 Indexes & Performance Considerations
- Indexes sur `User.email`, `User.role`, `Product.category`, `Order.userId`, `Order.status`, `Order.createdAt`
- Composite indexes pour requêtes courantes
- Redis cache pour stocks temps réel
- Session management dans Redis

---

## 5. DATA FLOWS

### 5.1 Customer Order Flow

```
1. Client browse produits
   ├─ GET /api/products (cached Redis)
   └─ Affiche catalogue

2. Ajoute au panier (local storage)
   └─ Persiste dans session Redux/Zustand

3. Checkout
   ├─ POST /api/orders/create
   ├─ Crée Order (status: PENDING)
   ├─ Choix paiement:
   │  ├─ Stripe: Redirige Stripe Checkout
   │  │  ├─ Client paie
   │  │  └─ Webhook Stripe confirme → Order status = CONFIRMED
   │  └─ COD: Confirmation simple → Order status = CONFIRMED
   └─ Crée Payment record

4. Admin notifié (email)
   └─ Voit commande dans dashboard

5. Admin assigne livreur
   ├─ PATCH /api/orders/{id}/assign-driver
   ├─ Delivery.driverId = X
   ├─ Delivery.status = ASSIGNED
   └─ Livreur notifié (email/push)

6. Livreur accepte
   ├─ PATCH /api/delivery/{id}/accept
   ├─ Delivery.status = ACCEPTED
   ├─ Établit connexion WebSocket
   └─ Débute suivi géolocalisation

7. Client voit suivi
   ├─ WebSocket connexion établie
   ├─ Reçoit positions livreur temps réel
   └─ Affiche map + ETA

8. Livraison
   ├─ Livreur prend photo preuve
   ├─ Marque comme DELIVERED
   ├─ Delivery.proofPhoto = path
   └─ Delivery.actualDelivery = now()

9. Post-livraison
   ├─ Client peut noter produit et livraison
   ├─ Loyalty points ajoutés
   └─ Order archivé
```

### 5.2 WebSocket Real-time Tracking

```
Connection Flow:
1. Client: Page livraison charge
   └─ WebSocket CONNECT /api/ws/delivery?orderId=123

2. Server:
   ├─ Authentifie client
   ├─ Valide ordre appartient au client
   └─ Établit connexion

3. Livreur: Accepte livraison
   └─ WebSocket CONNECT /api/ws/delivery?deliveryId=456

4. Server (GPS update):
   ├─ Reçoit position livreur
   ├─ UPDATE Delivery (lat, lng, updatedAt)
   ├─ Cache position Redis (TTL: 30s)
   └─ Broadcast à clients connectés pour cet ordre

5. Client: Reçoit position
   ├─ Map update position livreur
   ├─ ETA recalculé
   └─ Affichage temps réel
```

### 5.3 Admin Dashboard Flow

```
Admin logs in → /admin/dashboard
├─ GET /api/admin/dashboard/stats
│  ├─ Revenue (jour/mois)
│  ├─ Order count
│  ├─ Active customers
│  └─ Pending tickets
├─ GET /api/admin/orders?status=PENDING
├─ GET /api/admin/deliveries/active
└─ GET /api/admin/tickets?status=OPEN
```

---

## 6. AUTHENTICATION & AUTHORIZATION

### 6.1 Authentication Strategy
- **Framework:** NextAuth.js v5
- **Provider:** Credentials (email/password) initially, OAuth later if needed
- **Session:** JWT + Refresh tokens in httpOnly cookies
- **PKCE:** For security

### 6.2 Authorization
- Middleware sur routes protégées
- Role-based access control (CUSTOMER, ADMIN, DRIVER)
- Client middleware checks role before rendering admin/driver pages

### 6.3 Session Management
- Sessions in Redis (TTL: 30 days for customers, 7 days for drivers)
- Auto-refresh on activity
- Logout clears session

---

## 7. PAYMENT INTEGRATION

### 7.1 Stripe Integration
- **Webhook handling** for payment confirmation
- **Client checkout** via Stripe Checkout hosted page
- **Webhook URL:** POST /api/webhooks/stripe
- **Failure handling:** Retry logic, user notification

### 7.2 Cash On Delivery (COD)
- Simple confirmation at checkout
- Payment.status = PENDING until driver confirms collection
- Admin can mark payment as COMPLETED

### 7.3 Refunds
- Stripe refunds via admin panel
- COD refunds tracked manually
- Refund notification to customer

---

## 8. FILE STORAGE STRATEGY

### 8.1 Local Storage
- Location: `/public/uploads/`
- Directories:
  - `/public/uploads/products/` → Product photos
  - `/public/uploads/tickets/` → Ticket attachments
  - `/public/uploads/deliveries/` → Proof of delivery photos
  - `/public/uploads/profiles/` → User profile photos

### 8.2 Validation
- File type validation: images only (jpg, png, webp)
- Size limit: 5MB per file
- Virus scan: Optional later (ClamAV)

### 8.3 Serving Files
- Static files served from `/public` (Coolify handles this)
- URLs: `https://maisondoree.ma/uploads/products/abc123.jpg`

---

## 9. REAL-TIME FEATURES

### 9.1 WebSocket Setup
- Library: **Socket.io** (or `ws` if lighter needed)
- Server: Next.js with Socket.io adapter
- Namespace: `/delivery` for order tracking

### 9.2 Events
```javascript
// Client listening
socket.on('delivery:location-update', (data) => {
  // data: { lat, lng, deliveryId }
})

socket.on('delivery:completed', (data) => {
  // data: { orderId, completedAt }
})

// Server broadcasting
io.to(`order:${orderId}`).emit('delivery:location-update', {...})
```

---

## 10. SECURITY CONSIDERATIONS

### 10.1 Input Validation
- Zod validation on all API routes
- Sanitize HTML in tickets/ratings
- Rate limiting on auth endpoints

### 10.2 CORS & CSRF
- CORS configured for Coolify domain
- CSRF tokens for form submissions

### 10.3 Database Security
- Parameterized queries (Prisma handles)
- No passwords in logs
- Hash passwords with bcrypt

### 10.4 Sensitive Data
- PCI compliance for Stripe (don't store card data)
- Environment variables for secrets
- No sensitive data in logs/error messages

---

## 11. DEPLOYMENT & DEVOPS

### 11.1 Docker Configuration
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build
CMD ["npm", "run", "start"]
```

### 11.2 Environment Variables (Coolify)
```
DATABASE_URL=postgresql://user:pass@postgres-service/db
REDIS_URL=redis://redis-service:6379
STRIPE_PUBLIC_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
NEXTAUTH_SECRET=<generated-secret>
NEXTAUTH_URL=https://maisondoree.ma
NODE_ENV=production
```

### 11.3 Database Migrations
- Prisma migrations tracked in `/prisma/migrations/`
- Run migrations on deploy: `prisma migrate deploy`

### 11.4 Monitoring
- Error tracking: Sentry (optional)
- Logs: Coolify built-in or Stack logging
- Uptime monitoring: Coolify health checks

---

## 12. TESTING STRATEGY

### 12.1 Unit Tests
- API routes: Jest + Supertest
- Utils: Jest
- Coverage target: 80%

### 12.2 Integration Tests
- Database interactions: Jest + Test DB (postgres container)
- Payment flows: Mock Stripe

### 12.3 E2E Tests
- Customer order flow: Playwright
- Admin operations: Playwright
- Delivery tracking: Playwright + WebSocket testing

---

## 13. PHASING & MILESTONES

### Phase 1: Foundation (Week 1-2)
- Project setup (Next.js, Prisma, DB)
- Auth implementation (NextAuth.js)
- Data models & migrations
- Basic API endpoints

### Phase 2: Client Features (Week 3-4)
- Countdown page
- Product catalog
- Shopping cart
- Checkout with Stripe & COD

### Phase 3: Order Management (Week 5)
- Order creation & confirmation
- Order history
- Payment tracking

### Phase 4: Delivery & Tracking (Week 6-7)
- Delivery assignment
- WebSocket real-time tracking
- Driver map integration
- Proof of delivery

### Phase 5: Admin Panel (Week 8-9)
- Dashboard
- Product management
- Stock management
- User management

### Phase 6: Support & Loyalty (Week 10)
- Ticket system
- Loyalty card implementation
- Ratings system

### Phase 7: Polish & Deploy (Week 11-12)
- Testing & bug fixes
- Performance optimization
- Coolify deployment
- Launch!

---

## 14. SUCCESS CRITERIA

✅ All three panels functional (client, admin, driver)  
✅ Payments working (Stripe + COD)  
✅ Real-time delivery tracking operational  
✅ Database optimized & fast  
✅ Mobile responsive  
✅ <2s page load time  
✅ Support ticket system functional  
✅ Deployed on Coolify & accessible via domain  
✅ All tests passing  

---

## 15. FUTURE ENHANCEMENTS (NOT in MVP)

- Push notifications (Firebase Cloud Messaging)
- SMS notifications (Twilio)
- Advanced route optimization (Google Maps API)
- Analytics dashboard
- Multi-language support
- Mobile app (React Native)
- AI-powered recommendations
- Subscription/recurring orders

---

## APPROVAL

**Design Status:** ✅ APPROVED by stakeholder  
**Next Step:** Invoke writing-plans skill for implementation plan
