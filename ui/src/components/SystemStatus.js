import React, { useState, useEffect } from 'react';
import {
  Grid,
  Paper,
  Typography,
  makeStyles,
  CircularProgress,
  Chip,
  Button,
} from '@material-ui/core';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
} from '@material-ui/icons';

const useStyles = makeStyles((theme) => ({
  root: {
    width: '100%',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
  },
  statusItem: {
    padding: theme.spacing(2),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.palette.background.default,
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    padding: theme.spacing(3),
  },
  error: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.error.light,
    color: theme.palette.error.contrastText,
    marginBottom: theme.spacing(2),
  },
  refreshButton: {
    marginLeft: theme.spacing(2),
  },
}));

function SystemStatus() {
  const classes = useStyles();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStatus = async () => {
    try {
      console.log('Fetching system status...');
      setLoading(true);
      setError(null);

      const response = await fetch('/api/health', {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to fetch system status: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Received status data:', data);
      setStatus(data);
    } catch (err) {
      console.error('Error fetching system status:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('SystemStatus component mounted');
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => {
      console.log('SystemStatus component unmounting');
      clearInterval(interval);
    };
  }, []);

  const handleRefresh = () => {
    console.log('Manual refresh requested');
    fetchStatus();
  };

  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <Typography variant="h6">
          System Status
        </Typography>
        <Button
          variant="outlined"
          color="primary"
          startIcon={<RefreshIcon />}
          onClick={handleRefresh}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>

      {error && (
        <Paper className={classes.error}>
          <Typography>
            {error}
          </Typography>
        </Paper>
      )}

      {loading ? (
        <div className={classes.loading}>
          <CircularProgress />
        </div>
      ) : (
        <Grid container spacing={2}>
          {status && status.components && Object.entries(status.components).map(([key, value]) => {
            // Handle both string and object values
            const status = typeof value === 'object' ? value.status : value;
            const label = typeof value === 'object' ? `${status} (${value.connections} connections)` : value;
            
            return (
              <Grid item xs={12} sm={6} md={4} key={key}>
                <Paper className={classes.statusItem} elevation={2}>
                  <Typography variant="subtitle1">
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </Typography>
                  <Chip
                    icon={status === 'healthy' ? <CheckCircleIcon /> : <ErrorIcon />}
                    label={label}
                    color={status === 'healthy' ? 'primary' : 'secondary'}
                    variant="outlined"
                  />
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      )}
    </div>
  );
}

export default SystemStatus; 