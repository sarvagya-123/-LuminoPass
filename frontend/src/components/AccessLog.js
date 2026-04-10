import React from 'react';

function AccessLog({ logs }) {
  const getBadge = (d) => {
    if (d === 'DENY') return 'badge-deny';
    if (d === 'VIP') return 'badge-vip';
    return 'badge-allow';
  };

  return (
    <div className="section">
      <h2>📋 Access Log (Gate Taps)</h2>
      <table>
        <thead>
          <tr><th>Time</th><th>UID</th><th>Name</th><th>Decision</th></tr>
        </thead>
        <tbody>
          {logs.map((l, i) => (
            <tr key={i}>
              <td>{l.ts}</td>
              <td><code>{l.uid}</code></td>
              <td>{l.name}</td>
              <td><span className={`badge ${getBadge(l.decision)}`}>{l.decision}</span></td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr><td colSpan={4} className="empty">No access logs yet. Tap a card!</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default AccessLog;