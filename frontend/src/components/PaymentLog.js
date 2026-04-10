import React, { useState, useEffect, useCallback } from 'react';

const API = 'http://localhost:5000/api';

const statusStyle = (status) => {
  if (status === 'APPROVED')
    return { background: '#1a3a1a', color: '#4caf50', border: '1px solid #4caf5044' };
  if (status?.includes('DECLINED'))
    return { background: '#3a1a1a', color: '#ef5350', border: '1px solid #ef535044' };
  if (status?.includes('BLOCKED'))
    return { background: '#3a2a1a', color: '#ff9800', border: '1px solid #ff980044' };
  if (status?.includes('DENY'))
    return { background: '#3a1a1a', color: '#ef5350', border: '1px solid #ef535044' };
  return { background: '#2a2a2a', color: '#aaa', border: '1px solid #333' };
};

const statusIcon = (status) => {
  if (status === 'APPROVED')        return '✅';
  if (status?.includes('DECLINED')) return '❌';
  if (status?.includes('BLOCKED'))  return '🚫';
  if (status?.includes('DENY'))     return '⛔';
  return '❓';
};

export default function PaymentLog() {
  const [payments,    setPayments]    = useState([]);
  const [stats,       setStats]       = useState({});
  const [filtered,    setFiltered]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [search,      setSearch]      = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');

  // ── Fetch payments from /api/payments ─────────────────────
  const fetchPayments = useCallback(async () => {
    try {
      const [payRes, statsRes] = await Promise.all([
        fetch(`${API}/payments`),
        fetch(`${API}/payments/stats`),
      ]);
      const payData   = await payRes.json();
      const statsData = await statsRes.json();

      setPayments(payData);
      setStats(statsData);
      setLastUpdated(new Date().toLocaleTimeString());
      setError('');
    } catch {
      setError('⚠️ Cannot connect to backend. Is it running?');
    }
    setLoading(false);
  }, []);

  // ── Auto-refresh every 3 s ─────────────────────────────────
  useEffect(() => {
    fetchPayments();
    if (!autoRefresh) return;
    const id = setInterval(fetchPayments, 3000);
    return () => clearInterval(id);
  }, [fetchPayments, autoRefresh]);

  // ── Filter logic ───────────────────────────────────────────
  useEffect(() => {
    let result = [...payments];

    if (search.trim()) {
      const q = search.trim().toUpperCase();
      result = result.filter(p =>
        p.uid?.toUpperCase().includes(q)     ||
        p.name?.toUpperCase().includes(q)    ||
        p.service?.toUpperCase().includes(q) ||
        p.status?.toUpperCase().includes(q)  ||
        p.receipt_id?.toUpperCase().includes(q)
      );
    }

    if (filterStatus !== 'ALL') {
      result = result.filter(p => p.status === filterStatus);
    }

    setFiltered(result);
  }, [payments, search, filterStatus]);

  const s = {
    container   : { padding: 24, background: '#0a0a1a', minHeight: '100vh', color: '#fff', fontFamily: 'Segoe UI, sans-serif' },
    header      : { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 },
    title       : { fontSize: 24, fontWeight: 800, color: '#ffd700' },
    statsGrid   : { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 24 },
    statCard    : { background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 12, padding: 16, textAlign: 'center' },
    statValue   : { fontSize: 24, fontWeight: 800, color: '#ffd700' },
    statLabel   : { fontSize: 11, color: '#888', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },
    controls    : { display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' },
    input       : { background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 8, padding: '8px 14px', color: '#fff', fontSize: 14, outline: 'none', flex: 1, minWidth: 180 },
    select      : { background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 8, padding: '8px 14px', color: '#fff', fontSize: 14, outline: 'none', cursor: 'pointer' },
    table       : { width: '100%', borderCollapse: 'collapse', background: '#12122a', borderRadius: 12, overflow: 'hidden', border: '1px solid #2a2a4a' },
    th          : { padding: '12px 16px', background: '#1a1a3a', color: '#ffd700', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'left', borderBottom: '1px solid #2a2a4a' },
    td          : { padding: '11px 16px', fontSize: 13, borderBottom: '1px solid #1a1a3a', color: '#ddd' },
    badge       : { padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, display: 'inline-block' },
    btn         : { background: '#1a1a3a', border: '1px solid #ffd70044', borderRadius: 8, padding: '8px 16px', color: '#ffd700', fontSize: 13, cursor: 'pointer', fontWeight: 600 },
    exportBtn   : { background: '#1a3a1a', border: '1px solid #4caf5044', borderRadius: 8, padding: '8px 16px', color: '#4caf50', fontSize: 13, cursor: 'pointer', fontWeight: 600 },
    emptyState  : { textAlign: 'center', padding: '60px 20px', color: '#555' },
    errorBox    : { background: '#3a1a1a', border: '1px solid #ef535044', borderRadius: 8, padding: '12px 16px', color: '#ef5350', marginBottom: 20, fontSize: 14 },
  };

  const handleExport = () => {
    window.open(`${API}/payments/export`, '_blank');
  };

  if (loading) {
    return (
      <div style={s.container}>
        <div style={s.emptyState}>
          <div style={{ fontSize: 32 }}>⏳</div>
          <div>Loading payments...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.container}>

      {/* ── Header ── */}
      <div style={s.header}>
        <div>
          <div style={s.title}>🧾 Payment Log</div>
          <div style={{ fontSize: 11, color: '#444', marginTop: 4 }}>
            {lastUpdated ? `Last updated: ${lastUpdated}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#888', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              style={{ accentColor: '#ffd700' }}
            />
            Auto-refresh
          </label>
          <button style={s.btn} onClick={fetchPayments}>🔄 Refresh</button>
          <button style={s.exportBtn} onClick={handleExport}>📥 Export CSV</button>
        </div>
      </div>

      {error && <div style={s.errorBox}>{error}</div>}

      {/* ── Stats Cards ── */}
      <div style={s.statsGrid}>
        {[
          { label: 'Total Revenue',   value: `₹${stats.total_revenue || 0}`,  color: '#ffd700' },
          { label: "Today's Revenue", value: `₹${stats.today_revenue || 0}`,  color: '#42a5f5' },
          { label: 'Total Payments',  value: stats.total_count  || 0,          color: '#fff'    },
          { label: "Today's Count",   value: stats.today_count  || 0,          color: '#ce93d8' },
          { label: 'Approved',        value: stats.approved     || 0,          color: '#4caf50' },
          { label: 'Declined',        value: stats.declined     || 0,          color: '#ef5350' },
        ].map(({ label, value, color }) => (
          <div style={s.statCard} key={label}>
            <div style={{ ...s.statValue, color }}>{value}</div>
            <div style={s.statLabel}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Revenue by Stall ── */}
      {stats.by_stall?.length > 0 && (
        <div style={{ background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ color: '#ffd700', fontWeight: 700, marginBottom: 14, fontSize: 14 }}>
            🏪 Revenue by Service / Stall
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {stats.by_stall.map((stall, i) => (
              <div key={i} style={{ background: '#1a1a3a', borderRadius: 10, padding: '12px 18px', border: '1px solid #2a2a4a', minWidth: 140 }}>
                <div style={{ color: '#ffd700', fontWeight: 800, fontSize: 18 }}>₹{stall.revenue}</div>
                <div style={{ color: '#fff', fontSize: 13, marginTop: 4 }}>{stall.service || 'General'}</div>
                <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>{stall.count} transactions</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Controls ── */}
      <div style={s.controls}>
        <input
          style={s.input}
          placeholder="🔍 Search by name, UID, service, status, receipt ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          style={s.select}
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="ALL">All Status</option>
          <option value="APPROVED">✅ Approved</option>
          <option value="DECLINED_LOW_BAL">❌ Low Balance</option>
          <option value="BLOCKED_CARD">🚫 Blocked Card</option>
          <option value="DENY_NO_USER">⛔ Unknown Card</option>
        </select>
        <span style={{ fontSize: 12, color: '#555' }}>
          {filtered.length} of {payments.length} records
        </span>
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <div style={s.emptyState}>
          <div style={{ fontSize: 48 }}>🧾</div>
          <div style={{ fontSize: 18, marginTop: 12 }}>No payment records found</div>
          <div style={{ fontSize: 13, marginTop: 6, color: '#444' }}>
            Payments will appear here after card taps
          </div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>#</th>
                <th style={s.th}>Timestamp</th>
                <th style={s.th}>Receipt ID</th>
                <th style={s.th}>Card UID</th>
                <th style={s.th}>Name</th>
                <th style={s.th}>Service</th>
                <th style={s.th}>Amount</th>
                <th style={s.th}>Balance After</th>
                <th style={s.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, idx) => (
                <tr
                  key={p.id}
                  style={{ background: idx % 2 === 0 ? '#12122a' : '#0f0f22' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#1a1a35'}
                  onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#12122a' : '#0f0f22'}
                >
                  <td style={{ ...s.td, color: '#555', fontSize: 12 }}>{p.id}</td>
                  <td style={{ ...s.td, fontSize: 12, color: '#888' }}>{p.ts}</td>
                  <td style={{ ...s.td, fontFamily: 'monospace', color: '#ce93d8', fontSize: 11 }}>
                    {p.receipt_id || '—'}
                  </td>
                  <td style={{ ...s.td, fontFamily: 'monospace', color: '#81c784', fontSize: 12 }}>
                    {p.uid}
                  </td>
                  <td style={{ ...s.td, fontWeight: 600 }}>{p.name || '—'}</td>
                  <td style={{ ...s.td, color: '#42a5f5' }}>{p.service || 'General'}</td>
                  <td style={{ ...s.td, fontWeight: 800, color: '#ffd700', fontSize: 15 }}>
                    ₹{p.amount}
                  </td>
                  <td style={{ ...s.td, color: '#888', fontSize: 12 }}>
                    {p.balance_after !== null && p.balance_after !== undefined
                      ? `₹${p.balance_after}`
                      : '—'}
                  </td>
                  <td style={s.td}>
                    <span style={{ ...s.badge, ...statusStyle(p.status) }}>
                      {statusIcon(p.status)} {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}