/*
  Warnings:

  - You are about to drop the column `permissions` on the `users` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CANCELLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "GoodsReceiptStatus" AS ENUM ('DRAFT', 'COMMITTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseInvoiceStatus" AS ENUM ('DRAFT', 'POSTED', 'PARTIALLY_PAID', 'PAID', 'VOIDED');

-- AlterTable
ALTER TABLE "users" DROP COLUMN "permissions";

-- CreateTable
CREATE TABLE "clinic_role_permissions" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "permissions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creditTermDays" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "subtotalMinor" INTEGER NOT NULL DEFAULT 0,
    "taxTotalMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_lines" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "uomId" TEXT,
    "quantityOrdered" DECIMAL(10,3) NOT NULL,
    "quantityReceived" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "quantityInvoiced" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "unitPriceMinor" INTEGER NOT NULL,
    "subtotalMinor" INTEGER NOT NULL,
    "taxRateBps" INTEGER NOT NULL DEFAULT 0,
    "taxTotalMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "code" TEXT NOT NULL,
    "status" "GoodsReceiptStatus" NOT NULL DEFAULT 'DRAFT',
    "receivedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedById" TEXT NOT NULL,
    "overrideReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_lines" (
    "id" TEXT NOT NULL,
    "goodsReceiptId" TEXT NOT NULL,
    "poLineId" TEXT,
    "branchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "uomId" TEXT,
    "quantityReceived" DECIMAL(10,3) NOT NULL,
    "lotNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goods_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoices" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "PurchaseInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "subtotalMinor" INTEGER NOT NULL DEFAULT 0,
    "taxTotalMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL DEFAULT 0,
    "amountPaidMinor" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoice_lines" (
    "id" TEXT NOT NULL,
    "purchaseInvoiceId" TEXT NOT NULL,
    "poLineId" TEXT,
    "grLineId" TEXT,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unitPriceMinor" INTEGER NOT NULL,
    "subtotalMinor" INTEGER NOT NULL,
    "taxRateBps" INTEGER NOT NULL DEFAULT 0,
    "taxTotalMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_payments" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "amountMinor" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_payment_allocations" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "purchaseInvoiceId" TEXT NOT NULL,
    "amountAllocatedMinor" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clinic_role_permissions_clinicId_role_key" ON "clinic_role_permissions"("clinicId", "role");

-- CreateIndex
CREATE INDEX "purchase_orders_clinicId_idx" ON "purchase_orders"("clinicId");

-- CreateIndex
CREATE INDEX "purchase_orders_supplierId_idx" ON "purchase_orders"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_clinicId_code_key" ON "purchase_orders"("clinicId", "code");

-- CreateIndex
CREATE INDEX "purchase_order_lines_purchaseOrderId_idx" ON "purchase_order_lines"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "purchase_order_lines_productId_idx" ON "purchase_order_lines"("productId");

-- CreateIndex
CREATE INDEX "goods_receipts_clinicId_idx" ON "goods_receipts"("clinicId");

-- CreateIndex
CREATE INDEX "goods_receipts_purchaseOrderId_idx" ON "goods_receipts"("purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_clinicId_code_key" ON "goods_receipts"("clinicId", "code");

-- CreateIndex
CREATE INDEX "goods_receipt_lines_goodsReceiptId_idx" ON "goods_receipt_lines"("goodsReceiptId");

-- CreateIndex
CREATE INDEX "goods_receipt_lines_branchId_idx" ON "goods_receipt_lines"("branchId");

-- CreateIndex
CREATE INDEX "goods_receipt_lines_productId_idx" ON "goods_receipt_lines"("productId");

-- CreateIndex
CREATE INDEX "purchase_invoices_clinicId_idx" ON "purchase_invoices"("clinicId");

-- CreateIndex
CREATE INDEX "purchase_invoices_supplierId_idx" ON "purchase_invoices"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_invoices_clinicId_code_key" ON "purchase_invoices"("clinicId", "code");

-- CreateIndex
CREATE INDEX "purchase_invoice_lines_purchaseInvoiceId_idx" ON "purchase_invoice_lines"("purchaseInvoiceId");

-- CreateIndex
CREATE INDEX "supplier_payments_clinicId_idx" ON "supplier_payments"("clinicId");

-- CreateIndex
CREATE INDEX "supplier_payments_supplierId_idx" ON "supplier_payments"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_payments_clinicId_code_key" ON "supplier_payments"("clinicId", "code");

-- CreateIndex
CREATE INDEX "supplier_payment_allocations_paymentId_idx" ON "supplier_payment_allocations"("paymentId");

-- CreateIndex
CREATE INDEX "supplier_payment_allocations_purchaseInvoiceId_idx" ON "supplier_payment_allocations"("purchaseInvoiceId");

-- AddForeignKey
ALTER TABLE "clinic_role_permissions" ADD CONSTRAINT "clinic_role_permissions_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "business_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_poLineId_fkey" FOREIGN KEY ("poLineId") REFERENCES "purchase_order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "business_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "purchase_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_poLineId_fkey" FOREIGN KEY ("poLineId") REFERENCES "purchase_order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_grLineId_fkey" FOREIGN KEY ("grLineId") REFERENCES "goods_receipt_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "business_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payment_allocations" ADD CONSTRAINT "supplier_payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "supplier_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payment_allocations" ADD CONSTRAINT "supplier_payment_allocations_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "purchase_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
