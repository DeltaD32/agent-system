import React from 'react';
import { Container, Grid, Paper, Typography, makeStyles } from '@material-ui/core';
import SystemStatus from './SystemStatus';
import ErrorBoundary from './ErrorBoundary';

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
    padding: theme.spacing(3),
    paddingTop: theme.spacing(2),
    backgroundColor: theme.palette.background.default,
    minHeight: '100%',
  },
  paper: {
    padding: theme.spacing(3),
    display: 'flex',
    overflow: 'auto',
    flexDirection: 'column',
    backgroundColor: theme.palette.background.paper,
    height: '100%',
  },
  title: {
    marginBottom: theme.spacing(3),
    color: theme.palette.text.primary,
  },
  contentWrapper: {
    flex: 1,
  },
}));

function Dashboard() {
  const classes = useStyles();

  return (
    <Container maxWidth="lg" className={classes.root}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h4" className={classes.title}>
            Dashboard
          </Typography>
        </Grid>
        <Grid item xs={12} className={classes.contentWrapper}>
          <Paper className={classes.paper} elevation={2}>
            <ErrorBoundary>
              <SystemStatus />
            </ErrorBoundary>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}

export default Dashboard; 