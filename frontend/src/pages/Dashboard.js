import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import StatsCards from '../components/StatsCards';
import RegisterForm from '../components/RegisterForm';
import UserTable from '../components/UserTable';
import AccessLog from '../components/AccessLog';
import TransactionLog from '../components/TransactionLog';

const API = 'http://localhost:5000/api';

function Dashboard() {
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [accessLogs, setAccessLogs] = useState([]);
  const [txLogs, setTxLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [s, u, a, t] = await Promise.all([
        axios.get(`${API}/stats`),
        axios.get(`${API}/users`),
        axios.get(`${API}/access_log`),
        axios.get(`${API}/logs`),
      ]);
      setStats(s.data);
      setUsers(u.data);
      setAccessLogs(a.data);
      setTxLogs(t.data);
    } catch (err) {
      console.error('API error:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 3000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  if (loading) return <div className="loading">⏳ Loading dashboard...</div>;

  return (
    <div>
      <div className="page-header">
        <span className="title">📊 Dashboard</span>
        <button className="btn-refresh" onClick={fetchAll}>🔄 Refresh</button>
      </div>
      <StatsCards stats={stats} />
      <RegisterForm onDone={fetchAll} />
      <UserTable users={users} onDone={fetchAll} />
      <AccessLog logs={accessLogs} />
      <TransactionLog logs={txLogs} />
    </div>
  );
}

export default Dashboard;