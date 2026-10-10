export function passwordStrength(password: string) {
  const variety = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter(
    (pattern) => pattern.test(password),
  ).length;
  const common =
    /^(password|qwerty|letmein|welcome|123456|abcdef)/i.test(password) ||
    /^(.)\1+$/.test(password);
  return password.length < 8 || common
    ? 1
    : password.length >= 12 && variety >= 3
      ? 3
      : 2;
}
