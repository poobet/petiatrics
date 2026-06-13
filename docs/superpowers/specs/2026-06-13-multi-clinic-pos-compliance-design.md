# Design Spec: Item Master, Dynamic Tax Engine, and Dispensing Compliance for Multi-Clinic POS Architecture

**Date:** 2026-06-13
**Status:** Approved for planning
**Prerequisites:** Branch-Scoped Inventory, Item Master ERP Extension

---

## 1. Overview & Goals

This specification outlines the database refactoring, backend logic, and frontend interactions to support a multi-clinic Point of Sale (POS) system. The solution implements location-based pricing and active branch visibility, a dynamic tax engine compliant with the Thai Revenue Department's context rules, and drug dispensing workflows compliant with the Thai FDA and Veterinary Profession Act.

---

## 2. Database Schema Refactoring

We will modify the Prisma database schema to incorporate enums and fields for tax, legal dispensing categories, GL accounting mappings, location settings, optional checkout references, and supervisor authorization PINs.

### 2.1. Enums
*   `ItemType`: Add `CONSUMABLE` and rename `STOCKED_GOOD` to `INVENTORY` for ERP-level compatibility.
*   `DefaultVatType`: Enum values are `VAT_7` (7% VAT), `VAT_EXEMPT` (0% exempt supply), and `NON_VAT` (out of scope).
*   `WhtRate`: Enum values are `WHT_0` (0%), `WHT_1` (1%), and `WHT_3` (3%).
*   `DispensingCategory`: Enum values are `General_Retail`, `Household_Remedy`, `Dangerous_Drug`, `Specially_Controlled_Drug`, and `Clinic_Use_Only`.

### 2.2. Product Model Updates
We will add default VAT, WHT rate, dispensing category, and GL account foreign key fields:
*   `defaultVatType`: `DefaultVatType` enum, default `VAT_7`.
*   `whtRate`: `WhtRate` enum, default `WHT_0`.
*   `dispensingCategory`: `DispensingCategory` enum, default `General_Retail`.
*   `revenueAccountId`: Nullable string referencing `GLAccount`.
*   `cogsAccountId`: Nullable string referencing `GLAccount`.
*   `inventoryAssetAccountId`: Nullable string referencing `GLAccount`.

### 2.3. Product Branch Settings (`ProductBranchSetting` Model)
Handles location-based pricing and item activation:
*   `id`: String UUID primary key.
*   `productId`: String foreign key to `Product`.
*   `branchId`: String foreign key to `Branch`.
*   `isActive`: Boolean, default `true`.
*   `retailPrice`: Decimal selling price.
*   `movingAverageCost`: Decimal moving cost.
*   `@@unique([productId, branchId])`

### 2.4. Invoice and InvoiceLineItem Updates
*   `Invoice.visitId`, `Invoice.patientId`, and `Invoice.ownerUserId` are changed to nullable string fields to support OTC checkouts.
*   `InvoiceLineItem` gets two new fields to store item-level taxes:
    *   `vatRateBps`: Integer (basis points, e.g. 700 = 7%, 0 = exempt).
    *   `vatTotalMinor`: Integer (tax total for the line item).

### 2.5. User Updates
*   `User.pinHash`: Nullable string storing the supervisor authorization PIN hashed with bcrypt.

---

## 3. Backend & POS Business Logic

### 3.1. Dynamic Tax Engine (`InvoiceService`)
The backend will compute taxes per line item based on the sales context:
*   **Context 1 (Clinical Service):** If `visitId` is provided (linked to treatment/prescription), the entire transaction is classified as a "Service". The default tax configuration of all items is overridden, and a flat **7% VAT** (`vatRateBps = 700`) is forced on every line item.
*   **Context 2 (Pet Shop Retail - OTC):** If `visitId` is null (OTC checkout), the default tax configurations are respected:
    *   `defaultVatType = VAT_7` $\rightarrow$ 7% VAT.
    *   `defaultVatType = VAT_EXEMPT` $\rightarrow$ 0% VAT.
    *   `defaultVatType = NON_VAT` $\rightarrow$ 0% VAT.
*   **Tax-Inclusive Logic:** If `Product.isTaxInclusive` is true, the VAT amount is extracted from the unit price: `vatTotal = subtotal - Math.round(subtotal / (1 + vatRateBps / 10000))`. If false, VAT is added to the subtotal.

### 3.2. PIN Override Authentication
*   Endpoint: `POST /api/v1/billing/invoices/verify-override-pin`
*   Payload: `{ pin: string }`
*   Behavior: Queries all active users in the clinic with role `VET` or `CLINIC_OWNER`. Compares the plain-text PIN with `pinHash` using `bcrypt.compare`. Returns success and the authorizer's user details if a match is found.

### 3.3. Dispensing Compliance Engine
Enforced in `InvoiceService` on invoice create/save operations:
*   `General_Retail` & `Household_Remedy`: Standard checkout.
*   `Dangerous_Drug`: Requires `overrideApprovedByUserId` (representing a validated Vet/Manager PIN approval).
*   `Specially_Controlled_Drug`: Blocks OTC checkouts (must have `visitId`). Validates that the product exists in the prescriptions list of the finalized/amended MongoDB `VisitRecord`.
*   `Clinic_Use_Only`: Hard-blocked in OTC mode. Only allowed in Clinical Service context.

---

## 4. Frontend POS Workspace & UX Flows

### 4.1. Workspace Layout
*   Path: `/clinic/billing/pos`
*   Features a dual-panel setup:
    *   *Left (Cart):* Lists added items with description, quantity, price, tax rate, and delete button. Integrates a search box and keyboard-mimicking barcode scanner event listener.
    *   *Right (Checkout & Meta):* Toggle between Retail and Clinical context. Selection of client, patient, and finalized visits (which populates cart items). Shows real-time summaries and triggers PIN verification modals.

### 4.2. Dialogs and Modals
*   **Dangerous Drug Authorization:** A modal overlay prompts the cashier: *"Supervisor PIN required. Enter Veterinarian or Clinic Manager PIN to authorize Dangerous Drug."* Cashier types the PIN, validating it asynchronously.
*   **Specially Controlled / Clinic Use Only Alerts:** Modal alerts prevent adding illegal items to the retail cart.

---

## 5. Verification Plan

### 5.1. Automated Tests
*   **Billing Logic Tests:** Assert correct line-item tax rates and totals under Clinical vs. OTC contexts, and tax-inclusive extraction.
*   **Compliance Constraint Tests:** Assert block actions occur for Specially Controlled Drugs and Clinic Use Only items in retail checkout. Assert Dangerous Drugs require a valid PIN supervisor ID.
*   **Pricing Override Tests:** Assert branch settings override product global base pricing in invoices.

### 5.2. Manual Verification
*   Log in to POS dashboard, switch branches, scan barcodes, trigger override dialogues, verify calculations, and inspect the database records.
