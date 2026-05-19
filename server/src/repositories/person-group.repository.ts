import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import { DB } from 'src/schema';

@Injectable()
export class PersonGroupRepository {
  constructor(@InjectKysely() private db: Kysely<DB>) {}

  create(data: { ownerId: string; name: string; personIds: string[] }) {
    return this.db
      .insertInto('person_group')
      .values({
        ownerId: data.ownerId,
        name: data.name,
        personIds: data.personIds,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  update(id: string, data: { name?: string; personIds?: string[] }) {
    return this.db
      .updateTable('person_group')
      .set(data)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  getById(id: string) {
    return this.db.selectFrom('person_group').where('id', '=', id).selectAll().executeTakeFirst();
  }

  getAllForUser(userId: string) {
    return this.db.selectFrom('person_group').where('ownerId', '=', userId).selectAll().execute();
  }

  delete(id: string): Promise<void> {
    return this.db.deleteFrom('person_group').where('id', '=', id).execute().then(() => {});
  }
}
