import React, { useState, useEffect } from 'react';
import { useLocation, useHistory, useParams } from 'react-router-dom';
import {
  Container,
  Typography,
  TextField,
  Button,
  Grid,
  CircularProgress,
  Box,
  makeStyles,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Snackbar,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Divider,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tooltip,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Assignment as ProjectIcon,
  Refresh as RefreshIcon,
} from '@material-ui/icons';
import axios from 'axios';
import { useNotification } from '../context/NotificationContext';

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
    padding: theme.spacing(3),
    backgroundColor: theme.palette.background.default,
  },
  header: {
    marginBottom: theme.spacing(4),
    padding: theme.spacing(4),
    background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
    color: theme.palette.primary.contrastText,
    borderRadius: theme.shape.borderRadius * 2,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    marginTop: theme.spacing(2),
  },
  backButton: {
    marginRight: theme.spacing(2),
  },
  paper: {
    padding: theme.spacing(3),
    marginBottom: theme.spacing(3),
    borderRadius: theme.shape.borderRadius,
    transition: 'transform 0.2s, box-shadow 0.2s',
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: theme.shadows[4],
    },
  },
  form: {
    '& .MuiTextField-root': {
      marginBottom: theme.spacing(2),
    },
  },
  templateSelect: {
    marginBottom: theme.spacing(2),
    minWidth: '100%',
  },
  submitButton: {
    marginTop: theme.spacing(2),
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(1, 3),
  },
  projectCard: {
    height: '100%',
    transition: 'transform 0.2s, box-shadow 0.2s',
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: theme.shadows[4],
    },
  },
  projectIcon: {
    fontSize: 40,
    color: theme.palette.primary.main,
    marginBottom: theme.spacing(2),
  },
  deleteButton: {
    color: theme.palette.error.main,
  },
  detailsSection: {
    marginTop: theme.spacing(3),
  },
  detailsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
  },
  taskList: {
    marginTop: theme.spacing(2),
  },
  taskItem: {
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(1),
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  editField: {
    marginBottom: theme.spacing(2),
  },
  statusChip: {
    margin: theme.spacing(0, 1),
  },
}));

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

