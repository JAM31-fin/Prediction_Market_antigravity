import { describe, it, expect, beforeAll } from 'vitest';
import { runMigrations } from '../src/server/migrate';
import { dbService } from '../src/server/dbService';

describe('User Authentication & Role System (Username-based)', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  it('verifies canonical admin31 exists with role admin and password 12345', async () => {
    const auth = await dbService.authenticate('admin31', '12345');
    expect(auth.user).toBeDefined();
    expect(auth.user.username).toBe('admin31');
    expect(auth.user.role).toBe('admin');
    expect(auth.token).toBeDefined();
    expect(auth.user.virtualBalance).toBe(25000.0);
  });

  it('rejects authentication with incorrect password for admin31', async () => {
    await expect(dbService.authenticate('admin31', 'wrong_password')).rejects.toThrow(
      'Invalid credentials. Please verify your password.'
    );
  });

  it('allows registering a new user with only username and password (no email required)', async () => {
    const regRes = await dbService.register('trader_carlos', 'Carlos2026!');
    expect(regRes.user).toBeDefined();
    expect(regRes.user.username).toBe('trader_carlos');
    expect(regRes.user.role).toBe('user');
    expect(regRes.user.virtualBalance).toBe(0.0);
    expect(regRes.token).toBeDefined();

    // Verify session authentication works with the newly created username
    const loginRes = await dbService.authenticate('trader_carlos', 'Carlos2026!');
    expect(loginRes.user.id).toBe(regRes.user.id);
  });

  it('rejects registration with duplicate username (case-insensitive)', async () => {
    // trader_carlos already registered, try registering TRADER_CARLOS
    await expect(dbService.register('TRADER_CARLOS', 'DifferentPass123')).rejects.toThrow(
      'already exists'
    );
  });

  it('rejects registration with invalid username (too short or special characters)', async () => {
    await expect(dbService.register('ab', 'Secret123!')).rejects.toThrow(
      'Username must be at least 3 characters long.'
    );

    await expect(dbService.register('invalid username with spaces', 'Secret123!')).rejects.toThrow(
      'Username can only contain letters, numbers, underscores, dashes, and periods.'
    );
  });

  it('verifies deprecated demo accounts are purged from database', async () => {
    const oldAdmin = await dbService.getUserByUsernameOrEmail('admin@demo.com');
    const oldUser = await dbService.getUserByUsernameOrEmail('user@demo.com');

    expect(oldAdmin).toBeNull();
    expect(oldUser).toBeNull();
  });

  it('guarantees username is never swapped with password when name parameter is provided', async () => {
    const regRes = await dbService.register('juan_trader', 'MySuperSecret99', 'Juan Gomez');
    expect(regRes.user.username).toBe('juan_trader');
    expect(regRes.user.username).not.toBe('MySuperSecret99');
    expect(regRes.user.name).toBe('Juan Gomez');

    // Authenticating with the username and password must succeed
    const loginRes = await dbService.authenticate('juan_trader', 'MySuperSecret99');
    expect(loginRes.user.username).toBe('juan_trader');

    // Attempting to use the password as the username must fail
    await expect(dbService.authenticate('MySuperSecret99', 'Juan Gomez')).rejects.toThrow();
  });
});
