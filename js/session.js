// ===============================
// SESSION MANAGER — browser-compatible
// Uses sessionStorage for session (auto-expires on tab close)
// Uses localStorage only for "remember username" feature
// ===============================

const SESSION_KEY = 'pos-session';
const REMEMBER_KEY = 'pos-remembered-user';
const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes

/**
 * Save the current session to sessionStorage.
 */
function saveSession(user, role, userData = {}) {
  try {
    const session = {
      user,
      role,
      userData: {
        id: userData.id,
        fullName: userData.fullName || '',
        email: userData.email || '',
        contactNumber: userData.contactNumber || '',
        lastLogin: userData.lastLogin || null
      },
      createdAt: Date.now()
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return true;
  } catch (e) {
    console.warn('[Session] Failed to save session:', e);
    return false;
  }
}

/**
 * Restore a session from sessionStorage.
 * Returns the session object if valid and not expired, otherwise null.
 */
function restoreSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const session = JSON.parse(raw);
    if (!session.user || !session.role) return null;

    // Check expiration
    const age = Date.now() - (session.createdAt || 0);
    if (age > SESSION_DURATION) {
      clearSession();
      return null;
    }

    // Reset the creation timestamp on restore (renew session for another 30 min)
    session.createdAt = Date.now();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

    return session;
  } catch (e) {
    console.warn('[Session] Failed to restore session:', e);
    return null;
  }
}

/**
 * Clear the session from sessionStorage.
 */
function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (e) {
    console.warn('[Session] Failed to clear session:', e);
  }
}

/**
 * Save remembered username to localStorage.
 */
function saveRememberedUser(username) {
  try {
    if (username) {
      localStorage.setItem(REMEMBER_KEY, username);
    } else {
      localStorage.removeItem(REMEMBER_KEY);
    }
  } catch (e) {
    console.warn('[Session] Failed to save remembered user:', e);
  }
}

/**
 * Get the remembered username from localStorage.
 */
function getRememberedUser() {
  try {
    return localStorage.getItem(REMEMBER_KEY) || '';
  } catch (e) {
    return '';
  }
}

/**
 * Clear the remembered username.
 */
function clearRememberedUser() {
  try {
    localStorage.removeItem(REMEMBER_KEY);
  } catch (e) {
    console.warn('[Session] Failed to clear remembered user:', e);
  }
}

/**
 * Get the correct page URL for a given role.
 */
function getPageForRole(role) {
  if (role === 'Administrator') return 'admin.html';
  if (role === 'Cashier') return 'cashier.html';
  return 'index.html';
}

/**
 * Redirect to the correct page for the given role.
 */
function redirectByRole(role) {
  window.location.href = getPageForRole(role);
}

/**
 * Redirect to the index page (for guests / logout).
 */
function redirectToIndex() {
  window.location.href = 'index.html';
}

/**
 * Validate that the current page matches the user's role.
 * Redirects to the correct page if mismatch.
 * Returns true if page is correct, false if redirected.
 */
function validatePageAccess(session) {
  if (!session) {
    redirectToIndex();
    return false;
  }

  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const expectedPage = getPageForRole(session.role);

  if (currentPage !== expectedPage) {
    window.location.href = expectedPage;
    return false;
  }
  return true;
}

/**
 * Check if the user's role allows access to the admin page.
 */
function isAdmin(role) {
  return role === 'Administrator';
}

/**
 * Check if the user's role allows access to the cashier page.
 */
function isCashier(role) {
  return role === 'Cashier';
}

/**
 * Check if the user's role can access the cashier page.
 * Admins are allowed by default (configurable).
 */
function canAccessCashierPage(role) {
  return role === 'Cashier' || role === 'Administrator';
}

export default {
  saveSession,
  restoreSession,
  clearSession,
  saveRememberedUser,
  getRememberedUser,
  clearRememberedUser,
  redirectByRole,
  getPageForRole,
  redirectToIndex,
  validatePageAccess,
  isAdmin,
  isCashier,
  canAccessCashierPage,
  SESSION_DURATION
};
