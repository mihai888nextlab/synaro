-- AlterTable (idempotent for databases that already added `slug` manually)
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "slug" TEXT;

-- Backfill URL-safe slugs from name + id prefix (handles empty / duplicate names)
UPDATE "Project"
SET
  "slug" = left(
    regexp_replace(
      regexp_replace(lower(trim("name")), '[^a-z0-9]+', '-', 'g'),
      '(^-+|-+$)',
      '',
      'g'
    ) || '-' || replace(substring("id"::text, 1, 13), '-', ''),
    64
  )
WHERE "slug" IS NULL OR btrim("slug") = '';

UPDATE "Project"
SET "slug" = 'p-' || replace("id"::text, '-', '')
WHERE "slug" IS NULL OR btrim("slug") = '';

ALTER TABLE "Project" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Project_slug_key" ON "Project"("slug");
