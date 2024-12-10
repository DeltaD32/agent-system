import React, { useState, useEffect } from 'react';
import {
  Paper,
  Grid,
  Typography,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  makeStyles,
} from '@material-ui/core';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

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
  card: {
    height: '100%',
  },
  chartContainer: {
    height: 300,
    marginTop: theme.spacing(2),
  },
  formControl: {
    minWidth: 120,
  },
  metric: {
    textAlign: 'center',
    padding: theme.spacing(2),
  },
  metricValue: {
    fontSize: '2rem',
    fontWeight: 'bold',
    marginBottom: theme.spacing(1),
  },
}));

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const ProjectAnalytics = ({ projectId }) => {
  const classes = useStyles();
  const [timeRange, setTimeRange] = useState('week');
  const [analytics, setAnalytics] = useState({
    taskProgress: [],
    taskDistribution: [],
    timeTracking: [],
    metrics: {
      completionRate: 0,
      averageTaskDuration: 0,
      activeContributors: 0,
      totalTasks: 0,
    },
  });

  useEffect(() => {
    fetchAnalytics();
  }, [projectId, timeRange]);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/analytics?timeRange=${timeRange}`
      );
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  return (
    <Paper className={classes.root}>
      <div className={classes.header}>
        <Typography variant="h5">Project Analytics</Typography>
        <FormControl className={classes.formControl}>
          <InputLabel>Time Range</InputLabel>
          <Select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <MenuItem value="week">Last Week</MenuItem>
            <MenuItem value="month">Last Month</MenuItem>
            <MenuItem value="quarter">Last Quarter</MenuItem>
            <MenuItem value="year">Last Year</MenuItem>
          </Select>
        </FormControl>
      </div>

      <Grid container spacing={3}>
        {/* Key Metrics */}
        <Grid item xs={12} md={3}>
          <Card className={classes.metric}>
            <Typography variant="h6">Completion Rate</Typography>
            <div className={classes.metricValue}>
              {analytics.metrics.completionRate}%
            </div>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card className={classes.metric}>
            <Typography variant="h6">Avg Task Duration</Typography>
            <div className={classes.metricValue}>
              {analytics.metrics.averageTaskDuration} days
            </div>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card className={classes.metric}>
            <Typography variant="h6">Active Contributors</Typography>
            <div className={classes.metricValue}>
              {analytics.metrics.activeContributors}
            </div>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card className={classes.metric}>
            <Typography variant="h6">Total Tasks</Typography>
            <div className={classes.metricValue}>
              {analytics.metrics.totalTasks}
            </div>
          </Card>
        </Grid>

        {/* Task Progress Chart */}
        <Grid item xs={12} md={8}>
          <Card className={classes.card}>
            <CardContent>
              <Typography variant="h6">Task Progress Over Time</Typography>
              <div className={classes.chartContainer}>
                <ResponsiveContainer>
                  <LineChart data={analytics.taskProgress}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="completed"
                      stroke="#8884d8"
                      name="Completed Tasks"
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#82ca9d"
                      name="Total Tasks"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </Grid>

        {/* Task Distribution */}
        <Grid item xs={12} md={4}>
          <Card className={classes.card}>
            <CardContent>
              <Typography variant="h6">Task Distribution</Typography>
              <div className={classes.chartContainer}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={analytics.taskDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {analytics.taskDistribution.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </Grid>

        {/* Time Tracking */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6">Time Tracking</Typography>
              <div className={classes.chartContainer}>
                <ResponsiveContainer>
                  <BarChart data={analytics.timeTracking}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="estimated" fill="#8884d8" name="Estimated Time" />
                    <Bar dataKey="actual" fill="#82ca9d" name="Actual Time" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default ProjectAnalytics; 