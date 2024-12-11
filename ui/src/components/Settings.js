import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  makeStyles,
  Grid,
  Switch,
  FormControlLabel,
  Button,
  TextField,
  Divider,
  IconButton,
  Card,
  CardContent,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@material-ui/core';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Security as SecurityIcon,
  Notifications as NotificationsIcon,
  Palette as PaletteIcon,
  Language as LanguageIcon,
  Storage as StorageIcon,
  Speed as PerformanceIcon,
  Code as IntegrationIcon,
  BugReport as DebugIcon,
} from '@material-ui/icons';
import { useNotification } from '../context/NotificationContext';
import axios from 'axios';

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
  section: {
    marginBottom: theme.spacing(4),
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
    '& svg': {
      marginRight: theme.spacing(1),
      color: theme.palette.primary.main,
    },
  },
  card: {
    height: '100%',
    transition: 'transform 0.2s, box-shadow 0.2s',
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: theme.shadows[4],
    },
  },
  settingGroup: {
    marginBottom: theme.spacing(3),
  },
  divider: {
    margin: theme.spacing(3, 0),
  },
  actionButton: {
    marginRight: theme.spacing(1),
    borderRadius: theme.shape.borderRadius * 2,
  },
  refreshButton: {
    marginLeft: 'auto',
  },
  formControl: {
    marginBottom: theme.spacing(2),
    minWidth: '100%',
  },
}));

