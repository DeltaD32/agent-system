import React, { useState, useEffect } from 'react';
import { ForceGraph2D } from 'react-force-graph';
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
  Refresh as RefreshIcon,
} from '@material-ui/icons';

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
  graphContainer: {
    height: 'calc(100% - 50px)',
    width: '100%',
  },
}));

const TaskDependencies = ({ projectId }) => {
  const classes = useStyles();
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState(null);

  useEffect(() => {
    fetchDependencyData();
  }, [projectId]);

  const fetchDependencyData = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/dependencies`);
      const data = await response.json();
      
      // Transform data for force graph
      const nodes = data.tasks.map(task => ({
        id: task.id,
        name: task.name,
        status: task.status,
        progress: task.progress,
      }));
      
      const links = data.dependencies.map(dep => ({
        source: dep.from,
        target: dep.to,
        type: dep.type,
      }));

      setGraphData({ nodes, links });
    } catch (error) {
      console.error('Error fetching dependency data:', error);
    }
  };

  const handleNodeClick = (node) => {
    setSelectedNode(node);
    // You could show a modal or sidebar with detailed task information
  };

  return (
    <Paper className={classes.root}>
      <div className={classes.toolbar}>
        <Typography variant="h6">Task Dependencies</Typography>
        <div>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchDependencyData}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </div>
      </div>
      <div className={classes.graphContainer}>
        <ForceGraph2D
          graphData={graphData}
          nodeLabel="name"
          nodeColor={node => {
            switch (node.status) {
              case 'completed':
                return 'green';
              case 'in_progress':
                return 'blue';
              case 'blocked':
                return 'red';
              default:
                return 'gray';
            }
          }}
          linkColor={link => link.type === 'blocking' ? 'red' : '#999'}
          onNodeClick={handleNodeClick}
          nodeCanvasObject={(node, ctx, globalScale) => {
            // Custom node rendering
            const label = node.name;
            const fontSize = 12/globalScale;
            ctx.font = `${fontSize}px Sans-Serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'black';
            ctx.fillText(label, node.x, node.y);
          }}
        />
      </div>
    </Paper>
  );
};

export default TaskDependencies; 