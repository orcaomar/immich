<script lang="ts">
  import { Icon } from '@immich/ui';
  import { mdiClose, mdiChevronDown, mdiChevronUp } from '@mdi/js';
  import { t } from 'svelte-i18n';

  type Props = {
    type: 'include' | 'exclude';
    label: string;
    originalQuery?: string;
    onRemove: () => void;
  };

  const { type, label, originalQuery, onRemove }: Props = $props();

  let isExpanded = $state(false);

  // If there's an original query, use it as the collapsed label; otherwise use the expanded label
  const displayText = $derived(
    originalQuery && !isExpanded ? originalQuery : label
  );
</script>

<div
  class="inline-flex max-w-full items-center rounded-full py-1 ps-1 pe-1 text-xs ring-1 transition-shadow
  {type === 'include'
    ? 'bg-primary/10 text-primary ring-primary/15 hover:ring-primary/25 dark:bg-immich-dark-primary/15 dark:text-immich-dark-primary dark:ring-immich-dark-primary/20 dark:hover:ring-immich-dark-primary/30'
    : 'bg-rose-500/10 text-rose-600 ring-rose-500/15 hover:ring-rose-500/25 dark:bg-rose-500/15 dark:text-rose-400 dark:ring-rose-500/20 dark:hover:ring-rose-500/30'}"
>
  <span
    class="shrink-0 rounded-full px-3 py-1.5 font-medium text-light
    {type === 'include'
      ? 'bg-primary dark:bg-immich-dark-primary dark:text-immich-dark-gray'
      : 'bg-rose-500 dark:bg-rose-500 dark:text-light'}"
  >
    {type === 'include' ? 'AI Filter' : 'AI Exclude'}
  </span>

  <span class="max-w-[min(36rem,55vw)] min-w-0 truncate px-3 py-1.5 text-immich-fg dark:text-immich-dark-fg font-medium">
    {displayText}
  </span>

  {#if originalQuery}
    <button
      type="button"
      class="flex size-7 shrink-0 items-center justify-center rounded-full outline-offset-2 transition-colors focus-visible:outline-2
      {type === 'include'
        ? 'text-primary outline-immich-primary hover:bg-primary/15 dark:text-immich-dark-primary dark:outline-immich-dark-primary dark:hover:bg-immich-dark-primary/20'
        : 'text-rose-600 outline-rose-500 hover:bg-rose-500/15 dark:text-rose-400 dark:outline-rose-500 dark:hover:bg-rose-500/20'}"
      aria-label={isExpanded ? 'Collapse' : 'Expand'}
      title={isExpanded ? 'Collapse' : 'Expand'}
      onclick={() => (isExpanded = !isExpanded)}
    >
      <Icon icon={isExpanded ? mdiChevronUp : mdiChevronDown} size="16" />
    </button>
  {/if}

  <button
    type="button"
    class="ms-0.5 flex size-7 shrink-0 items-center justify-center rounded-full outline-offset-2 transition-colors focus-visible:outline-2
    {type === 'include'
      ? 'text-primary outline-immich-primary hover:bg-primary/15 dark:text-immich-dark-primary dark:outline-immich-dark-primary dark:hover:bg-immich-dark-primary/20'
      : 'text-rose-600 outline-rose-500 hover:bg-rose-500/15 dark:text-rose-400 dark:outline-rose-500 dark:hover:bg-rose-500/20'}"
    aria-label={$t('remove_filter')}
    title={$t('remove_filter')}
    onclick={onRemove}
  >
    <Icon icon={mdiClose} size="14" />
  </button>
</div>
