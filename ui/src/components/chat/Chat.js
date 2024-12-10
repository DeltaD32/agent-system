import React, { useState, useEffect, useRef } from 'react';
import {
  Paper,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  TextField,
  IconButton,
  Divider,
  Badge,
  Menu,
  MenuItem,
  makeStyles,
} from '@material-ui/core';
import {
  Send as SendIcon,
  AttachFile as AttachIcon,
  MoreVert as MoreIcon,
  InsertEmoticon as EmojiIcon,
  Search as SearchIcon,
} from '@material-ui/icons';
import { useNotification } from '../../context/NotificationContext';
import EmojiPicker from 'emoji-picker-react';

const useStyles = makeStyles((theme) => ({
  root: {
    height: 'calc(100vh - 100px)',
    display: 'flex',
  },
  sidebar: {
    width: 300,
    borderRight: `1px solid ${theme.palette.divider}`,
  },
  chatArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  messageList: {
    flex: 1,
    overflow: 'auto',
    padding: theme.spacing(2),
  },
  inputArea: {
    padding: theme.spacing(2),
    borderTop: `1px solid ${theme.palette.divider}`,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  message: {
    marginBottom: theme.spacing(2),
    padding: theme.spacing(1),
    borderRadius: theme.shape.borderRadius,
    maxWidth: '70%',
  },
  sentMessage: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    marginLeft: 'auto',
  },
  receivedMessage: {
    backgroundColor: theme.palette.background.default,
  },
  chatHeader: {
    padding: theme.spacing(2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchBar: {
    padding: theme.spacing(1),
  },
  filePreview: {
    maxWidth: 200,
    maxHeight: 200,
    marginTop: theme.spacing(1),
  },
  emojiPicker: {
    position: 'absolute',
    bottom: '100%',
    right: 0,
  },
}));

const Chat = ({ projectId }) => {
  const classes = useStyles();
  const { showNotification } = useNotification();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedChat, setSelectedChat] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const messageEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const ws = useRef(null);

  useEffect(() => {
    // Initialize WebSocket connection
    ws.current = new WebSocket(`ws://localhost:5000/ws/chat/${projectId}`);
    
    ws.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleNewMessage(message);
    };

    fetchConversations();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [projectId]);

  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.id);
    }
  }, [selectedChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/chat/conversations`);
      const data = await response.json();
      setConversations(data);
    } catch (error) {
      showNotification('Failed to fetch conversations', 'error');
    }
  };

  const fetchMessages = async (conversationId) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/chat/${conversationId}/messages`);
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      showNotification('Failed to fetch messages', 'error');
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && attachments.length === 0) return;

    try {
      const formData = new FormData();
      formData.append('message', newMessage);
      attachments.forEach(file => {
        formData.append('files', file);
      });

      await fetch(`/api/projects/${projectId}/chat/${selectedChat.id}/messages`, {
        method: 'POST',
        body: formData,
      });

      setNewMessage('');
      setAttachments([]);
    } catch (error) {
      showNotification('Failed to send message', 'error');
    }
  };

  const handleNewMessage = (message) => {
    if (message.conversationId === selectedChat?.id) {
      setMessages(prev => [...prev, message]);
    }
    // Update conversation list with new message preview
    setConversations(prev => {
      const updated = [...prev];
      const index = updated.findIndex(c => c.id === message.conversationId);
      if (index !== -1) {
        updated[index] = {
          ...updated[index],
          lastMessage: message,
        };
      }
      return updated;
    });
  };

  const handleFileAttachment = (event) => {
    const files = Array.from(event.target.files);
    setAttachments(prev => [...prev, ...files]);
  };

  const handleEmojiClick = (event, emojiObject) => {
    setNewMessage(prev => prev + emojiObject.emoji);
  };

  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const filteredConversations = conversations.filter(conv =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Paper className={classes.root}>
      <div className={classes.sidebar}>
        <div className={classes.searchBar}>
          <TextField
            fullWidth
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon color="action" />,
            }}
          />
        </div>
        <List>
          {filteredConversations.map((conv) => (
            <ListItem
              button
              key={conv.id}
              selected={selectedChat?.id === conv.id}
              onClick={() => setSelectedChat(conv)}
            >
              <ListItemAvatar>
                <Badge
                  color="secondary"
                  variant="dot"
                  invisible={!conv.unreadCount}
                >
                  <Avatar src={conv.avatar}>{conv.name[0]}</Avatar>
                </Badge>
              </ListItemAvatar>
              <ListItemText
                primary={conv.name}
                secondary={conv.lastMessage?.content}
              />
            </ListItem>
          ))}
        </List>
      </div>

      <div className={classes.chatArea}>
        {selectedChat ? (
          <>
            <div className={classes.chatHeader}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Avatar src={selectedChat.avatar} style={{ marginRight: 8 }}>
                  {selectedChat.name[0]}
                </Avatar>
                <Typography variant="h6">{selectedChat.name}</Typography>
              </div>
              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
                <MoreIcon />
              </IconButton>
            </div>

            <div className={classes.messageList}>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`${classes.message} ${
                    message.isSent ? classes.sentMessage : classes.receivedMessage
                  }`}
                >
                  <Typography variant="body2" style={{ marginBottom: 4 }}>
                    {message.sender}
                  </Typography>
                  <Typography>{message.content}</Typography>
                  {message.attachments?.map((attachment) => (
                    <img
                      key={attachment.id}
                      src={attachment.url}
                      alt="attachment"
                      className={classes.filePreview}
                    />
                  ))}
                  <Typography variant="caption" style={{ marginTop: 4 }}>
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </Typography>
                </div>
              ))}
              <div ref={messageEndRef} />
            </div>

            <div className={classes.inputArea}>
              <IconButton onClick={() => setShowEmoji(!showEmoji)}>
                <EmojiIcon />
              </IconButton>
              {showEmoji && (
                <div className={classes.emojiPicker}>
                  <EmojiPicker onEmojiClick={handleEmojiClick} />
                </div>
              )}
              <IconButton onClick={() => fileInputRef.current.click()}>
                <AttachIcon />
              </IconButton>
              <input
                type="file"
                multiple
                hidden
                ref={fileInputRef}
                onChange={handleFileAttachment}
              />
              <TextField
                fullWidth
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                multiline
                maxRows={4}
              />
              <IconButton
                color="primary"
                onClick={handleSendMessage}
                disabled={!newMessage.trim() && attachments.length === 0}
              >
                <SendIcon />
              </IconButton>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography variant="h6" color="textSecondary">
              Select a conversation to start chatting
            </Typography>
          </div>
        )}
      </div>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => {
          // Handle mute notifications
          setAnchorEl(null);
        }}>
          Mute Notifications
        </MenuItem>
        <MenuItem onClick={() => {
          // Handle clear chat
          setAnchorEl(null);
        }}>
          Clear Chat
        </MenuItem>
      </Menu>
    </Paper>
  );
};

export default Chat; 