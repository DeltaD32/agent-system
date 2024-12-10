import { useState, useEffect } from 'react';

const useSystemStats = () => {
  const [stats, setStats] = useState({
    activeProjects: 0,
    runningWorkers: 0,
    tasksCompleted: 0,
    systemUptime: '0%',
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('http://localhost:5000/stats');
        const data = await response.json();
        setStats({
          activeProjects: data.active_projects,
          runningWorkers: data.running_workers,
          tasksCompleted: data.tasks_completed,
          systemUptime: data.system_uptime,
        });
      } catch (error) {
        console.error('Error fetching system stats:', error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  return stats;
};

export default useSystemStats; 