const SettingCard = ({ icon: Icon, title, description, children }) => {
  const classes = useStyles();
  return (
    <Card className={classes.card}>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <Icon style={{ marginRight: 8, color: '#1976d2' }} />
          <Typography variant="h6">{title}</Typography>
        </Box>
        <Typography variant="body2" color="textSecondary" paragraph>
          {description}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
};

function Settings() {
  const classes = useStyles();
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    general: {
      systemName: 'AI Agent System',
      language: 'en',
      theme: 'light',
      timezone: 'UTC',
    },
    security: {
      twoFactorAuth: false,
      sessionTimeout: 30,
      passwordExpiration: 90,
      strongPasswordPolicy: true,
    },
    notifications: {
      email: true,
      desktop: true,
      slack: false,
      taskUpdates: true,
      systemAlerts: true,
    },
    performance: {
      maxWorkers: 5,
      taskTimeout: 300,
      retryAttempts: 3,
      cacheEnabled: true,
    },
    storage: {
      backupEnabled: true,
      backupInterval: 24,
      retentionDays: 30,
      compressionEnabled: true,
    },
    integrations: {
      githubEnabled: false,
      slackEnabled: false,
      jiraEnabled: false,
    },
    debug: {
      loggingLevel: 'info',
      debugMode: false,
      telemetryEnabled: true,
    },
  });
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get('/api/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setSettings(response.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
      showNotification('Failed to fetch settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (section) => {
    try {
      const token = localStorage.getItem('auth_token');
      await axios.put(`/api/settings/${section}`, settings[section], {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });
      showNotification('Settings saved successfully', 'success');
    } catch (error) {
      console.error('Error saving settings:', error);
      showNotification('Failed to save settings', 'error');
    }
  };

  const handleReset = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      await axios.post('/api/settings/reset', {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      showNotification('Settings reset successfully', 'success');
      setResetDialogOpen(false);
      fetchSettings();
    } catch (error) {
      console.error('Error resetting settings:', error);
      showNotification('Failed to reset settings', 'error');
    }
  };

  const updateSetting = (section, key, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  return (
    <Container maxWidth="lg" className={classes.root}>
      <Box className={classes.header}>
        <Typography variant="h4" gutterBottom>
          System Settings
        </Typography>
        <Typography variant="subtitle1" paragraph>
          Configure and manage your AI Agent System settings
        </Typography>
        <Box display="flex" alignItems="center">
          <Button
            variant="contained"
            color="secondary"
            startIcon={<RefreshIcon />}
            onClick={() => setResetDialogOpen(true)}
            className={classes.actionButton}
          >
            Reset to Defaults
          </Button>
          <Tooltip title="Refresh Settings">
            <IconButton
              color="inherit"
              onClick={fetchSettings}
              className={classes.refreshButton}
              disabled={loading}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" m={4}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <SettingCard
              icon={SecurityIcon}
              title="Security"
              description="Configure security settings and access controls"
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.security.twoFactorAuth}
                    onChange={(e) => updateSetting('security', 'twoFactorAuth', e.target.checked)}
                    color="primary"
                  />
                }
                label="Two-Factor Authentication"
              />
              <TextField
                fullWidth
                label="Session Timeout (minutes)"
                type="number"
                value={settings.security.sessionTimeout}
                onChange={(e) => updateSetting('security', 'sessionTimeout', parseInt(e.target.value))}
                margin="normal"
              />
              <Button
                variant="contained"
                color="primary"
                startIcon={<SaveIcon />}
                onClick={() => handleSave('security')}
                className={classes.actionButton}
              >
                Save Security Settings
              </Button>
            </SettingCard>
          </Grid>

          <Grid item xs={12} md={6}>
            <SettingCard
              icon={NotificationsIcon}
              title="Notifications"
              description="Manage notification preferences and channels"
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.notifications.email}
                    onChange={(e) => updateSetting('notifications', 'email', e.target.checked)}
                    color="primary"
                  />
                }
                label="Email Notifications"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.notifications.desktop}
                    onChange={(e) => updateSetting('notifications', 'desktop', e.target.checked)}
                    color="primary"
                  />
                }
                label="Desktop Notifications"
              />
              <Button
                variant="contained"
                color="primary"
                startIcon={<SaveIcon />}
                onClick={() => handleSave('notifications')}
                className={classes.actionButton}
              >
                Save Notification Settings
              </Button>
            </SettingCard>
          </Grid>

          <Grid item xs={12} md={6}>
            <SettingCard
              icon={PerformanceIcon}
              title="Performance"
              description="Configure system performance and optimization settings"
            >
              <TextField
                fullWidth
                label="Maximum Workers"
                type="number"
                value={settings.performance.maxWorkers}
                onChange={(e) => updateSetting('performance', 'maxWorkers', parseInt(e.target.value))}
                margin="normal"
              />
              <TextField
                fullWidth
                label="Task Timeout (seconds)"
                type="number"
                value={settings.performance.taskTimeout}
                onChange={(e) => updateSetting('performance', 'taskTimeout', parseInt(e.target.value))}
                margin="normal"
              />
              <Button
                variant="contained"
                color="primary"
                startIcon={<SaveIcon />}
                onClick={() => handleSave('performance')}
                className={classes.actionButton}
              >
                Save Performance Settings
              </Button>
            </SettingCard>
          </Grid>

          <Grid item xs={12} md={6}>
            <SettingCard
              icon={StorageIcon}
              title="Storage"
              description="Configure data storage and backup settings"
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.storage.backupEnabled}
                    onChange={(e) => updateSetting('storage', 'backupEnabled', e.target.checked)}
                    color="primary"
                  />
                }
                label="Enable Automatic Backups"
              />
              <TextField
                fullWidth
                label="Backup Interval (hours)"
                type="number"
                value={settings.storage.backupInterval}
                onChange={(e) => updateSetting('storage', 'backupInterval', parseInt(e.target.value))}
                margin="normal"
              />
              <Button
                variant="contained"
                color="primary"
                startIcon={<SaveIcon />}
                onClick={() => handleSave('storage')}
                className={classes.actionButton}
              >
                Save Storage Settings
              </Button>
            </SettingCard>
          </Grid>

          <Grid item xs={12} md={6}>
            <SettingCard
              icon={IntegrationIcon}
              title="Integrations"
              description="Manage external service integrations"
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.integrations.githubEnabled}
                    onChange={(e) => updateSetting('integrations', 'githubEnabled', e.target.checked)}
                    color="primary"
                  />
                }
                label="GitHub Integration"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.integrations.slackEnabled}
                    onChange={(e) => updateSetting('integrations', 'slackEnabled', e.target.checked)}
                    color="primary"
                  />
                }
                label="Slack Integration"
              />
              <Button
                variant="contained"
                color="primary"
                startIcon={<SaveIcon />}
                onClick={() => handleSave('integrations')}
                className={classes.actionButton}
              >
                Save Integration Settings
              </Button>
            </SettingCard>
          </Grid>

          <Grid item xs={12} md={6}>
            <SettingCard
              icon={DebugIcon}
              title="Debug"
              description="Configure debugging and logging settings"
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.debug.debugMode}
                    onChange={(e) => updateSetting('debug', 'debugMode', e.target.checked)}
                    color="primary"
                  />
                }
                label="Debug Mode"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.debug.telemetryEnabled}
                    onChange={(e) => updateSetting('debug', 'telemetryEnabled', e.target.checked)}
                    color="primary"
                  />
                }
                label="Enable Telemetry"
              />
              <Button
                variant="contained"
                color="primary"
                startIcon={<SaveIcon />}
                onClick={() => handleSave('debug')}
                className={classes.actionButton}
              >
                Save Debug Settings
              </Button>
            </SettingCard>
          </Grid>
        </Grid>
      )}

      <Dialog
        open={resetDialogOpen}
        onClose={() => setResetDialogOpen(false)}
      >
        <DialogTitle>Reset Settings</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to reset all settings to their default values? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleReset} color="secondary">
            Reset Settings
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default Settings; 