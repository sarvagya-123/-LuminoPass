import React from 'react';

function TransactionLog({ logs }) {
  const getBadge = (s) => {
    if (s === 'APPROVED' || s === 'OK') return 'badge-approved';
    if (s && s.includes('DECLINED')) return 'badge-declined';
    if (s === 'DENY_NO_USER') return 'badge-deny';
    return 'badge-ok';
  };

  return (
    <div className="section">
      <h2>💳 Transaction Log</h2>
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>UID</th>
            <th>Event</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l, i) => (
            <tr key={i}>
              <td>{l.ts}</td>
              <td><code>{l.uid}</code></td>
              <td>{l.event}</td>
              <td>₹{l.amount}</td>
              <td>
                <span className={`badge ${getBadge(l.status)}`}>
                  {l.status}
                </span>
              </td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr>
              <td colSpan={5} className="empty">No transactions yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default TransactionLog;