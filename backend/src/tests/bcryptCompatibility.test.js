const bcrypt = require('bcrypt');

describe('bcrypt compatibility', () => {
  test('hashes and verifies passwords with bcrypt 6', async () => {
    const hash = await bcrypt.hash('correct-password', 4);

    await expect(bcrypt.compare('correct-password', hash)).resolves.toBe(true);
    await expect(bcrypt.compare('wrong-password', hash)).resolves.toBe(false);
  });

  test('verifies an existing stored bcrypt hash fixture', async () => {
    const storedHash = '$2b$04$oJw7Dv4lP6V1VhmZm2OA0unPSweG2b2/bsl1ef6icwDoGezhsaUVa';

    await expect(bcrypt.compare('legacy-password-1', storedHash)).resolves.toBe(true);
    await expect(bcrypt.compare('wrong-password', storedHash)).resolves.toBe(false);
  });
});
