import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runMigrations } from '../src/server/migrate';
import { dbService } from '../src/server/dbService';

describe('Auth Modes Distinction: Log In vs Sign In', () => {
  const TEST_ADMIN_PIN = 'centra-master-pin-2026';

  beforeAll(async () => {
    process.env.ADMIN_MASTER_PIN = TEST_ADMIN_PIN;
    await runMigrations();
  });

  afterAll(() => {
    delete process.env.ADMIN_MASTER_PIN;
  });

  describe('1. Log In (Iniciar Sesión) - Solo requiere Nombre de Usuario y Contraseña', () => {
    it('authenticates canonical operator account using only username and password + PIN', async () => {
      // First attempt without PIN throws PIN challenge
      await expect(
        dbService.authenticate('admin31', '12345')
      ).rejects.toThrow(/master PIN is required/i);

      // Second attempt with PIN succeeds
      const authRes = await dbService.authenticate('admin31', '12345', TEST_ADMIN_PIN);
      expect(authRes).toBeDefined();
      expect(authRes.user).toBeDefined();
      expect(authRes.user.username).toBe('admin31');
      expect(authRes.user.role).toBe('admin');
      expect(authRes.token).toBeDefined();
    });

    it('authenticates a standard trader using strictly username and password without any phone number', async () => {
      // Create user first via canonical registration
      const phone = '+51987111222';
      const reg = await dbService.register('trader_login_test', 'PassLogin123!', 'Trader Login', undefined, phone);
      expect(reg.user.username).toBe('trader_login_test');

      // Now authenticate via Log In passing ONLY username and password
      const loginRes = await dbService.authenticate('trader_login_test', 'PassLogin123!');
      expect(loginRes).toBeDefined();
      expect(loginRes.user).toBeDefined();
      expect(loginRes.user.username).toBe('trader_login_test');
      expect(loginRes.user.role).toBe('user');
      expect(loginRes.token).toBeDefined();
    });

    it('rejects Log In when incorrect password is provided', async () => {
      await expect(
        dbService.authenticate('trader_login_test', 'WrongPass!')
      ).rejects.toThrow(/invalid credentials|verify your password/i);
    });

    it('rejects Log In when username does not exist', async () => {
      await expect(
        dbService.authenticate('non_existent_user_999', 'AnyPass123!')
      ).rejects.toThrow(/not found|verify your credentials/i);
    });
  });

  describe('2. Sign In (Registrarse) - Requiere Nombre de Usuario, Contraseña y Número de Celular', () => {
    it('successfully registers when username, password and phone number are all provided', async () => {
      const regRes = await dbService.register(
        'nuevo_participante',
        'SecurePassword2026!',
        'Nuevo P.',
        undefined,
        '+51 988 777 666'
      );

      expect(regRes).toBeDefined();
      expect(regRes.user.username).toBe('nuevo_participante');
      expect(regRes.user.name).toBe('Nuevo P.');
      expect(regRes.user.phoneNumber).toBe('+51988777666');
      expect(regRes.user.virtualBalance).toBe(0.0);
      expect(regRes.token).toBeDefined();

      // Verify the newly registered user can now Log In using ONLY username and password
      const subsequentLogin = await dbService.authenticate('nuevo_participante', 'SecurePassword2026!');
      expect(subsequentLogin.user.username).toBe('nuevo_participante');
      expect(subsequentLogin.token).toBeDefined();
    });

    it('rejects Sign In when phone number is missing', async () => {
      await expect(
        dbService.register('usuario_sin_celular', 'Pass12345!', 'Sin Celular', undefined, undefined)
      ).rejects.toThrow(/phone number is required|valid phone number/i);
    });

    it('rejects Sign In when phone number is duplicated (Anti-Sybil enforcement)', async () => {
      await expect(
        dbService.register('otro_usuario', 'Pass12345!', 'Otro', undefined, '+51 988 777 666')
      ).rejects.toThrow(/ya está registrado|already registered/i);
    });
  });
});
