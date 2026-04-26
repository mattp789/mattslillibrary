import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import AdminScreen from './AdminScreen.jsx';

vi.mock('../api.js', () => ({
  adminListUsers: vi.fn(),
  adminCreateUser: vi.fn(),
  adminDeleteUser: vi.fn(),
  adminResetPassword: vi.fn(),
  adminListBooks: vi.fn(),
  adminDeleteBook: vi.fn(),
  adminShareBook: vi.fn(),
  adminUnshareBook: vi.fn(),
  uploadBook: vi.fn(),
}));

import * as api from '../api.js';

const USERS = [
  { id: 'u1', username: 'alice', email: 'alice@x.com', role: 'user', createdAt: '2026-01-01' },
];

describe('AdminScreen — Users tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.adminListUsers.mockResolvedValue(USERS);
    api.adminListBooks.mockResolvedValue([]);
  });

  test('renders Users tab by default and lists users', async () => {
    render(<AdminScreen onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('alice')).toBeTruthy();
    });
  });

  test('shows Add User form when button clicked', async () => {
    render(<AdminScreen onBack={() => {}} />);
    await waitFor(() => screen.getByText('alice'));
    fireEvent.click(screen.getByText('Add User'));
    expect(screen.getByLabelText(/username/i)).toBeTruthy();
  });

  test('calls adminCreateUser and refreshes list', async () => {
    api.adminCreateUser.mockResolvedValueOnce(
      { id: 'u2', username: 'bob', email: 'bob@x.com', role: 'user', createdAt: '2026-01-02' }
    );
    api.adminListUsers.mockResolvedValueOnce(USERS).mockResolvedValueOnce([...USERS,
      { id: 'u2', username: 'bob', email: 'bob@x.com', role: 'user', createdAt: '2026-01-02' },
    ]);
    render(<AdminScreen onBack={() => {}} />);
    await waitFor(() => screen.getByText('alice'));
    fireEvent.click(screen.getByText('Add User'));
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'bob' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'bob@x.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pw123' } });
    fireEvent.click(screen.getByText('Create'));
    await waitFor(() => {
      expect(api.adminCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'bob', email: 'bob@x.com' })
      );
    });
  });
});
