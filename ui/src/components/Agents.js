import React from 'react';
import {
  Paper,
  Typography,
  Grid,
  makeStyles,
} from '@material-ui/core';
import { Network } from 'vis-network/standalone';
import { DataSet } from 'vis-data';

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
  },
  paper: {
    padding: theme.spacing(3),
    height: '600px',
  },
  networkContainer: {
    height: 'calc(100% - 48px)',
  },
}));

function Agents() {
  const classes = useStyles();
  const networkContainer = React.useRef(null);
  const [network, setNetwork] = React.useState(null);

  React.useEffect(() => {
    if (networkContainer.current) {
      const nodes = new DataSet([
        { id: 'orchestrator', label: 'Orchestrator', color: '#1976d2', shape: 'dot', size: 30 },
        { id: 'mistral', label: 'Mistral', color: '#dc004e', shape: 'dot', size: 30 },
        { id: 'worker1', label: 'Worker 1', color: '#4caf50', shape: 'dot', size: 25 },
        { id: 'worker2', label: 'Worker 2', color: '#4caf50', shape: 'dot', size: 25 },
        { id: 'worker3', label: 'Worker 3', color: '#4caf50', shape: 'dot', size: 25 },
      ]);

      const edges = new DataSet([
        { from: 'orchestrator', to: 'mistral', arrows: 'to', color: { color: '#1976d2' } },
        { from: 'orchestrator', to: 'worker1', arrows: 'to', color: { color: '#1976d2' } },
        { from: 'orchestrator', to: 'worker2', arrows: 'to', color: { color: '#1976d2' } },
        { from: 'orchestrator', to: 'worker3', arrows: 'to', color: { color: '#1976d2' } },
      ]);

      const data = { nodes, edges };
      const options = {
        nodes: {
          font: {
            size: 16,
            face: 'Roboto',
          },
          shadow: true,
        },
        edges: {
          width: 2,
          smooth: {
            type: 'curvedCW',
            roundness: 0.2,
          },
          shadow: true,
        },
        physics: {
          stabilization: false,
          barnesHut: {
            gravitationalConstant: -80000,
            springConstant: 0.001,
            springLength: 200,
          },
        },
        interaction: {
          hover: true,
          tooltipDelay: 200,
        },
      };

      const network = new Network(networkContainer.current, data, options);
      setNetwork(network);

      // Add event listeners
      network.on('click', function(params) {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0];
          console.log('Clicked node:', nodeId);
          // You can add node-specific actions here
        }
      });
    }
  }, [networkContainer]);

  return (
    <div className={classes.root}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper className={classes.paper}>
            <Typography variant="h5" gutterBottom>
              Agent Network
            </Typography>
            <div ref={networkContainer} className={classes.networkContainer} />
          </Paper>
        </Grid>
      </Grid>
    </div>
  );
}

export default Agents; 