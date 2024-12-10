import jwtDecode from 'jwt-decode';

class AuthService {
  static TOKEN_KEY = 'auth_token';
  static IS_AUTHENTICATED = 'is_authenticated';
  
  // Predefined admin credentials
  static ADMIN_CREDENTIALS = {
    username: 'admin',
    password: 'adminadmin'
  };

  static validateCredentials(username, password) {
    return username === this.ADMIN_CREDENTIALS.username && 
           password === this.ADMIN_CREDENTIALS.password;
  }

  static login(username, password) {
    if (this.validateCredentials(username, password)) {
      localStorage.setItem(this.TOKEN_KEY, 'admin-token');
      localStorage.setItem(this.IS_AUTHENTICATED, 'true');
      window.dispatchEvent(new Event('auth-change'));
      return true;
    }
    throw new Error('Invalid username or password');
  }

  static logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.IS_AUTHENTICATED);
    window.dispatchEvent(new Event('auth-change'));
    window.location.href = '/login';
  }

  static getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static isAuthenticated() {
    return localStorage.getItem(this.IS_AUTHENTICATED) === 'true';
  }

  static clearAuth() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.IS_AUTHENTICATED);
  }
}

export default AuthService; 