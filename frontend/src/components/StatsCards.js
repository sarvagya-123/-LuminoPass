import React from 'react';

function StatsCards({ stats }) {
  const cards = [
    { icon: '👥', label: 'Users', value: stats.total_users || 0 },
    { icon: '🪪', label: 'Access Taps', value: stats.total_access || 0 },
    { icon: '💳', label: 'Transactions', value: stats.total_transactions || 0 },
    { icon: '✅', label: 'Approved', value: stats.approved_payments || 0 },
    { icon: '🚫', label: 'Denied Entry', value: stats.denied_count || 0 },
    { icon: '💰', label: 'Total Balance', value: `₹${stats.total_balance || 0}` },
  ];

  return (
    <div className="stats-grid">
      {cards.map((c, i) => (
        <div className="stat-card" key={i}>
          <div className="icon">{c.icon}</div>
          <div className="number">{c.value}</div>
          <div className="label">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

export default StatsCards;