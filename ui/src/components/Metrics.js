import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Grid,
  makeStyles,
  CircularProgress,
  Card,
  CardContent,
  Link,
} from '@material-ui/core';
import {
  Timeline as TimelineIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  BubbleChart as BubbleChartIcon,
} from '@material-ui/icons';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
  },
  paper: {
    padding: theme.spacing(3),
    height: '100%',
  },
  card: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  metricValue: {
    fontSize: '2rem',
    fontWeight: 500,
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
  metricLabel: {
    color: theme.palette.text.secondary,
  },
  icon: {
    fontSize: '2.5rem',
    marginBottom: theme.spacing(2),
    color: theme.palette.primary.main,
  },
  link: {
    display: 'flex',
    alignItems: 'center',
    marginTop: theme.spacing(2),
    '& > svg': {
      marginRight: theme.spacing(1),
    },
  },
}));

function Metrics() {
  const classes = useStyles();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await axios.get(`${API_URL}/metrics`);
        setMetrics(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching metrics:', error);
        setError('Failed to fetch metrics');
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
        <CircularProgress />
      </div>
    );
  }

  if (error) {
    return (
      <Typography color="error" align="center">
        {error}
      </Typography>
    );
  }

  const metricCards = [
    {
      title: 'Active Tasks',
      value: metrics?.active_tasks || 0,
      icon: <TimelineIcon className={classes.icon} />,
      link: 'http://localhost:3001/d/agent-metrics/agent-system-metrics',
    },
    {
      title: 'Projects Created',
      value: metrics?.projects_created || 0,
      icon: <StorageIcon className={classes.icon} />,
      link: 'http://localhost:3001/d/agent-metrics/agent-system-metrics',
    },
    {
      title: 'Average Response Time',
      value: `${((metrics?.request_duration_seconds || 0) * 1000).toFixed(2)}ms`,
      icon: <SpeedIcon className={classes.icon} />,
      link: 'http://localhost:3001/d/agent-metrics/agent-system-metrics',
    },
    {
      title: 'Active Connections',
      value: metrics?.active_connections || 0,
      icon: <BubbleChartIcon className={classes.icon} />,
      link: 'http://localhost:3001/d/agent-metrics/agent-system-metrics',
    },
  ];

  return (
    <div className={classes.root}>
      <Grid container spacing={3}>
        {metricCards.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card className={classes.card}>
              <CardContent>
                {card.icon}
                <Typography variant="h6" component="h2">
                  {card.title}
                </Typography>
                <Typography className={classes.metricValue}>
                  {card.value}
                </Typography>
                <Link
                  href={card.link}
                  target="_blank"
                  rel="noopener"
                  className={classes.link}
                  color="primary"
                >
                  View in Grafana
                </Link>
              </CardContent>
            </Card>
          </Grid>
        ))}
        <Grid item xs={12}>
          <Paper className={classes.paper}>
            <Typography variant="h5" gutterBottom>
              System Health
            </Typography>
            <iframe
              src="http://localhost:3001/d/agent-metrics/agent-system-metrics?orgId=1&refresh=5s"
              width="100%"
              height="800px"
              frameBorder="0"
              title="Grafana Dashboard"
            />
          </Paper>
        </Grid>
      </Grid>
    </div>
  );
}

export default Metrics; 