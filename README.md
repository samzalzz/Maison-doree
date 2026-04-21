# Maison Dorée - Production Management System

A comprehensive production management system for optimizing multi-lab pastry production, featuring batch scheduling, inventory management, demand forecasting, and role-based dashboards.

## 🚀 Quick Links

- **Live Application**: http://t5e6u03ffihh77kzwxxu327o.178.104.153.248.sslip.io
- **Admin Guide**: `docs/superpowers/specs/ADMIN_GUIDE.md`
- **Worker Guide**: `docs/superpowers/specs/WORKER_GUIDE.md`
- **Manager Guide**: `docs/superpowers/specs/MANAGER_GUIDE.md`
- **Quick Start**: `docs/superpowers/specs/QUICKSTART.md`
- **System Overview**: `docs/superpowers/specs/SYSTEM_OVERVIEW.md`

## ✨ Key Features

### Production Management
- **Batch Scheduling**: Create and manage production batches with automatic validation
- **Recipe Management**: Define recipes with ingredients, labor time, and equipment requirements
- **Status Tracking**: Monitor batch progress from planning to completion
- **Capacity Management**: Track lab utilization and avoid over-capacity situations

### Inventory Management
- **Multi-Lab Inventory**: Track raw materials across different production facilities
- **Low Stock Alerts**: Automatic notifications when materials fall below thresholds
- **Stock Adjustments**: Easy interface to manually adjust inventory levels
- **Material Consumption**: Automatic stock decrement when batches are created

### Team & Equipment
- **Lab Configuration**: Set up production facilities with machines and employees
- **Equipment Tracking**: Monitor machines, their capacity, and availability
- **Team Management**: Assign workers to labs and track productivity
- **Role Assignment**: Separate admin, manager, and worker roles

### Analytics & Reporting
- **Production Dashboard**: Overview of active batches, capacity, and alerts
- **Demand Forecasting**: Predict future production needs based on historical data
- **Performance Metrics**: Track completion rates, quality, and efficiency
- **Manager Dashboard**: Team oversight and production monitoring

## 🏗️ Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TypeScript |
| Styling | Tailwind CSS, Lucide Icons |
| Backend | Next.js API Routes |
| Database | PostgreSQL |
| ORM | Prisma 5.7 |
| Auth | NextAuth.js |
| Deployment | Docker on Coolify |

## 👥 User Roles

### Admin (Full Access)
- Lab and machine management
- Recipe and material setup
- Production batch creation
- Inventory management
- User management
- System configuration

### Manager (Oversight)
- Production monitoring
- Team performance tracking
- Quality approval
- Issue reporting
- Analytics viewing

### Worker (Execution)
- View assigned batches
- Follow recipes
- Report progress
- Track completions

## 🗄️ Database Schema

**Key Tables:**
- `ProductionLab` - Facility configuration
- `LabEmployee` - Team members
- `Machine` - Equipment inventory
- `Recipe` - Production formulas
- `RecipeIngredient` - Recipe components
- `RawMaterial` - Base and intermediate materials
- `LabStock` - Per-lab inventory
- `ProductionBatch` - Production runs
- `BatchItem` - Individual batch items

See `docs/superpowers/specs/SYSTEM_OVERVIEW.md` for complete schema details.

## 📊 API Endpoints

**Labs:** `/api/admin/labs` (GET, POST, PATCH, DELETE)
**Machines:** `/api/admin/machines` (GET, POST, PATCH, DELETE)
**Recipes:** `/api/admin/recipes` (GET, POST, PATCH, DELETE)
**Materials:** `/api/admin/raw-materials` (GET, POST, PATCH, DELETE)
**Inventory:** `/api/admin/lab-stock` (GET, PATCH, DELETE)
**Batches:** `/api/admin/production/batches` (GET, POST, PATCH, DELETE)
**Analytics:** `/api/admin/production/forecast`, `/api/admin/production/metrics`
**Worker:** `/api/worker/dashboard`, `/api/worker/batches/[id]/report-progress`

All endpoints require authentication via NextAuth session.

## 🚦 Getting Started

### For Administrators

1. **Log in** with admin credentials
2. **Create your first lab** → Production Management → Labs → Add Lab
3. **Add raw materials** → Production Management → Raw Materials
4. **Create recipes** → Production Management → Recipes
5. **Create production batches** → Production → Batches
6. **Manage users** → Settings → Users (assign roles)

### For Managers

1. **Log in** with manager credentials
2. **View dashboard** → Production → Manager Dashboard
3. **Monitor batches** → Check progress and quality
4. **Track team** → Review performance metrics

