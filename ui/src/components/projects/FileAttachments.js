import React, { useState, useEffect, useCallback } from 'react';
import {
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondary,
  IconButton,
  Typography,
  Button,
  makeStyles,
  CircularProgress,
} from '@material-ui/core';
import {
  Description as FileIcon,
  Image as ImageIcon,
  Movie as VideoIcon,
  Archive as ArchiveIcon,
  Delete as DeleteIcon,
  GetApp as DownloadIcon,
  CloudUpload as UploadIcon,
} from '@material-ui/icons';
import { useDropzone } from 'react-dropzone';
import { useNotification } from '../../context/NotificationContext';

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(2),
  },
  dropzone: {
    border: `2px dashed ${theme.palette.primary.main}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(2),
    textAlign: 'center',
    marginBottom: theme.spacing(2),
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  fileList: {
    maxHeight: '400px',
    overflow: 'auto',
  },
  fileItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progress: {
    marginLeft: theme.spacing(2),
  },
  fileIcon: {
    marginRight: theme.spacing(1),
  },
  fileInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  fileSize: {
    color: theme.palette.text.secondary,
    fontSize: '0.875rem',
  },
}));

const FileAttachments = ({ projectId }) => {
  const classes = useStyles();
  const { showNotification } = useNotification();
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});

  useEffect(() => {
    fetchFiles();
  }, [projectId]);

  const fetchFiles = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/files`);
      const data = await response.json();
      setFiles(data);
    } catch (error) {
      showNotification('Failed to fetch files', 'error');
    }
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    setUploading(true);
    const newProgress = {};
    
    try {
      for (const file of acceptedFiles) {
        const formData = new FormData();
        formData.append('file', file);

        newProgress[file.name] = 0;
        setUploadProgress(newProgress);

        await fetch(`/api/projects/${projectId}/files`, {
          method: 'POST',
          body: formData,
          onUploadProgress: (progressEvent) => {
            const progress = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(prev => ({
              ...prev,
              [file.name]: progress,
            }));
          },
        });
      }

      fetchFiles();
      showNotification('Files uploaded successfully', 'success');
    } catch (error) {
      showNotification('Failed to upload files', 'error');
    } finally {
      setUploading(false);
      setUploadProgress({});
    }
  }, [projectId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
  });

  const handleDelete = async (fileId) => {
    try {
      await fetch(`/api/projects/${projectId}/files/${fileId}`, {
        method: 'DELETE',
      });

      fetchFiles();
      showNotification('File deleted successfully', 'success');
    } catch (error) {
      showNotification('Failed to delete file', 'error');
    }
  };

  const handleDownload = async (file) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/files/${file.id}/download`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      showNotification('Failed to download file', 'error');
    }
  };

  const getFileIcon = (fileType) => {
    if (fileType.startsWith('image/')) return <ImageIcon />;
    if (fileType.startsWith('video/')) return <VideoIcon />;
    if (fileType.includes('zip') || fileType.includes('tar')) return <ArchiveIcon />;
    return <FileIcon />;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Paper className={classes.root}>
      <div {...getRootProps()} className={classes.dropzone}>
        <input {...getInputProps()} />
        <UploadIcon fontSize="large" color="primary" />
        <Typography variant="h6">
          {isDragActive
            ? 'Drop the files here...'
            : 'Drag & drop files here, or click to select files'}
        </Typography>
      </div>

      <List className={classes.fileList}>
        {files.map((file) => (
          <ListItem key={file.id} className={classes.fileItem}>
            <div className={classes.fileInfo}>
              {getFileIcon(file.type)}
              <ListItemText
                primary={file.name}
                secondary={
                  <>
                    <span className={classes.fileSize}>
                      {formatFileSize(file.size)}
                    </span>
                    <span style={{ marginLeft: 8 }}>
                      {new Date(file.uploadedAt).toLocaleDateString()}
                    </span>
                  </>
                }
              />
            </div>
            <div>
              {uploadProgress[file.name] !== undefined ? (
                <CircularProgress
                  variant="determinate"
                  value={uploadProgress[file.name]}
                  size={24}
                  className={classes.progress}
                />
              ) : (
                <>
                  <IconButton onClick={() => handleDownload(file)}>
                    <DownloadIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(file.id)}>
                    <DeleteIcon />
                  </IconButton>
                </>
              )}
            </div>
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};

export default FileAttachments; 