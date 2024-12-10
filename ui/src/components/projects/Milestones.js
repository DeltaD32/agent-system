import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Button,
  List,
  ListItem,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  LinearProgress,
  Chip,
  makeStyles,
  Menu,
  MenuItem,
} from '@material-ui/core';
import {
  Add as AddIcon,
  MoreVert as MoreIcon,
  Flag as FlagIcon,
  CheckCircle as CompletedIcon,
  Schedule as PendingIcon,
} from '@material-ui/icons';
import { DatePicker } from '@material-ui/pickers';
import { useNotification } from '../../context/NotificationContext';

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(3),
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(3),
  },
  milestone: {
    marginBottom: theme.spacing(2),
    padding: theme.spacing(2),
    position: 'relative',
  },
  milestoneHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progress: {
    marginTop: theme.spacing(2),
  },
  chip: {
    margin: theme.spacing(0, 1),
  },
  statusCompleted: {
    backgroundColor: theme.palette.success.main,
    color: 'white',
  },
  statusPending: {
    backgroundColor: theme.palette.warning.main,
    color: 'white',
  },
  statusOverdue: {
    backgroundColor: theme.palette.error.main,
    color: 'white',
  },
}));

const Milestones = ({ projectId }) => {
  const classes = useStyles();
  const { showNotification } = useNotification();
  const [milestones, setMilestones] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: new Date(),
    progress: 0,
  });

  useEffect(() => {
    fetchMilestones();
  }, [projectId]);

  const fetchMilestones = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/milestones`);
      const data = await response.json();
      setMilestones(data);
    } catch (error) {
      showNotification('Failed to fetch milestones', 'error');
    }
  };

  const handleSubmit = async () => {
    try {
      const url = selectedMilestone
        ? `/api/projects/${projectId}/milestones/${selectedMilestone.id}`
        : `/api/projects/${projectId}/milestones`;
      
      const method = selectedMilestone ? 'PUT' : 'POST';
      
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      fetchMilestones();
      handleClose();
      showNotification(
        `Milestone ${selectedMilestone ? 'updated' : 'created'} successfully`,
        'success'
      );
    } catch (error) {
      showNotification('Failed to save milestone', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`/api/projects/${projectId}/milestones/${id}`, {
        method: 'DELETE',
      });
      
      fetchMilestones();
      showNotification('Milestone deleted successfully', 'success');
    } catch (error) {
      showNotification('Failed to delete milestone', 'error');
    }
  };

  const handleClose = () => {
    setDialogOpen(false);
    setSelectedMilestone(null);
    setFormData({
      title: '',
      description: '',
      dueDate: new Date(),
      progress: 0,
    });
  };

  const getMilestoneStatus = (milestone) => {
    if (milestone.progress === 100) return 'completed';
    if (new Date(milestone.dueDate) < new Date()) return 'overdue';
    return 'pending';
  };

  return (
    <Paper className={classes.root}>
      <div className={classes.header}>
        <Typography variant="h5">Project Milestones</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          Add Milestone
        </Button>
      </div>

      <List>
        {milestones.map((milestone) => (
          <Paper key={milestone.id} className={classes.milestone}>
            <div className={classes.milestoneHeader}>
              <div>
                <Typography variant="h6">{milestone.title}</Typography>
                <Typography variant="body2" color="textSecondary">
                  Due: {new Date(milestone.dueDate).toLocaleDateString()}
                </Typography>
              </div>
              <div>
                <Chip
                  icon={
                    milestone.progress === 100 ? (
                      <CompletedIcon />
                    ) : (
                      <PendingIcon />
                    )
                  }
                  label={getMilestoneStatus(milestone)}
                  className={`${classes.chip} ${
                    classes[`status${getMilestoneStatus(milestone)}`]
                  }`}
                />
                <IconButton
                  onClick={(e) => {
                    setAnchorEl(e.currentTarget);
                    setSelectedMilestone(milestone);
                  }}
                >
                  <MoreIcon />
                </IconButton>
              </div>
            </div>
            <Typography variant="body1">{milestone.description}</Typography>
            <div className={classes.progress}>
              <LinearProgress
                variant="determinate"
                value={milestone.progress}
                color={milestone.progress === 100 ? 'secondary' : 'primary'}
              />
              <Typography
                variant="body2"
                color="textSecondary"
                align="right"
                style={{ marginTop: 4 }}
              >
                {milestone.progress}% Complete
              </Typography>
            </div>
          </Paper>
        ))}
      </List>

      <Dialog
        open={dialogOpen}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {selectedMilestone ? 'Edit Milestone' : 'Create Milestone'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Title"
            fullWidth
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
          <DatePicker
            label="Due Date"
            value={formData.dueDate}
            onChange={(date) => setFormData({ ...formData, dueDate: date })}
            fullWidth
            margin="dense"
          />
          <TextField
            margin="dense"
            label="Progress"
            type="number"
            fullWidth
            value={formData.progress}
            onChange={(e) => setFormData({ ...formData, progress: Number(e.target.value) })}
            inputProps={{ min: 0, max: 100 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} color="primary" variant="contained">
            {selectedMilestone ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem
          onClick={() => {
            setDialogOpen(true);
            setFormData(selectedMilestone);
            setAnchorEl(null);
          }}
        >
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleDelete(selectedMilestone.id);
            setAnchorEl(null);
          }}
        >
          Delete
        </MenuItem>
      </Menu>
    </Paper>
  );
};

export default Milestones; 