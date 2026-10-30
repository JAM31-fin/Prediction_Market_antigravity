import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runMigrations } from '../src/server/migrate';
import { dbService } from '../src/server/dbService';
import { dbQuery } from '../src/server/db';
import { User } from '../src/types';

describe('Anti-Sybil Phone Registration, Multi-Identifier Login & Admin Master PIN Protection', () => {
  const TEST_ADMIN_PIN = 'centra-master-pin-2026';

  beforeAll(async () => {
    process.env.ADMIN_MASTER_PIN = TEST_ADMIN_PIN;
    await runMigrations();
  });

  afterAll(() => {
    delete process.env.ADMIN_MASTER_PIN;
  });

  // =========================================================================
  // 1. ANTI-SYBIL UNIQUE PHONE REGISTRATION
  // =========================================================================
  describe('1. Anti-Sybil Unique Phone Registration', () => {
    it('registers a user with a valid Peruvian phone number and normalizes it', async () => {
      const regRes = await (dbService as any).register(
        'mateo_peru',
        'PassPeru2026!',
        'Mateo Quispe',
        'mateo@amigos.pe',
        '+51 999 888 777'
      );

      expect(regRes).toBeDefined();
      expect(regRes.user).toBeDefined();
      expect(regRes.user.username).toBe('mateo_peru');
      expect(regRes.user.role).toBe('user');
      expect(regRes.user.virtualBalance).toBe(0.0);
      expect(regRes.token).toBeDefined();

      // Verify phoneNumber is normalized to standard international format (+51999888777)
      expect(regRes.user.phoneNumber).toBe('+51999888777');

      // Verify stored record in database has normalized phone
      const stored = await (dbService as any).getUserById(regRes.user.id);
      expect(stored).toBeDefined();
      expect(stored.phoneNumber).toBe('+51999888777');
    });

    it('registers a user with a valid Argentine phone number and normalizes formatting', async () => {
      const regRes = await (dbService as any).register(
        'facundo_arg',
        'PassArg2026!',
        'Facundo Rossi',
        'facundo@torneo.ar',
        '+54-9-11-2345-6789'
      );

      expect(regRes.user).toBeDefined();
      expect(regRes.user.username).toBe('facundo_arg');
      expect(regRes.user.phoneNumber).toBe('+5491123456789');
    });

    it('rejects registration when phone number is missing (undefined)', async () => {
      await expect(
        (dbService as any).register(
          'lucas_no_phone',
          'Pass12345!',
          'Lucas Sin Celular',
          'lucas@test.com',
          undefined
        )
      ).rejects.toThrow(/phone number is required|valid phone number/i);
    });

    it('rejects registration when phone number is empty string or only whitespace', async () => {
      await expect(
        (dbService as any).register(
          'ana_empty_phone',
          'Pass12345!',
          'Ana Vacio',
          'ana@test.com',
          ''
        )
      ).rejects.toThrow(/phone number is required|valid phone number/i);

      await expect(
        (dbService as any).register(
          'ana_spaces_phone',
          'Pass12345!',
          'Ana Espacios',
          'ana2@test.com',
          '     '
        )
      ).rejects.toThrow(/phone number is required|valid phone number/i);
    });

    it('rejects registration when phone number has fewer than 8 digits', async () => {
      // Too short (< 8 digits)
      await expect(
        (dbService as any).register(
          'short_phone_user',
          'Pass12345!',
          'Short Phone',
          'short@test.com',
          '+12345'
        )
      ).rejects.toThrow(/invalid phone number|at least 8 digits/i);

      await expect(
        (dbService as any).register(
          'short_phone_user_2',
          'Pass12345!',
          'Short Phone 2',
          'short2@test.com',
          '1234567'
        )
      ).rejects.toThrow(/invalid phone number|at least 8 digits/i);
    });

    it('rejects registration when phone number contains letters or invalid characters', async () => {
      await expect(
        (dbService as any).register(
          'letter_phone_user',
          'Pass12345!',
          'Letter Phone',
          'letters@test.com',
          '+51999888abc'
        )
      ).rejects.toThrow(/invalid phone number|valid international phone/i);

      await expect(
        (dbService as any).register(
          'fake_phone_user',
          'Pass12345!',
          'Fake Phone',
          'fake@test.com',
          'my-phone-number!'
        )
      ).rejects.toThrow(/invalid phone number|valid international phone/i);
    });

    it('rejects registration when phone number is already registered by another account (Anti-Sybil duplicate)', async () => {
      // Attempt to register another account using the exact same phone number as mateo_peru (+51999888777)
      await expect(
        (dbService as any).register(
          'sybil_attacker_1',
          'SybilPass2026!',
          'Sybil Clone',
          'sybil1@attacker.com',
          '+51999888777'
        )
      ).rejects.toThrow(/already registered|already in use|duplicate phone number/i);
    });

    it('rejects duplicate phone registration even if submitted with different spaces or dashes', async () => {
      // facundo_arg registered with +54-9-11-2345-6789 which normalizes to +5491123456789
      // Attempting to register with spaces "+54 9 11 2345 6789" must be caught by normalization
      await expect(
        (dbService as any).register(
          'sybil_attacker_2',
          'SybilPass2026!',
          'Sybil Clone 2',
          'sybil2@attacker.com',
          '+54 9 11 2345 6789'
        )
      ).rejects.toThrow(/already registered|already in use|duplicate phone number/i);
    });
  });

  // =========================================================================
  // 2. LOGIN WITH MULTIPLE IDENTIFIERS
  // =========================================================================
  describe('2. Login with Multiple Identifiers (Username, Email, Phone Number)', () => {
    let multiUserId: string;

    beforeAll(async () => {
      const reg = await (dbService as any).register(
        'camila_trader',
        'CamilaSecure2026!',
        'Camila Gomez',
        'camila@amigos.io',
        '+51 987 654 321'
      );
      multiUserId = reg.user.id;
    });

    it('authenticates successfully using username', async () => {
      const auth = await (dbService as any).authenticate('camila_trader', 'CamilaSecure2026!');
      expect(auth).toBeDefined();
      expect(auth.user.id).toBe(multiUserId);
      expect(auth.user.username).toBe('camila_trader');
      expect(auth.token).toBeDefined();
    });

    it('authenticates successfully using email address', async () => {
      const auth = await (dbService as any).authenticate('camila@amigos.io', 'CamilaSecure2026!');
      expect(auth).toBeDefined();
      expect(auth.user.id).toBe(multiUserId);
      expect(auth.user.email).toBe('camila@amigos.io');
      expect(auth.token).toBeDefined();
    });

    it('authenticates successfully using normalized phone number', async () => {
      const auth = await (dbService as any).authenticate('+51987654321', 'CamilaSecure2026!');
      expect(auth).toBeDefined();
      expect(auth.user.id).toBe(multiUserId);
      expect(auth.user.phoneNumber).toBe('+51987654321');
      expect(auth.token).toBeDefined();
    });

    it('authenticates successfully using formatted/spaced phone number', async () => {
      const auth = await (dbService as any).authenticate('+51 987 654 321', 'CamilaSecure2026!');
      expect(auth).toBeDefined();
      expect(auth.user.id).toBe(multiUserId);
      expect(auth.token).toBeDefined();
    });

    it('rejects authentication with non-existent phone number / identifier', async () => {
      await expect(
        (dbService as any).authenticate('+51900000000', 'CamilaSecure2026!')
      ).rejects.toThrow(/not found|invalid credentials/i);
    });

    it('rejects authentication with correct phone number but incorrect password', async () => {
      await expect(
        (dbService as any).authenticate('+51987654321', 'WrongPassword999')
      ).rejects.toThrow(/invalid credentials|verify your password/i);
    });
  });

  // =========================================================================
  // 3. ADMINISTRATOR MASTER PIN PROTECTION
  // =========================================================================
  describe('3. Administrator Master PIN Protection', () => {
    it('rejects admin31 authentication when adminPin is missing', async () => {
      await expect(
        (dbService as any).authenticate('admin31', '12345')
      ).rejects.toThrow(/admin master PIN|PIN is required/i);

      await expect(
        (dbService as any).authenticate('admin31', '12345', '')
      ).rejects.toThrow(/admin master PIN|PIN is required/i);
    });

    it('rejects admin31 authentication when adminPin is incorrect', async () => {
      await expect(
        (dbService as any).authenticate('admin31', '12345', 'wrong-pin-0000')
      ).rejects.toThrow(/invalid admin.*PIN|incorrect master PIN/i);
    });

    it('authenticates admin31 successfully when correct admin master PIN is provided', async () => {
      const auth = await (dbService as any).authenticate('admin31', '12345', TEST_ADMIN_PIN);
      expect(auth).toBeDefined();
      expect(auth.user.username).toBe('admin31');
      expect(auth.user.role).toBe('admin');
      expect(auth.token).toBeDefined();
    });

    it('allows regular trader to authenticate without providing any PIN', async () => {
      const auth = await (dbService as any).authenticate('mateo_peru', 'PassPeru2026!');
      expect(auth).toBeDefined();
      expect(auth.user.username).toBe('mateo_peru');
      expect(auth.user.role).toBe('user');
      expect(auth.token).toBeDefined();
    });
  });

  // =========================================================================
  // 4. PERMANENT BLOCK ON SELF-ELEVATION
  // =========================================================================
  describe('4. Permanent Block on Self-Elevation', () => {
    it('permanently blocks regular trader from self-elevating to admin role via switchUserRole', async () => {
      const userAccount = await (dbService as any).getUserByUsernameOrEmail('mateo_peru');
      expect(userAccount).toBeDefined();
      expect(userAccount.role).toBe('user');

      // Attempting to elevate to 'admin' must be rejected
      await expect(
        (dbService as any).switchUserRole(userAccount.id, 'admin')
      ).rejects.toThrow(/forbidden|prohibited|cannot.*admin|unauthorized/i);

      // Verify role in database was NOT altered
      const refreshed = await (dbService as any).getUserById(userAccount.id);
      expect(refreshed.role).toBe('user');
    });
  });

  // =========================================================================
  // 5. ADMIN USER AUDIT
  // =========================================================================
  describe('5. Admin User Audit (dbService.getUsers)', () => {
    it('returns all registered users with phoneNumber, virtualBalance, and createdAt', async () => {
      const users = await (dbService as any).getUsers();
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThanOrEqual(3); // admin31, mateo_peru, facundo_arg, camila_trader

      // Verify mateo_peru has all audit fields
      const mateo = users.find((u: any) => u.username === 'mateo_peru');
      expect(mateo).toBeDefined();
      expect(mateo.phoneNumber).toBe('+51999888777');
      expect(typeof mateo.virtualBalance).toBe('number');
      expect(mateo.virtualBalance).toBe(0.0);
      expect(mateo.createdAt).toBeDefined();
      expect(new Date(mateo.createdAt).getTime()).not.toBeNaN();

      // Verify every returned user record is sanitized (no password_hash exposed)
      for (const u of users) {
        expect(u.id).toBeDefined();
        expect(u.role).toBeDefined();
        expect(u.passwordHash).toBeUndefined();
        expect(u.password_hash).toBeUndefined();
      }
    });
  });
});
