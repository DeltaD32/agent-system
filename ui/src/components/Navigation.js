import React from 'react';
import { AppBar, Toolbar, Typography, Button, makeStyles } from '@material-ui/core';
import { Link as RouterLink } from 'react-router-dom';
import DashboardIcon from '@material-ui/icons/Dashboard';
import AssignmentIcon from '@material-ui/icons/Assignment';
import BubbleChartIcon from '@material-ui/icons/BubbleChart';
import TimelineIcon from '@material-ui/icons/Timeline';
import SettingsIcon from '@material-ui/icons/Settings';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import AuthService from '../services/AuthService';

const useStyles = makeStyles((theme) => ({
  appBar: {
    zIndex: theme.zIndex.drawer + 1,
  },
  menuButton: {
    marginRight: theme.spacing(2),
    color: 'white',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    '& svg': {
      marginRight: theme.spacing(1),
    },
  },
  title: {
    flexGrow: 1,
    color: 'white',
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'none',
    },
  },
  toolbar: {
    justifyContent: 'space-between',
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
  },
  leftButtons: {
    display: 'flex',
    alignItems: 'center',
  },
  rightButtons: {
    display: 'flex',
    alignItems: 'center',
  },
}));

function Navigation() {
  const classes = useStyles();

  const handleLogout = () => {
    AuthService.logout();
  };

  return (
    <AppBar position="fixed" className={classes.appBar}>
      <Toolbar className={classes.toolbar}>
        <div className={classes.leftButtons}>
          <Typography
            component={RouterLink}
            to="/"
            variant="h6"
            className={classes.title}
          >
            Agent System
          </Typography>
          <Button
            component={RouterLink}
            to="/"
            className={classes.menuButton}
            startIcon={<DashboardIcon />}
          >
            Dashboard
          </Button>
          <Button
            component={RouterLink}
            to="/projects"
            className={classes.menuButton}
            startIcon={<AssignmentIcon />}
          >
            Projects
          </Button>
          <Button
            component={RouterLink}
            to="/agents"
            className={classes.menuButton}
            startIcon={<BubbleChartIcon />}
          >
            Agents
          </Button>
          <Button
            component={RouterLink}
            to="/metrics"
            className={classes.menuButton}
            startIcon={<TimelineIcon />}
          >
            Metrics
          </Button>
        </div>
        <div className={classes.rightButtons}>
          <Button
            component={RouterLink}
            to="/settings"
            className={classes.menuButton}
            startIcon={<SettingsIcon />}
          >
            Settings
          </Button>
          <Button
            className={classes.menuButton}
            startIcon={<ExitToAppIcon />}
            onClick={handleLogout}
          >
            Logout
          </Button>
        </div>
      </Toolbar>
    </AppBar>
  );
}

export default Navigation; 