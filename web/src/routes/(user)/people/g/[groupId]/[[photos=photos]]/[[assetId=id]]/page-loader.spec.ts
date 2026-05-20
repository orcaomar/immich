import { vi, describe, it, expect } from 'vitest';
import { load } from './+page';

vi.mock('@immich/sdk', () => ({
  getById: vi.fn(),
  getPerson: vi.fn(),
}));

vi.mock('$lib/utils/auth', () => ({
  authenticate: vi.fn().mockResolvedValue({}),
}));

import { getById as getPersonGroup, getPerson } from '@immich/sdk';

describe('Group timeline page loader (+page.ts)', () => {
  it('should authenticate and load group details along with member people info', async () => {
    const mockGroup = {
      id: 'group-uuid',
      name: 'Friends Group',
      personIds: ['person-1', 'person-2'],
    };

    const mockPerson1 = { id: 'person-1', name: 'John Doe' };
    const mockPerson2 = { id: 'person-2', name: 'Jane Smith' };

    vi.mocked(getPersonGroup).mockResolvedValue(mockGroup);
    vi.mocked(getPerson).mockImplementation(async ({ id }) => {
      if (id === 'person-1') return mockPerson1;
      if (id === 'person-2') return mockPerson2;
      throw new Error('Not found');
    });

    const result = await load({
      params: { groupId: 'group-uuid' },
      url: new URL('http://localhost/people/g/group-uuid'),
      route: { id: '(user)/people/g/[groupId]/[[photos=photos]]/[[assetId=id]]' },
    } as any);

    expect(result).toEqual({
      group: mockGroup,
      people: [mockPerson1, mockPerson2],
      meta: {
        title: 'Friends Group',
      },
    });
  });

  it('should fallback to default Group title when group name is empty', async () => {
    const mockGroup = {
      id: 'group-uuid',
      name: '',
      personIds: [],
    };

    vi.mocked(getPersonGroup).mockResolvedValue(mockGroup);

    const result = await load({
      params: { groupId: 'group-uuid' },
      url: new URL('http://localhost/people/g/group-uuid'),
      route: { id: '(user)/people/g/[groupId]/[[photos=photos]]/[[assetId=id]]' },
    } as any);

    expect(result.meta.title).toBe('Group');
  });
});
