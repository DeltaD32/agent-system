import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  makeStyles,
} from '@material-ui/core';
import {
  Add as AddIcon,
  FileCopy as CopyIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@material-ui/icons';
import { useNotification } from '../../context/NotificationContext';

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(3),
  },
  card: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.2s',
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: theme.shadows[4],
    },
  },
  templateActions: {
    marginTop: 'auto',
    justifyContent: 'flex-end',
  },
  addButton: {
    marginBottom: theme.spacing(3),
  },
}));

const ProjectTemplates = () => {
  const classes = useStyles();
  const { showNotification } = useNotification();
  const [templates, setTemplates] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tasks: [],
    milestones: [],
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/project-templates');
      const data = await response.json();
      setTemplates(data);
    } catch (error) {
      showNotification('Failed to fetch templates', 'error');
    }
  };

  const handleSave = async () => {
    try {
      const url = selectedTemplate
        ? `/api/project-templates/${selectedTemplate.id}`
        : '/api/project-templates';
      
      const method = selectedTemplate ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to save template');
      
      showNotification(
        `Template ${selectedTemplate ? 'updated' : 'created'} successfully`,
        'success'
      );
      
      handleClose();
      fetchTemplates();
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  const handleDelete = async (templateId) => {
    try {
      await fetch(`/api/project-templates/${templateId}`, {
        method: 'DELETE',
      });
      
      showNotification('Template deleted successfully', 'success');
      fetchTemplates();
    } catch (error) {
      showNotification('Failed to delete template', 'error');
    }
  };

  const handleClose = () => {
    setDialogOpen(false);
    setSelectedTemplate(null);
    setFormData({
      name: '',
      description: '',
      tasks: [],
      milestones: [],
    });
  };

  return (
    <div className={classes.root}>
      <Button
        variant="contained"
        color="primary"
        startIcon={<AddIcon />}
        className={classes.addButton}
        onClick={() => setDialogOpen(true)}
      >
        Create Template
      </Button>

      <Grid container spacing={3}>
        {templates.map((template) => (
          <Grid item xs={12} sm={6} md={4} key={template.id}>
            <Card className={classes.card}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {template.name}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {template.description}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Tasks: {template.tasks.length}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Milestones: {template.milestones.length}
                </Typography>
              </CardContent>
              <CardActions className={classes.templateActions}>
                <IconButton
                  size="small"
                  onClick={() => {
                    setSelectedTemplate(template);
                    setFormData(template);
                    setDialogOpen(true);
                  }}
                >
                  <EditIcon />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => handleDelete(template.id)}
                >
                  <DeleteIcon />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => {
                    // Copy template logic
                    setFormData({
                      ...template,
                      name: `${template.name} (Copy)`,
                    });
                    setDialogOpen(true);
                  }}
                >
                  <CopyIcon />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog
        open={dialogOpen}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedTemplate ? 'Edit Template' : 'Create Template'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Template Name"
            fullWidth
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={4}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          {/* Add task and milestone editors here */}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="primary">
            Cancel
          </Button>
          <Button onClick={handleSave} color="primary" variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default ProjectTemplates; 