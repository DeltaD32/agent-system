import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Grid,
  Paper,
  Typography,
  CircularProgress,
  LinearProgress,
  Box,
  makeStyles,
} from '@material-ui/core';

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
    padding: theme.spacing(2),
  },
  paper: {
    padding: theme.spacing(2),
    height: '100%',
  },
  title: {
    marginBottom: theme.spacing(2),
    color: theme.palette.primary.main,
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
    height: '200px',
  },
  error: {
    color: theme.palette.error.main,
    textAlign: 'center',
  },
}));

async function queryPrometheus(query) {
  try {
    const response = await axios.get('/prometheus/api/v1/query', {
      params: {
        query,
        time: Date.now() / 1000,
      },
    });
    return response.data?.data?.result?.[0]?.value?.[1] || '0';
  } catch (error) {
    console.error(`Error querying Prometheus for ${query}:`, error);
    return '0';
  }
}

function SystemStatus() {
  const classes = useStyles();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMetrics = async () => {
    try {
      // Fetch health status
      const healthResponse = await axios.get('/api/health');
      const healthData = healthResponse.data;

      // Fetch Prometheus metrics
      const [
        activeAgents,
        healthyAgents,
        unhealthyAgents,
        totalProjects,
        activeProjects,
        totalTasks,
        completedTasks,
        workerConnections,
        systemUptime,
      ] = await Promise.all([
        queryPrometheus('active_agents'),
        queryPrometheus('ai_agents_by_status{status="healthy"}'),
        queryPrometheus('ai_agents_by_status{status="unhealthy"}'),
        queryPrometheus('project_total'),
        queryPrometheus('active_projects'),
        queryPrometheus('tasks_created_total'),
        queryPrometheus('project_tasks_by_status{status="completed"}'),
        queryPrometheus('worker_connections'),
        queryPrometheus('process_uptime_seconds'),
      ]);

      const parsedMetrics = {
        system: {
          database: healthData.components.database === 'healthy',
          messageQueue: healthData.components.message_queue === 'healthy',
          ollama: healthData.components.ollama === 'healthy',
          websocket: healthData.components.websocket?.status === 'healthy' || false,
          connections: parseInt(workerConnections),
          uptime: parseFloat(systemUptime).toFixed(2),
        },
        agents: {
          total: parseInt(activeAgents),
          byStatus: {
            healthy: parseInt(healthyAgents),
            unhealthy: parseInt(unhealthyAgents),
          }
        },
        projects: {
          total: parseInt(totalProjects),
          active: parseInt(activeProjects),
          tasks: parseInt(totalTasks),
          completed: parseInt(completedTasks),
        }
      };

      setMetrics(parsedMetrics);
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Error fetching metrics:', err);
      setError(err.message || 'Failed to fetch metrics');
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
        <Grid item xs={12} md={4}>
          <Paper className={classes.paper}>
            <Typography variant="h6" className={classes.title}>
              System Health
            </Typography>
            <div className={classes.metric}>
              <Typography variant="subtitle1">
                Database: {metrics?.system.database ? 'Healthy' : 'Unhealthy'}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={metrics?.system.database ? 100 : 0}
                className={classes.progress}
                color={metrics?.system.database ? "primary" : "secondary"}
              />
            </div>
            <div className={classes.metric}>
              <Typography variant="subtitle1">
                Message Queue: {metrics?.system.messageQueue ? 'Healthy' : 'Unhealthy'}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={metrics?.system.messageQueue ? 100 : 0}
                className={classes.progress}
                color={metrics?.system.messageQueue ? "primary" : "secondary"}
              />
            </div>
            <div className={classes.metric}>
              <Typography variant="subtitle1">
                WebSocket: {metrics?.system.websocket ? 'Healthy' : 'Unhealthy'}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={metrics?.system.websocket ? 100 : 0}
                className={classes.progress}
                color={metrics?.system.websocket ? "primary" : "secondary"}
              />
            </div>
            <Typography variant="body2" color="textSecondary">
              System Uptime: {metrics?.system.uptime} seconds
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper className={classes.paper}>
            <Typography variant="h6" className={classes.title}>
              Agent Status
            </Typography>
            <div className={classes.metric}>
              <Typography variant="subtitle1">
                Active Agents: {metrics?.agents.total || 0}
              </Typography>
              <Typography variant="subtitle1">
                Ollama Status: {metrics?.system.ollama ? 'Connected' : 'Disconnected'}
              </Typography>
              <Box mt={1}>
                <Typography variant="body2">
                  Healthy Agents: {metrics?.agents.byStatus.healthy || 0}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={metrics?.agents.total > 0 ? (metrics?.agents.byStatus.healthy / metrics?.agents.total) * 100 : 0}
                  className={classes.progress}
                  color="primary"
                />
                <Typography variant="body2">
                  Unhealthy Agents: {metrics?.agents.byStatus.unhealthy || 0}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={metrics?.agents.total > 0 ? (metrics?.agents.byStatus.unhealthy / metrics?.agents.total) * 100 : 0}
                  className={classes.progress}
                  color="secondary"
                />
              </Box>
              <Typography variant="body2" color="textSecondary">
                Active Connections: {metrics?.system.connections}
              </Typography>
            </div>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper className={classes.paper}>
            <Typography variant="h6" className={classes.title}>
              Project Overview
            </Typography>
            <div className={classes.metric}>
              <Typography variant="subtitle1">
                Total Projects: {metrics?.projects.total || 0}
              </Typography>
              <Typography variant="subtitle1">
                Active Projects: {metrics?.projects.active || 0}
              </Typography>
              <Typography variant="subtitle1">
                Total Tasks: {metrics?.projects.tasks || 0}
              </Typography>
              <Typography variant="subtitle1">
                Completed Tasks: {metrics?.projects.completed || 0}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={metrics?.projects.tasks > 0 ? (metrics?.projects.completed / metrics?.projects.tasks) * 100 : 0}
                className={classes.progress}
                color="primary"
              />
              <Typography variant="body2" color="textSecondary">
                Task Completion Rate: {metrics?.projects.tasks > 0 ? ((metrics?.projects.completed / metrics?.projects.tasks) * 100).toFixed(1) : 0}%
              </Typography>
            </div>
          </Paper>
        </Grid>
      </Grid>
    </div>
  );
}

export default SystemStatus; 