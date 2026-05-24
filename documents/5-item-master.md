@coordinator I want to implement the "Item Master" system for the Petiatrics ERP. 

Your goal is to act as a COORDINATOR. Do not jump into coding yet. Please manage the lifecycle of this feature by directing workers (or yourself) through these three mandatory stages:

1. **RESEARCH & SPECIFY**: 
   - Analyze the current `schema.prisma` and Business Partner architecture. 
   - Define a comprehensive Item Master specification that supports:
     - Item Types: Physical Goods (Inventory-based) vs. Services (Medical/Doctor fees).
     - Units of Measure (UoM) with conversion logic (e.g., Box to Piece).
     - Pricing: Standard Cost, Base Selling Price, and Tax configuration.
     - Clinic Specifics: Generic Name, Controlled Substance flag, and default Doctor Fee rates.
   - Propose the Database Schema updates and the API Design.

2. **IMPLEMENTATION PLAN**:
   - Create a task list in a new folder `specs/007-item-master-spec/tasks.md`.
   - Organize tasks into vertical slices: Database Migration -> Backend API/Services -> Frontend UI (ERP style with Tabs).
   - Ensure the UI follows the existing ERP design language (Sticky headers, High-density grids).

3. **VERIFICATION**:
   - Define how we will verify the data integrity (e.g., preventing duplicate Item Codes).
   - Plan for automated tests for the pricing logic and UoM conversions.

**YOUR FIRST TASK**: 
Please start Stage 1 (RESEARCH). Present a proposed Data Model for `Item`, `ItemCategory`, and `UnitOfMeasure` that aligns with our Multi-tenant architecture (`clinicId`). Ask for my feedback before moving to Stage 2.