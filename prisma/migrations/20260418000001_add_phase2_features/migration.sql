-- Migration: add_phase2_features
-- Date: 2026-04-18
-- Description: Phase 2 e-commerce features — notifications, loyalty transactions,
--              points rules, promo coupons, coupon usage, and contact form

-- ============================================================================
-- NEW ENUMS
-- ============================================================================

CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'IN_APP');

CREATE TYPE "NotificationType" AS ENUM (
  'ORDER_PLACED',
  'ORDER_CONFIRMED',
  'ORDER_DISPATCHED',
  'ORDER_DELIVERED',
  'PAYMENT_RECEIVED',
  'DELIVERY_ASSIGNED',
  'TICKET_RESPONSE',
  'LOYALTY_POINTS_EARNED'
);

CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- ============================================================================
-- NEW TABLES
-- ============================================================================

-- Notification -----------------------------------------------------------

CREATE TABLE "Notification" (
  "id"        TEXT         NOT NULL,
  "userId"    TEXT         NOT NULL,
  "type"      "NotificationType" NOT NULL,
  "title"     TEXT         NOT NULL,
  "message"   TEXT         NOT NULL,
  "metadata"  JSONB,
  "channels"  "NotificationChannel"[] NOT NULL DEFAULT ARRAY['IN_APP'::"NotificationChannel"],
  "read"      BOOLEAN      NOT NULL DEFAULT false,
  "readAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_idx"  ON "Notification"("userId");
CREATE INDEX "Notification_read_idx"    ON "Notification"("read");

-- NotificationPreference -------------------------------------------------

CREATE TABLE "NotificationPreference" (
  "id"            TEXT    NOT NULL,
  "userId"        TEXT    NOT NULL,
  "emailOrders"   BOOLEAN NOT NULL DEFAULT true,
  "emailDelivery" BOOLEAN NOT NULL DEFAULT true,
  "emailPayment"  BOOLEAN NOT NULL DEFAULT true,
  "emailTickets"  BOOLEAN NOT NULL DEFAULT true,
  "emailLoyalty"  BOOLEAN NOT NULL DEFAULT true,
  "smsOrders"     BOOLEAN NOT NULL DEFAULT false,
  "smsDelivery"   BOOLEAN NOT NULL DEFAULT true,
  "smsPayment"    BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT "NotificationPreference_pkey"    PRIMARY KEY ("id"),
  CONSTRAINT "NotificationPreference_userId_key" UNIQUE ("userId")
);

-- LoyaltyTransaction -----------------------------------------------------

CREATE TABLE "LoyaltyTransaction" (
  "id"            TEXT         NOT NULL,
  "loyaltyCardId" TEXT         NOT NULL,
  "type"          TEXT         NOT NULL,
  "points"        INTEGER      NOT NULL,
  "reason"        TEXT         NOT NULL,
  "orderId"       TEXT,
  "expiresAt"     TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LoyaltyTransaction_pkey"     PRIMARY KEY ("id"),
  CONSTRAINT "LoyaltyTransaction_orderId_key" UNIQUE ("orderId")
);

CREATE INDEX "LoyaltyTransaction_loyaltyCardId_idx" ON "LoyaltyTransaction"("loyaltyCardId");
CREATE INDEX "LoyaltyTransaction_createdAt_idx"     ON "LoyaltyTransaction"("createdAt");

-- PointsRule -------------------------------------------------------------

CREATE TABLE "PointsRule" (
  "id"                 TEXT         NOT NULL,
  "name"               TEXT         NOT NULL,
  "type"               TEXT         NOT NULL,
  "pointsPerUnit"      DECIMAL(5,2) NOT NULL,
  "applicableCategory" TEXT,
  "minOrderAmount"     DECIMAL(10,2),
  "tierRequired"       TEXT,
  "isActive"           BOOLEAN      NOT NULL DEFAULT true,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PointsRule_pkey" PRIMARY KEY ("id")
);

-- PromoCoupon ------------------------------------------------------------

CREATE TABLE "PromoCoupon" (
  "id"                   TEXT            NOT NULL,
  "code"                 TEXT            NOT NULL,
  "name"                 TEXT            NOT NULL,
  "discountType"         "DiscountType"  NOT NULL,
  "discountValue"        DECIMAL(10,2)   NOT NULL,
  "maxUses"              INTEGER,
  "usedCount"            INTEGER         NOT NULL DEFAULT 0,
  "maxUsesPerCustomer"   INTEGER         NOT NULL DEFAULT 1,
  "minOrderAmount"       DECIMAL(10,2),
  "applicableCategories" TEXT[]          NOT NULL DEFAULT ARRAY[]::TEXT[],
  "validFrom"            TIMESTAMP(3)    NOT NULL,
  "validUntil"           TIMESTAMP(3)    NOT NULL,
  "isActive"             BOOLEAN         NOT NULL DEFAULT true,
  "createdBy"            TEXT            NOT NULL,
  "createdAt"            TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3)    NOT NULL,

  CONSTRAINT "PromoCoupon_pkey"      PRIMARY KEY ("id"),
  CONSTRAINT "PromoCoupon_code_key"  UNIQUE ("code")
);

CREATE INDEX "PromoCoupon_code_idx"     ON "PromoCoupon"("code");
CREATE INDEX "PromoCoupon_isActive_idx" ON "PromoCoupon"("isActive");

-- CouponUsage ------------------------------------------------------------

CREATE TABLE "CouponUsage" (
  "id"              TEXT         NOT NULL,
  "couponId"        TEXT         NOT NULL,
  "orderId"         TEXT         NOT NULL,
  "userId"          TEXT         NOT NULL,
  "discountApplied" DECIMAL(10,2) NOT NULL,
  "appliedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CouponUsage_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "CouponUsage_orderId_key" UNIQUE ("orderId")
);

CREATE INDEX "CouponUsage_couponId_idx" ON "CouponUsage"("couponId");
CREATE INDEX "CouponUsage_userId_idx"   ON "CouponUsage"("userId");

-- ContactSubmission ------------------------------------------------------

CREATE TABLE "ContactSubmission" (
  "id"          TEXT         NOT NULL,
  "name"        TEXT         NOT NULL,
  "email"       TEXT         NOT NULL,
  "subject"     TEXT         NOT NULL,
  "message"     TEXT         NOT NULL,
  "status"      TEXT         NOT NULL DEFAULT 'NEW',
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),

  CONSTRAINT "ContactSubmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContactSubmission_status_idx"    ON "ContactSubmission"("status");
CREATE INDEX "ContactSubmission_createdAt_idx" ON "ContactSubmission"("createdAt");

-- ============================================================================
-- FOREIGN KEYS
-- ============================================================================

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationPreference"
  ADD CONSTRAINT "NotificationPreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LoyaltyTransaction"
  ADD CONSTRAINT "LoyaltyTransaction_loyaltyCardId_fkey"
  FOREIGN KEY ("loyaltyCardId") REFERENCES "LoyaltyCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LoyaltyTransaction"
  ADD CONSTRAINT "LoyaltyTransaction_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CouponUsage"
  ADD CONSTRAINT "CouponUsage_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "PromoCoupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CouponUsage"
  ADD CONSTRAINT "CouponUsage_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CouponUsage"
  ADD CONSTRAINT "CouponUsage_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
