import React from 'react';
import {
  Paper,
  Typography,
  Grid,
  makeStyles,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  Divider,
  Button,
  TextField,
} from '@material-ui/core';
import {
  Storage as DatabaseIcon,
  Queue as QueueIcon,
  Code as ApiIcon,
  Dashboard as DashboardIcon,
  Settings as SettingsIcon,
} from '@material-ui/icons';

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
  },
  paper: {
    padding: theme.spacing(3),
  },
  section: {
    marginBottom: theme.spacing(4),
  },
  button: {
    marginTop: theme.spacing(2),
  },
  textField: {
    marginBottom: theme.spacing(2),
  },
}));

function Settings() {
  const classes = useStyles();
  const [settings, setSettings] = React.useState({
    enableMetrics: true,
    enableLogging: true,
    enableWebSocket: true,
    enableDebug: false,
  });

  const handleToggle = (setting) => () => {
    setSettings((prev) => ({
      ...prev,
      [setting]: !prev[setting],
    }));
  };

  const serviceLinks = [
    {
      name: 'Grafana',
      url: 'http://localhost:3001',
      icon: <DashboardIcon />,
      description: 'Metrics and Monitoring Dashboard',
    },
    {
      name: 'RabbitMQ Management',
      url: 'http://localhost:15672',
      icon: <QueueIcon />,
      description: 'Message Queue Management Interface',
    },
    {
      name: 'Prometheus',
      url: 'http://localhost:9090',
      icon: <DatabaseIcon />,
      description: 'Metrics Storage and Querying',
    },
    {
      name: 'API Documentation',
      url: 'http://localhost:5000/docs',
      icon: <ApiIcon />,
      description: 'REST API Documentation',
    },
  ];

  return (
    <div className={classes.root}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper className={classes.paper}>
            <div className={classes.section}>
              <Typography variant="h5" gutterBottom>
                System Settings
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <SettingsIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Enable Metrics Collection"
                    secondary="Collect and store system metrics"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      edge="end"
                      checked={settings.enableMetrics}
                      onChange={handleToggle('enableMetrics')}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemIcon>
                    <SettingsIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Enable System Logging"
                    secondary="Log system events and errors"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      edge="end"
                      checked={settings.enableLogging}
                      onChange={handleToggle('enableLogging')}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemIcon>
                    <SettingsIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Enable WebSocket Updates"
                    secondary="Real-time updates via WebSocket"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      edge="end"
                      checked={settings.enableWebSocket}
                      onChange={handleToggle('enableWebSocket')}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemIcon>
                    <SettingsIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Debug Mode"
                    secondary="Enable detailed debug logging"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      edge="end"
                      checked={settings.enableDebug}
                      onChange={handleToggle('enableDebug')}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              </List>
              <Button
                variant="contained"
                color="primary"
                className={classes.button}
                fullWidth
              >
                Save Settings
              </Button>
            </div>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper className={classes.paper}>
            <div className={classes.section}>
              <Typography variant="h5" gutterBottom>
                Service Links
              </Typography>
              <List>
                {serviceLinks.map((service) => (
                  <React.Fragment key={service.name}>
                    <ListItem
                      button
                      component="a"
                      href={service.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ListItemIcon>{service.icon}</ListItemIcon>
                      <ListItemText
                        primary={service.name}
                        secondary={service.description}
                      />
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            </div>
          </Paper>
        </Grid>
      </Grid>
    </div>
  );
}

export default Settings; 