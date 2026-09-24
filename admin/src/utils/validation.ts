// Client-side checks are for quick feedback only — the backend validates
// everything again and is the one that actually decides.

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mirrors strongPassword() in backend/src/validators/authValidators.js.
export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (password: string) => password.length >= 8 },
  { id: 'upper', label: 'An uppercase letter', test: (password: string) => /[A-Z]/.test(password) },
  { id: 'number', label: 'A number', test: (password: string) => /\d/.test(password) },
];

export function isStrongPassword(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

// No look-alike characters (0/O, 1/l/I), since these get read out or typed
// by hand when shared with a new admin.
const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export function generateTemporaryPassword(): string {
  let password: string;
  do {
    const bytes = crypto.getRandomValues(new Uint8Array(14));
    password = Array.from(bytes, (byte) => TEMP_PASSWORD_ALPHABET[byte % TEMP_PASSWORD_ALPHABET.length]).join('');
  } while (!isStrongPassword(password));
  return password;
}
