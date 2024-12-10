import React, { useState, useEffect } from 'react';
import {
  Grid,
  Paper,
  Typography,
  makeStyles,
  CircularProgress,
  Chip,
} from '@material-ui/core';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@material-ui/icons';

const useStyles = makeStyles((theme) => ({
  paper: {
    padding: theme.spacing(2),
    display: 'flex',
    overflow: 'auto',
    flexDirection: 'column',
  },
  statusItem: {
    padding: theme.spacing(2),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  healthy: {
    backgroundColor: theme.palette.success.light,
  },
  unhealthy: {
    backgroundColor: theme.palette.error.light,
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    padding: theme.spacing(3),
  },
}));

function SystemStatus() {
  const classes = useStyles();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('http://localhost:5000/health');
        if (!response.ok) {
          throw new Error('Failed to fetch system status');
        }
        const data = await response.json();
        setStatus(data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className={classes.loading}>
        <CircularProgress />
      </div>
    );
  }

  if (error) {
    return (
      <Paper className={classes.paper}>
        <Typography color="error" align="center">
          {error}
        </Typography>
      </Paper>
    );
  }

  return (
    <div>
      <Typography variant="h6" gutterBottom>
        System Status
      </Typography>
      <Grid container spacing={2}>
        {status && status.components && Object.entries(status.components).map(([key, value]) => (
          <Grid item xs={12} sm={6} md={4} key={key}>
            <Paper className={classes.statusItem}>
              <Typography variant="subtitle1">
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </Typography>
              <Chip
                icon={value === 'healthy' ? <CheckCircleIcon /> : <ErrorIcon />}
                label={value}
                color={value === 'healthy' ? 'primary' : 'secondary'}
              />
            </Paper>
          </Grid>
        ))}
      </Grid>
    </div>
  );
}

export default SystemStatus; 