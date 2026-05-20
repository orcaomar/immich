<script lang="ts">
  import { BasicModal } from '@immich/ui';
  import { type PersonResponseDto } from '@immich/sdk';
  import { getPeopleThumbnailUrl } from '$lib/utils';
  import ImageThumbnail from '$lib/components/assets/thumbnail/ImageThumbnail.svelte';
  import { Route } from '$lib/route';
  import { goto } from '$app/navigation';
  import { t } from 'svelte-i18n';

  type Props = {
    groupName: string;
    members: PersonResponseDto[];
    onClose: () => void;
  };

  const { groupName, members, onClose }: Props = $props();

  const navigateToPerson = (person: PersonResponseDto) => {
    onClose();
    void goto(Route.viewPerson(person, { previousRoute: Route.people() }));
  };
</script>

<BasicModal title={groupName} size="small" {onClose}>
  <div class="flex flex-col gap-1 max-h-[60vh] overflow-y-auto pr-2">
    <p class="text-xs text-gray-400 dark:text-gray-500 mb-3 px-1">{members.length} members</p>
    
    {#each members as person (person.id)}
      <button
        type="button"
        onclick={() => navigateToPerson(person)}
        class="flex items-center gap-4 p-2 rounded-2xl transition-all text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 w-full group outline-none"
      >
        <div class="h-12 w-12 shrink-0 rounded-full overflow-hidden ring-2 ring-white dark:ring-immich-dark-gray shadow-sm group-hover:ring-primary/25 dark:group-hover:ring-immich-dark-primary/20 transition-all">
          <ImageThumbnail
            circle
            shadow
            url={getPeopleThumbnailUrl(person)}
            altText={person.name}
            widthStyle="100%"
          />
        </div>
        
        <div class="flex flex-col min-w-0">
          <span class="text-sm font-bold text-immich-fg dark:text-immich-dark-fg group-hover:text-primary dark:group-hover:text-immich-dark-primary transition-colors truncate">
            {person.name || $t('no_name')}
          </span>
        </div>
      </button>
    {/each}
  </div>
</BasicModal>