function Projects() {
  const classes = useStyles();
  const location = useLocation();
  const history = useHistory();
  const { id } = useParams();
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [error, setError] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templates] = useState(DEFAULT_TEMPLATES);
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editedProject, setEditedProject] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    if (location.pathname === '/projects') {
      fetchProjects();
    } else if (id) {
      fetchProjectDetails(id);
    }
  }, [location.pathname, id]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get('/api/projects', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setProjects(response.data);
    } catch (error) {
      console.error('Error fetching projects:', error);
      showNotification('Failed to fetch projects', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectDetails = async (projectId) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`/api/projects/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setCurrentProject(response.data);
      setEditedProject({
        name: response.data.name,
        description: response.data.description,
      });
    } catch (error) {
      console.error('Error fetching project details:', error);
      showNotification('Failed to fetch project details', 'error');
      history.push('/projects');
    } finally {
      setLoading(false);
    }
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!projectName.trim()) {
      setError('Project name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('auth_token');
      const projectData = {
        name: projectName.trim(),
        description: projectDescription.trim(),
        template_id: selectedTemplate || undefined
      };

      await axios.post('/api/projects', projectData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      showNotification('Project created successfully', 'success');
      
      // Clear form and refresh projects list
      setProjectName('');
      setProjectDescription('');
      setSelectedTemplate('');
      
      // Fetch updated projects list and redirect
      await fetchProjects();
      history.push('/projects');
    } catch (error) {
      console.error('Error creating project:', error);
      if (error.response?.status === 401) {
        showNotification('Please log in to create a project', 'error');
        history.push('/login');
      } else {
        setError(error.response?.data?.error || 'Failed to create project. Please try again.');
        showNotification('Failed to create project. Please try again.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProject = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      await axios.put(`/api/projects/${currentProject.id}`, editedProject, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });
      showNotification('Project updated successfully', 'success');
      setIsEditing(false);
      fetchProjectDetails(currentProject.id);
    } catch (error) {
      console.error('Error updating project:', error);
      showNotification('Failed to update project', 'error');
    }
  };

  const handleDeleteProject = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      await axios.delete(`/api/projects/${currentProject.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      showNotification('Project deleted successfully', 'success');
      setDeleteDialogOpen(false);
      history.push('/projects');
    } catch (error) {
      console.error('Error deleting project:', error);
      showNotification(error.response?.data?.error || 'Failed to delete project', 'error');
    }
  };

  const renderProjectsList = () => (
    <>
      <Box className={classes.header}>
        <Typography variant="h4" gutterBottom>
          Projects
        </Typography>
        <Typography variant="subtitle1" paragraph>
          Manage and monitor your AI-powered projects
        </Typography>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<AddIcon />}
          onClick={() => history.push('/projects/new')}
          className={classes.submitButton}
        >
          Create New Project
        </Button>
      </Box>

      <Grid container spacing={3}>
        {projects.map((project) => (
          <Grid item xs={12} sm={6} md={4} key={project.id}>
            <Card className={classes.projectCard}>
              <CardContent>
                <ProjectIcon className={classes.projectIcon} />
                <Typography variant="h6" gutterBottom>
                  {project.name}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {project.description}
                </Typography>
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  color="primary"
                  onClick={() => history.push(`/projects/${project.id}`)}
                >
                  View Details
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  );

  const renderProjectDetails = () => (
    <>
      <Box className={classes.header}>
        <Box className={classes.headerActions}>
          <IconButton
            color="inherit"
            onClick={() => history.push('/projects')}
            className={classes.backButton}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4">
            {isEditing ? 'Edit Project' : currentProject?.name}
          </Typography>
        </Box>
      </Box>

      <Paper className={classes.paper}>
        {isEditing ? (
          <form className={classes.form}>
            <TextField
              fullWidth
              label="Project Name"
              value={editedProject.name}
              onChange={(e) => setEditedProject({ ...editedProject, name: e.target.value })}
              className={classes.editField}
            />
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Project Description"
              value={editedProject.description}
              onChange={(e) => setEditedProject({ ...editedProject, description: e.target.value })}
              className={classes.editField}
            />
            <Box display="flex" justifyContent="flex-end">
              <Button
                startIcon={<CancelIcon />}
                onClick={() => setIsEditing(false)}
                style={{ marginRight: 8 }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<SaveIcon />}
                onClick={handleUpdateProject}
              >
                Save Changes
              </Button>
            </Box>
          </form>
        ) : (
          <>
            <Box className={classes.detailsHeader}>
              <Typography variant="h6">Project Details</Typography>
              <Box>
                <IconButton onClick={() => setIsEditing(true)}>
                  <EditIcon />
                </IconButton>
                <IconButton
                  className={classes.deleteButton}
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            </Box>
            <Divider />
            <Box mt={2}>
              <Typography variant="body1" paragraph>
                {currentProject?.description}
              </Typography>
            </Box>
            <Box className={classes.detailsSection}>
              <Typography variant="h6" gutterBottom>
                Tasks
              </Typography>
              <List className={classes.taskList}>
                {currentProject?.tasks?.map((task, index) => (
                  <ListItem key={index} className={classes.taskItem}>
                    <ListItemText
                      primary={task.description}
                      secondary={`Status: ${task.status}`}
                    />
                    <ListItemSecondaryAction>
                      <IconButton edge="end" size="small">
                        <EditIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          </>
        )}
      </Paper>
    </>
  );

  const renderNewProjectForm = () => (
    <>
      <Box className={classes.header}>
        <Box className={classes.headerActions}>
          <IconButton
            color="inherit"
            onClick={() => history.push('/projects')}
            className={classes.backButton}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4">Create New Project</Typography>
        </Box>
        <Typography variant="subtitle1" paragraph>
          Start a new AI-powered project with our templates
        </Typography>
      </Box>

      <Paper className={classes.paper}>
        <form onSubmit={handleSubmit} className={classes.form}>
          <FormControl className={classes.templateSelect}>
            <InputLabel>Project Template</InputLabel>
            <Select
              value={selectedTemplate}
              onChange={handleTemplateChange}
              disabled={loading}
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
            required
            label="Project Name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            disabled={loading}
            error={!projectName && error}
            helperText={!projectName && error ? 'Project name is required' : ''}
          />
          
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Project Description"
            value={projectDescription}
            onChange={(e) => setProjectDescription(e.target.value)}
            disabled={loading}
          />
          
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            className={classes.submitButton}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <AddIcon />}
          >
            {loading ? 'Creating Project...' : 'Create Project'}
          </Button>
        </form>
      </Paper>
    </>
  );

  return (
    <Container maxWidth="lg" className={classes.root}>
      {location.pathname === '/projects' && renderProjectsList()}
      {location.pathname === '/projects/new' && renderNewProjectForm()}
      {id && renderProjectDetails()}

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Project</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this project? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={handleDeleteProject} color="secondary">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setError('')} severity="error">
          {error}
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default Projects; 