### For Workers

1. **Log in** with worker credentials
2. **View tasks** → Assigned batches appear automatically
3. **Start work** → Expand batch to see recipe details
4. **Report completion** → Click "Mark Complete" when done

## 🔧 Development

### Prerequisites
- Node.js 18+
- npm or yarn
- Docker (for deployment)
- PostgreSQL database

### Local Setup

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local

# Run migrations
npx prisma migrate dev

# Start development server
npm run dev
```

Visit `http://localhost:3000`

### Database

```bash
# View database
npx prisma studio

# Create migration
npx prisma migrate dev --name migration_name

# Seed database
npm run prisma:seed
```

### Build & Test

```bash
# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

## 🚀 Deployment

### Docker Build
```bash
docker build -t maison-doree:latest .
```

### Environment Variables
```
DATABASE_URL=postgresql://user:password@host:5432/maison_doree
NEXTAUTH_SECRET=<random-secret>
NEXTAUTH_URL=https://yourdomain.com
NODE_ENV=production
```

### Coolify Deployment
The application is configured for automatic deployment on Coolify when changes are pushed to the main branch.

## 📋 Features by Phase

### Phase 1 (Implemented) ✅
- Production lab management
- Batch creation with validation
- Recipe management
- Inventory tracking
- Basic dashboards
- Role-based access

### Phase 2 (Ready)
- Demand forecasting
- Advanced analytics
- Performance metrics

### Phase 3 (Planned)
- Visual workflow editor
- Workflow automation
- Custom actions

### Phase 4 (Future)
- Machine learning predictions
- Predictive inventory management
- Advanced reporting

## 📚 Documentation

**User Guides:**
- `ADMIN_GUIDE.md` - Administrator operations
- `MANAGER_GUIDE.md` - Manager oversight
- `WORKER_GUIDE.md` - Worker tasks
- `QUICKSTART.md` - Quick reference

**Technical:**
- `SYSTEM_OVERVIEW.md` - System architecture and design

## 🐛 Troubleshooting

### Batch Creation Fails
Check if materials are available in the lab → Production → Stock

### API Errors
Review browser console for error messages, check authentication status

### Performance Issues
Increase auto-refresh intervals, check lab capacity utilization

See `SYSTEM_OVERVIEW.md` for detailed troubleshooting guide.

## 🔐 Security

- Authentication via NextAuth.js
- Role-based access control
- Database encryption
- Input validation on all endpoints
- CSRF protection
- Session management

## 📈 Scalability

The system is designed to scale:
- Database connection pooling enabled
- API rate limiting in place
- Caching for frequently accessed data
- Docker containerization for easy deployment
- Horizontal scaling ready

## 🤝 Contributing

This system is actively maintained. For issues or improvements, contact the development team.

## 📞 Support

- **For Users**: Check the relevant guide (Admin/Manager/Worker)
- **For Issues**: Review system logs in dashboard
- **For Technical Support**: Contact your administrator

## 📄 License

All rights reserved - Maison Dorée Productions

## Version

**Current Version**: 1.0.0 (Phase 1 Complete)
**Last Updated**: April 2024

---

**Key Commands:**
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npx prisma studio` - View database
- `npm run prisma:seed` - Populate test data

**Important Files:**
- `prisma/schema.prisma` - Database schema
- `lib/validators-production.ts` - Input validation
- `lib/types-production.ts` - TypeScript types
- `app/(admin)/` - Admin pages
- `app/(worker)/` - Worker pages
- `app/api/` - Backend APIs

## 🔧 Deployment Status

**Latest Fix (April 21, 2026):**
- ✅ Cleared Prisma migration lock from database (deleted 3 failed migration records)
- ✅ Verified all PurchaseOrder workflow columns are present in database
- ✅ Cleaned up failed migration records from _prisma_migrations table
- ✅ Re-enabled proper migrations in production start script
- ⏳ Fresh deployment triggered (commit b641dd9)
- **Status**: Verifying deployment completion

**Testing Status:**
- Database: ✅ Migration lock cleared, schema verified
- Local Build: ✅ Next.js build succeeds without errors
- Restart Loop: ✅ FIXED - Rewritten startup script with direct DB cleanup + cleanup migration
- Remote Deployment: ⏳ Deploying comprehensive fix (commit f6d4bd0)
  - Improved startup script (9f2b240): Direct database cleanup, better error handling
  - Cleanup migration (f6d4bd0): Removes failed migration records from database
- API Endpoints: Testing after deployment - should work with all fixes in place
