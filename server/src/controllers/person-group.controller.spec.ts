import { PersonGroupController } from 'src/controllers/person-group.controller';
import { PersonGroupService } from 'src/services/person-group.service';
import request from 'supertest';
import { errorDto } from 'test/medium/responses';
import { factory } from 'test/small.factory';
import { ControllerContext, controllerSetup, mockBaseService } from 'test/utils';

describe(PersonGroupController.name, () => {
  let ctx: ControllerContext;
  const service = mockBaseService(PersonGroupService);

  beforeAll(async () => {
    ctx = await controllerSetup(PersonGroupController, [{ provide: PersonGroupService, useValue: service }]);
    return () => ctx.close();
  });

  beforeEach(() => {
    service.resetAllMocks();
    ctx.reset();
  });

  describe('GET /person-groups', () => {
    it('should be an authenticated route', async () => {
      await request(ctx.getHttpServer()).get('/person-groups');
      expect(ctx.authenticate).toHaveBeenCalled();
    });

    it('should return all person groups', async () => {
      const groups = [
        { id: factory.uuid(), name: 'Family', personIds: [factory.uuid()] },
      ];
      service.getAll.mockResolvedValue(groups);

      const { status, body } = await request(ctx.getHttpServer()).get('/person-groups');

      expect(status).toBe(200);
      expect(body).toEqual(groups);
      expect(service.getAll).toHaveBeenCalled();
    });
  });

  describe('POST /person-groups', () => {
    it('should be an authenticated route', async () => {
      await request(ctx.getHttpServer()).post('/person-groups');
      expect(ctx.authenticate).toHaveBeenCalled();
    });

    it('should fail with validation error when name is missing', async () => {
      const { status, body } = await request(ctx.getHttpServer())
        .post('/person-groups')
        .send({ personIds: [] });

      expect(status).toBe(400);
      expect(body).toEqual(
        errorDto.validationError([{ path: ['name'], message: 'Invalid input: expected string, received undefined' }]),
      );
    });

    it('should create a person group successfully', async () => {
      const group = { id: factory.uuid(), name: 'Colleagues', personIds: [] };
      service.create.mockResolvedValue(group);

      const { status, body } = await request(ctx.getHttpServer())
        .post('/person-groups')
        .send({ name: 'Colleagues', personIds: [] });

      expect(status).toBe(201);
      expect(body).toEqual(group);
      expect(service.create).toHaveBeenCalledWith(undefined, { name: 'Colleagues', personIds: [] });
    });

    it('should create a person group with 10 members successfully', async () => {
      const personIds = Array.from({ length: 10 }, () => factory.uuid());
      const group = { id: factory.uuid(), name: 'Family', personIds };
      service.create.mockResolvedValue(group);

      const { status, body } = await request(ctx.getHttpServer())
        .post('/person-groups')
        .send({ name: 'Family', personIds });

      expect(status).toBe(201);
      expect(body).toEqual(group);
      expect(service.create).toHaveBeenCalledWith(undefined, { name: 'Family', personIds });
    });
  });

  describe('GET /person-groups/:id', () => {
    it('should be an authenticated route', async () => {
      await request(ctx.getHttpServer()).get(`/person-groups/${factory.uuid()}`);
      expect(ctx.authenticate).toHaveBeenCalled();
    });

    it('should require a valid uuid', async () => {
      const { status, body } = await request(ctx.getHttpServer()).get(`/person-groups/123`);
      expect(status).toBe(400);
      expect(body).toEqual(errorDto.validationError([{ path: ['id'], message: 'Invalid UUID' }]));
    });

    it('should get a person group by id successfully', async () => {
      const id = factory.uuid();
      const group = { id, name: 'Friends', personIds: [] };
      service.getById.mockResolvedValue(group);

      const { status, body } = await request(ctx.getHttpServer()).get(`/person-groups/${id}`);

      expect(status).toBe(200);
      expect(body).toEqual(group);
      expect(service.getById).toHaveBeenCalledWith(undefined, id);
    });
  });

  describe('PUT /person-groups/:id', () => {
    it('should be an authenticated route', async () => {
      await request(ctx.getHttpServer()).put(`/person-groups/${factory.uuid()}`);
      expect(ctx.authenticate).toHaveBeenCalled();
    });

    it('should require a valid uuid', async () => {
      const { status, body } = await request(ctx.getHttpServer())
        .put(`/person-groups/123`)
        .send({ name: 'New Name' });
      expect(status).toBe(400);
      expect(body).toEqual(errorDto.validationError([{ path: ['id'], message: 'Invalid UUID' }]));
    });

    it('should update a person group successfully', async () => {
      const id = factory.uuid();
      const updated = { id, name: 'Close Friends', personIds: [] };
      service.update.mockResolvedValue(updated);

      const { status, body } = await request(ctx.getHttpServer())
        .put(`/person-groups/${id}`)
        .send({ name: 'Close Friends' });

      expect(status).toBe(200);
      expect(body).toEqual(updated);
      expect(service.update).toHaveBeenCalledWith(undefined, id, { name: 'Close Friends' });
    });
  });

  describe('DELETE /person-groups/:id', () => {
    it('should be an authenticated route', async () => {
      await request(ctx.getHttpServer()).delete(`/person-groups/${factory.uuid()}`);
      expect(ctx.authenticate).toHaveBeenCalled();
    });

    it('should require a valid uuid', async () => {
      const { status, body } = await request(ctx.getHttpServer()).delete(`/person-groups/123`);
      expect(status).toBe(400);
      expect(body).toEqual(errorDto.validationError([{ path: ['id'], message: 'Invalid UUID' }]));
    });

    it('should delete a person group successfully', async () => {
      const id = factory.uuid();
      service.delete.mockResolvedValue(undefined);

      const { status } = await request(ctx.getHttpServer()).delete(`/person-groups/${id}`);

      expect(status).toBe(200);
      expect(service.delete).toHaveBeenCalledWith(undefined, id);
    });
  });
});
