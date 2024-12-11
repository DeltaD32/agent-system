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
  Box,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import AuthService from '../services/AuthService';

const useStyles = makeStyles((theme) => ({
  root: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.palette.background.default,
  },
  paper: {
    padding: theme.spacing(4),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    maxWidth: '400px',
    backgroundColor: theme.palette.background.paper,
  },
  form: {
    width: '100%',
    marginTop: theme.spacing(2),
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
    width: '100%',
  },
  hint: {
    marginTop: theme.spacing(2),
    color: theme.palette.text.secondary,
    textAlign: 'center',
    padding: theme.spacing(1),
    backgroundColor: theme.palette.action.hover,
    borderRadius: theme.shape.borderRadius,
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
  const [fieldErrors, setFieldErrors] = useState({ username: false, password: false });

  const validateFields = () => {
    const errors = {
      username: !username,
      password: !password,
    };
    setFieldErrors(errors);
    return !errors.username && !errors.password;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateFields()) {
      setError('Please enter both username and password');
      return;
    }

    setLoading(true);
    setError('');
    setFieldErrors({ username: false, password: false });

    try {
      const success = await AuthService.login(username, password);
      if (success) {
        const { from } = location.state || { from: { pathname: '/' } };
        history.replace(from);
      }
    } catch (error) {
      console.error('Login error:', error);
      if (error.response?.data?.error) {
        setError(error.response.data.error);
      } else if (error.message) {
        setError(error.message);
      } else {
        setError('Failed to login. Please try again.');
      }
      setFieldErrors({ username: true, password: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className={classes.root}>
      <Container maxWidth="xs">
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
              onChange={(e) => {
                setUsername(e.target.value);
                setFieldErrors({ ...fieldErrors, username: false });
              }}
              disabled={loading}
              error={fieldErrors.username}
              helperText={fieldErrors.username ? 'Username is required' : ''}
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
              onChange={(e) => {
                setPassword(e.target.value);
                setFieldErrors({ ...fieldErrors, password: false });
              }}
              disabled={loading}
              error={fieldErrors.password}
              helperText={fieldErrors.password ? 'Password is required' : ''}
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
          <Paper variant="outlined" className={classes.hint}>
            <Typography variant="body2">
              Default admin credentials:<br />
              Username: admin<br />
              Password: adminadmin
            </Typography>
          </Paper>
        </Paper>
      </Container>
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
    </Box>
  );
}

export default Login; 