import React, { useState, useEffect } from 'react';
import {
  Paper,
  makeStyles,
  Typography,
  IconButton,
  Tooltip,
} from '@material-ui/core';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Today as TodayIcon,
} from '@material-ui/icons';
import { gantt } from 'dhtmlx-gantt';
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';

const useStyles = makeStyles((theme) => ({
  root: {
    height: 'calc(100vh - 200px)',
    position: 'relative',
  },
  toolbar: {
    padding: theme.spacing(1),
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  ganttContainer: {
    height: 'calc(100% - 50px)',
    width: '100%',
  },
}));

const GanttChart = ({ projectId }) => {
  const classes = useStyles();
  const [tasks, setTasks] = useState([]);
  const [links, setLinks] = useState([]);

  useEffect(() => {
    // Initialize Gantt
    gantt.init(ganttContainer.current);

    // Configure Gantt
    gantt.config.date_format = '%Y-%m-%d %H:%i';
    gantt.config.auto_scheduling = true;
    gantt.config.auto_scheduling_strict = true;
    gantt.config.work_time = true;

    // Load data
    fetchGanttData();

    // Set up event handlers
    gantt.attachEvent('onAfterTaskAdd', handleTaskAdd);
    gantt.attachEvent('onAfterTaskUpdate', handleTaskUpdate);
    gantt.attachEvent('onAfterTaskDelete', handleTaskDelete);
    gantt.attachEvent('onAfterLinkAdd', handleLinkAdd);
    gantt.attachEvent('onAfterLinkDelete', handleLinkDelete);

    return () => {
      gantt.clearAll();
    };
  }, [projectId]);

  const fetchGanttData = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/gantt`);
      const data = await response.json();
      setTasks(data.tasks);
      setLinks(data.links);
      gantt.parse({ data: data.tasks, links: data.links });
    } catch (error) {
      console.error('Error fetching Gantt data:', error);
    }
  };

  const handleTaskAdd = async (id, task) => {
    try {
      await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task),
      });
    } catch (error) {
      console.error('Error adding task:', error);
    }
  };

  const handleTaskUpdate = async (id, task) => {
    try {
      await fetch(`/api/projects/${projectId}/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task),
      });
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  // ... Additional handlers for task/link operations ...

  const zoomIn = () => {
    gantt.ext.zoom.zoomIn();
  };

  const zoomOut = () => {
    gantt.ext.zoom.zoomOut();
  };

  const goToToday = () => {
    gantt.showDate(new Date());
  };

  return (
    <Paper className={classes.root}>
      <div className={classes.toolbar}>
        <Typography variant="h6">Project Timeline</Typography>
        <div>
          <Tooltip title="Zoom In">
            <IconButton onClick={zoomIn}>
              <ZoomInIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom Out">
            <IconButton onClick={zoomOut}>
              <ZoomOutIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Go to Today">
            <IconButton onClick={goToToday}>
              <TodayIcon />
            </IconButton>
          </Tooltip>
        </div>
      </div>
      <div ref={ganttContainer} className={classes.ganttContainer} />
    </Paper>
  );
};

export default GanttChart; 