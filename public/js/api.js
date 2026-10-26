/**
 * API CLIENT & AUTH UTILITIES
 */

// Toast notification manager
window.showToast = function (message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span style="font-size:1.15rem;font-weight:bold;">${icons[type] || '•'}</span>
    <span style="flex:1;">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(15px) scale(0.95)';
    setTimeout(() => toast.remove(), 250);
  }, duration);
};

const api = {
  TOKEN_KEY: 'student_portal_token',
  USER_KEY: 'student_portal_user',

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  setToken(token) {
    localStorage.setItem(this.TOKEN_KEY, token);
  },

  getUser() {
    try {
      const u = localStorage.getItem(this.USER_KEY);
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  },

  setUser(user) {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  },

  clearAuth() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  },

  logout(redirectUrl = '/') {
    this.clearAuth();
    window.location.href = redirectUrl;
  },

  // Role guardian for dashboard pages
  requireRole(expectedRole, redirectOnFail) {
    const token = this.getToken();
    const user = this.getUser();

    if (!token || !user) {
      window.location.href = redirectOnFail;
      return false;
    }

    if (user.role !== expectedRole) {
      window.showToast(`Access Denied: Only ${expectedRole} accounts allowed here.`, 'error');
      setTimeout(() => {
        window.location.href = redirectOnFail;
      }, 1200);
      return false;
    }

    return true;
  },

  // Centralized request wrapper
  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = { ...options.headers };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers
      });

      if (response.status === 401) {
        this.clearAuth();
        const path = window.location.pathname;
        if (!path.includes('login') && path !== '/') {
          window.location.href = '/';
        }
      }

      // Check if response is blob/download
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/vnd.openxmlformats') || contentType.includes('text/csv')) {
        return response;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Request failed with status ' + response.status);
      }
      return data;
    } catch (err) {
      console.error('API Error:', err);
      throw err;
    }
  }
};

window.api = api;
