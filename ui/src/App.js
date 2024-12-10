import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Redirect } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@material-ui/core';
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import Projects from './components/Projects';
import Agents from './components/Agents';
import Metrics from './components/Metrics';
import Settings from './components/Settings';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import SystemStatus from './components/SystemStatus';
import AuthService from './services/AuthService';
import ErrorBoundary from './components/ErrorBoundary';

// Create theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(AuthService.isAuthenticated());

  useEffect(() => {
    const handleAuthChange = () => {
      setIsAuthenticated(AuthService.isAuthenticated());
    };

    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <Router>
        <ErrorBoundary>
          {isAuthenticated && <Navigation />}
          <Switch>
            <Route exact path="/login" render={(props) => (
              isAuthenticated ? <Redirect to="/" /> : <Login {...props} />
            )} />
            <ProtectedRoute exact path="/" component={Dashboard} />
            <ProtectedRoute exact path="/projects" component={Projects} />
            <ProtectedRoute exact path="/agents" component={Agents} />
            <ProtectedRoute exact path="/metrics" component={Metrics} />
            <ProtectedRoute exact path="/settings" component={Settings} />
            <Redirect to="/" />
          </Switch>
        </ErrorBoundary>
      </Router>
    </ThemeProvider>
  );
}

export default App; 