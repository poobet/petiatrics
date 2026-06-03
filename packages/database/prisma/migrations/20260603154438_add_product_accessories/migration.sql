-- CreateTable
CREATE TABLE "product_accessories" (
    "id" TEXT NOT NULL,
    "parentProductId" TEXT NOT NULL,
    "childProductId" TEXT NOT NULL,
    "quantityRatio" DECIMAL(10,3) NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_accessories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_accessories_parentProductId_idx" ON "product_accessories"("parentProductId");

-- CreateIndex
CREATE INDEX "product_accessories_childProductId_idx" ON "product_accessories"("childProductId");

-- CreateIndex
CREATE UNIQUE INDEX "product_accessories_parentProductId_childProductId_key" ON "product_accessories"("parentProductId", "childProductId");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_accessories" ADD CONSTRAINT "product_accessories_parentProductId_fkey" FOREIGN KEY ("parentProductId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_accessories" ADD CONSTRAINT "product_accessories_childProductId_fkey" FOREIGN KEY ("childProductId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
