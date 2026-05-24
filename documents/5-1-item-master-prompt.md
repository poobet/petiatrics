# Prompt for AI Assistant: Petiatrics ERP - Item Master Implementation

**Role:** You are an Expert Full-Stack Software Engineer and System Architect specializing in NestJS (Backend), Next.js App Router (Frontend), Prisma (ORM), and Domain-Driven Design (DDD).
**Project:** Petiatrics (Pet Clinic Management System - Enterprise Grade)
**Current Branch:** `006-item-master`
**Context:** We are building the Inventory & Item Master module. This module is the foundation for clinic operations, billing, and stock management.

## Objective
Your task is to design, update the database schema, and write the implementation code (Backend APIs + Frontend UI components) for the following 4 core features in the `006-item-master` branch.

---

### Feature 1: General Ledger (GL) Structure Setup ("The Heart of Accounting")
**Business Context:** Every financial transaction (sales, expenses, inventory value) must eventually flow into the GL to generate P&L and Balance Sheets. We need to lay the foundation for this in the Item Master.
**Requirements:**
1. **Schema Update:** Update the Prisma schema. Add a relation to map `ItemCategory` (or `Product`) to a specific `glAccountId` (e.g., Revenue Account, Inventory Asset Account, COGS Account).
2. **Backend Logic:** Ensure that when a new category or product is created, the system allows linking to a valid GL Account. Prepare an event emitter structure (e.g., `product.sold` event) that a future Accounting module can listen to.
3. **Frontend:** Add a dropdown/selector in the Item/Category creation form to select the corresponding GL Account.

### Feature 2: Barcode & SKU Management ("The ID Card & Passport")
**Business Context:** SKUs are internal identifiers (e.g., `MED-DOG-001`), while Barcodes are scannable tags (EAN-13) used for fast checkout and reducing human error during dispensing.
**Requirements:**
1. **Schema Update:** Ensure `Product` model has `sku` (String, Unique) and `barcode` (String, Nullable, Unique) fields.
2. **Backend Logic:** - Add validation in `CreateProductDto` and `UpdateProductDto`. 
   - Ensure SKUs are auto-generated if not provided, or strictly validated if provided.
   - Implement search endpoints that can query by either `sku` or `barcode` instantly.
3. **Frontend:** - Add input fields for SKU and Barcode in `item-form.tsx`. 
   - Implement a generic "Scan Barcode" listener in the POS/Dispensing UI mockups so that scanning a barcode auto-selects the item.

### Feature 3: Reorder Point & Minimum Stock Level ("The Fuel Gauge")
**Business Context:** To prevent stockouts (which impact animal lives) and overstocking (which ties up cash flow), the system must track minimum levels and reorder thresholds.
**Requirements:**
1. **Schema Update:** Add `minimumStock` (Int, default 0) and `reorderPoint` (Int, default 0) to the `Product` or `InventoryStock` model.
2. **Backend Logic:** - In `stock.service.ts`, implement a function that checks current stock against `reorderPoint` after every stock deduction (e.g., via `visit-finalized.listener.ts`).
   - If `currentStock <= reorderPoint`, emit an event `stock.low_stock_warning`.
   - Create an endpoint `GET /inventory/low-stock` to fetch items needing replenishment.
3. **Frontend:** - Add inputs for Min Stock and Reorder Point in the Item Master form.
   - Create a UI component (Widget/Table) for the Inventory Dashboard that lists "Items to Replenish".

### Feature 4: Bulk Import / Excel Upload ("The Moving Truck")
**Business Context:** Clinics migrating to Petiatrics need to upload hundreds of items at once via Excel/CSV rather than manual entry.
**Requirements:**
1. **Backend Logic:** - Create a new endpoint `POST /inventory/products/bulk-import`.
   - Implement file parsing (using libraries like `xlsx` or `papaparse` for CSV).
   - Implement strict validation row-by-row (Check for duplicate SKUs, missing names, invalid prices). Return an array of errors with row numbers if validation fails.
   - Use Prisma's `createMany` or transaction blocks for efficient batch inserts.
2. **Frontend:** - Add an "Import Items" button in the Item Master list view.
   - Create a modal with drag-and-drop file upload.
   - Provide a "Download Template" button so users know the expected column format.
   - Display a preview or error summary table before finalizing the import.

---

## Output Instructions for AI:
Please provide your implementation step-by-step:
1. **Prisma Schema Changes:** Provide the exact changes needed in `schema.prisma`.
2. **Backend (NestJS):** Provide the updated DTOs, Controllers, Services, and Event Listeners. Keep the Clean Architecture in mind.
3. **Frontend (Next.js):** Provide the React components (using your existing shadcn/ui library) for the forms and bulk upload modal.
4. **Testing Checklist:** List the edge cases that need to be tested for these 4 features.
