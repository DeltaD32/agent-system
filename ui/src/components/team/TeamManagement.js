import React, { useState, useEffect } from 'react';
import {
  Paper,
  Grid,
  Card,
  CardContent,
  Typography,
  Avatar,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  makeStyles,
} from '@material-ui/core';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
} from '@material-ui/icons';
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
  memberCard: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  avatar: {
    width: theme.spacing(7),
    height: theme.spacing(7),
    marginBottom: theme.spacing(2),
  },
  roleChip: {
    margin: theme.spacing(0.5),
  },
  contactInfo: {
    display: 'flex',
    alignItems: 'center',
    marginTop: theme.spacing(1),
    '& svg': {
      marginRight: theme.spacing(1),
    },
  },
  inviteSection: {
    marginTop: theme.spacing(3),
  },
}));

const TeamManagement = ({ projectId }) => {
  const classes = useStyles();
  const { showNotification } = useNotification();
  const [members, setMembers] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '',
    phone: '',
    department: '',
  });

  useEffect(() => {
    fetchTeamMembers();
  }, [projectId]);

  const fetchTeamMembers = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/team`);
      const data = await response.json();
      setMembers(data);
    } catch (error) {
      showNotification('Failed to fetch team members', 'error');
    }
  };

  const handleSubmit = async () => {
    try {
      const url = selectedMember
        ? `/api/projects/${projectId}/team/${selectedMember.id}`
        : `/api/projects/${projectId}/team`;
      
      const method = selectedMember ? 'PUT' : 'POST';
      
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      fetchTeamMembers();
      handleClose();
      showNotification(
        `Team member ${selectedMember ? 'updated' : 'added'} successfully`,
        'success'
      );
    } catch (error) {
      showNotification('Failed to save team member', 'error');
    }
  };

  const handleInvite = async () => {
    try {
      await fetch(`/api/projects/${projectId}/team/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail }),
      });

      setInviteEmail('');
      showNotification('Invitation sent successfully', 'success');
    } catch (error) {
      showNotification('Failed to send invitation', 'error');
    }
  };

  const handleRemoveMember = async (memberId) => {
    try {
      await fetch(`/api/projects/${projectId}/team/${memberId}`, {
        method: 'DELETE',
      });

      fetchTeamMembers();
      showNotification('Team member removed successfully', 'success');
    } catch (error) {
      showNotification('Failed to remove team member', 'error');
    }
  };

  const handleClose = () => {
    setDialogOpen(false);
    setSelectedMember(null);
    setFormData({
      name: '',
      email: '',
      role: '',
      phone: '',
      department: '',
    });
  };

  return (
    <Paper className={classes.root}>
      <div className={classes.header}>
        <Typography variant="h5">Team Management</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          Add Team Member
        </Button>
      </div>

      <Grid container spacing={3}>
        {members.map((member) => (
          <Grid item xs={12} sm={6} md={4} key={member.id}>
            <Card className={classes.memberCard}>
              <CardContent>
                <Avatar
                  src={member.avatar}
                  className={classes.avatar}
                >
                  {member.name[0]}
                </Avatar>
                <Typography variant="h6">{member.name}</Typography>
                <Chip
                  label={member.role}
                  className={classes.roleChip}
                  color="primary"
                  variant="outlined"
                />
                <div className={classes.contactInfo}>
                  <EmailIcon />
                  <Typography variant="body2">{member.email}</Typography>
                </div>
                {member.phone && (
                  <div className={classes.contactInfo}>
                    <PhoneIcon />
                    <Typography variant="body2">{member.phone}</Typography>
                  </div>
                )}
                <div style={{ marginTop: 'auto' }}>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setSelectedMember(member);
                      setFormData(member);
                      setDialogOpen(true);
                    }}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveMember(member.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </div>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <div className={classes.inviteSection}>
        <Typography variant="h6" gutterBottom>
          Invite Team Members
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Email Address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleInvite}
              disabled={!inviteEmail}
            >
              Send Invitation
            </Button>
          </Grid>
        </Grid>
      </div>

      <Dialog
        open={dialogOpen}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {selectedMember ? 'Edit Team Member' : 'Add Team Member'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            fullWidth
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Email"
            type="email"
            fullWidth
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Role"
            fullWidth
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Phone"
            fullWidth
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Department"
            fullWidth
            value={formData.department}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} color="primary" variant="contained">
            {selectedMember ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default TeamManagement; 