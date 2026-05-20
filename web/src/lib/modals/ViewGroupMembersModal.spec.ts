import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { type PersonResponseDto } from '@immich/sdk';
import { goto } from '$app/navigation';
import ViewGroupMembersModal from './ViewGroupMembersModal.svelte';

vi.mock('$app/navigation', () => ({
  goto: vi.fn(),
}));

describe('ViewGroupMembersModal component', () => {
  const members: PersonResponseDto[] = [
    { id: 'person-1', name: 'John Doe', thumbnailPath: 'path/to/thumb1', isHidden: false },
    { id: 'person-2', name: 'Jane Smith', thumbnailPath: 'path/to/thumb2', isHidden: false },
    { id: 'person-3', name: '', thumbnailPath: 'path/to/thumb3', isHidden: false },
  ];

  const onClose = vi.fn();

  it('renders modal with correct group name, member names and count', () => {
    render(ViewGroupMembersModal, {
      props: {
        groupName: 'Test Family Group',
        members,
        onClose,
      },
    });

    expect(screen.getByText('Test Family Group')).toBeInTheDocument();
    expect(screen.getByText('3 members')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('no_name')).toBeInTheDocument();
  });

  it('calls onClose and goto when a member is clicked', async () => {
    vi.clearAllMocks();

    render(ViewGroupMembersModal, {
      props: {
        groupName: 'Test Family Group',
        members,
        onClose,
      },
    });

    const johnButton = screen.getByText('John Doe').closest('button');
    expect(johnButton).not.toBeNull();

    await fireEvent.click(johnButton!);

    expect(onClose).toHaveBeenCalled();
    expect(goto).toHaveBeenCalledWith('/people/person-1?previousRoute=%2Fpeople');
  });
});
