// Authentication & Session Management Module
window.Auth = {
  TOKEN_KEY: 'tpb_access_token',
  USER_KEY: 'tpb_user_data',

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  getUser() {
    try {
      const data = localStorage.getItem(this.USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  isLoggedIn() {
    return !!this.getToken() && !!this.getUser();
  },

  isAdmin() {
    const user = this.getUser();
    return user && (user.role === 'admin' || user.role === 'super_admin');
  },

  isSuperAdmin() {
    const user = this.getUser();
    return user && user.role === 'super_admin';
  },

  async login(nim, password) {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nim: nim.trim(), password: password.trim() })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Login gagal.');
    }

    const data = await response.json();
    localStorage.setItem(this.TOKEN_KEY, data.access_token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(data.user));
    return data;
  },

  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    window.location.href = '/login';
  },

  async authFetch(url, options = {}) {
    const token = this.getToken();
    const headers = options.headers || {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    options.headers = headers;

    const response = await fetch(url, options);
    if (response.status === 401) {
      this.logout();
      throw new Error('Sesi berakhir. Silakan login kembali.');
    }
    return response;
  }
};
