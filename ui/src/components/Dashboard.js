import React from 'react';
import { Container, Grid, Paper, Typography, makeStyles } from '@material-ui/core';
import SystemStatus from './SystemStatus';

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
    padding: theme.spacing(3),
  },
  paper: {
    padding: theme.spacing(2),
    display: 'flex',
    overflow: 'auto',
    flexDirection: 'column',
  },
  fixedHeight: {
    height: 240,
  },
}));

function Dashboard() {
  const classes = useStyles();

  return (
    <div className={classes.root}>
      <Container maxWidth="lg">
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography variant="h4" gutterBottom>
              Dashboard
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <Paper className={classes.paper}>
              <SystemStatus />
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </div>
  );
}

export default Dashboard; 