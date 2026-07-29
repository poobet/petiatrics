DO  BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='appointments' AND column_name='code'
  ) THEN
    ALTER TABLE "appointments" ADD COLUMN "code" TEXT;
  END IF;
END ;
