import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const otplib = require('otplib');

const totp = {
  generateSecret: (size = 20) => otplib.generateSecret(size),
  generate: (secret) => otplib.generate(secret),
  verify: (token, secret) => {
    try {
      return otplib.verify({ secret, token: token.trim() }) === true;
    } catch (e) {
      console.error(e);
      return false;
    }
  },
};

try {
  const secret = totp.generateSecret();
  console.log('Secret:', secret);
  const code = totp.generate(secret);
  console.log('Generated code:', code);
  const isValid = totp.verify(code, secret);
  console.log('Is valid:', isValid);
} catch (e) {
  console.error("CRASH:", e);
}
  console.log('Secret:', secret);
  const code = totp.generate(secret);
  console.log('Generated code:', code);
  const isValid = totp.verify(code, secret);
  console.log('Is valid:', isValid);
} catch (e) {
  console.error("CRASH:", e);
}
