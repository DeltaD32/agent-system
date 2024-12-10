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
    console.log('AuthService: Validating credentials');
    return username === this.ADMIN_CREDENTIALS.username && 
           password === this.ADMIN_CREDENTIALS.password;
  }

  static login(username, password) {
    console.log('AuthService: Attempting login for:', username);
    
    if (this.validateCredentials(username, password)) {
      console.log('AuthService: Credentials valid, setting auth state');
      localStorage.setItem(this.TOKEN_KEY, 'admin-token');
      localStorage.setItem(this.IS_AUTHENTICATED, 'true');
      window.dispatchEvent(new Event('auth-change'));
      console.log('AuthService: Login successful');
      return true;
    } else {
      console.log('AuthService: Invalid credentials');
      throw new Error('Invalid username or password');
    }
  }

  static logout() {
    console.log('AuthService: Logging out');
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.IS_AUTHENTICATED);
    window.dispatchEvent(new Event('auth-change'));
    console.log('AuthService: Logout complete');
  }

  static getToken() {
    const token = localStorage.getItem(this.TOKEN_KEY);
    console.log('AuthService: Getting token:', token ? 'Token exists' : 'No token');
    return token;
  }

  static isAuthenticated() {
    const isAuth = localStorage.getItem(this.IS_AUTHENTICATED) === 'true';
    console.log('AuthService: Checking auth state:', isAuth);
    return isAuth;
  }

  // Helper method to clear all auth state (for debugging)
  static clearAuth() {
    console.log('AuthService: Clearing all auth state');
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.IS_AUTHENTICATED);
    console.log('AuthService: Auth state cleared');
  }
}

// Clear any stale auth state on service initialization
AuthService.clearAuth();

export default AuthService; 