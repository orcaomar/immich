import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`CREATE TABLE "person_group" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "ownerId" uuid NOT NULL,
  "name" character varying NOT NULL,
  "personIds" uuid[] NOT NULL DEFAULT '{}',
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
  "updateId" uuid NOT NULL DEFAULT immich_uuid_v7(),
  CONSTRAINT "person_group_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "person_group_pkey" PRIMARY KEY ("id")
);`.execute(db);
  await sql`CREATE INDEX "person_group_ownerId_idx" ON "person_group" ("ownerId");`.execute(db);
  await sql`CREATE INDEX "person_group_updateId_idx" ON "person_group" ("updateId");`.execute(db);
  await sql`CREATE OR REPLACE TRIGGER "person_group_updatedAt"
  BEFORE UPDATE ON "person_group"
  FOR EACH ROW
  EXECUTE FUNCTION updated_at();`.execute(db);
  await sql`INSERT INTO "migration_overrides" ("name", "value") VALUES ('trigger_person_group_updatedAt', '{"type":"trigger","name":"person_group_updatedAt","sql":"CREATE OR REPLACE TRIGGER \\"person_group_updatedAt\\"\\n  BEFORE UPDATE ON \\"person_group\\"\\n  FOR EACH ROW\\n  EXECUTE FUNCTION updated_at();"}'::jsonb);`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TABLE "person_group";`.execute(db);
  await sql`DROP TRIGGER "person_group_updatedAt" ON "person_group";`.execute(db);
  await sql`DELETE FROM "migration_overrides" WHERE "name" = 'trigger_person_group_updatedAt';`.execute(db);
}
