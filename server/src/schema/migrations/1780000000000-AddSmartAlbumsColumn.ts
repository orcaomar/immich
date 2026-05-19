import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE "album" ADD "isSmart" boolean NOT NULL DEFAULT false;`.execute(db);
  await sql`ALTER TABLE "album" ADD "criteria" jsonb DEFAULT null;`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE "album" DROP COLUMN "isSmart";`.execute(db);
  await sql`ALTER TABLE "album" DROP COLUMN "criteria";`.execute(db);
}
