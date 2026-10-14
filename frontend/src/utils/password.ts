/**
 * The password rules — the same ones the server checks (backend
 * validators/authValidators.js, strongPassword), so the checklist on screen
 * never says "done" for a password the server would refuse.
 */
export const PASSWORD_RULES: readonly { label: string; test: (password: string) => boolean }[] = [
  { label: 'At least 8 characters', test: (password) => password.length >= 8 },
  { label: 'At least 1 capital letter', test: (password) => /[A-Z]/.test(password) },
  { label: 'At least 1 number', test: (password) => /\d/.test(password) },
];

export const passwordOk = (password: string) => PASSWORD_RULES.every((rule) => rule.test(password));
