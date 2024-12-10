import React, { useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  makeStyles,
  CircularProgress,
  Snackbar,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import AuthService from '../services/AuthService';

const useStyles = makeStyles((theme) => ({
  container: {
    marginTop: theme.spacing(8),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  paper: {
    padding: theme.spacing(4),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    maxWidth: '400px',
  },
  form: {
    width: '100%',
    marginTop: theme.spacing(1),
  },
  submit: {
    margin: theme.spacing(3, 0, 2),
    height: 48,
  },
  buttonProgress: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -12,
    marginLeft: -12,
  },
  wrapper: {
    position: 'relative',
  },
  hint: {
    marginTop: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
}));

function Login() {
  const classes = useStyles();
  const history = useHistory();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  console.log('Login component rendered', { location });

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Login attempt', { username });
    setLoading(true);
    setError('');

    try {
      await AuthService.login(username, password);
      const { from } = location.state || { from: { pathname: '/' } };
      console.log('Login successful, redirecting to:', from);
      history.push(from);
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <div className={classes.container}>
        <Paper className={classes.paper} elevation={3}>
          <Typography component="h1" variant="h5" gutterBottom>
            Sign in to Agent System
          </Typography>
          <Typography variant="body2" color="textSecondary" align="center" gutterBottom>
            Please enter your credentials
          </Typography>
          <form className={classes.form} onSubmit={handleSubmit} noValidate>
            <TextField
              variant="outlined"
              margin="normal"
              required
              fullWidth
              id="username"
              label="Username"
              name="username"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              error={!!error}
            />
            <TextField
              variant="outlined"
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type="password"
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              error={!!error}
            />
            <div className={classes.wrapper}>
              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="primary"
                className={classes.submit}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : 'Sign In'}
              </Button>
            </div>
          </form>
          <Typography variant="body2" className={classes.hint}>
            Default admin credentials:<br />
            Username: admin<br />
            Password: adminadmin
          </Typography>
        </Paper>
      </div>
      <Snackbar 
        open={!!error} 
        autoHideDuration={6000} 
        onClose={() => setError('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setError('')} severity="error">
          {error}
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default Login; 