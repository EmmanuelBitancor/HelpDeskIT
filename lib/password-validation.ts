export const PASSWORD_REQUIREMENTS = {
  minLength: 6,
  uppercase: /[A-Z]/,
  number: /\d/,
  symbol: /[^A-Za-z0-9]/,
} as const;

export function getPasswordRequirementStatus(password: string) {
  return {
    minLength: password.length >= PASSWORD_REQUIREMENTS.minLength,
    uppercase: PASSWORD_REQUIREMENTS.uppercase.test(password),
    number: PASSWORD_REQUIREMENTS.number.test(password),
    symbol: PASSWORD_REQUIREMENTS.symbol.test(password),
  };
}

export function isStrongPassword(password: string) {
  const status = getPasswordRequirementStatus(password);
  return Object.values(status).every(Boolean);
}
