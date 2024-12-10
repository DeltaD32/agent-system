import React, { useState } from 'react';
import {
  makeStyles,
  Paper,
  Tabs,
  Tab,
  Box,
  Typography,
  CircularProgress,
} from '@material-ui/core';
import {
  Timeline as TimelineIcon,
  Memory as SystemIcon,
  Group as UserIcon,
  Storage as DatabaseIcon,
} from '@material-ui/icons';

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(3),
  },
  paper: {
    width: '100%',
    height: 'calc(100vh - 180px)',
    overflow: 'hidden',
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
  },
  tabIcon: {
    marginRight: theme.spacing(1),
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
}));

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`metrics-tabpanel-${index}`}
      {...other}
      style={{ height: 'calc(100% - 48px)' }}
    >
      {value === index && (
        <Box style={{ height: '100%' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const Metrics = () => {
  const classes = useStyles();
  const [value, setValue] = useState(0);
  const [loading, setLoading] = useState(true);

  // Get auth token for Grafana
  const token = localStorage.getItem('grafana_token');

  const dashboards = [
    {
      name: 'System Overview',
      icon: <SystemIcon className={classes.tabIcon} />,
      url: `/grafana/d/system-overview/system-overview?orgId=1&kiosk&theme=light&auth_token=${token}`,
    },
    {
      name: 'User Activity',
      icon: <UserIcon className={classes.tabIcon} />,
      url: `/grafana/d/user-activity/user-activity?orgId=1&kiosk&theme=light&auth_token=${token}`,
    },
    {
      name: 'Task Metrics',
      icon: <TimelineIcon className={classes.tabIcon} />,
      url: `/grafana/d/task-metrics/task-metrics?orgId=1&kiosk&theme=light&auth_token=${token}`,
    },
    {
      name: 'Database Stats',
      icon: <DatabaseIcon className={classes.tabIcon} />,
      url: `/grafana/d/database-stats/database-stats?orgId=1&kiosk&theme=light&auth_token=${token}`,
    },
  ];

  const handleChange = (event, newValue) => {
    setValue(newValue);
    setLoading(true);
  };

  const handleIframeLoad = () => {
    setLoading(false);
  };

  return (
    <div className={classes.root}>
      <Paper className={classes.paper}>
        <Tabs
          value={value}
          onChange={handleChange}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          {dashboards.map((dashboard, index) => (
            <Tab
              key={index}
              icon={dashboard.icon}
              label={dashboard.name}
            />
          ))}
        </Tabs>

        {dashboards.map((dashboard, index) => (
          <TabPanel key={index} value={value} index={index}>
            {loading && (
              <div className={classes.loadingContainer}>
                <CircularProgress />
              </div>
            )}
            <iframe
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