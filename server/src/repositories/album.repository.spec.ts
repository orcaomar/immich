import { AlbumRepository } from './album.repository';

describe(AlbumRepository.name, () => {
  let sut: AlbumRepository;
  let dbMock: any;
  let executeMock: any;
  let updateExecuteMock: any;

  beforeEach(() => {
    executeMock = vitest.fn();
    updateExecuteMock = vitest.fn();

    const selectFromChain = {
      select: vitest.fn().mockReturnThis(),
      where: vitest.fn().mockReturnThis(),
      execute: executeMock,
    };

    const updateTableChain = {
      set: vitest.fn().mockReturnThis(),
      where: vitest.fn().mockReturnThis(),
      execute: updateExecuteMock,
    };

    dbMock = {
      selectFrom: vitest.fn().mockReturnValue(selectFromChain),
      updateTable: vitest.fn().mockReturnValue(updateTableChain),
    };

    sut = new AlbumRepository(
      dbMock,
      {} as any,
      {} as any,
      {} as any,
      { setContext: vitest.fn() } as any,
    );
  });

  describe('replacePersonIdInSmartCriteria', () => {
    it('should do nothing if no smart albums are found', async () => {
      executeMock.mockResolvedValue([]);

      await sut.replacePersonIdInSmartCriteria('old-id', 'new-id');

      expect(dbMock.selectFrom).toHaveBeenCalledWith('album');
      expect(dbMock.updateTable).not.toHaveBeenCalled();
    });

    it('should do nothing if album criteria is null', async () => {
      executeMock.mockResolvedValue([{ id: 'album-1', criteria: null }]);

      await sut.replacePersonIdInSmartCriteria('old-id', 'new-id');

      expect(dbMock.updateTable).not.toHaveBeenCalled();
    });

    it('should do nothing if album criteria does not contain old-id', async () => {
      executeMock.mockResolvedValue([
        { id: 'album-1', criteria: { personIds: ['other-id'] } },
      ]);

      await sut.replacePersonIdInSmartCriteria('old-id', 'new-id');

      expect(dbMock.updateTable).not.toHaveBeenCalled();
    });

    it('should delete old-id from criteria.personIds when newId is null', async () => {
      executeMock.mockResolvedValue([
        { id: 'album-1', criteria: { personIds: ['old-id', 'other-id'] } },
      ]);

      await sut.replacePersonIdInSmartCriteria('old-id', null);

      expect(dbMock.updateTable).toHaveBeenCalledWith('album');
      expect(updateExecuteMock).toHaveBeenCalled();
      const setCall = dbMock.updateTable().set.mock.calls[0][0];
      expect(JSON.parse(setCall.criteria)).toEqual({
        personIds: ['other-id'],
      });
    });

    it('should replace old-id with new-id in criteria.personIds when newId is provided', async () => {
      executeMock.mockResolvedValue([
        { id: 'album-1', criteria: { personIds: ['old-id', 'other-id'] } },
      ]);

      await sut.replacePersonIdInSmartCriteria('old-id', 'new-id');

      expect(dbMock.updateTable).toHaveBeenCalledWith('album');
      const setCall = dbMock.updateTable().set.mock.calls[0][0];
      expect(JSON.parse(setCall.criteria)).toEqual({
        personIds: ['new-id', 'other-id'],
      });
    });

    it('should remove old-id and not duplicate if new-id is already in criteria.personIds', async () => {
      executeMock.mockResolvedValue([
        { id: 'album-1', criteria: { personIds: ['old-id', 'new-id', 'other-id'] } },
      ]);

      await sut.replacePersonIdInSmartCriteria('old-id', 'new-id');

      expect(dbMock.updateTable).toHaveBeenCalledWith('album');
      const setCall = dbMock.updateTable().set.mock.calls[0][0];
      expect(JSON.parse(setCall.criteria)).toEqual({
        personIds: ['new-id', 'other-id'],
      });
    });

    it('should delete old-id and clean up empty custom groups without groupId', async () => {
      executeMock.mockResolvedValue([
        {
          id: 'album-1',
          criteria: {
            personQuery: {
              includes: [{ personIds: ['old-id'] }],
            },
          },
        },
      ]);

      await sut.replacePersonIdInSmartCriteria('old-id', null);

      expect(dbMock.updateTable).toHaveBeenCalledWith('album');
      const setCall = dbMock.updateTable().set.mock.calls[0][0];
      expect(JSON.parse(setCall.criteria)).toEqual({
        personQuery: {
          includes: [],
        },
      });
    });

    it('should delete old-id but keep group with groupId in personQuery.includes', async () => {
      executeMock.mockResolvedValue([
        {
          id: 'album-1',
          criteria: {
            personQuery: {
              includes: [{ groupId: 'group-1', personIds: ['old-id'] }],
            },
          },
        },
      ]);

      await sut.replacePersonIdInSmartCriteria('old-id', null);

      expect(dbMock.updateTable).toHaveBeenCalledWith('album');
      const setCall = dbMock.updateTable().set.mock.calls[0][0];
      expect(JSON.parse(setCall.criteria)).toEqual({
        personQuery: {
          includes: [{ groupId: 'group-1', personIds: [] }],
        },
      });
    });

    it('should replace old-id with new-id in personQuery.excludes', async () => {
      executeMock.mockResolvedValue([
        {
          id: 'album-1',
          criteria: {
            personQuery: {
              excludes: ['old-id', 'other-id'],
            },
          },
        },
      ]);

      await sut.replacePersonIdInSmartCriteria('old-id', 'new-id');

      expect(dbMock.updateTable).toHaveBeenCalledWith('album');
      const setCall = dbMock.updateTable().set.mock.calls[0][0];
      expect(JSON.parse(setCall.criteria)).toEqual({
        personQuery: {
          excludes: ['new-id', 'other-id'],
        },
      });
    });
  });

  describe('getSmartAlbumsUsingGroup', () => {
    it('should only return albums referencing the specific groupId', async () => {
      executeMock.mockResolvedValue([
        {
          id: 'album-1',
          albumName: 'Album 1',
          criteria: {
            personQuery: {
              includes: [{ groupId: 'group-1' }],
            },
          },
        },
        {
          id: 'album-2',
          albumName: 'Album 2',
          criteria: {
            personQuery: {
              includes: [{ groupId: 'group-2' }],
            },
          },
        },
        {
          id: 'album-3',
          albumName: 'Album 3',
          criteria: null,
        },
      ]);

      const result = await sut.getSmartAlbumsUsingGroup('group-1', 'Family Group');
      expect(result).toEqual([{ id: 'album-1', albumName: 'Album 1' }]);
    });
  });

  describe('getSmartAlbumsUsingPerson', () => {
    it('should find albums that use the personId in various filters', async () => {
      executeMock.mockResolvedValue([
        {
          id: 'album-1',
          albumName: 'Album 1',
          criteria: {
            personIds: ['person-1', 'other-id'],
          },
        },
        {
          id: 'album-2',
          albumName: 'Album 2',
          criteria: {
            personQuery: {
              includes: [{ personIds: ['person-1'] }],
            },
          },
        },
        {
          id: 'album-3',
          albumName: 'Album 3',
          criteria: {
            personQuery: {
              excludes: ['person-1'],
            },
          },
        },
        {
          id: 'album-4',
          albumName: 'Album 4',
          criteria: {
            personIds: ['other-id'],
            personQuery: {
              includes: [{ personIds: ['other-id'] }],
              excludes: ['other-id'],
            },
          },
        },
      ]);

      const result = await sut.getSmartAlbumsUsingPerson('person-1');
      expect(result).toEqual([
        { id: 'album-1', albumName: 'Album 1' },
        { id: 'album-2', albumName: 'Album 2' },
        { id: 'album-3', albumName: 'Album 3' },
      ]);
    });
  });
});
