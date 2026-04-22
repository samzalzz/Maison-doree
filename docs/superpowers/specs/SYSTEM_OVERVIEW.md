# Maison Dorée - Production Management System
## Complete System Overview

## Features
- Purchase order manager ( Create PO PDF files that he provide to the supplier by mail or print buttonà
- Purchase order manager ( Validate that the supplier aggree and define the date of delivery )
- Supplier (Define the suppliers products , Selling price from last purchases, Qtt delivered )
- Purchase order that populate the Stock database when an order is defined as Received
- Stock manage 3 types of stock the Raw materials the mid process material and the finished product
- Recipe module, that creat workflows to use raw/mid process materials, with defined Lab (Workers+Machine) and machine(Capacity and availability) to product final product
- Production batch management with validation that launch production with recepies
- The production batch must update the stocks during the process
- Once that the batch is over final products are sent to an available stock that can be used by the sell order
- Sell order modul that manage the available final product stock and make Selling invoices in PDF format and create send order to deliver to the client using drivers part
- Once reiceived the driver update the sell order and define it as delivered 
- Inventory tracking across multiple labs
- Role-based access control (Admin, Manager, Worker)
- Performance analytics and metrics
- Auto-refreshing dashboards

## User Roles

### Admin
Full system access including:
- Lab and machine configuration
- Recipe and material management
- User and role management
- Production batch creation
- Inventory management
- All analytics and reporting

### Manager
Production oversight including:
- Monitor batch progress
- Team performance tracking
- Quality approval workflows
- Issue reporting
- Production metrics view

### Worker
Task execution including:
- View assigned batches
- Follow recipe instructions
- Report progress
- Submit completions
- Track task status

## Key Technologies
- Next.js 14 (React 18, TypeScript)
- PostgreSQL with Prisma ORM
- NextAuth.js for authentication
- Tailwind CSS for styling
- Docker for deployment

## Database Tables
- ProductionLab - Facility configuration
- LabEmployee - Team members
- Machine - Equipment inventory
- Recipe - Production formulas
- RecipeIngredient - Recipe components
- RawMaterial - Base and intermediate materials
- LabStock - Inventory per lab
- ProductionBatch - Production runs
- BatchItem - Individual items in batches

## Getting Started

For Admins:
1. Create labs (Production Management → Labs)
2. Add raw materials (Production Management → Raw Materials)
3. Create recipes (Production Management → Recipes)
4. Create production batches (Production → Batches)

For Managers:
1. Review Manager Dashboard
2. Monitor batch progress
3. Track team performance
4. Approve quality

For Workers:
1. View assigned tasks
2. Follow recipe instructions
3. Report progress
4. Mark batches complete

## API Documentation
All endpoints require authentication via NextAuth session.

Core endpoints:
- /api/admin/labs - Lab management
- /api/admin/machines - Equipment management
- /api/admin/recipes - Recipe management
- /api/admin/raw-materials - Material management
- /api/admin/lab-stock - Inventory management
- /api/admin/production/batches - Batch management
- /api/worker/dashboard - Worker task list

## Deployment
Deployed on Coolify with Docker containerization.
PostgreSQL database on Coolify infrastructure.
Auto-scaling and backup enabled.

## Support Documents
See docs/user-guides/ for detailed instructions:
- ADMIN_GUIDE.md - Administrator manual
- MANAGER_GUIDE.md - Manager operations guide
- WORKER_GUIDE.md - Worker task guide
- QUICKSTART.md - Quick reference guide
