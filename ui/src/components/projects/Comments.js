import React, { useState, useEffect } from 'react';
import {
  Paper,
  TextField,
  Button,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Typography,
  makeStyles,
  IconButton,
  Menu,
  MenuItem,
} from '@material-ui/core';
import {
  Send as SendIcon,
  MoreVert as MoreIcon,
  Reply as ReplyIcon,
} from '@material-ui/icons';
import { useNotification } from '../../context/NotificationContext';
import ReactMarkdown from 'react-markdown';

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(2),
  },
  commentInput: {
    display: 'flex',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(3),
  },
  commentList: {
    maxHeight: '600px',
    overflow: 'auto',
  },
  comment: {
    marginBottom: theme.spacing(2),
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.default,
  },
  nested: {
    paddingLeft: theme.spacing(4),
  },
  markdown: {
    '& p': {
      margin: 0,
    },
  },
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing(1),
  },
}));

const Comments = ({ projectId }) => {
  const classes = useStyles();
  const { showNotification } = useNotification();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedComment, setSelectedComment] = useState(null);

  useEffect(() => {
    fetchComments();
  }, [projectId]);

  const fetchComments = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/comments`);
      const data = await response.json();
      setComments(data);
    } catch (error) {
      showNotification('Failed to fetch comments', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`/api/projects/${projectId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newComment,
          parentId: replyTo?.id,
        }),
      });

      if (!response.ok) throw new Error('Failed to post comment');

      setNewComment('');
      setReplyTo(null);
      fetchComments();
      showNotification('Comment posted successfully', 'success');
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  const handleEdit = async (commentId, content) => {
    try {
      await fetch(`/api/projects/${projectId}/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      fetchComments();
      showNotification('Comment updated successfully', 'success');
    } catch (error) {
      showNotification('Failed to update comment', 'error');
    }
  };

  const handleDelete = async (commentId) => {
    try {
      await fetch(`/api/projects/${projectId}/comments/${commentId}`, {
        method: 'DELETE',
      });

      fetchComments();
      showNotification('Comment deleted successfully', 'success');
    } catch (error) {
      showNotification('Failed to delete comment', 'error');
    }
  };

  const renderComment = (comment, level = 0) => (
    <div key={comment.id}>
      <Paper className={`${classes.comment} ${level > 0 ? classes.nested : ''}`}>
        <ListItem alignItems="flex-start">
          <ListItemAvatar>
            <Avatar src={comment.author.avatar} alt={comment.author.name}>
              {comment.author.name[0]}
            </Avatar>
          </ListItemAvatar>
          <ListItemText
            primary={
              <Typography variant="subtitle2">
                {comment.author.name}
                <Typography
                  component="span"
                  variant="body2"
                  color="textSecondary"
                  style={{ marginLeft: 8 }}
                >
                  {new Date(comment.createdAt).toLocaleString()}
                </Typography>
              </Typography>
            }
            secondary={
              <div className={classes.markdown}>
                <ReactMarkdown>{comment.content}</ReactMarkdown>
              </div>
            }
          />
          <IconButton
            onClick={(e) => {
              setAnchorEl(e.currentTarget);
              setSelectedComment(comment);
            }}
          >
            <MoreIcon />
          </IconButton>
        </ListItem>
        <div className={classes.actions}>
          <Button
            size="small"
            startIcon={<ReplyIcon />}
            onClick={() => setReplyTo(comment)}
          >
            Reply
          </Button>
        </div>
      </Paper>
      {comment.replies?.map((reply) => renderComment(reply, level + 1))}
    </div>
  );

  return (
    <div className={classes.root}>
      <form onSubmit={handleSubmit} className={classes.commentInput}>
        <TextField
          fullWidth
          multiline
          rows={3}
          variant="outlined"
          placeholder={replyTo ? `Replying to ${replyTo.author.name}...` : "Write a comment..."}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
        />
        <Button
          type="submit"
          variant="contained"
          color="primary"
          endIcon={<SendIcon />}
          disabled={!newComment.trim()}
        >
          Post
        </Button>
      </form>

      {replyTo && (
        <Typography variant="body2" color="textSecondary" gutterBottom>
          Replying to {replyTo.author.name}
          <Button size="small" onClick={() => setReplyTo(null)}>
            Cancel
          </Button>
        </Typography>
      )}

      <List className={classes.commentList}>
        {comments.map((comment) => renderComment(comment))}
      </List>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => {
          setAnchorEl(null);
          setSelectedComment(null);
        }}
      >
        <MenuItem onClick={() => {
          // Handle edit
          setAnchorEl(null);
        }}>
          Edit
        </MenuItem>
        <MenuItem onClick={() => {
          handleDelete(selectedComment.id);
          setAnchorEl(null);
        }}>
          Delete
        </MenuItem>
      </Menu>
    </div>
  );
};

export default Comments; 