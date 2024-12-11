import React, { useState, useEffect } from 'react';
import {
  makeStyles,
  Paper,
  Tabs,
  Tab,
  Box,
  Typography,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Button,
  Divider,
} from '@material-ui/core';
import {
  Timeline as TimelineIcon,
  Memory as SystemIcon,
  Group as UserIcon,
  Speed as PerformanceIcon,
  Assessment as AnalyticsIcon,
  Dashboard as DashboardIcon,
  Refresh as RefreshIcon,
  Fullscreen as FullscreenIcon,
  GetApp as DownloadIcon,
} from '@material-ui/icons';

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(3),
  },
  paper: {
    width: '100%',
    height: 'calc(100vh - 180px)',
    overflow: 'hidden',
    borderRadius: theme.shape.borderRadius * 2,
    backgroundColor: theme.palette.background.paper,
  },
  header: {
    padding: theme.spacing(2, 3),
    background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
    color: theme.palette.primary.contrastText,
    borderTopLeftRadius: theme.shape.borderRadius * 2,
    borderTopRightRadius: theme.shape.borderRadius * 2,
  },
  headerActions: {
    display: 'flex',
    gap: theme.spacing(1),
  },
  tabs: {
    backgroundColor: theme.palette.background.paper,
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  tab: {
    minHeight: 72,
    padding: theme.spacing(2),
  },
  tabContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  tabIcon: {
    marginBottom: theme.spacing(1),
    color: theme.palette.primary.main,
  },
  tabLabel: {
    fontSize: '0.875rem',
    fontWeight: 500,
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    gap: theme.spacing(2),
  },
  tabPanel: {
    height: 'calc(100% - 73px)',
    position: 'relative',
  },
  dashboardInfo: {
    position: 'absolute',
    top: theme.spacing(2),
    right: theme.spacing(2),
    zIndex: 1000,
    background: theme.palette.background.paper,
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    boxShadow: theme.shadows[2],
    maxWidth: 300,
  },
  quickStats: {
    padding: theme.spacing(2),
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: theme.spacing(2),
  },
  statCard: {
    background: theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: theme.palette.primary.main,
  },
}));

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`metrics-tabpanel-${index}`}
      {...other}
      style={{ height: '100%' }}
    >
      {value === index && (
        <Box style={{ height: '100%' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const QuickStat = ({ title, value, icon: Icon }) => {
  const classes = useStyles();
  return (
    <Card className={classes.statCard}>
      <CardContent>
        <Box display="flex" alignItems="center" mb={1}>
          <Icon color="primary" style={{ marginRight: 8 }} />
          <Typography variant="body2" color="textSecondary">
            {title}
          </Typography>
        </Box>
        <Typography className={classes.statValue}>{value}</Typography>
      </CardContent>
    </Card>
  );
};

const Metrics = () => {
  const classes = useStyles();
  const [value, setValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  const dashboards = [
    {
      name: 'Quick Stats',
      icon: DashboardIcon,
      url: '/grafana/d/quick-metrics/quick-metrics?orgId=1&refresh=5s&theme=light',
      description: 'Real-time overview of key metrics including active tasks and agents',
    },
    {
      name: 'System Overview',
      icon: SystemIcon,
      url: '/grafana/d/system-overview/system-overview?orgId=1&refresh=5s&theme=light',
      description: 'System performance metrics and resource utilization',
    },
    {
      name: 'Project Analytics',
      icon: AnalyticsIcon,
      url: '/grafana/d/project-analytics/project-analytics?orgId=1&refresh=5s&theme=light',
      description: 'Detailed project metrics, task distribution, and completion rates',
    },
    {
      name: 'Agent Performance',
      icon: PerformanceIcon,
      url: '/grafana/d/agent-metrics/agent-system-metrics?orgId=1&refresh=5s&theme=light',
      description: 'Agent performance metrics and workload distribution',
    },
    {
      name: 'Task Metrics',
      icon: TimelineIcon,
      url: '/grafana/d/task-metrics/task-metrics?orgId=1&refresh=5s&theme=light',
      description: 'Detailed task execution metrics and trends',
    },
  ];

  const handleChange = (event, newValue) => {
    setValue(newValue);
    setLoading(true);
    setShowInfo(false);
  };

  const handleIframeLoad = () => {
    setLoading(false);
  };

  const handleRefresh = () => {
    setLoading(true);
    const iframe = document.querySelector(`#metrics-frame-${value}`);
    if (iframe) {
      iframe.src = iframe.src;
    }
  };

  return (
    <div className={classes.root}>
      <Paper className={classes.paper} elevation={3}>
        <Box className={classes.header} display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h5">System Metrics & Analytics</Typography>
          <div className={classes.headerActions}>
            <Tooltip title="Refresh">
              <IconButton size="small" color="inherit" onClick={handleRefresh}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Download Report">
              <IconButton size="small" color="inherit">
                <DownloadIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Fullscreen">
              <IconButton size="small" color="inherit">
                <FullscreenIcon />
              </IconButton>
            </Tooltip>
          </div>
        </Box>

        <div className={classes.quickStats}>
          <QuickStat title="Active Tasks" value="24" icon={TimelineIcon} />
          <QuickStat title="System Load" value="75%" icon={PerformanceIcon} />
          <QuickStat title="Active Agents" value="3" icon={UserIcon} />
          <QuickStat title="Memory Usage" value="62%" icon={SystemIcon} />
        </div>

        <Tabs
          value={value}
          onChange={handleChange}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
          className={classes.tabs}
        >
          {dashboards.map((dashboard, index) => (
            <Tab
              key={index}
              className={classes.tab}
              label={
                <div className={classes.tabContent}>
                  <dashboard.icon className={classes.tabIcon} />
                  <Typography className={classes.tabLabel}>{dashboard.name}</Typography>
                </div>
              }
              title={dashboard.description}
            />
          ))}
        </Tabs>

        {dashboards.map((dashboard, index) => (
          <TabPanel key={index} value={value} index={index} className={classes.tabPanel}>
            {loading && (
              <div className={classes.loadingContainer}>
                <CircularProgress />
                <Typography variant="body2" color="textSecondary">
                  Loading {dashboard.name}...
                </Typography>
              </div>
            )}
            {showInfo && (
              <Paper className={classes.dashboardInfo}>
                <Typography variant="subtitle2" gutterBottom>
                  {dashboard.name}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {dashboard.description}
                </Typography>
              </Paper>
            )}
            <iframe
              id={`metrics-frame-${index}`}
              src={dashboard.url}
              className={classes.iframe}
              onLoad={handleIframeLoad}
              style={{ display: loading ? 'none' : 'block' }}
              title={dashboard.name}
            />
          </TabPanel>
        ))}
      </Paper>
    </div>
  );
};

export default Metrics; 