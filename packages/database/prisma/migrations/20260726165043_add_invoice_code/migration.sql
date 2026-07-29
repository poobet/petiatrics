DO  BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='invoices' AND column_name='code'
  ) THEN
    ALTER TABLE "invoices" ADD COLUMN "code" TEXT;
  END IF;
END ;
