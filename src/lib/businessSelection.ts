const key = (userId: string) => `revbaze-active-business:${userId}`;
export function savedBusiness(userId?: string): string {
  if (!userId) return "";
  try {
    return localStorage.getItem(key(userId)) || "";
  } catch {
    return "";
  }
}
export function rememberBusiness(userId: string, businessId: string) {
  if (!userId || !businessId) return;
  try {
    localStorage.setItem(key(userId), businessId);
  } catch {
    /* Workspace switching still works when browser storage is unavailable. */
  }
}
