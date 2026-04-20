# Maison Dorée Production Management System
## Admin User Guide

### Table of Contents
1. [Overview](#overview)
2. [Dashboard Navigation](#dashboard-navigation)
3. [Production Management](#production-management)
4. [Labs Management](#labs-management)
5. [Inventory Management](#inventory-management)
6. [Reporting & Analytics](#reporting--analytics)
7. [Best Practices](#best-practices)

---

## Overview

The Maison Dorée Production Management System helps optimize pastry production across multiple labs. As an administrator, you have full access to:
- Lab and equipment management
- Production batch scheduling and monitoring
- Inventory/stock level management
- Production forecasting
- Performance analytics

### Key Roles
- **Admin**: Full system access, can manage all aspects of production
- **Manager**: Views production metrics, oversees lab operations
- **Worker**: Executes production tasks, reports progress

---

## Dashboard Navigation

### Main Menu Structure

The admin dashboard has three main sections:

#### 1. **Core**
- Dashboard - System overview and KPIs
- Analytics - Production trends and metrics
- Finished Product Stock - Final product inventory

#### 2. **Production Management**
- Labs - Lab setup and configuration
- Machines - Equipment inventory
- Recipes - Production recipes with ingredients
- Raw Materials - Input materials inventory
- Supplier Accounts - Supplier information
- Orders - Purchase orders to suppliers

#### 3. **Production**
- Dashboard - Production status overview
- Batches - Create and monitor production batches
- Stock - Raw material inventory per lab
- Forecast - Demand predictions
- Workflows - Production automation

---

## Production Management

### Creating a Production Batch

1. Navigate to **Production → Batches**
2. Click **"Create New Batch"** button
3. Fill in the form:
   - **Select Lab**: Choose which lab will handle production
   - **Select Recipe**: Choose the pastry recipe to produce
   - **Quantity**: How many units to produce
   - **Start Time**: When production should begin
   - **Machine Assignment** (Optional): Assign specific equipment
4. Click **"Create Batch"**
   - System validates material availability
   - Stock is automatically decremented
   - Batch status is set to "PLANNED"

### Monitoring Batch Progress

1. Navigate to **Production → Batches**
2. View list of all batches filtered by:
   - Status (Planned, In Progress, Completed, Paused, Cancelled)
   - Lab
   - Date range

3. Click a batch to view:
   - Recipe details and ingredients
   - Labor requirements
   - Assigned equipment
   - Production timeline
   - Current status

### Updating Batch Status

1. In the batches list, find the batch to update
2. Click the status button to change:
   - **PLANNED** → Start production (IN_PROGRESS)
   - **IN_PROGRESS** → Mark complete (COMPLETED) or pause (PAUSED)
   - **PAUSED** → Resume or cancel
   - Any status → CANCELLED if needed

---

## Labs Management

### Lab Overview

Each lab represents a production facility with:
- Assigned equipment (machines)
- Team members (employees)
- Current capacity utilization
- Raw material inventory

### Creating a New Lab

1. Navigate to **Production Management → Labs**
2. Click **"Add New Lab"** button
3. Fill in:
   - **Name**: Descriptive lab name (e.g., "Preparation Lab")
   - **Type**: 
     - PREPARATION - Initial dough/mix preparation
     - ASSEMBLY - Assembling components (filling, layering)
     - FINISHING - Final decoration and packaging
   - **Capacity**: Maximum concurrent batches
4. Click **"Create Lab"**

### Managing Lab Equipment

1. In **Labs** page, select a lab to expand details
2. View **"Machines"** section showing all equipment:
   - Oven capacity and cycle time
   - Mixers and their specifications
   - Fridges for temperature control
   - Workstations for manual assembly

3. To add equipment:
   - Navigate to **Production Management → Machines**
   - Enter machine details and assign to lab

### Managing Lab Team

1. In **Labs** page, select a lab
2. View **"Employees"** section
3. To add a team member:
   - Navigate to **Production Management → Labs**
   - Click "Add Employee"
   - Enter name, role (Boulanger, Pâtissier, etc.)
   - Set available hours per week

---

## Inventory Management

### Stock Management

The stock management system tracks raw materials across labs.

#### Viewing Lab Stock

1. Navigate to **Production → Stock**
2. View all labs with their current inventory
3. Each lab shows:
   - Materials in stock
   - Current quantity vs. minimum threshold
   - Low stock warnings
   - Progress bars for visual status

#### Adjusting Stock Levels

1. In **Stock** page, expand a lab to see materials
2. For each material, you can:
   - **Edit** (pencil icon): Adjust quantity and threshold
   - **Delete** (X icon): Remove material from lab

3. Click **"Edit"** to adjust:
   - **Current Quantity**: Set exact stock level
   - **Minimum Threshold**: Alert level for reordering
   - Click **"Save"** to update

#### Adding Material to a Lab

1. In **Stock** page, expand a lab
2. Click **"Add Material"** button
3. Select from available raw materials
4. Set initial quantity and minimum threshold
5. Click **"Add"** to confirm

### Raw Materials Management

1. Navigate to **Production Management → Raw Materials**
2. View all available materials with:
   - Material type (Flour, Sugar, etc.)
   - Measurement unit (kg, liters, pieces)
   - Whether it's intermediate (semi-finished) or base

3. To add new material:
   - Click **"Add New Material"**
   - Enter name and type
   - Select measurement unit
   - Click **"Create"**

---

## Reporting & Analytics

### Production Dashboard

Navigate to **Production → Dashboard** to see:
- **Active Batches**: Currently running production
- **Lab Utilization**: Capacity usage per lab
- **Material Alerts**: Low stock warnings
- **Production Timeline**: Gantt-style batch schedule

### Demand Forecast

Navigate to **Production → Forecast** to view:
- **Daily Predictions**: Predicted demand for next 7 days
- **Confidence Levels**: How certain the prediction is
- **Production Recommendations**: Suggested batches based on forecast
- **Historical Trends**: Past demand patterns

### Analytics Dashboard

Navigate to **Core → Analytics** to see:
- Production trends over time
- Lab efficiency metrics
- Material consumption patterns
- Batch success rates

---

## Best Practices

### 1. Batch Planning
- Plan batches based on demand forecast
- Ensure sufficient raw materials in lab before creating batch
- Assign experienced workers to complex recipes
- Schedule maintenance windows when labs aren't in use

### 2. Inventory Management
- Review stock levels daily
- Set appropriate minimum thresholds (usually 20% of max usage)
- Order materials with supplier lead time in mind
- Keep high-cost items at lower minimums

### 3. Lab Organization
- Maintain consistent team assignments
- Document equipment maintenance schedules
- Review capacity before overloading labs
- Cross-train employees for flexibility

### 4. Quality Control
- Monitor batch completion times
- Track material waste and loss
- Review employee productivity metrics
- Adjust recipes based on feedback

---

## Troubleshooting

### Batch Creation Fails
- **Issue**: Can't create batch - "Insufficient materials"
- **Solution**: Check Stock page, add materials if needed, retry

### Low Utilization
- **Issue**: Labs have spare capacity
- **Solution**: Check Forecast for upcoming demand, create planned batches

### Equipment Issues
- **Issue**: Machine assigned to batch is unavailable
- **Solution**: Go to Machines page, mark as unavailable, reassign batch

---

## Contact & Support

For issues or questions:
- Email: admin@maisondoree.com
- Check system logs in dashboard
- Review training materials for your role
