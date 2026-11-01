import { describe, it, expect, beforeAll } from 'vitest';
import { runMigrations } from '../src/server/migrate';
import { dbService } from '../src/server/dbService';

describe('Phone Authentication & Terms / Beta Disclaimer Verification', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  describe('1. Phone Registration & Login Logic', () => {
    const testPhone = '+51988112233';

    it('successfully registers a brand-new participant using phone number only', async () => {
      const res = await dbService.authenticateOrRegisterByPhone(testPhone);

      expect(res).toBeDefined();
      expect(res.user).toBeDefined();
      expect(res.token).toBeDefined();
      expect(res.isNew).toBe(true);
      expect(res.user.phoneNumber).toBe(testPhone);
      expect(res.user.role).toBe('user');
      expect(res.user.virtualBalance).toBe(0.0);
      expect(res.user.username).toMatch(/^trader_\d+/);
      expect(res.user.name).toMatch(/^Trader \d+/);
    });

    it('successfully registers with custom username, phone number and alias without any PIN', async () => {
      const res = await dbService.authenticateOrRegisterByPhone(
        '+51933445566',
        'carlos_inversionista',
        'Carlos I.'
      );

      expect(res).toBeDefined();
      expect(res.user).toBeDefined();
      expect(res.token).toBeDefined();
      expect(res.isNew).toBe(true);
      expect(res.user.username).toBe('carlos_inversionista');
      expect(res.user.name).toBe('Carlos I.');
      expect(res.user.phoneNumber).toBe('+51933445566');
    });

    it('logs in the existing user directly when the same username or phone number is submitted again', async () => {
      const secondCall = await dbService.authenticateOrRegisterByPhone(
        '+51933445566',
        'carlos_inversionista'
      );

      expect(secondCall).toBeDefined();
      expect(secondCall.isNew).toBe(false);
      expect(secondCall.user.username).toBe('carlos_inversionista');
      expect(secondCall.user.name).toBe('Carlos I.');
      expect(secondCall.token).toBeDefined();
    });

    it('rejects invalid or incomplete phone numbers (< 8 or > 16 digits)', async () => {
      await expect(
        dbService.authenticateOrRegisterByPhone('1234')
      ).rejects.toThrow(/inválido|digits/i);

      await expect(
        dbService.authenticateOrRegisterByPhone('+51999')
      ).rejects.toThrow(/inválido|digits/i);
    });

    it('handles 9-digit Peruvian numbers provided with or without country code', async () => {
      const res = await dbService.authenticateOrRegisterByPhone('977665544');
      expect(res.user).toBeDefined();
      expect(res.user.phoneNumber).toBe('977665544');
    });
  });

  describe('2. Anti-Sybil Uniqueness and No Institutional Email Requirement', () => {
    it('creates accounts without requiring personal or UP institutional email addresses (@up.edu.pe)', async () => {
      const res = await dbService.authenticateOrRegisterByPhone('+51955443322');
      expect(res.user.email).not.toContain('@up.edu.pe');
      expect(res.user.email).toContain('@centra.internal');
    });
  });
});
