import React, { useState, useEffect } from 'react';
import {
  Grid,
  Paper,
  Typography,
  makeStyles,
  CircularProgress,
  LinearProgress,
  Box,
} from '@material-ui/core';
import axios from 'axios';

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
  },
  paper: {
    padding: theme.spacing(2),
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: theme.palette.background.paper,
  },
  title: {
    marginBottom: theme.spacing(2),
  },
  metric: {
    marginBottom: theme.spacing(2),
  },
  progress: {
    marginTop: theme.spacing(1),
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  error: {
    color: theme.palette.error.main,
    textAlign: 'center',
    padding: theme.spacing(2),
  },
}));

function SystemStatus() {
  const classes = useStyles();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMetrics = async () => {
    try {
      const response = await axios.get('/api/metrics');
      const metricsText = response.data;
      
      // Parse Prometheus metrics
      const parsedMetrics = {
        projects: {
          total: 0,
          active: 0,
        },
        tasks: {
          total: 0,
          byStatus: {},
          byPriority: {},
        },
        agents: {
          total: 0,
          byStatus: {},
        },
        system: {
          requestRate: 0,
          errorRate: 0,
          avgResponseTime: 0,
        },
      };

      // Parse metrics text
      metricsText.split('\n').forEach(line => {
        if (line.startsWith('#')) return;
        
        if (line.includes('project_total')) {
          parsedMetrics.projects.total = parseFloat(line.split(' ')[1]);
        }
        else if (line.includes('active_projects')) {
          parsedMetrics.projects.active = parseFloat(line.split(' ')[1]);
        }
        else if (line.includes('project_tasks_total')) {
          parsedMetrics.tasks.total += parseFloat(line.split(' ')[1]);
        }
        else if (line.includes('project_tasks_by_status')) {
          const match = line.match(/status="([^"]+)"\s+(\d+)/);
          if (match) {
            parsedMetrics.tasks.byStatus[match[1]] = parseFloat(match[2]);
          }
        }
        else if (line.includes('ai_agents_total')) {
          parsedMetrics.agents.total = parseFloat(line.split(' ')[1]);
        }
        else if (line.includes('ai_agents_by_status')) {
          const match = line.match(/status="([^"]+)"\s+(\d+)/);
          if (match) {
            parsedMetrics.agents.byStatus[match[1]] = parseFloat(match[2]);
          }
        }
        else if (line.includes('http_request_duration_seconds_sum')) {
          const value = parseFloat(line.split(' ')[1]);
          parsedMetrics.system.avgResponseTime = value;
        }
        else if (line.includes('http_requests_total')) {
          const value = parseFloat(line.split(' ')[1]);
          parsedMetrics.system.requestRate = value;
        }
      });

      setMetrics(parsedMetrics);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Update every 30 seconds
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
      <Typography variant="h6" className={classes.error}>
        Error loading system status: {error}
      </Typography>
    );
  }

  return (
    <div className={classes.root}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper className={classes.paper}>
            <Typography variant="h6" className={classes.title}>
              Projects & Tasks
            </Typography>
            <div className={classes.metric}>
              <Typography variant="subtitle1">
                Active Projects: {metrics.projects.active} / {metrics.projects.total}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(metrics.projects.active / metrics.projects.total) * 100}
                className={classes.progress}
              />
            </div>
            <div className={classes.metric}>
              <Typography variant="subtitle1">
                Total Tasks: {metrics.tasks.total}
              </Typography>
              <Box mt={1}>
                {Object.entries(metrics.tasks.byStatus).map(([status, count]) => (
                  <div key={status}>
                    <Typography variant="body2">
                      {status}: {count}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={(count / metrics.tasks.total) * 100}
                      className={classes.progress}
                    />
                  </div>
                ))}
              </Box>
            </div>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper className={classes.paper}>
            <Typography variant="h6" className={classes.title}>
              System Performance
            </Typography>
            <div className={classes.metric}>
              <Typography variant="subtitle1">
                Request Rate: {metrics.system.requestRate.toFixed(2)} req/s
              </Typography>
              <Typography variant="subtitle1">
                Avg Response Time: {metrics.system.avgResponseTime.toFixed(2)} ms
              </Typography>
            </div>
            <Typography variant="h6" className={classes.title} style={{ marginTop: 16 }}>
              Agent Status
            </Typography>
            <div className={classes.metric}>
              <Typography variant="subtitle1">
                Total Agents: {metrics.agents.total}
              </Typography>
              <Box mt={1}>
                {Object.entries(metrics.agents.byStatus).map(([status, count]) => (
                  <div key={status}>
                    <Typography variant="body2">
                      {status}: {count}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={(count / metrics.agents.total) * 100}
                      className={classes.progress}
                    />
                  </div>
                ))}
              </Box>
            </div>
          </Paper>
        </Grid>
      </Grid>
    </div>
  );
}

export default SystemStatus; 