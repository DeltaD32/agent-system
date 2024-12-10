import React, { useState, useEffect } from 'react';
import {
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  Paper,
  makeStyles,
} from '@material-ui/core';
import {
  Assignment as TaskIcon,
  Comment as CommentIcon,
  Person as PersonIcon,
  Update as UpdateIcon,
} from '@material-ui/icons';

const useStyles = makeStyles((theme) => ({
  root: {
    width: '100%',
    maxHeight: 400,
    overflow: 'auto',
    backgroundColor: theme.palette.background.paper,
  },
  inline: {
    display: 'inline',
  },
  timestamp: {
    color: theme.palette.text.secondary,
    fontSize: '0.875rem',
  },
  avatar: {
    backgroundColor: theme.palette.primary.main,
  },
}));

const ActivityFeed = () => {
  const classes = useStyles();
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const response = await fetch('/api/activities');
        const data = await response.json();
        setActivities(data);
      } catch (error) {
        console.error('Error fetching activities:', error);
      }
    };

    fetchActivities();
    
    // Set up WebSocket connection for real-time updates
    const ws = new WebSocket('ws://localhost:5000/ws/activities');
    
    ws.onmessage = (event) => {
      const newActivity = JSON.parse(event.data);
      setActivities(prev => [newActivity, ...prev]);
    };

    return () => ws.close();
  }, []);

  const getActivityIcon = (type) => {
    switch (type) {
      case 'task':
        return <TaskIcon />;
      case 'comment':
        return <CommentIcon />;
      case 'user':
        return <PersonIcon />;
      default:
        return <UpdateIcon />;
    }
  };

  return (
    <Paper className={classes.root}>
      <List>
        {activities.map((activity) => (
          <ListItem alignItems="flex-start" key={activity.id}>
            <ListItemAvatar>
              <Avatar className={classes.avatar}>
                {getActivityIcon(activity.type)}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={activity.title}
              secondary={
                <>
                  <Typography
                    component="span"
                    variant="body2"
                    className={classes.inline}
                    color="textPrimary"
                  >
                    {activity.description}
                  </Typography>
                  <br />
                  <span className={classes.timestamp}>
                    {new Date(activity.timestamp).toLocaleString()}
                  </span>
                </>
              }
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};

export default ActivityFeed; 