<script lang="ts">
  import ImageThumbnail from '$lib/components/assets/thumbnail/ImageThumbnail.svelte';
  import SearchBar from '$lib/elements/SearchBar.svelte';
  import { getPeopleThumbnailUrl } from '$lib/utils';
  import { handleError } from '$lib/utils/handle-error';
  import {
    create as createPersonGroup,
    update as updatePersonGroup,
    getAllPeople,
    type PersonResponseDto,
    type PersonGroupResponseDto
  } from '@immich/sdk';
  import { Button, Field, HStack, Input, LoadingSpinner, Modal, ModalBody, ModalFooter, toastManager } from '@immich/ui';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';

  type Props = {
    group?: PersonGroupResponseDto;
    onClose: (updated?: boolean) => void;
  };

  let { group, onClose }: Props = $props();

  let groupName = $state(group?.name || '');
  let selectedIds: string[] = $state(group?.personIds || []);
  let people: PersonResponseDto[] = $state([]);
  let loading = $state(true);
  let searchName = $state('');

  const filteredPeople = $derived(
    people.filter((person) => !searchName || person.name.toLowerCase().includes(searchName.toLowerCase())),
  );

  onMount(async () => {
    try {
      loading = true;
      const result = await getAllPeople({ withHidden: false });
      people = result.people;
      loading = false;
    } catch (error) {
      handleError(error, $t('get_people_error'));
      loading = false;
    }
  });

  const togglePerson = (personId: string) => {
    if (selectedIds.includes(personId)) {
      selectedIds = selectedIds.filter((id) => id !== personId);
    } else {
      selectedIds = [...selectedIds, personId];
    }
  };

  const handleSave = async () => {
    if (!groupName.trim()) {
      toastManager.error($t('group_name_required') || 'Group name is required');
      return;
    }

    try {
      if (group) {
        await updatePersonGroup({
          id: group.id,
          personGroupUpdateDto: {
            name: groupName.trim(),
            personIds: selectedIds,
          },
        });
        toastManager.primary($t('group_updated_successfully') || 'Group updated successfully');
      } else {
        await createPersonGroup({
          personGroupCreateDto: {
            name: groupName.trim(),
            personIds: selectedIds,
          },
        });
        toastManager.primary($t('group_created_successfully') || 'Group created successfully');
      }
      onClose(true);
    } catch (error) {
      handleError(error, $t('unable_to_save_group') || 'Unable to save group');
    }
  };
</script>

<Modal title={group ? 'Edit Group' : 'Create Group'} {onClose} size="medium">
  <ModalBody>
    <div class="flex flex-col gap-4">
      <Field label="Group Name" required>
        <Input autofocus bind:value={groupName} placeholder="e.g. Family, Friends, Colleagues" />
      </Field>

      <div class="border-t border-gray-100 pt-4 dark:border-gray-800">
        <p class="mb-2 text-sm font-semibold text-primary">Select Members ({selectedIds.length} selected)</p>
        <SearchBar bind:name={searchName} placeholder="Search people" showLoadingSpinner={false} />
      </div>

      <div class="max-h-64 overflow-y-auto immich-scrollbar">
        {#if loading}
          <div class="flex justify-center p-8">
            <LoadingSpinner />
          </div>
        {:else if filteredPeople.length > 0}
          <div class="grid grid-cols-4 gap-4 p-2">
            {#each filteredPeople as person (person.id)}
              {@const isSelected = selectedIds.includes(person.id)}
              <button
                type="button"
                onclick={() => togglePerson(person.id)}
                class="relative flex flex-col items-center gap-2 rounded-xl p-2 transition-all hover:bg-subtle {isSelected
                  ? 'bg-primary/10 ring-2 ring-primary dark:bg-immich-dark-primary/20 dark:ring-immich-dark-primary'
                  : ''}"
              >
                <ImageThumbnail
                  circle
                  shadow
                  url={getPeopleThumbnailUrl(person)}
                  altText={person.name}
                  widthStyle="100%"
                />
                <p class="line-clamp-2 text-center text-xs font-medium text-primary">{person.name}</p>

                {#if isSelected}
                  <div class="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white dark:bg-immich-dark-primary">
                    <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                {/if}
              </button>
            {/each}
          </div>
        {:else}
          <p class="py-8 text-center text-sm text-gray-500">No people found</p>
        {/if}
      </div>
    </div>
  </ModalBody>

  <ModalFooter>
    <HStack fullWidth gap={4}>
      <Button shape="round" color="secondary" fullWidth onclick={() => onClose()}>Cancel</Button>
      <Button shape="round" fullWidth onclick={handleSave} disabled={!groupName.trim()}>
        {group ? 'Save' : 'Create'}
      </Button>
    </HStack>
  </ModalFooter>
</Modal>
