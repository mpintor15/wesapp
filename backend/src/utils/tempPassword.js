const crypto = require('node:crypto');

const generateTempPassword = () => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  const buf = crypto.randomBytes(16);

  const chars = [
    upper[buf[0] % upper.length],
    lower[buf[1] % lower.length],
    digits[buf[2] % digits.length],
  ];
  for (let i = 3; i < 10; i++) {
    chars.push(all[buf[i] % all.length]);
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = buf[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

module.exports = { generateTempPassword };
