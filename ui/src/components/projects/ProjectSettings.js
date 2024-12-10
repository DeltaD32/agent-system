import React, { useState, useEffect } from 'react';
import {
  Paper,
  Tabs,
  Tab,
  Typography,
  TextField,
  Button,
  Switch,
  FormGroup,
  FormControlLabel,
  Divider,
  Grid,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  makeStyles,
} from '@material-ui/core';
import {
  Delete as DeleteIcon,
  Save as SaveIcon,
  Add as AddIcon,
  Warning as WarningIcon,
} from '@material-ui/icons';
import { useNotification } from '../../context/NotificationContext';

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(3),
  },
  section: {
    marginBottom: theme.spacing(4),
  },
  header: {
    marginBottom: theme.spacing(2),
  },
  dangerZone: {
    border: `1px solid ${theme.palette.error.main}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(2),
    marginTop: theme.spacing(4),
  },
  dangerButton: {
    color: theme.palette.error.main,
    borderColor: theme.palette.error.main,
  },
  tabContent: {
    padding: theme.spacing(3),
  },
  formControl: {
    minWidth: 200,
    marginBottom: theme.spacing(2),
  },
}));

const ProjectSettings = ({ projectId }) => {
  const classes = useStyles();
  const { showNotification } = useNotification();
  const [activeTab, setActiveTab] = useState(0);
  const [settings, setSettings] = useState({
    general: {
      name: '',
      description: '',
      visibility: 'private',
      tags: [],
    },
    notifications: {
      emailNotifications: true,
      pushNotifications: true,
      dailyDigest: false,
      mentionNotifications: true,
    },
    permissions: {
      defaultRole: 'member',
      allowGuests: false,
      requireApproval: true,
      roles: [],
    },
    integrations: {
      github: false,
      slack: false,
      jira: false,
    },
    workflow: {
      stages: [],
      autoAssignment: false,
      requireReview: true,
    },
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState('');

  useEffect(() => {
    fetchProjectSettings();
  }, [projectId]);

  const fetchProjectSettings = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/settings`);
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      showNotification('Failed to fetch project settings', 'error');
    }
  };

  const handleSave = async (section) => {
    try {
      await fetch(`/api/projects/${projectId}/settings/${section}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings[section]),
      });
      showNotification('Settings saved successfully', 'success');
    } catch (error) {
      showNotification('Failed to save settings', 'error');
    }
  };

  const handleDeleteProject = async () => {
    if (confirmDelete !== settings.general.name) {
      showNotification('Project name does not match', 'error');
      return;
    }

    try {
      await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });
      showNotification('Project deleted successfully', 'success');
      // Redirect to projects list
      window.location.href = '/projects';
    } catch (error) {
      showNotification('Failed to delete project', 'error');
    }
  };

  const renderGeneralSettings = () => (
    <div>
      <TextField
        fullWidth
        label="Project Name"
        value={settings.general.name}
        onChange={(e) => setSettings({
          ...settings,
          general: { ...settings.general, name: e.target.value }
        })}
        margin="normal"
      />
      <TextField
        fullWidth
        multiline
        rows={4}
        label="Description"
        value={settings.general.description}
        onChange={(e) => setSettings({
          ...settings,
          general: { ...settings.general, description: e.target.value }
        })}
        margin="normal"
      />
      <FormControl className={classes.formControl}>
        <InputLabel>Visibility</InputLabel>
        <Select
          value={settings.general.visibility}
          onChange={(e) => setSettings({
            ...settings,
            general: { ...settings.general, visibility: e.target.value }
          })}
        >
          <MenuItem value="private">Private</MenuItem>
          <MenuItem value="public">Public</MenuItem>
          <MenuItem value="team">Team Only</MenuItem>
        </Select>
      </FormControl>
      <Button
        variant="contained"
        color="primary"
        startIcon={<SaveIcon />}
        onClick={() => handleSave('general')}
      >
        Save Changes
      </Button>
    </div>
  );

  const renderNotificationSettings = () => (
    <FormGroup>
      <FormControlLabel
        control={
          <Switch
            checked={settings.notifications.emailNotifications}
            onChange={(e) => setSettings({
              ...settings,
              notifications: {
                ...settings.notifications,
                emailNotifications: e.target.checked
              }
            })}
          />
        }
        label="Email Notifications"
      />
      {/* Add more notification settings */}
      <Button
        variant="contained"
        color="primary"
        startIcon={<SaveIcon />}
        onClick={() => handleSave('notifications')}
      >
        Save Changes
      </Button>
    </FormGroup>
  );

  const renderPermissionSettings = () => (
    <div>
      <FormControl className={classes.formControl}>
        <InputLabel>Default Role</InputLabel>
        <Select
          value={settings.permissions.defaultRole}
          onChange={(e) => setSettings({
            ...settings,
            permissions: {
              ...settings.permissions,
              defaultRole: e.target.value
            }
          })}
        >
          <MenuItem value="admin">Admin</MenuItem>
          <MenuItem value="member">Member</MenuItem>
          <MenuItem value="viewer">Viewer</MenuItem>
        </Select>
      </FormControl>
      {/* Add more permission settings */}
      <Button
        variant="contained"
        color="primary"
        startIcon={<SaveIcon />}
        onClick={() => handleSave('permissions')}
      >
        Save Changes
      </Button>
    </div>
  );

  return (
    <Paper className={classes.root}>
      <Tabs
        value={activeTab}
        onChange={(e, newValue) => setActiveTab(newValue)}
        indicatorColor="primary"
        textColor="primary"
      >
        <Tab label="General" />
        <Tab label="Notifications" />
        <Tab label="Permissions" />
        <Tab label="Integrations" />
        <Tab label="Workflow" />
      </Tabs>

      <div className={classes.tabContent}>
        {activeTab === 0 && renderGeneralSettings()}
        {activeTab === 1 && renderNotificationSettings()}
        {activeTab === 2 && renderPermissionSettings()}
        {/* Add more tab content */}
      </div>

      <div className={classes.dangerZone}>
        <Typography variant="h6" color="error" gutterBottom>
          Danger Zone
        </Typography>
        <Typography variant="body2" gutterBottom>
          Once you delete a project, there is no going back. Please be certain.
        </Typography>
        <Button
          variant="outlined"
          className={classes.dangerButton}
          startIcon={<DeleteIcon />}
          onClick={() => setDeleteDialogOpen(true)}
        >
          Delete Project
        </Button>
      </div>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>
          <WarningIcon color="error" /> Delete Project
        </DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            This action cannot be undone. This will permanently delete the
            project "{settings.general.name}" and all associated data.
          </Typography>
          <TextField
            fullWidth
            label={`Type "${settings.general.name}" to confirm`}
            value={confirmDelete}
            onChange={(e) => setConfirmDelete(e.target.value)}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteProject}
            color="error"
            disabled={confirmDelete !== settings.general.name}
          >
            Delete Project
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default ProjectSettings; 