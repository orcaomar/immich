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

  async replacePersonId(oldId: string, newId: string): Promise<void> {
    const groups = await this.db.selectFrom('person_group').selectAll().execute();
    for (const group of groups) {
      if (group.personIds.includes(oldId)) {
        let newPersonIds = group.personIds.map((id) => (id === oldId ? newId : id));
        newPersonIds = [...new Set(newPersonIds)];
        await this.update(group.id, { personIds: newPersonIds });
      }
    }
  }

  async removePersonIds(ids: string[]): Promise<void> {
    const idsSet = new Set(ids);
    const groups = await this.db.selectFrom('person_group').selectAll().execute();
    for (const group of groups) {
      const newPersonIds = group.personIds.filter((id) => !idsSet.has(id));
      if (newPersonIds.length !== group.personIds.length) {
        await this.update(group.id, { personIds: newPersonIds });
      }
    }
  }
}
