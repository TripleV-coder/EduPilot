/**
 * Root user access control utilities
 */

const ROOT_EMAILS = (process.env.ROOT_USER_EMAILS || "").split(",").map(e => e.trim()).filter(Boolean);

/**
 * Check if an email belongs to a root user
 */
export function isRootUserEmail(email: string): boolean {
    if (ROOT_EMAILS.length === 0) return false;
    return ROOT_EMAILS.includes(email);
}

/**
 * Validate the current session has root access
 * Returns true if the user has SUPER_ADMIN role
 */
export function hasValidRootSession(session: any): boolean {
    if (!session?.user) return false;
    if (session.user.role !== "SUPER_ADMIN") return false;
    if (ROOT_EMAILS.length > 0 && !isRootUserEmail(session.user.email)) return false;
    return true;
}
