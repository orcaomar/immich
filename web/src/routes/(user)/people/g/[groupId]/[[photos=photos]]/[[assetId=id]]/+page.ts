import { getById as getPersonGroup, getPerson } from '@immich/sdk';
import { authenticate } from '$lib/utils/auth';
import type { PageLoad } from './$types';

export const load = (async ({ params, url }) => {
  await authenticate(url);

  const group = await getPersonGroup({ id: params.groupId });
  const people = (
    await Promise.all((group.personIds || []).map((id) => getPerson({ id }).catch(() => null)))
  ).filter((p): p is NonNullable<typeof p> => p !== null);

  return {
    group,
    people,
    meta: {
      title: group.name || 'Group',
    },
  };
}) satisfies PageLoad;
