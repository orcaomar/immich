<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { scrollMemory } from '$lib/actions/scroll-memory';
  import { shortcut } from '$lib/actions/shortcut';
  import PeopleCard from './PeopleCard.svelte';
  import PeopleInfiniteScroll from './PeopleInfiniteScroll.svelte';
  import SearchPeople from '$lib/components/faces-page/PeopleSearch.svelte';
  import UserPageLayout from '$lib/components/layouts/UserPageLayout.svelte';
  import OnEvents from '$lib/components/OnEvents.svelte';
  import { QueryParameter, SessionStorageKey } from '$lib/constants';
  import PersonMergeSuggestionModal from '$lib/modals/PersonMergeSuggestionModal.svelte';
  import { Route } from '$lib/route';
  import { locale } from '$lib/stores/preferences.store';
  import { websocketEvents } from '$lib/stores/websocket';
  import { handlePromiseError } from '$lib/utils';
  import { handleError } from '$lib/utils/handle-error';
  import { clearQueryParam } from '$lib/utils/navigation';
  import {
    getAllPeople,
    getPerson,
    searchPerson,
    updatePerson,
    getAll as getAllGroups,
    deletePersonGroupsById,
    type PersonResponseDto,
    type PersonGroupResponseDto
  } from '@immich/sdk';
  import { Button, Icon, LoadingSpinner, modalManager, toastManager } from '@immich/ui';
  import { mdiAccountOff, mdiEyeOutline, mdiPlus, mdiPencilOutline, mdiTrashCanOutline } from '@mdi/js';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';
  import type { PageData } from './$types';
  import GroupTab from '$lib/elements/GroupTab.svelte';
  import PersonGroupEditModal from '$lib/modals/PersonGroupEditModal.svelte';
  import ViewGroupMembersModal from '$lib/modals/ViewGroupMembersModal.svelte';
  import ImageThumbnail from '$lib/components/assets/thumbnail/ImageThumbnail.svelte';
  import { getPeopleThumbnailUrl } from '$lib/utils';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  let searchName = $state('');
  let newName = $state('');
  let currentPage = $state(1);
  let nextPage = $state(data.people.hasNextPage ? 2 : null);
  let personMerge1 = $state<PersonResponseDto>();
  let personMerge2 = $state<PersonResponseDto>();
  let potentialMergePeople: PersonResponseDto[] = $state([]);
  let editingPerson: PersonResponseDto | null = $state(null);
  let searchedPeopleLocal: PersonResponseDto[] = $state([]);
  let innerHeight = $state(0);
  let searchPeopleElement = $state<ReturnType<typeof SearchPeople>>();

  let activeTab = $state<'people' | 'groups'>('people');
  let groups = $state<PersonGroupResponseDto[]>([]);
  let groupsLoading = $state(true);
  let allPeople = $state<PersonResponseDto[]>([]);
  let peopleMap = $derived(new Map(allPeople.map((p) => [p.id, p])));

  const loadGroups = async () => {
    try {
      groupsLoading = true;
      const [groupsResult, peopleResult] = await Promise.all([
        getAllGroups(),
        getAllPeople({ withHidden: true, size: 1000 }),
      ]);
      groups = groupsResult;
      allPeople = peopleResult.people;
      groupsLoading = false;
    } catch (error) {
      handleError(error, 'Unable to load groups');
      groupsLoading = false;
    }
  };

  const openCreateGroupModal = async () => {
    const updated = await modalManager.show(PersonGroupEditModal, {});
    if (updated) {
      await loadGroups();
    }
  };

  const openEditGroupModal = async (group: PersonGroupResponseDto) => {
    const updated = await modalManager.show(PersonGroupEditModal, { group });
    if (updated) {
      await loadGroups();
    }
  };

  const handleDeleteGroup = async (id: string) => {
    const isConfirmed = await modalManager.showDialog({
      title: 'Delete Group',
      prompt: 'Are you sure you want to delete this group? This action cannot be undone.',
      confirmText: 'Delete',
      confirmColor: 'danger',
    });

    if (!isConfirmed) {
      return;
    }

    try {
      await deletePersonGroupsById({ id });
      toastManager.primary('Group deleted successfully');
      await loadGroups();
    } catch (error) {
      handleError(error, 'Unable to delete group');
    }
  };

  const viewGroupMembers = (group: PersonGroupResponseDto) => {
    const members = group.personIds
      .map((id) => peopleMap.get(id))
      .filter((person): person is PersonResponseDto => !!person);

    modalManager.show(ViewGroupMembersModal, { groupName: group.name, members });
  };

  onMount(() => {
    loadGroups();

    const getSearchedPeople = $page.url.searchParams.get(QueryParameter.SEARCHED_PEOPLE);
    if (getSearchedPeople) {
      searchName = getSearchedPeople;
      if (searchPeopleElement) {
        handlePromiseError(searchPeopleElement.searchPeople(true, searchName));
      }
    }

    return websocketEvents.on('on_person_thumbnail', (personId: string) => {
      for (const person of people) {
        if (person.id === personId) {
          person.updatedAt = new Date().toISOString();
        }
      }
    });
  });

  const loadInitialScroll = () =>
    new Promise<void>((resolve) => {
      // Load up to previously loaded page when returning.
      let newNextPage = sessionStorage.getItem(SessionStorageKey.INFINITE_SCROLL_PAGE);
      if (newNextPage && nextPage) {
        let startingPage = nextPage,
          pagesToLoad = Number.parseInt(newNextPage) - nextPage;

        if (pagesToLoad) {
          handlePromiseError(
            Promise.all(
              Array.from({ length: pagesToLoad }).map((_, i) => {
                return getAllPeople({ withHidden: true, page: startingPage + i });
              }),
            ).then((pages) => {
              for (const page of pages) {
                people = people.concat(page.people);
              }
              currentPage = startingPage + pagesToLoad - 1;
              nextPage = pages.at(-1)?.hasNextPage ? startingPage + pagesToLoad : null;
              resolve(); // wait until extra pages are loaded
            }),
          );
        } else {
          resolve();
        }
        sessionStorage.removeItem(SessionStorageKey.INFINITE_SCROLL_PAGE);
      }
    });

  const loadNextPage = async () => {
    if (!nextPage) {
      return;
    }

    try {
      const { people: newPeople, hasNextPage } = await getAllPeople({ withHidden: true, page: nextPage });
      people = people.concat(newPeople);
      if (nextPage !== null) {
        currentPage = nextPage;
      }
      nextPage = hasNextPage ? nextPage + 1 : null;
    } catch (error) {
      handleError(error, $t('errors.failed_to_load_people'));
    }
  };

  const handleSearch = async () => {
    const getSearchedPeople = $page.url.searchParams.get(QueryParameter.SEARCHED_PEOPLE);
    if (getSearchedPeople !== searchName) {
      $page.url.searchParams.set(QueryParameter.SEARCHED_PEOPLE, searchName);
      await goto($page.url, { keepFocus: true });
    }
  };

  const handleMerge = async () => {
    if (!editingPerson || !personMerge1 || !personMerge2) {
      return;
    }

    const response = await modalManager.show(PersonMergeSuggestionModal, {
      personToMerge: personMerge1,
      personToBeMergedInto: personMerge2,
      potentialMergePeople,
    });

    if (!response) {
      await updateName(personMerge1.id, newName);
      return;
    }

    const [personToMerge, personToBeMergedInto] = response;

    const mergedPerson = await getPerson({ id: personToBeMergedInto.id });

    people = people.filter((person: PersonResponseDto) => person.id !== personToMerge.id);
    people = people.map((person: PersonResponseDto) => (person.id === personToBeMergedInto.id ? mergedPerson : person));

    if (personToBeMergedInto.name !== newName && editingPerson.id === personToBeMergedInto.id) {
      /*
       *
       * If the user merges one of the suggested people into the person he's editing, it's merging the suggested person AND renames
       * the person he's editing
       *
       */
      try {
        await updatePerson({ id: personToBeMergedInto.id, personUpdateDto: { name: newName } });

        for (const person of people) {
          if (person.id === personToBeMergedInto.id) {
            person.name = newName;
            break;
          }
        }
        toastManager.primary($t('change_name_successfully'));
      } catch (error) {
        handleError(error, $t('errors.unable_to_save_name'));
      }
    }
  };

  const handleHidePerson = async (detail: PersonResponseDto) => {
    try {
      const updatedPerson = await updatePerson({
        id: detail.id,
        personUpdateDto: { isHidden: true },
      });

      people = people.map((person: PersonResponseDto) => {
        if (person.id === updatedPerson.id) {
          return updatedPerson;
        }
        return person;
      });

      toastManager.primary($t('changed_visibility_successfully'));
    } catch (error) {
      handleError(error, $t('errors.unable_to_hide_person'));
    }
  };

  const handleToggleFavorite = async (detail: PersonResponseDto) => {
    try {
      const updatedPerson = await updatePerson({
        id: detail.id,
        personUpdateDto: { isFavorite: !detail.isFavorite },
      });

      people = people.map((person: PersonResponseDto) => {
        if (person.id === updatedPerson.id) {
          return updatedPerson;
        }
        return person;
      });

      toastManager.primary(updatedPerson.isFavorite ? $t('added_to_favorites') : $t('removed_from_favorites'));
    } catch (error) {
      handleError(error, $t('errors.unable_to_add_remove_favorites', { values: { favorite: detail.isFavorite } }));
    }
  };

  const handleMergePeople = async (detail: PersonResponseDto) => {
    await goto(Route.viewPerson(detail, { previousRoute: Route.people(), action: 'merge' }));
  };

  const onResetSearchBar = async () => {
    await clearQueryParam(QueryParameter.SEARCHED_PEOPLE, $page.url);
  };

  let people = $derived(data.people.people);

  let visiblePeople = $derived(people.filter((people) => !people.isHidden));
  let countVisiblePeople = $derived(searchName ? searchedPeopleLocal.length : data.people.total - data.people.hidden);
  let showPeople = $derived(searchName ? searchedPeopleLocal : visiblePeople);

  const onNameChangeInputFocus = (person: PersonResponseDto) => {
    editingPerson = person;
    newName = person.name;
  };

  const onNameChangeSubmit = async (name: string, targetPerson: PersonResponseDto) => {
    try {
      if (name == targetPerson.name) {
        return;
      }

      if (name === '') {
        await updateName(targetPerson.id, '');
        return;
      }

      const personWithSimilarName = await findPeopleWithSimilarName(name, targetPerson.id);
      if (personWithSimilarName) {
        personMerge1 = targetPerson;
        personMerge2 = personWithSimilarName;
        potentialMergePeople = people
          .filter(
            (person: PersonResponseDto) =>
              personMerge2?.name.toLowerCase() === person.name.toLowerCase() &&
              person.id !== personMerge2.id &&
              person.id !== personMerge1?.id &&
              !person.isHidden,
          )
          .slice(0, 3);
        await handleMerge();
        return;
      }
      await updateName(targetPerson.id, name);
    } catch (error) {
      handleError(error, $t('errors.unable_to_save_name'));
    }
  };

  const onNameChangeInputUpdate = (event: Event) => {
    if (event.target) {
      newName = (event.target as HTMLInputElement).value;
    }
  };

  const updateName = async (id: string, name: string) => {
    await updatePerson({
      id,
      personUpdateDto: { name },
    });

    newName = '';
  };

  const findPeopleWithSimilarName = async (name: string, personId: string) => {
    const searchResult = await searchPerson({ name, withHidden: true });
    return searchResult.find(
      (person) => person.name.toLowerCase() === name.toLowerCase() && person.id !== personId && person.name,
    );
  };

  const onPersonUpdate = (response: PersonResponseDto) => {
    people = people.map((person: PersonResponseDto) => {
      if (person.id === response.id) {
        return response;
      }
      return person;
    });
  };
