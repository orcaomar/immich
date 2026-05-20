<script lang="ts">
  import { afterNavigate, goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';
  import { scrollMemoryClearer } from '$lib/actions/scroll-memory';
  import ImageThumbnail from '$lib/components/assets/thumbnail/ImageThumbnail.svelte';
  import OnEvents from '$lib/components/OnEvents.svelte';
  import ButtonContextMenu from '$lib/components/shared-components/context-menu/ButtonContextMenu.svelte';
  import ControlAppBar from '$lib/components/shared-components/ControlAppBar.svelte';
  import ArchiveAction from '$lib/components/timeline/actions/ArchiveAction.svelte';
  import ChangeDate from '$lib/components/timeline/actions/ChangeDateAction.svelte';
  import ChangeDescription from '$lib/components/timeline/actions/ChangeDescriptionAction.svelte';
  import ChangeLocation from '$lib/components/timeline/actions/ChangeLocationAction.svelte';
  import CreateSharedLink from '$lib/components/timeline/actions/CreateSharedLinkAction.svelte';
  import DeleteAssets from '$lib/components/timeline/actions/DeleteAssetsAction.svelte';
  import DownloadAction from '$lib/components/timeline/actions/DownloadAction.svelte';
  import FavoriteAction from '$lib/components/timeline/actions/FavoriteAction.svelte';
  import SelectAllAssets from '$lib/components/timeline/actions/SelectAllAction.svelte';
  import SetVisibilityAction from '$lib/components/timeline/actions/SetVisibilityAction.svelte';
  import TagAction from '$lib/components/timeline/actions/TagAction.svelte';
  import AssetSelectControlBar from '$lib/components/timeline/AssetSelectControlBar.svelte';
  import Timeline from '$lib/components/timeline/Timeline.svelte';
  import { QueryParameter, SessionStorageKey } from '$lib/constants';
  import { assetMultiSelectManager } from '$lib/managers/asset-multi-select-manager.svelte';
  import { authManager } from '$lib/managers/auth-manager.svelte';
  import { TimelineManager } from '$lib/managers/timeline-manager/timeline-manager.svelte';
  import type { TimelineAsset } from '$lib/managers/timeline-manager/types';
  import { Route } from '$lib/route';
  import { getAssetBulkActions } from '$lib/services/asset.service';
  import { getPeopleThumbnailUrl } from '$lib/utils';
  import { isExternalUrl } from '$lib/utils/navigation';
  import { AssetVisibility } from '@immich/sdk';
  import { ActionButton, CommandPaletteDefaultProvider } from '@immich/ui';
  import { mdiArrowLeft, mdiDotsVertical } from '@mdi/js';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  let timelineManager = $state<TimelineManager>() as TimelineManager;
  let numberOfAssets = $derived(timelineManager?.assetCount ?? 0);
  const options = $derived({ visibility: AssetVisibility.Timeline, groupId: data.group.id });

  let previousRoute = $state<string>(Route.people());

  onMount(() => {
    const getPreviousRoute = $page.url.searchParams.get(QueryParameter.PREVIOUS_ROUTE);
    if (getPreviousRoute && !isExternalUrl(getPreviousRoute)) {
      previousRoute = getPreviousRoute;
    }
  });

  const handleEscape = async () => {
    if (assetMultiSelectManager.selectionActive) {
      assetMultiSelectManager.clear();
      return;
    }

    await goto(previousRoute);
  };

  const updateAssetCount = async () => {
    await invalidateAll();
  };

  afterNavigate(({ from }) => {
    // Prevent setting previousRoute to the current page.
    if (from?.url && from.route.id !== $page.route.id) {
      previousRoute = from.url.href;
    }
  });

  const handleDeleteAssets = async (assetIds: string[]) => {
    timelineManager.removeAssets(assetIds);
    await updateAssetCount();
  };

  const handleUndoDeleteAssets = async (assets: TimelineAsset[]) => {
    timelineManager.upsertAssets(assets);
    await updateAssetCount();
  };

  const handleSetVisibility = (assetIds: string[]) => {
    timelineManager.removeAssets(assetIds);
    assetMultiSelectManager.clear();
  };
</script>

<OnEvents
  onAssetsDelete={updateAssetCount}
  onAssetsArchive={updateAssetCount}
/>

<main
  class="relative z-0 h-dvh overflow-hidden px-2 pt-(--navbar-height) md:px-6 md:pt-(--navbar-height-md)"
  use:scrollMemoryClearer={{
    routeStartsWith: Route.people(),
    beforeClear: () => {
      sessionStorage.removeItem(SessionStorageKey.INFINITE_SCROLL_PAGE);
    },
  }}
>
  {#key data.group.id}
    <Timeline
      enableRouting={true}
      bind:timelineManager
      {options}
      assetInteraction={assetMultiSelectManager}
      onEscape={handleEscape}
    >
      <div class="p-4 pt-12 sm:px-6">
        <div class="flex flex-col gap-6">
          <!-- Title & asset count -->
          <div class="flex flex-col">
            <h1 class="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100 sm:text-4xl">
              {data.group.name}
            </h1>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {$t('assets_count', { values: { count: numberOfAssets } })}
            </p>
          </div>

          <!-- Group Members section -->
          {#if data.people.length > 0}
            <div class="flex flex-col gap-2">
              <h2 class="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Group Members
              </h2>
              <div class="flex flex-wrap gap-4 py-2">
                {#each data.people as person (person.id)}
                  <button
                    type="button"
                    onclick={() => goto(Route.viewPerson({ id: person.id }, { previousRoute: $page.url.href }))}
                    class="group/member flex flex-col items-center gap-1 focus:outline-none"
                  >
                    <div class="relative h-16 w-16 overflow-hidden rounded-full ring-2 ring-transparent transition-all group-hover/member:ring-primary dark:group-hover/member:ring-immich-dark-primary group-hover/member:scale-105 group-hover/member:shadow-md">
                      <ImageThumbnail
                        circle
                        shadow
                        url={getPeopleThumbnailUrl(person)}
                        altText={person.name}
                        widthStyle="100%"
                        heightStyle="100%"
                      />
                    </div>
                    <span class="max-w-[72px] truncate text-center text-xs font-medium text-gray-700 transition-colors group-hover/member:text-primary dark:text-gray-300 dark:group-hover/member:text-immich-dark-primary">
                      {person.name || $t('add_a_name')}
                    </span>
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      </div>
    </Timeline>
  {/key}
</main>

<header>
  {#if assetMultiSelectManager.selectionActive}
    <AssetSelectControlBar>
      {@const Actions = getAssetBulkActions($t)}
      <CommandPaletteDefaultProvider name={$t('assets')} actions={Object.values(Actions)} />
      <CreateSharedLink />
      <SelectAllAssets {timelineManager} assetInteraction={assetMultiSelectManager} />
      <ActionButton action={Actions.AddToAlbum} />
      <FavoriteAction
        removeFavorite={assetMultiSelectManager.isAllFavorite}
        onFavorite={(ids, isFavorite) => timelineManager.update(ids, (asset) => (asset.isFavorite = isFavorite))}
      />
      <ButtonContextMenu icon={mdiDotsVertical} title={$t('menu')}>
        <DownloadAction menuItem filename="{data.group.name || 'immich'}.zip" />
        <ChangeDate menuItem />
        <ChangeDescription menuItem />
        <ChangeLocation menuItem />
        <ArchiveAction
          menuItem
          unarchive={assetMultiSelectManager.isAllArchived}
          onArchive={(ids, visibility) => timelineManager.update(ids, (asset) => (asset.visibility = visibility))}
        />
        {#if authManager.preferences.tags.enabled && assetMultiSelectManager.isAllUserOwned}
          <TagAction menuItem />
        {/if}
        <SetVisibilityAction menuItem onVisibilitySet={handleSetVisibility} />
        <DeleteAssets
          menuItem
          onAssetDelete={(assetIds) => handleDeleteAssets(assetIds)}
          onUndoDelete={(assets) => handleUndoDeleteAssets(assets)}
        />
      </ButtonContextMenu>
    </AssetSelectControlBar>
  {:else}
    <ControlAppBar showBackButton backIcon={mdiArrowLeft} onClose={() => goto(previousRoute)}>
    </ControlAppBar>
  {/if}
</header>
