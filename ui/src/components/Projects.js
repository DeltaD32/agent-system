import React, { useState, useEffect } from 'react';
import { useLocation, useHistory } from 'react-router-dom';
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@material-ui/core';
import {
  Add as AddIcon,
  Save as SaveIcon,
} from '@material-ui/icons';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const DEFAULT_TEMPLATES = [
  {
    id: 'web-app',
    name: 'Web Application',
    description: 'Template for web application development projects',
    tasks: [
      { description: 'Setup project repository', status: 'pending' },
      { description: 'Create frontend structure', status: 'pending' },
      { description: 'Setup backend API', status: 'pending' },
      { description: 'Implement authentication', status: 'pending' },
      { description: 'Setup database', status: 'pending' },
    ],
  },
  {
    id: 'ml-project',
    name: 'Machine Learning Project',
    description: 'Template for machine learning projects',
    tasks: [
      { description: 'Data collection and preprocessing', status: 'pending' },
      { description: 'Exploratory data analysis', status: 'pending' },
      { description: 'Model development', status: 'pending' },
      { description: 'Model training and validation', status: 'pending' },
      { description: 'Deployment and monitoring', status: 'pending' },
    ],
  },
];

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
  templateSelect: {
    marginBottom: theme.spacing(2),
    minWidth: '100%',
  },
  saveTemplateButton: {
    marginTop: theme.spacing(2),
  },
}));

function Projects() {
  const classes = useStyles();
  const location = useLocation();
  const history = useHistory();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [error, setError] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    // Show create form if accessed via /projects/new
    setShowCreateForm(location.pathname === '/projects/new');
    
    // Load templates from localStorage or use defaults
    const savedTemplates = localStorage.getItem('projectTemplates');
    if (savedTemplates) {
      setTemplates([...DEFAULT_TEMPLATES, ...JSON.parse(savedTemplates)]);
    }

    // Load existing projects
    const fetchProjects = async () => {
      try {
        const response = await axios.get(`${API_URL}/projects`);
        setProjects(response.data);
      } catch (error) {
        console.error('Error fetching projects:', error);
        setError('Failed to fetch projects');
      }
    };

    fetchProjects();
  }, [location.pathname]);

  const handleTemplateChange = (event) => {
    const templateId = event.target.value;
    setSelectedTemplate(templateId);
    
    if (templateId) {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        setProjectName(template.name);
        setProjectDescription(template.description);
      }
    }
  };

  const handleSaveAsTemplate = () => {
    if (!projectName || !projectDescription) {
      setError('Please fill in project details before saving as template');
      return;
    }
    setSaveTemplateDialogOpen(true);
  };

  const handleSaveTemplate = () => {
    const newTemplate = {
      id: `template-${Date.now()}`,
      name: newTemplateName,
      description: projectDescription,
      tasks: [],
    };

    const updatedTemplates = [...templates, newTemplate];
    setTemplates(updatedTemplates);
    localStorage.setItem('projectTemplates', JSON.stringify(updatedTemplates));
    setSaveTemplateDialogOpen(false);
    setNewTemplateName('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_URL}/project`, {
        name: projectName,
        description: projectDescription,
        template_id: selectedTemplate || undefined,
      });

      // Clear form
      setProjectName('');
      setProjectDescription('');
      setSelectedTemplate('');

      // Redirect to projects list
      if (location.pathname === '/projects/new') {
        history.push('/projects');
      }

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
        <Grid item xs={12} md={showCreateForm ? 12 : 4}>
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
              <FormControl className={classes.templateSelect}>
                <InputLabel>Project Template</InputLabel>
                <Select
                  value={selectedTemplate}
                  onChange={handleTemplateChange}
                  autoFocus={showCreateForm}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {templates.map((template) => (
                    <MenuItem key={template.id} value={template.id}>
                      {template.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                fullWidth
                label="Project Name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                required
                autoFocus={!showCreateForm}
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
              <Box display="flex" gap={1} mt={2}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={loading}
                  className={classes.submitButton}
                >
                  {loading ? <CircularProgress size={24} /> : 'Create Project'}
                </Button>
                {!showCreateForm && (
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={handleSaveAsTemplate}
                    startIcon={<SaveIcon />}
                    className={classes.saveTemplateButton}
                  >
                    Save as Template
                  </Button>
                )}
                {showCreateForm && (
                  <Button
                    variant="outlined"
                    onClick={() => history.push('/projects')}
                  >
                    Cancel
                  </Button>
                )}
              </Box>
            </form>
          </Paper>
        </Grid>
        {!showCreateForm && (
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
        )}
      </Grid>

      {/* Save Template Dialog */}
      <Dialog
        open={saveTemplateDialogOpen}
        onClose={() => setSaveTemplateDialogOpen(false)}
      >
        <DialogTitle>Save as Template</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Template Name"
            fullWidth
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveTemplateDialogOpen(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={handleSaveTemplate} color="primary" variant="contained">
            Save Template
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default Projects; 