</script>

<svelte:window bind:innerHeight />

<OnEvents {onPersonUpdate} />

<UserPageLayout
  title={activeTab === 'people' ? $t('people') : 'Groups'}
  description={activeTab === 'people'
    ? (countVisiblePeople === 0 && !searchName ? undefined : `(${countVisiblePeople.toLocaleString($locale)})`)
    : `(${groups.length.toLocaleString($locale)})`}
  use={[
    [
      scrollMemory,
      {
        routeStartsWith: Route.people(),
        beforeSave: () => {
          if (currentPage) {
            sessionStorage.setItem(SessionStorageKey.INFINITE_SCROLL_PAGE, currentPage.toString());
          }
        },
        beforeClear: () => {
          sessionStorage.removeItem(SessionStorageKey.INFINITE_SCROLL_PAGE);
        },
        beforeLoad: loadInitialScroll,
      },
    ],
  ]}
>
  {#snippet buttons()}
    <div class="flex items-center justify-center gap-4">
      <div class="h-10">
        <GroupTab
          label="View Selector"
          filters={['people', 'groups']}
          labels={['People', 'Groups']}
          selected={activeTab}
          onSelect={(value) => activeTab = value as 'people' | 'groups'}
        />
      </div>

      {#if activeTab === 'people'}
        {#if people.length > 0}
          <div class="hidden sm:block">
            <div class="h-10 w-40 lg:w-80">
              <SearchPeople
                bind:this={searchPeopleElement}
                type="searchBar"
                placeholder={$t('search_people')}
                onReset={onResetSearchBar}
                onSearch={handleSearch}
                bind:searchName
                bind:searchedPeopleLocal
              />
            </div>
          </div>
          <Button
            leadingIcon={mdiEyeOutline}
            onclick={() => goto('/people/manage')}
            size="small"
            variant="ghost"
            color="secondary">{$t('show_and_hide_people')}</Button
          >
        {/if}
      {:else if activeTab === 'groups'}
        <Button
          leadingIcon={mdiPlus}
          onclick={openCreateGroupModal}
          size="small"
          shape="round"
        >
          Create Group
        </Button>
      {/if}
    </div>
  {/snippet}

  {#if activeTab === 'people'}
    {#if countVisiblePeople > 0 && (!searchName || searchedPeopleLocal.length > 0)}
      <PeopleInfiniteScroll people={showPeople} hasNextPage={!!nextPage && !searchName} {loadNextPage}>
        {#snippet children({ person })}
          <div
            class="rounded-xl border-2 border-transparent p-2 transition-all hover:border-immich-primary/50 hover:bg-gray-200 hover:shadow-sm hover:dark:border-immich-dark-primary/25 dark:hover:bg-immich-dark-primary/20"
          >
            <PeopleCard
              {person}
              onMergePeople={() => handleMergePeople(person)}
              onHidePerson={() => handleHidePerson(person)}
              onToggleFavorite={() => handleToggleFavorite(person)}
            />

            <input
              type="text"
              class="mt-2 w-full rounded-2xl border-gray-100 bg-white py-2 text-center text-sm text-primary placeholder-gray-400 dark:border-gray-900 dark:bg-immich-dark-gray"
              value={person.name}
              placeholder={$t('add_a_name')}
              use:shortcut={{ shortcut: { key: 'Enter' }, onShortcut: (e) => e.currentTarget.blur() }}
              onfocusin={() => onNameChangeInputFocus(person)}
              onfocusout={() => onNameChangeSubmit(newName, person)}
              oninput={(event) => onNameChangeInputUpdate(event)}
            />
          </div>
        {/snippet}
      </PeopleInfiniteScroll>
    {:else}
      <div class="flex min-h-[calc(66vh-11rem)] w-full place-content-center items-center dark:text-white">
        <div class="flex flex-col content-center items-center text-center">
          <Icon icon={mdiAccountOff} size="3.5em" />
          <p class="mt-5 line-clamp-2 max-w-lg overflow-hidden text-3xl font-medium">
            {$t(searchName ? 'search_no_people_named' : 'search_no_people', { values: { name: searchName } })}
          </p>
        </div>
      </div>
    {/if}
  {:else if activeTab === 'groups'}
    {#if groupsLoading}
      <div class="flex min-h-[50vh] w-full items-center justify-center">
        <LoadingSpinner />
      </div>
    {:else}
      {#if groups.length > 0}
        <div class="grid grid-cols-1 gap-6 p-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {#each groups as group (group.id)}
            <div class="relative flex flex-col justify-between rounded-3xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:translate-y-[-2px] hover:border-primary/30 hover:shadow-md dark:border-gray-800 dark:bg-immich-dark-gray dark:hover:border-immich-dark-primary/30">
              <button
                type="button"
                onclick={() => viewGroupMembers(group)}
                class="text-left w-full focus:outline-none group/card cursor-pointer"
              >
                <h3 class="line-clamp-1 text-lg font-bold text-primary group-hover/card:underline">{group.name}</h3>
                <p class="text-xs text-gray-400 dark:text-gray-500">{group.personIds.length} members</p>

                <div class="flex items-center -space-x-3 overflow-hidden py-4">
                  {#each group.personIds.slice(0, 5) as personId}
                    {@const person = peopleMap.get(personId)}
                    {#if person}
                      <div class="inline-block h-10 w-10 rounded-full ring-2 ring-white dark:ring-immich-dark-gray transition-transform group-hover/card:scale-105">
                        <ImageThumbnail
                          circle
                          shadow
                          url={getPeopleThumbnailUrl(person)}
                          altText={person.name}
                          widthStyle="100%"
                        />
                      </div>
                    {/if}
                  {/each}
                  {#if group.personIds.length > 5}
                    <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500 ring-2 ring-white dark:bg-gray-800 dark:text-gray-400 dark:ring-immich-dark-gray transition-transform group-hover/card:scale-105">
                      +{group.personIds.length - 5}
                    </div>
                  {/if}
                </div>
              </button>

              <div class="mt-4 flex gap-2 border-t border-gray-50 pt-3 dark:border-gray-800">
                <Button
                  size="small"
                  variant="ghost"
                  color="secondary"
                  leadingIcon={mdiPencilOutline}
                  onclick={() => openEditGroupModal(group)}
                  fullWidth
                >
                  Edit
                </Button>
                <Button
                  size="small"
                  variant="ghost"
                  color="danger"
                  leadingIcon={mdiTrashCanOutline}
                  onclick={() => handleDeleteGroup(group.id)}
                  fullWidth
                >
                  Delete
                </Button>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="flex min-h-[calc(66vh-11rem)] w-full place-content-center items-center dark:text-white">
          <div class="flex flex-col content-center items-center text-center">
            <Icon icon={mdiAccountOff} size="3.5em" />
            <p class="mt-5 line-clamp-2 max-w-lg overflow-hidden text-3xl font-medium">
              No custom groups created yet.
            </p>
            <p class="mt-2 text-sm text-gray-400">Create a group to organize your family, friends, and colleagues.</p>
            <Button leadingIcon={mdiPlus} shape="round" class="mt-5" onclick={openCreateGroupModal}>
              Create Group
            </Button>
          </div>
        </div>
      {/if}
    {/if}
  {/if}
</UserPageLayout>
