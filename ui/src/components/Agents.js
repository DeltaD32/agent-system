import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Grid,
  Paper,
  Box,
  makeStyles,
  Card,
  CardContent,
  CardActions,
  Button,
  IconButton,
  Chip,
  Avatar,
  CircularProgress,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Settings as SettingsIcon,
  Memory as AgentIcon,
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
  agentCard: {
    height: '100%',
    transition: 'transform 0.2s, box-shadow 0.2s',
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: theme.shadows[4],
    },
  },
  agentIcon: {
    fontSize: 40,
    color: theme.palette.primary.main,
    marginBottom: theme.spacing(2),
  },
  statusChip: {
    margin: theme.spacing(1),
  },
  actionButton: {
    margin: theme.spacing(1),
    borderRadius: theme.shape.borderRadius * 2,
  },
  refreshButton: {
    marginLeft: theme.spacing(2),
  },
  stats: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: theme.spacing(2),
    marginTop: theme.spacing(2),
    background: theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
  },
  statItem: {
    textAlign: 'center',
  },
  dialogContent: {
    minWidth: 400,
  },
}));

function Agents() {
  const classes = useStyles();
  const { showNotification } = useNotification();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [newAgentData, setNewAgentData] = useState({
    name: '',
    type: '',
    configuration: '',
  });

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get('/api/agents', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setAgents(response.data);
    } catch (error) {
      console.error('Error fetching agents:', error);
      showNotification('Failed to fetch agents', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleAgentAction = async (agentId, action) => {
    try {
      const token = localStorage.getItem('auth_token');
      await axios.post(`/api/agents/${agentId}/${action}`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      showNotification(`Agent ${action} successful`, 'success');
      fetchAgents();
    } catch (error) {
      console.error(`Error ${action} agent:`, error);
      showNotification(`Failed to ${action} agent`, 'error');
    }
  };

  const handleCreateAgent = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      await axios.post('/api/agents', newAgentData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });
      showNotification('Agent created successfully', 'success');
      setOpenDialog(false);
      setNewAgentData({ name: '', type: '', configuration: '' });
      fetchAgents();
    } catch (error) {
      console.error('Error creating agent:', error);
      setError(error.response?.data?.error || 'Failed to create agent');
    }
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'running':
        return 'primary';
      case 'stopped':
        return 'default';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Container maxWidth="lg" className={classes.root}>
      <Box className={classes.header}>
        <Typography variant="h4" gutterBottom>
          AI Agents
        </Typography>
        <Typography variant="subtitle1" paragraph>
          Manage and monitor your AI agents
        </Typography>
        <Box display="flex" alignItems="center">
          <Button
            variant="contained"
            color="secondary"
            startIcon={<AddIcon />}
            onClick={() => setOpenDialog(true)}
            className={classes.actionButton}
          >
            Create New Agent
          </Button>
          <Tooltip title="Refresh">
            <IconButton
              color="inherit"
              onClick={fetchAgents}
              className={classes.refreshButton}
              disabled={loading}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {loading ? (
          <Box display="flex" justifyContent="center" width="100%" mt={4}>
            <CircularProgress />
          </Box>
        ) : (
          agents.map((agent) => (
            <Grid item xs={12} sm={6} md={4} key={agent.id}>
              <Card className={classes.agentCard}>
                <CardContent>
                  <AgentIcon className={classes.agentIcon} />
                  <Typography variant="h6" gutterBottom>
                    {agent.name}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" paragraph>
                    Type: {agent.type}
                  </Typography>
                  <Chip
                    label={agent.status}
                    color={getStatusColor(agent.status)}
                    className={classes.statusChip}
                  />
                  <Box className={classes.stats}>
                    <Box className={classes.statItem}>
                      <Typography variant="h6">{agent.tasksCompleted}</Typography>
                      <Typography variant="caption">Tasks</Typography>
                    </Box>
                    <Box className={classes.statItem}>
                      <Typography variant="h6">{agent.uptime}</Typography>
                      <Typography variant="caption">Uptime</Typography>
                    </Box>
                    <Box className={classes.statItem}>
                      <Typography variant="h6">{agent.efficiency}%</Typography>
                      <Typography variant="caption">Efficiency</Typography>
                    </Box>
                  </Box>
                </CardContent>
                <CardActions>
                  {agent.status === 'stopped' ? (
                    <Button
                      size="small"
                      color="primary"
                      startIcon={<StartIcon />}
                      onClick={() => handleAgentAction(agent.id, 'start')}
                    >
                      Start
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      color="secondary"
                      startIcon={<StopIcon />}
                      onClick={() => handleAgentAction(agent.id, 'stop')}
                    >
                      Stop
                    </Button>
                  )}
                  <Button
                    size="small"
                    startIcon={<SettingsIcon />}
                    onClick={() => handleAgentAction(agent.id, 'configure')}
                  >
                    Configure
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>Create New Agent</DialogTitle>
        <DialogContent className={classes.dialogContent}>
          <TextField
            autoFocus
            margin="dense"
            label="Agent Name"
            fullWidth
            value={newAgentData.name}
            onChange={(e) => setNewAgentData({ ...newAgentData, name: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Agent Type"
            fullWidth
            value={newAgentData.type}
            onChange={(e) => setNewAgentData({ ...newAgentData, type: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Configuration"
            fullWidth
            multiline
            rows={4}
            value={newAgentData.configuration}
            onChange={(e) => setNewAgentData({ ...newAgentData, configuration: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={handleCreateAgent} color="primary" variant="contained">
            Create
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

export default Agents; 