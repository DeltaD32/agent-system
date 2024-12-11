import React, { useState } from 'react';
import { 
  Container, 
  Grid, 
  Paper, 
  Typography, 
  makeStyles, 
  Button,
  Box,
  IconButton,
  Tooltip,
  LinearProgress,
  Avatar,
  Chip,
} from '@material-ui/core';
import {
  Add as AddIcon,
  Assignment as ProjectIcon,
  Timeline as MetricsIcon,
  Code as AIIcon,
  Speed as PerformanceIcon,
  CloudQueue as CloudIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
} from '@material-ui/icons';
import { useHistory } from 'react-router-dom';
import SystemStatus from './SystemStatus';
import useSystemStats from '../hooks/useSystemStats';

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
    padding: theme.spacing(3),
    backgroundColor: theme.palette.background.default,
  },
  welcomeSection: {
    marginBottom: theme.spacing(4),
    padding: theme.spacing(4),
    background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
    color: theme.palette.primary.contrastText,
    borderRadius: theme.shape.borderRadius * 2,
    position: 'relative',
    overflow: 'hidden',
    '&::after': {
      content: '""',
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      background: 'linear-gradient(45deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%)',
      zIndex: 1,
    },
  },
  statCard: {
    height: '100%',
    background: theme.palette.background.paper,
    borderRadius: theme.shape.borderRadius,
    transition: 'transform 0.2s, box-shadow 0.2s',
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: theme.shadows[4],
    },
  },
  actionButton: {
    marginRight: theme.spacing(1),
    borderRadius: theme.shape.borderRadius * 2,
    textTransform: 'none',
    padding: theme.spacing(1, 3),
  },
  sectionTitle: {
    marginBottom: theme.spacing(3),
    position: 'relative',
    paddingBottom: theme.spacing(1),
    '&:after': {
      content: '""',
      position: 'absolute',
      bottom: 0,
      left: 0,
      width: 40,
      height: 3,
      background: theme.palette.primary.main,
      borderRadius: 1.5,
    },
  },
  gridContainer: {
    marginBottom: theme.spacing(4),
  },
  statusWidget: {
    padding: theme.spacing(3),
    background: theme.palette.background.paper,
    borderRadius: theme.shape.borderRadius,
    height: '100%',
  },
  agentChip: {
    margin: theme.spacing(0.5),
  },
  refreshButton: {
    marginLeft: 'auto',
  },
  widgetHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
  },
  progressSection: {
    marginTop: theme.spacing(2),
  },
  progress: {
    height: 8,
    borderRadius: 4,
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  statValue: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: theme.palette.primary.main,
    marginBottom: theme.spacing(1),
  },
  statLabel: {
    color: theme.palette.text.secondary,
    fontSize: '0.875rem',
  },
}));

const StatCard = ({ icon: Icon, value, label, color }) => {
  const classes = useStyles();
  return (
    <Paper className={classes.statCard} elevation={1}>
      <Box p={3}>
        <Box display="flex" alignItems="center" mb={2}>
          <Avatar style={{ backgroundColor: color, marginRight: 8 }}>
            <Icon />
          </Avatar>
          <Typography variant="h6">{label}</Typography>
        </Box>
        <Typography className={classes.statValue}>{value}</Typography>
      </Box>
    </Paper>
  );
};

function Dashboard() {
  const classes = useStyles();
  const history = useHistory();
  const stats = useSystemStats();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const quickActions = [
    { 
      icon: AddIcon, 
      label: 'New Project', 
      onClick: () => {
        history.push('/projects/new');
      },
      variant: 'contained',
      color: 'primary'
    },
    { 
      icon: MetricsIcon, 
      label: 'View Metrics', 
      onClick: () => {
        history.push('/metrics');
      },
      variant: 'outlined',
      color: 'inherit'
    },
    { 
      icon: AIIcon, 
      label: 'Manage Agents', 
      onClick: () => {
        history.push('/agents');
      },
      variant: 'outlined',
      color: 'inherit'
    },
  ];

  return (
    <Container maxWidth="lg" className={classes.root}>
      <Paper className={classes.welcomeSection} elevation={3}>
        <Typography variant="h4" gutterBottom>
          Welcome to Agent System
        </Typography>
        <Typography variant="subtitle1" paragraph>
          Your AI-powered project management hub
        </Typography>
        <Box mt={3}>
          {quickActions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant}
              color={action.color}
              className={classes.actionButton}
              startIcon={<action.icon />}
              onClick={action.onClick}
              disableElevation
            >
              {action.label}
            </Button>
          ))}
        </Box>
      </Paper>

      <Typography variant="h5" className={classes.sectionTitle}>
        System Overview
      </Typography>
      <Grid container spacing={3} className={classes.gridContainer}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={ProjectIcon}
            value={stats.activeProjects}
            label="Active Projects"
            color="#1976d2"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={AIIcon}
            value={stats.runningWorkers}
            label="Active Agents"
            color="#2e7d32"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={PerformanceIcon}
            value={stats.tasksCompleted}
            label="Tasks Completed"
            color="#ed6c02"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={CloudIcon}
            value={stats.systemUptime}
            label="System Uptime"
            color="#9c27b0"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper className={classes.statusWidget}>
            <div className={classes.widgetHeader}>
              <Typography variant="h6">System Status</Typography>
              <Tooltip title="Refresh">
                <IconButton className={classes.refreshButton} onClick={handleRefresh} size="small">
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </div>
            <SystemStatus key={refreshKey} />
            <div className={classes.progressSection}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="textSecondary">System Load</Typography>
                <Typography variant="body2" color="primary">75%</Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={75} 
                className={classes.progress}
                color="primary"
              />
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="textSecondary">Memory Usage</Typography>
                <Typography variant="body2" color="secondary">62%</Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={62} 
                className={classes.progress}
                color="secondary"
              />
            </div>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper className={classes.statusWidget}>
            <Typography variant="h6" gutterBottom>Active Agents</Typography>
            <Box mt={2}>
              <Chip
                avatar={<Avatar style={{ backgroundColor: '#4caf50' }}>A1</Avatar>}
                label="Agent-1 (Ready)"
                className={classes.agentChip}
                color="primary"
              />
              <Chip
                avatar={<Avatar style={{ backgroundColor: '#ff9800' }}>A2</Avatar>}
                label="Agent-2 (Processing)"
                className={classes.agentChip}
                color="secondary"
              />
              <Chip
                avatar={<Avatar style={{ backgroundColor: '#2196f3' }}>A3</Avatar>}
                label="Agent-3 (Idle)"
                className={classes.agentChip}
              />
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}

export default Dashboard; 