<script lang="ts">
  import { shortcut } from '$lib/actions/shortcut';
  import { eventManager } from '$lib/managers/event-manager.svelte';
  import { handleError } from '$lib/utils/handle-error';
  import { updateAlbumInfo } from '@immich/sdk';
  import { Textarea } from '@immich/ui';
  import { t } from 'svelte-i18n';
  import { fromAction } from 'svelte/attachments';

  import { Icon } from '@immich/ui';
  import { mdiContentSave } from '@mdi/js';

  type Props = {
    id: string;
    albumName: string;
    isOwned: boolean;
    isSmart?: boolean;
    onUpdate: (albumName: string) => void;
  };

  let { id, albumName = $bindable(), isOwned, isSmart = false, onUpdate }: Props = $props();

  let newAlbumName = $derived(albumName);

  const handleUpdate = async () => {
    newAlbumName = newAlbumName.replaceAll('\n', ' ').trim();

    if (newAlbumName === albumName) {
      return;
    }

    try {
      const response = await updateAlbumInfo({ id, updateAlbumDto: { albumName: newAlbumName } });
      ({ albumName } = response);
      eventManager.emit('AlbumUpdate', response);
      onUpdate(albumName);
    } catch (error) {
      handleError(error, $t('errors.unable_to_save_album'));
    }
  };

  const textClasses = 'text-2xl lg:text-6xl text-primary';
</script>

<div class="mb-2 flex items-center gap-3">
  {#if isSmart}
    <div class="mt-1 shrink-0 text-primary" title="Smart Album (Dynamic Query)">
      <Icon icon={mdiContentSave} size="36" />
    </div>
  {/if}
  <div class="w-full flex-1">
    {#if isOwned}
      <Textarea
        bind:value={newAlbumName}
        variant="ghost"
        title={$t('edit_title')}
        onblur={handleUpdate}
        placeholder={$t('add_a_title')}
        class={textClasses}
        {@attach fromAction(shortcut, () => ({
          shortcut: { key: 'Enter' },
          onShortcut: (event) => event.currentTarget.blur(),
        }))}
      />
    {:else}
      <div class={textClasses}>{newAlbumName}</div>
    {/if}
  </div>
</div>
