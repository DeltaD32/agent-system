import React, { useState } from 'react';
import { 
  Container, 
  Grid, 
  Paper, 
  Typography, 
  makeStyles, 
  Card, 
  CardContent,
  CardActions,
  Button,
  Box,
  IconButton,
  Tooltip,
  Divider,
  Menu,
  MenuItem,
} from '@material-ui/core';
import {
  Add as AddIcon,
  Assignment as ProjectIcon,
  Group as TeamIcon,
  Timeline as MetricsIcon,
  Code as AIIcon,
  Security as SecurityIcon,
  Build as ToolsIcon,
  MoreVert as MoreVertIcon,
  Dashboard as DashboardIcon,
  Storage as DatabaseIcon,
  Speed as PerformanceIcon,
  BugReport as BugIcon,
  CloudQueue as CloudIcon,
  Settings as SettingsIcon,
} from '@material-ui/icons';
import { useHistory } from 'react-router-dom';
import SystemStatus from './SystemStatus';

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
    padding: theme.spacing(3),
    backgroundColor: theme.palette.background.default,
  },
  welcomeSection: {
    marginBottom: theme.spacing(4),
    padding: theme.spacing(3),
    background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.primary.light} 90%)`,
    color: theme.palette.primary.contrastText,
    borderRadius: theme.shape.borderRadius,
  },
  shortcutCard: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.2s, box-shadow 0.2s',
    cursor: 'pointer',
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: theme.shadows[8],
    },
  },
  shortcutIcon: {
    fontSize: '2.5rem',
    marginBottom: theme.spacing(2),
    color: theme.palette.primary.main,
  },
  dashboardWidget: {
    height: '100%',
    minHeight: 300,
  },
  widgetHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
  },
  metricsFrame: {
    width: '100%',
    height: 300,
    border: 'none',
    borderRadius: theme.shape.borderRadius,
  },
  actionButton: {
    marginRight: theme.spacing(1),
  },
  sectionTitle: {
    marginBottom: theme.spacing(3),
    position: 'relative',
    '&:after': {
      content: '""',
      position: 'absolute',
      bottom: -8,
      left: 0,
      width: 40,
      height: 4,
      background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
      borderRadius: 2,
    },
  },
}));

const ShortcutCard = ({ icon: Icon, title, description, onClick }) => {
  const classes = useStyles();
  return (
    <Card className={classes.shortcutCard} onClick={onClick}>
      <CardContent>
        <Icon className={classes.shortcutIcon} />
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {description}
        </Typography>
      </CardContent>
    </Card>
  );
};

const DashboardWidget = ({ title, children, onMoreClick }) => {
  const classes = useStyles();
  const [anchorEl, setAnchorEl] = useState(null);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  return (
    <Paper className={classes.dashboardWidget}>
      <Box p={2}>
        <div className={classes.widgetHeader}>
          <Typography variant="h6">{title}</Typography>
          <IconButton size="small" onClick={handleMenuOpen}>
            <MoreVertIcon />
          </IconButton>
        </div>
        <Menu
          anchorEl={anchorEl}
          keepMounted
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={handleMenuClose}>Refresh</MenuItem>
          <MenuItem onClick={handleMenuClose}>Maximize</MenuItem>
          <MenuItem onClick={handleMenuClose}>Settings</MenuItem>
        </Menu>
        {children}
      </Box>
    </Paper>
  );
};

function Dashboard() {
  const classes = useStyles();
  const history = useHistory();

  const shortcuts = [
    {
      icon: ProjectIcon,
      title: 'New Project',
      description: 'Create a new project from template',
      onClick: () => history.push('/projects/new'),
    },
    {
      icon: AIIcon,
      title: 'AI Agents',
      description: 'Manage and monitor AI agents',
      onClick: () => history.push('/agents'),
    },
    {
      icon: MetricsIcon,
      title: 'Analytics',
      description: 'View system analytics and metrics',
      onClick: () => history.push('/metrics'),
    },
    {
      icon: TeamIcon,
      title: 'Team',
      description: 'Manage team and permissions',
      onClick: () => history.push('/team'),
    },
    {
      icon: SecurityIcon,
      title: 'Security',
      description: 'Security settings and access control',
      onClick: () => history.push('/security'),
    },
    {
      icon: SettingsIcon,
      title: 'Settings',
      description: 'System configuration and preferences',
      onClick: () => history.push('/settings'),
    },
  ];

  const quickActions = [
    { 
      icon: AddIcon, 
      label: 'New Project', 
      onClick: () => history.push('/projects/new'),
      variant: 'contained',
      color: 'inherit'
    },
    { 
      icon: DashboardIcon, 
      label: 'Dashboards', 
      onClick: () => history.push('/metrics'),
      variant: 'outlined',
      color: 'inherit'
    },
    { 
      icon: BugIcon, 
      label: 'Debug Console', 
      onClick: () => history.push('/debug'),
      variant: 'outlined',
      color: 'inherit'
    },
    { 
      icon: CloudIcon, 
      label: 'Resources', 
      onClick: () => history.push('/resources'),
      variant: 'outlined',
      color: 'inherit'
    },
  ];

  return (
    <Container maxWidth="lg" className={classes.root}>
      <Paper className={classes.welcomeSection} elevation={0}>
        <Typography variant="h4" gutterBottom>
          Welcome to Agent System
        </Typography>
        <Typography variant="subtitle1" paragraph>
          Manage your projects and AI agents from one central dashboard
        </Typography>
        <Box mt={2}>
          {quickActions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant}
              color={action.color}
              className={classes.actionButton}
              startIcon={<action.icon />}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ))}
        </Box>
      </Paper>

      <Typography variant="h5" className={classes.sectionTitle}>
        Quick Access
      </Typography>
      <Grid container spacing={3} style={{ marginBottom: theme.spacing(4) }}>
        {shortcuts.map((shortcut, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <ShortcutCard {...shortcut} />
          </Grid>
        ))}
      </Grid>

      <Typography variant="h5" className={classes.sectionTitle}>
        System Overview
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <DashboardWidget title="System Status">
            <SystemStatus />
          </DashboardWidget>
        </Grid>
        <Grid item xs={12} md={4}>
          <DashboardWidget title="Active Projects">
            <iframe
              src="/grafana/d/quick-metrics/quick-metrics?orgId=1&kiosk&viewPanel=1"
              className={classes.metricsFrame}
              title="Active Projects"
            />
          </DashboardWidget>
        </Grid>
        <Grid item xs={12} md={6}>
          <DashboardWidget title="Agent Performance">
            <iframe
              src="/grafana/d/agent-metrics/agent-metrics?orgId=1&kiosk&viewPanel=2"
              className={classes.metricsFrame}
              title="Agent Performance"
            />
          </DashboardWidget>
        </Grid>
        <Grid item xs={12} md={6}>
          <DashboardWidget title="Task Distribution">
            <iframe
              src="/grafana/d/project-analytics/project-analytics?orgId=1&kiosk&viewPanel=3"
              className={classes.metricsFrame}
              title="Task Distribution"
            />
          </DashboardWidget>
        </Grid>
      </Grid>
    </Container>
  );
}

export default Dashboard; 