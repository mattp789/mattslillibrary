import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import LoginScreen from './LoginScreen.jsx';

vi.mock('../api.js', () => ({ login: vi.fn() }));
vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ login: vi.fn() }),
}));

import * as api from '../api.js';

describe('LoginScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  test('renders email and password fields', () => {
    render(<LoginScreen />);
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByLabelText(/password/i)).toBeTruthy();
  });

  test('shows error message on failed login', async () => {
    api.login.mockRejectedValueOnce(new Error('bad'));
    render(<LoginScreen />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } });
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeTruthy();
    });
  });
});
