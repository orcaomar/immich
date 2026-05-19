import { NotFoundException } from '@nestjs/common';
import { PersonGroupService } from 'src/services/person-group.service';
import { AuthFactory } from 'test/factories/auth.factory';
import { newTestService, ServiceMocks } from 'test/utils';

describe(PersonGroupService.name, () => {
  let sut: PersonGroupService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(PersonGroupService));
  });

  it('should be defined', () => {
    expect(sut).toBeDefined();
  });

  describe('create', () => {
    it('should create a person group', async () => {
      const auth = AuthFactory.create();
      const dto = { name: 'Family', personIds: ['uuid-1', 'uuid-2'] };
      const expectedGroup = { id: 'group-1', ownerId: auth.user.id, ...dto, createdAt: new Date(), updatedAt: new Date(), updateId: 'update-id-1' };

      mocks.personGroup.create.mockResolvedValue(expectedGroup);

      const result = await sut.create(auth, dto);

      expect(result).toEqual(expectedGroup);
      expect(mocks.personGroup.create).toHaveBeenCalledWith({
        ownerId: auth.user.id,
        name: dto.name,
        personIds: dto.personIds,
      });
    });
  });

  describe('update', () => {
    it('should throw NotFoundException if group does not exist', async () => {
      const auth = AuthFactory.create();
      mocks.personGroup.getById.mockResolvedValue(undefined);

      await expect(sut.update(auth, 'unknown-id', { name: 'New Name' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if user is not the owner', async () => {
      const auth = AuthFactory.create();
      const group = { id: 'group-1', ownerId: 'other-user', name: 'Family', personIds: [] as string[], createdAt: new Date(), updatedAt: new Date(), updateId: 'update-id-1' };
      mocks.personGroup.getById.mockResolvedValue(group);

      await expect(sut.update(auth, 'group-1', { name: 'New Name' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update a person group successfully', async () => {
      const auth = AuthFactory.create();
      const group = { id: 'group-1', ownerId: auth.user.id, name: 'Family', personIds: ['uuid-1'], createdAt: new Date(), updatedAt: new Date(), updateId: 'update-id-1' };
      const updatedGroup = { ...group, name: 'New Name', personIds: ['uuid-1', 'uuid-2'] };

      mocks.personGroup.getById.mockResolvedValue(group);
      mocks.personGroup.update.mockResolvedValue(updatedGroup);

      const result = await sut.update(auth, 'group-1', {
        name: 'New Name',
        personIds: ['uuid-1', 'uuid-2'],
      });

      expect(result).toEqual(updatedGroup);
      expect(mocks.personGroup.getById).toHaveBeenCalledWith('group-1');
      expect(mocks.personGroup.update).toHaveBeenCalledWith('group-1', {
        name: 'New Name',
        personIds: ['uuid-1', 'uuid-2'],
      });
    });
  });

  describe('getAll', () => {
    it('should return all person groups for the user', async () => {
      const auth = AuthFactory.create();
      const groups = [
        { id: 'group-1', ownerId: auth.user.id, name: 'Family', personIds: [] as string[], createdAt: new Date(), updatedAt: new Date(), updateId: 'update-id-1' },
        { id: 'group-2', ownerId: auth.user.id, name: 'Friends', personIds: [] as string[], createdAt: new Date(), updatedAt: new Date(), updateId: 'update-id-1' },
      ];

      mocks.personGroup.getAllForUser.mockResolvedValue(groups);

      const result = await sut.getAll(auth);

      expect(result).toEqual(groups);
      expect(mocks.personGroup.getAllForUser).toHaveBeenCalledWith(auth.user.id);
    });
  });

  describe('getById', () => {
    it('should throw NotFoundException if group does not exist', async () => {
      const auth = AuthFactory.create();
      mocks.personGroup.getById.mockResolvedValue(undefined);

      await expect(sut.getById(auth, 'unknown-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if user is not the owner', async () => {
      const auth = AuthFactory.create();
      const group = { id: 'group-1', ownerId: 'other-user', name: 'Family', personIds: [] as string[], createdAt: new Date(), updatedAt: new Date(), updateId: 'update-id-1' };
      mocks.personGroup.getById.mockResolvedValue(group);

      await expect(sut.getById(auth, 'group-1')).rejects.toThrow(NotFoundException);
    });

    it('should return the group by id successfully', async () => {
      const auth = AuthFactory.create();
      const group = { id: 'group-1', ownerId: auth.user.id, name: 'Family', personIds: [] as string[], createdAt: new Date(), updatedAt: new Date(), updateId: 'update-id-1' };

      mocks.personGroup.getById.mockResolvedValue(group);

      const result = await sut.getById(auth, 'group-1');

      expect(result).toEqual(group);
      expect(mocks.personGroup.getById).toHaveBeenCalledWith('group-1');
    });
  });

  describe('delete', () => {
    it('should throw NotFoundException if group does not exist', async () => {
      const auth = AuthFactory.create();
      mocks.personGroup.getById.mockResolvedValue(undefined);

      await expect(sut.delete(auth, 'unknown-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if user is not the owner', async () => {
      const auth = AuthFactory.create();
      const group = { id: 'group-1', ownerId: 'other-user', name: 'Family', personIds: [] as string[], createdAt: new Date(), updatedAt: new Date(), updateId: 'update-id-1' };
      mocks.personGroup.getById.mockResolvedValue(group);

      await expect(sut.delete(auth, 'group-1')).rejects.toThrow(NotFoundException);
    });

    it('should delete the group successfully', async () => {
      const auth = AuthFactory.create();
      const group = { id: 'group-1', ownerId: auth.user.id, name: 'Family', personIds: [] as string[], createdAt: new Date(), updatedAt: new Date(), updateId: 'update-id-1' };

      mocks.personGroup.getById.mockResolvedValue(group);
      mocks.personGroup.delete.mockResolvedValue(undefined);

      await sut.delete(auth, 'group-1');

      expect(mocks.personGroup.getById).toHaveBeenCalledWith('group-1');
      expect(mocks.personGroup.delete).toHaveBeenCalledWith('group-1');
    });
  });
});
