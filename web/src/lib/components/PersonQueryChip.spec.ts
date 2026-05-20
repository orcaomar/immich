import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { sdkMock } from '$lib/__mocks__/sdk.mock';
import { modalManager } from '@immich/ui';
import PersonQueryChip from './PersonQueryChip.svelte';
import ViewGroupMembersModal from '$lib/modals/ViewGroupMembersModal.svelte';

describe('PersonQueryChip component', () => {
  const onRemove = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders include chip type correctly with originalQuery', () => {
    render(PersonQueryChip, {
      props: {
        type: 'include',
        label: 'Person A, Person B, Person C',
        originalQuery: 'family group',
        onRemove,
      },
    });

    // Check AI Filter prefix
    expect(screen.getByText('AI Filter')).toBeInTheDocument();

    // Check display text is original query initially
    expect(screen.getByText('family group')).toBeInTheDocument();
    expect(screen.queryByText('Person A, Person B, Person C')).not.toBeInTheDocument();
  });

  it('renders exclude chip type correctly with label when no originalQuery is provided', () => {
    render(PersonQueryChip, {
      props: {
        type: 'exclude',
        label: 'Person A, Person B',
        onRemove,
      },
    });

    // Check AI Exclude prefix
    expect(screen.getByText('AI Exclude')).toBeInTheDocument();

    // Check display text is the label
    expect(screen.getByText('Person A, Person B')).toBeInTheDocument();
  });

  it('toggles between originalQuery and label when expand/collapse button is clicked', async () => {
    render(PersonQueryChip, {
      props: {
        type: 'include',
        label: 'Person A, Person B, Person C',
        originalQuery: 'family group',
        onRemove,
      },
    });

    expect(screen.getByText('family group')).toBeInTheDocument();
    expect(screen.queryByText('Person A, Person B, Person C')).not.toBeInTheDocument();

    // Expand
    const expandBtn = screen.getByLabelText('Expand');
    await fireEvent.click(expandBtn);

    expect(screen.queryByText('family group')).not.toBeInTheDocument();
    expect(screen.getByText('Person A, Person B, Person C')).toBeInTheDocument();

    // Collapse
    const collapseBtn = screen.getByLabelText('Collapse');
    await fireEvent.click(collapseBtn);

    expect(screen.getByText('family group')).toBeInTheDocument();
    expect(screen.queryByText('Person A, Person B, Person C')).not.toBeInTheDocument();
  });

  it('calls onRemove when the remove button is clicked', async () => {
    render(PersonQueryChip, {
      props: {
        type: 'include',
        label: 'Person A',
        onRemove,
      },
    });

    const removeBtn = screen.getByLabelText('remove_filter');
    await fireEvent.click(removeBtn);

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('fetches members and opens ViewGroupMembersModal on group name click', async () => {
    const personIds = ['id-1', 'id-2'];
    const mockPerson1 = { id: 'id-1', name: 'John Doe', thumbnailPath: 'path1' };
    const mockPerson2 = { id: 'id-2', name: 'Jane Smith', thumbnailPath: 'path2' };

    let resolvePerson1: any;
    let resolvePerson2: any;
    const promise1 = new Promise((resolve) => {
      resolvePerson1 = resolve;
    });
    const promise2 = new Promise((resolve) => {
      resolvePerson2 = resolve;
    });

    sdkMock.getPerson.mockImplementation(async ({ id }) => {
      if (id === 'id-1') return promise1 as any;
      if (id === 'id-2') return promise2 as any;
      throw new Error('Not found');
    });

    const spyShow = vi.spyOn(modalManager, 'show');

    render(PersonQueryChip, {
      props: {
        type: 'include',
        label: 'John Doe, Jane Smith',
        originalQuery: 'my friends',
        personIds,
        onRemove,
      },
    });

    const groupBtn = screen.getByRole('button', { name: /my friends/i });
    await fireEvent.click(groupBtn);

    // Should show loading text because getPerson is pending!
    expect(await screen.findByText('(loading...)')).toBeInTheDocument();

    // Resolve the promises
    resolvePerson1(mockPerson1);
    resolvePerson2(mockPerson2);

    await waitFor(() => {
      expect(sdkMock.getPerson).toHaveBeenCalledWith({ id: 'id-1' });
      expect(sdkMock.getPerson).toHaveBeenCalledWith({ id: 'id-2' });
      expect(spyShow).toHaveBeenCalledWith(ViewGroupMembersModal, {
        groupName: 'my friends',
        members: [mockPerson1, mockPerson2],
      });
    });

    // Loading indicator should disappear
    expect(screen.queryByText('(loading...)')).not.toBeInTheDocument();
  });
});
