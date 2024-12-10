import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Chip,
  Box,
  makeStyles,
} from '@material-ui/core';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
  },
  paper: {
    padding: theme.spacing(3),
    marginBottom: theme.spacing(3),
  },
  form: {
    '& .MuiTextField-root': {
      marginBottom: theme.spacing(2),
    },
  },
  chip: {
    margin: theme.spacing(0.5),
  },
  taskList: {
    maxHeight: '300px',
    overflow: 'auto',
    marginTop: theme.spacing(2),
  },
  statusChip: {
    marginLeft: theme.spacing(1),
  },
}));

function Projects() {
  const classes = useStyles();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_URL}/project`, {
        name: projectName,
        description: projectDescription,
      });

      // Clear form
      setProjectName('');
      setProjectDescription('');

      // Refresh project list
      fetchProject(response.data.project_id);
    } catch (error) {
      console.error('Error creating project:', error);
      setError('Failed to create project. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchProject = async (projectId) => {
    try {
      const response = await axios.get(`${API_URL}/project/${projectId}`);
      setProjects(prev => {
        const newProjects = [...prev];
        const index = newProjects.findIndex(p => p.project.id === projectId);
        if (index !== -1) {
          newProjects[index] = response.data;
        } else {
          newProjects.unshift(response.data);
        }
        return newProjects;
      });
    } catch (error) {
      console.error('Error fetching project:', error);
      setError('Failed to fetch project details.');
    }
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'primary';
      case 'pending':
        return 'default';
      case 'in_progress':
        return 'secondary';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <div className={classes.root}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper className={classes.paper}>
            <Typography variant="h5" gutterBottom>
              Create New Project
            </Typography>
            {error && (
              <Typography color="error" gutterBottom>
                {error}
              </Typography>
            )}
            <form onSubmit={handleSubmit} className={classes.form}>
              <TextField
                fullWidth
                label="Project Name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                required
              />
              <TextField
                fullWidth
                label="Project Description"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                multiline
                rows={4}
                required
              />
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : 'Create Project'}
              </Button>
            </form>
          </Paper>
        </Grid>
        <Grid item xs={12} md={8}>
          <Paper className={classes.paper}>
            <Typography variant="h5" gutterBottom>
              Projects
            </Typography>
            <List>
              {projects.map((project) => (
                <Paper key={project.project.id} className={classes.paper}>
                  <Box display="flex" alignItems="center" marginBottom={2}>
                    <Typography variant="h6">
                      {project.project.name}
                    </Typography>
                    <Chip
                      label={project.project.status}
                      color={getStatusColor(project.project.status)}
                      className={classes.statusChip}
                    />
                  </Box>
                  <Typography variant="body1" paragraph>
                    {project.project.description}
                  </Typography>
                  <Typography variant="subtitle1" gutterBottom>
                    Tasks ({project.tasks.length})
                  </Typography>
                  <List className={classes.taskList}>
                    {project.tasks.map((task) => (
                      <ListItem key={task.id} divider>
                        <ListItemText
                          primary={task.description}
                          secondary={
                            <Box display="flex" alignItems="center" marginTop={1}>
                              <Chip
                                size="small"
                                label={task.status}
                                color={getStatusColor(task.status)}
                              />
                              {task.assigned_agent && (
                                <Chip
                                  size="small"
                                  label={`Agent: ${task.assigned_agent}`}
                                  className={classes.chip}
                                />
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              ))}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </div>
  );
}

export default Projects; 