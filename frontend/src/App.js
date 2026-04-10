import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import PaymentLog from './components/PaymentLog';
import './App.css';

const API = 'http://localhost:5000/api';

const CHART_COLORS = [
  '#ffd700', '#ef5350', '#4caf50', '#42a5f5',
  '#ce93d8', '#ff9800', '#26c6da', '#ec407a',
  '#8d6e63', '#78909c'
];

// ══════════════════════════════════════════
//  RECEIPT GENERATOR
// ══════════════════════════════════════════
function generateReceiptId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'LP-';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function printReceipt(receipt) {
  const win = window.open('', '_blank', 'width=520,height=750');
  if (!win) return;
  const statusColor = receipt.status === 'APPROVED' ? '#4caf50' : '#ef5350';
  const statusIcon  = receipt.status === 'APPROVED' ? '✅' : '❌';
  const balanceRow  = receipt.balance !== undefined && receipt.balance !== null
    ? `<div class="detail-row">
         <span class="detail-label">Balance After</span>
         <span class="detail-value gold">₹${receipt.balance}</span>
       </div>`
    : '';

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>LuminoPass Receipt</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        body {
          font-family:'Inter',sans-serif;
          background:#0a0a1a;
          color:#e0e0e0;
          display:flex;
          justify-content:center;
          padding:30px 15px;
          min-height:100vh;
        }
        .receipt-container {
          width:100%;
          max-width:420px;
          background:#12122a;
          border-radius:16px;
          overflow:hidden;
          border:1px solid #2a2a4a;
          box-shadow:0 8px 40px rgba(0,0,0,0.5),0 0 60px rgba(255,215,0,0.05);
        }
        .receipt-header {
          background:linear-gradient(135deg,#1a1a3a 0%,#0d0d25 100%);
          padding:28px;
          text-align:center;
          border-bottom:2px solid #ffd700;
        }
        .receipt-header .logo-icon  { font-size:36px; margin-bottom:6px; }
        .receipt-header .logo-text  { color:#ffd700; font-size:26px; font-weight:800; letter-spacing:1px; }
        .receipt-header .logo-sub   { color:#555; font-size:11px; text-transform:uppercase; letter-spacing:3px; margin-top:4px; }
        .receipt-id-bar { padding:14px 20px; text-align:center; background:#0f0f25; border-bottom:1px solid #1a1a3a; }
        .receipt-id-bar .rid   { color:#ffd700; font-size:13px; font-weight:700; letter-spacing:1.5px; }
        .receipt-id-bar .rtime { color:#555; font-size:11px; margin-top:3px; }
        .amount-section {
          padding:30px 20px;
          text-align:center;
          background:linear-gradient(135deg,#1a1a35 0%,#151528 100%);
          border-bottom:1px solid #1a1a3a;
        }
        .amount-label  { color:#666; font-size:11px; text-transform:uppercase; letter-spacing:3px; margin-bottom:6px; }
        .amount-value  { color:#ffd700; font-size:48px; font-weight:800; text-shadow:0 0 30px rgba(255,215,0,0.15); }
        .status-badge  {
          display:inline-block; margin-top:14px; padding:6px 20px;
          border-radius:20px; font-size:13px; font-weight:700;
          background:${statusColor}18; color:${statusColor}; border:1px solid ${statusColor}44;
        }
        .details-section { padding:8px 0; }
        .detail-row {
          display:flex; justify-content:space-between; align-items:center;
          padding:13px 24px; border-bottom:1px solid #1a1a3a;
        }
        .detail-row:hover { background:#151535; }
        .detail-row:last-child { border-bottom:none; }
        .detail-label         { color:#888; font-size:13px; font-weight:500; }
        .detail-value         { color:#fff; font-size:14px; font-weight:700; }
        .detail-value.mono    { font-family:'Courier New',monospace; color:#81c784; }
        .detail-value.gold    { color:#ffd700; }
        .receipt-footer { padding:24px; text-align:center; background:#0a0a1a; border-top:1px solid #1a1a3a; }
        .thank-you   { color:#ffd700; font-size:18px; font-weight:700; margin-bottom:10px; }
        .footer-text { color:#444; font-size:10px; line-height:1.7; }
        .divider-dots { text-align:center; padding:8px; color:#2a2a4a; letter-spacing:4px; font-size:10px; }
        .actions {
          text-align:center; padding:20px;
          display:flex; gap:10px; justify-content:center; flex-wrap:wrap;
        }
        .btn-print {
          padding:12px 30px;
          background:linear-gradient(135deg,#ffd700,#ffb300);
          color:#000; border:none; border-radius:10px;
          font-weight:700; font-size:1em; cursor:pointer;
          box-shadow:0 4px 15px rgba(255,215,0,0.3);
        }
        .btn-print:hover { transform:translateY(-2px); }
        .btn-close {
          padding:12px 30px; background:#2a2a4a; color:#ccc;
          border:1px solid #444; border-radius:10px;
          font-weight:600; font-size:1em; cursor:pointer;
        }
        .btn-close:hover { background:#3a3a5a; }
        @media print {
          body { background:#fff; padding:0; }
          .receipt-container { box-shadow:none; border:2px solid #ddd; }
          .receipt-header { background:#f5f5f5 !important; border-bottom-color:#ccc; }
          .receipt-header .logo-text { color:#333 !important; }
          .amount-section { background:#fafafa !important; }
          .amount-value  { color:#333 !important; text-shadow:none !important; }
          .detail-row    { border-bottom-color:#eee; }
          .detail-label  { color:#666 !important; }
          .detail-value  { color:#333 !important; }
          .detail-value.mono { color:#2e7d32 !important; }
          .detail-value.gold { color:#b8860b !important; }
          .receipt-footer { background:#f5f5f5 !important; border-top-color:#eee; }
          .thank-you { color:#333 !important; }
          .actions { display:none !important; }
        }
      </style>
    </head>
    <body>
      <div style="width:100%;max-width:420px;">
        <div class="receipt-container">
          <div class="receipt-header">
            <div class="logo-icon">⚡</div>
            <div class="logo-text">LuminoPass</div>
            <div class="logo-sub">Payment Receipt</div>
          </div>
          <div class="receipt-id-bar">
            <div class="rid">RECEIPT #${receipt.receiptId}</div>
            <div class="rtime">${receipt.timestamp}</div>
          </div>
          <div class="amount-section">
            <div class="amount-label">Amount Charged</div>
            <div class="amount-value">₹${receipt.amount}</div>
            <div><span class="status-badge">${statusIcon} ${receipt.status}</span></div>
          </div>
          <div class="divider-dots">• • • • • • • • • • • • • • • • • •</div>
          <div class="details-section">
            <div class="detail-row">
              <span class="detail-label">👤 Customer</span>
              <span class="detail-value">${receipt.name || 'Unknown'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">🪪 Card UID</span>
              <span class="detail-value mono">${receipt.uid || 'N/A'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">🏪 Service / Stall</span>
              <span class="detail-value">${receipt.service || 'General'}</span>
            </div>
            ${balanceRow}
          </div>
          <div class="divider-dots">• • • • • • • • • • • • • • • • • •</div>
          <div class="receipt-footer">
            <div class="thank-you">Thank You! 🎉</div>
            <div class="footer-text">
              This is a computer-generated receipt.<br/>
              Powered by LuminoPass RFID System<br/>
              For support, contact event admin.
            </div>
          </div>
        </div>
        <div class="actions">
          <button class="btn-print" onclick="window.print()">🖨️ Print / Save PDF</button>
          <button class="btn-close" onclick="window.close()">✕ Close</button>
        </div>
      </div>
    </body>
    </html>
  `);
  win.document.close();
}

function buildReceiptFromLog(log, userName) {
  return {
    receiptId : generateReceiptId(),
    timestamp : log.ts,
    name      : userName || log.uid,
    uid       : log.uid,
    service   : (log.event || '').replace('PAY:', '') || 'General',
    amount    : log.amount,
    status    : log.status,
    balance   : log.balance ?? undefined,
  };
}

// ══════════════════════════════════════════
//  SEND RECEIPT MODAL
// ══════════════════════════════════════════
function SendReceiptModal({ receipt, userEmail, onClose }) {
  const [email,   setEmail]   = useState(userEmail || '');
  const [sending, setSending] = useState(false);
  const [result,  setResult]  = useState(null);

  const handleSend = async () => {
    if (!email.trim()) {
      setResult({ ok: false, message: 'Please enter an email address' });
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const res = await axios.post(`${API}/receipt/send`, {
        receipt_id : receipt.receiptId,
        timestamp  : receipt.timestamp,
        name       : receipt.name,
        uid        : receipt.uid,
        service    : receipt.service,
        amount     : receipt.amount,
        status     : receipt.status,
        balance    : receipt.balance,
        email      : email.trim(),
      });
      setResult({ ok: true, message: res.data.message || `Receipt sent to ${email}` });
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Failed to send receipt. Check backend email config.';
      setResult({ ok: false, message: errMsg });
    }
    setSending(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📤 Send Receipt via Email</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="receipt-preview-mini">
            {[
              { label: 'Receipt ID', value: receipt.receiptId },
              { label: 'Customer',   value: receipt.name },
              { label: 'Amount',     value: `₹${receipt.amount}`, cls: 'rpm-gold' },
              { label: 'Service',    value: receipt.service },
            ].map(({ label, value, cls }) => (
              <div className="rpm-row" key={label}>
                <span className="rpm-label">{label}</span>
                <span className={`rpm-value ${cls || ''}`}>{value}</span>
              </div>
            ))}
            <div className="rpm-row">
              <span className="rpm-label">Status</span>
              <span className={`rpm-value ${receipt.status === 'APPROVED' ? 'rpm-green' : 'rpm-red'}`}>
                {receipt.status === 'APPROVED' ? '✅' : '❌'} {receipt.status}
              </span>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: 16 }}>
            <label>📧 Recipient Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="customer@example.com"
              disabled={sending}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
            />
          </div>

          {result && (
            <div className={`send-result ${result.ok ? 'send-success' : 'send-error'}`}>
              {result.ok ? '✅' : '❌'} {result.message}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={handleSend} disabled={sending} className="btn-send-email">
            {sending ? '⏳ Sending...' : '📧 Send Receipt'}
          </button>
          <button onClick={() => printReceipt(receipt)} className="btn-modal-print">
            🧾 Print Instead
          </button>
          <button onClick={onClose} className="btn-modal-cancel">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
//  RECEIPT ACTION BUTTONS
// ══════════════════════════════════════════
function ReceiptButtons({ log, userName, userEmail, users }) {
  const [showSendModal, setShowSendModal] = useState(false);

  const receipt = buildReceiptFromLog(log, userName);

  let email = userEmail || '';
  if (!email && users) {
    const user = users.find(u => u.uid === log.uid);
    if (user?.email) email = user.email;
  }

  return (
    <div className="receipt-btns">
      <button
        onClick={() => printReceipt(receipt)}
        className="btn-receipt"
        title="Download / Print Receipt"
      >
        🧾
      </button>
      <button
        onClick={() => setShowSendModal(true)}
        className="btn-send"
        title="Send Receipt via Email"
      >
        📤
      </button>
      {showSendModal && (
        <SendReceiptModal
          receipt={receipt}
          userEmail={email}
          onClose={() => setShowSendModal(false)}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════
//  MAIN APP
// ══════════════════════════════════════════
function App() {
  const [page,        setPage]        = useState('dashboard');
  const [stats,       setStats]       = useState({});
  const [users,       setUsers]       = useState([]);
  const [accessLogs,  setAccessLogs]  = useState([]);
  const [txLogs,      setTxLogs]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  const [regForm, setRegForm] = useState({ uid: '', name: '', role: 'ALLOW', balance: 500, email: '' });
  const [regMsg,  setRegMsg]  = useState('');

  const [payAmount,        setPayAmount]        = useState('');
  const [payService,       setPayService]       = useState('');
  const [payStatus,        setPayStatus]        = useState('idle');
  const [payResult,        setPayResult]        = useState(null);
  const [lastReceipt,      setLastReceipt]      = useState(null);
  const [showPaySendModal, setShowPaySendModal] = useState(false);

  const [topForm,   setTopForm]   = useState({ uid: '', amount: '' });
  const [topResult, setTopResult] = useState(null);

  const [topupAmounts, setTopupAmounts] = useState({});

  const [editingId, setEditingId] = useState(null);
  const [editForm,  setEditForm]  = useState({ name: '', role: 'ALLOW', balance: 0, email: '' });

  // ── Refs to avoid stale closure in polling ──────────────────────
  const payAmountRef  = useRef(payAmount);
  const payServiceRef = useRef(payService);
  const usersRef      = useRef(users);

  useEffect(() => { payAmountRef.current  = payAmount;  }, [payAmount]);
  useEffect(() => { payServiceRef.current = payService; }, [payService]);
  useEffect(() => { usersRef.current      = users;      }, [users]);
  // ────────────────────────────────────────────────────────────────

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
      setError(null);
    } catch {
      setError('Cannot connect to backend. Make sure backend.py is running on port 5000.');
    }
    setLoading(false);
  }, []);

  // ── Auto-refresh every 5 s ──────────────────────────────────────
  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 5000);
    return () => clearInterval(id);
  }, [fetchAll]);

  // ── Payment polling ─────────────────────────────────────────────
  useEffect(() => {
    if (payStatus !== 'waiting') return;

    const id = setInterval(async () => {
      try {
        const statusRes = await axios.get(`${API}/pay/status`);
        if (statusRes.data.active) return;   // still waiting

        const logsRes = await axios.get(`${API}/logs`);
        const latest  = logsRes.data[0];

        if (!latest) return;

        const isPayEvent = latest.event?.startsWith('PAY:');
        const isFinal    =
          latest.status === 'APPROVED'           ||
          latest.status.includes('DECLINED')     ||
          latest.status.includes('DENY')         ||
          latest.status.includes('BLOCKED');

        if (isPayEvent && isFinal) {
          const isSuccess = latest.status === 'APPROVED';
          setPayStatus(isSuccess ? 'success' : 'failed');
          setPayResult(latest);

          // ── Resolve name from users ref (no stale closure) ──
          const matchedUser = usersRef.current.find(u => u.uid === latest.uid);
          const resolvedName = matchedUser?.name || latest.uid;

          const receipt = {
            receiptId : generateReceiptId(),
            timestamp : latest.ts || new Date().toLocaleString(),
            name      : resolvedName,
            uid       : latest.uid,
            service   : (latest.event || '').replace('PAY:', '') || payServiceRef.current || 'General',
            amount    : latest.amount || payAmountRef.current,
            status    : latest.status,
            balance   : undefined,    // logs table has no balance_after column
          };
          setLastReceipt(receipt);

          fetchAll();

          // Auto-clear after 30 s
          setTimeout(() => {
            setPayStatus('idle');
            setPayResult(null);
            setLastReceipt(null);
            setShowPaySendModal(false);
          }, 30000);
        }
      } catch {
        // silently ignore polling errors
      }
    }, 1000);

    return () => clearInterval(id);
  }, [payStatus, fetchAll]);
  // ────────────────────────────────────────────────────────────────

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/users`, regForm);
      setRegMsg(`✅ ${regForm.name} registered!`);
      setRegForm({ uid: '', name: '', role: 'ALLOW', balance: 500, email: '' });
      fetchAll();
      setTimeout(() => setRegMsg(''), 3000);
    } catch (err) {
      setRegMsg('❌ ' + (err.response?.data?.error || 'Error'));
    }
  };

  const handleDelete = async (uid, name) => {
    if (!window.confirm(`Delete ${name}?`)) return;
    await axios.delete(`${API}/users/${uid}`);
    fetchAll();
  };

  const handleInlineTopup = async (uid) => {
    const amount = parseInt(topupAmounts[uid] || 0);
    if (amount <= 0) return;
    await axios.post(`${API}/topup`, { uid, amount });
    setTopupAmounts(prev => ({ ...prev, [uid]: '' }));
    fetchAll();
  };

  const handleBlock = async (uid, name) => {
    if (!window.confirm(`⛔ Block card for "${name}"?\n\nThis will DENY all access and payments.`)) return;
    try {
      await axios.post(`${API}/users/${uid}/block`);
      alert(`🔒 ${name} has been BLOCKED`);
      fetchAll();
    } catch { alert('Error blocking user'); }
  };

  const handleUnblock = async (uid, name) => {
    if (!window.confirm(`✅ Unblock card for "${name}"?\n\nThis will restore normal access.`)) return;
    try {
      await axios.post(`${API}/users/${uid}/unblock`);
      alert(`🔓 ${name} has been UNBLOCKED`);
      fetchAll();
    } catch { alert('Error unblocking user'); }
  };

  const handleEditClick = (user) => {
    setEditingId(user.uid);
    setEditForm({
      name    : user.name,
      role    : (user.role || 'ALLOW').toUpperCase(),
      balance : user.balance,
      email   : user.email || '',
    });
  };

  const handleSave = async (uid) => {
    try {
      await axios.put(`${API}/users/${uid}`, {
        name    : editForm.name,
        role    : editForm.role,
        balance : parseFloat(editForm.balance),
        email   : editForm.email,
      });
      setEditingId(null);
      fetchAll();
    } catch { alert('Failed to update user'); }
  };

  const handleSetupPayment = async (e) => {
    e.preventDefault();
    const amount = parseInt(payAmount);
    if (!amount || amount <= 0) return;
    try {
      await axios.post(`${API}/pay/setup`, { amount, service: payService || 'General' });
      setPayStatus('waiting');
      setPayResult(null);
      setLastReceipt(null);
      setShowPaySendModal(false);
    } catch {
      setPayStatus('failed');
      setPayResult({ status: 'SETUP_ERROR' });
    }
  };

  const handleCancelPayment = async () => {
    try { await axios.post(`${API}/pay/cancel`); } catch { /* ignore */ }
    setPayStatus('idle');
    setPayResult(null);
    setLastReceipt(null);
    setShowPaySendModal(false);
  };

  const handleWalletTopup = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API}/topup`, topForm);
      setTopResult({ type: 'success', data: res.data });
      fetchAll();
    } catch (err) {
      setTopResult({ type: 'error', data: err.response?.data || { error: 'Failed' } });
    }
    setTimeout(() => setTopResult(null), 4000);
  };

  const resetPayment = () => {
    setPayStatus('idle');
    setPayResult(null);
    setLastReceipt(null);
    setShowPaySendModal(false);
  };

  // ── Helpers ──────────────────────────────────────────────────────
  const getBadge = (value) => {
    const v = (value || '').toUpperCase();
    if (v === 'VIP')   return 'badge-vip';
    if (v === 'BLOCK' || v === 'BLOCKED') return 'badge-block';
    if (v === 'ALLOW' || v === 'APPROVED' || v === 'OK') return 'badge-allow';
    if (v === 'DENY'  || v.includes('DECLINED') || v.includes('DENY') || v.includes('BLOCKED'))
      return 'badge-deny';
    return 'badge-allow';
  };

  const isBlocked    = (role)  => (role || '').toUpperCase() === 'BLOCK';
  const getUserEmail = (uid)   => users.find(u => u.uid === uid)?.email || '';
  const getUserName  = (uid)   => users.find(u => u.uid === uid)?.name  || '';

  const renderAccessTable = (logs) =>
    logs.map((l, i) => (
      <tr key={i}>
        <td>{l.ts}</td>
        <td><code>{l.uid}</code></td>
        <td>{l.name}</td>
        <td><span className={`badge ${getBadge(l.decision)}`}>{l.decision}</span></td>
      </tr>
    ));

  if (loading) {
    return (
      <div className="app">
        <div className="loading">⏳ Connecting to LuminoPass...</div>
      </div>
    );
  }

  const vipLogs   = accessLogs.filter(l => l.decision === 'VIP');
  const allowLogs = accessLogs.filter(l => l.decision === 'ALLOW');
  const denyLogs  = accessLogs.filter(l => l.decision === 'DENY');

  return (
    <div className="app">
      {/* ── NAVBAR ─────────────────────────────────────────────── */}
      <nav className="navbar">
        <div className="logo">⚡ LuminoPass</div>
        <div className="links">
          {[
            { key: 'dashboard',  icon: '📊', label: 'Dashboard'      },
            { key: 'wallet',      icon: '💳', label: 'Wallet'        },
            { key: 'payments',    icon: '🧾', label: 'Payment Log'   },
            { key: 'search',      icon: '🔍', label: 'Search'        },
          ].map(({ key, icon, label }) => (
            <button
              key={key}
              className={`nav-btn ${page === key ? 'active' : ''}`}
              onClick={() => setPage(key)}
            >
              {icon} {label}
            </button>
          ))}
        </div>
      </nav>

      <div className="container">
        {error && <div className="error-banner">⚠️ {error}</div>}

        {/* ══════════════ DASHBOARD ══════════════ */}
        {page === 'dashboard' && (
          <>
            <div className="page-header">
              <span className="title">📊 Dashboard</span>
              <button className="btn-refresh" onClick={fetchAll}>🔄 Refresh</button>
            </div>

            {/* STATS */}
            <div className="stats-grid">
              {[
                { icon: '👥', label: 'Users',         value: stats.total_users        || 0 },
                { icon: '🪪', label: 'Access Taps',   value: stats.total_access       || 0 },
                { icon: '💳', label: 'Transactions',  value: stats.total_transactions || 0 },
                { icon: '✅', label: 'Approved',       value: stats.approved_payments  || 0 },
                { icon: '🚫', label: 'Denied',         value: stats.denied_count       || 0 },
                { icon: '🔒', label: 'Blocked',        value: stats.blocked_users      || 0 },
                { icon: '💰', label: 'Total Balance',  value: `₹${stats.total_balance || 0}` },
              ].map((c, i) => (
                <div className="stat-card" key={i}>
                  <div className="icon">{c.icon}</div>
                  <div className="number">{c.value}</div>
                  <div className="label">{c.label}</div>
                </div>
              ))}
            </div>

            {/* REGISTER NEW USER */}
            <div className="section">
              <h2>➕ Register New User</h2>
              {regMsg && (
                <p className={regMsg.startsWith('✅') ? 'msg-success' : 'msg-error'}>{regMsg}</p>
              )}
              <form onSubmit={handleRegister}>
                <div className="form-row">
                  <div className="form-group">
                    <label>UID</label>
                    <input
                      value={regForm.uid}
                      onChange={e => setRegForm({ ...regForm, uid: e.target.value })}
                      placeholder="e.g. A015FA0E"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Name</label>
                    <input
                      value={regForm.name}
                      onChange={e => setRegForm({ ...regForm, name: e.target.value })}
                      placeholder="Guest name"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>📧 Email</label>
                    <input
                      type="email"
                      value={regForm.email}
                      onChange={e => setRegForm({ ...regForm, email: e.target.value })}
                      placeholder="guest@email.com"
                    />
                  </div>
                  <div className="form-group">
                    <label>Role</label>
                    <select
                      value={regForm.role}
                      onChange={e => setRegForm({ ...regForm, role: e.target.value })}
                    >
                      <option value="ALLOW">ALLOW</option>
                      <option value="VIP">VIP</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Balance ₹</label>
                    <input
                      type="number"
                      value={regForm.balance}
                      onChange={e => setRegForm({ ...regForm, balance: e.target.value })}
                      step="50"
                    />
                  </div>
                  <button type="submit">Register</button>
                </div>
              </form>
            </div>

            {/* USER TABLE */}
            <div className="section">
              <h2>👥 Registered Users ({users.length})</h2>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>UID</th><th>Name</th><th>Role</th>
                      <th>Balance</th><th>Email</th><th>Top Up</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.uid} style={isBlocked(u.role) ? { background: '#1a0000' } : {}}>
                        <td><code>{u.uid}</code></td>

                        {editingId === u.uid ? (
                          <React.Fragment>
                            <td>
                              <input
                                type="text"
                                value={editForm.name}
                                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                className="edit-input"
                              />
                            </td>
                            <td>
                              <select
                                value={editForm.role}
                                onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                                className="edit-select"
                              >
                                <option value="ALLOW">ALLOW</option>
                                <option value="VIP">VIP</option>
                                <option value="BLOCK">⛔ BLOCK</option>
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                value={editForm.balance}
                                onChange={e => setEditForm({ ...editForm, balance: e.target.value })}
                                className="edit-input"
                                style={{ width: 90 }}
                              />
                            </td>
                            <td>
                              <input
                                type="email"
                                value={editForm.email}
                                onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                className="edit-input"
                                placeholder="email"
                              />
                            </td>
                            <td colSpan={2}>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => handleSave(u.uid)} className="btn-save-inline">✅ Save</button>
                                <button onClick={() => setEditingId(null)} className="btn-cancel-inline">✕</button>
                              </div>
                            </td>
                          </React.Fragment>
                        ) : (
                          <React.Fragment>
                            <td>
                              {u.name}
                              {isBlocked(u.role) && (
                                <span style={{ color: '#ff3333', marginLeft: 8, fontSize: '0.75em', fontWeight: 'bold' }}>
                                  🔒 LOST CARD
                                </span>
                              )}
                            </td>
                            <td>
                              <span className={`badge ${getBadge(u.role)}`}>
                                {(u.role || 'ALLOW').toUpperCase()}
                              </span>
                            </td>
                            <td style={{ fontWeight: 700 }}>₹{u.balance}</td>
                            <td>
                              <span className="email-cell">
                                {u.email || <span style={{ color: '#555' }}>—</span>}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 5 }}>
                                <input
                                  type="number"
                                  placeholder="₹"
                                  value={topupAmounts[u.uid] || ''}
                                  onChange={e => setTopupAmounts({ ...topupAmounts, [u.uid]: e.target.value })}
                                  style={{ width: 80, padding: '6px 8px' }}
                                />
                                <button className="btn-topup" onClick={() => handleInlineTopup(u.uid)}>
                                  +Add
                                </button>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <button onClick={() => handleEditClick(u)} className="btn-edit">✏️</button>
                                {isBlocked(u.role) ? (
                                  <button onClick={() => handleUnblock(u.uid, u.name)} className="btn-unblock">🔓</button>
                                ) : (
                                  <button onClick={() => handleBlock(u.uid, u.name)} className="btn-block">🔒</button>
                                )}
                                <button className="btn-delete" onClick={() => handleDelete(u.uid, u.name)}>🗑️</button>
                              </div>
                            </td>
                          </React.Fragment>
                        )}
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr><td colSpan={7} className="empty">No users yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ACCESS LOG SECTIONS */}
            {[
              { title: '🟢 VIP Access',    logs: vipLogs,   cls: 'section-vip'   },
              { title: '🔵 Normal Access', logs: allowLogs, cls: 'section-allow' },
              { title: '🔴 Denied Access', logs: denyLogs,  cls: 'section-deny'  },
            ].map(({ title, logs, cls }) => (
              <div className={`section ${cls}`} key={cls}>
                <h2>{title} ({logs.length})</h2>
                <table>
                  <thead><tr><th>Time</th><th>UID</th><th>Name</th><th>Decision</th></tr></thead>
                  <tbody>
                    {logs.length > 0
                      ? renderAccessTable(logs)
                      : <tr><td colSpan={4} className="empty">No entries yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            ))}

            {/* TRANSACTION LOG */}
            <div className="section">
              <h2>💳 Transaction Log</h2>
              <table>
                <thead>
                  <tr>
                    <th>Time</th><th>UID</th><th>Event</th>
                    <th>Amount</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {txLogs.map((l, i) => (
                    <tr key={i}>
                      <td>{l.ts}</td>
                      <td><code>{l.uid}</code></td>
                      <td>{l.event}</td>
                      <td>₹{l.amount}</td>
                      <td><span className={`badge ${getBadge(l.status)}`}>{l.status}</span></td>
                      <td>
                        {l.event?.startsWith('PAY:') && (
                          <ReceiptButtons
                            log={l}
                            userName={getUserName(l.uid)}
                            userEmail={getUserEmail(l.uid)}
                            users={users}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                  {txLogs.length === 0 && (
                    <tr><td colSpan={6} className="empty">No transactions yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ══════════════ WALLET ══════════════ */}
        {page === 'wallet' && (
          <>
            <div className="page-header">
              <span className="title">💳 Wallet / Tap-and-Pay</span>
            </div>

            <div className="wallet-grid">
              {/* MAKE PAYMENT */}
              <div className="section">
                <h2>💸 Make Payment</h2>

                {payStatus === 'idle' && (
                  <form onSubmit={handleSetupPayment}>
                    <div className="form-group" style={{ marginBottom: 12 }}>
                      <label>Amount ₹</label>
                      <input
                        type="number"
                        value={payAmount}
                        onChange={e => setPayAmount(e.target.value)}
                        placeholder="100"
                        required
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 12 }}>
                      <label>Service / Stall</label>
                      <input
                        value={payService}
                        onChange={e => setPayService(e.target.value)}
                        placeholder="Food Stall"
                      />
                    </div>
                    <button type="submit">💸 Ready to Pay</button>
                  </form>
                )}

                {payStatus === 'waiting' && (
                  <div className="waiting-card">
                    <div className="pulse-icon">📡</div>
                    <h3>Waiting for Card Tap...</h3>
                    <p>₹{payAmount} at {payService || 'General'}</p>
                    <p style={{ color: '#888', fontSize: '0.85em', marginTop: 10 }}>
                      Ask the customer to tap their RFID card
                    </p>
                    <button
                      className="btn-delete"
                      style={{ marginTop: 15 }}
                      onClick={handleCancelPayment}
                    >
                      ✕ Cancel Payment
                    </button>
                  </div>
                )}

                {payStatus === 'success' && payResult && (
                  <div className="result-card success">
                    <h3>✅ Payment Approved!</h3>
                    <p>₹{payResult.amount} at {payResult.event?.replace('PAY:', '') || ''}</p>
                    <p>Status: {payResult.status}</p>
                    {lastReceipt && (
                      <div className="pay-receipt-actions">
                        <p className="receipt-id-display">Receipt ID: {lastReceipt.receiptId}</p>
                        <div className="pay-receipt-btns">
                          <button onClick={() => printReceipt(lastReceipt)} className="btn-receipt-large">
                            🧾 Download Receipt
                          </button>
                          <button onClick={() => setShowPaySendModal(true)} className="btn-send-large">
                            📤 Send to Customer
                          </button>
                          <button onClick={resetPayment} className="btn-new-payment">
                            ➕ New Payment
                          </button>
                        </div>
                        {showPaySendModal && (
                          <SendReceiptModal
                            receipt={lastReceipt}
                            userEmail={getUserEmail(lastReceipt.uid)}
                            onClose={() => setShowPaySendModal(false)}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}

                {payStatus === 'failed' && payResult && (
                  <div className="result-card failed">
                    <h3>❌ Payment Failed</h3>
                    <p>Status: {payResult.status}</p>
                    <button onClick={resetPayment} className="btn-new-payment" style={{ marginTop: 10 }}>
                      Try Again
                    </button>
                  </div>
                )}
              </div>

              {/* TOP UP BALANCE */}
              <div className="section">
                <h2>💰 Top Up Balance</h2>
                {topResult && (
                  <p className={topResult.type === 'success' ? 'msg-success' : 'msg-error'}>
                    {topResult.type === 'success'
                      ? `✅ ₹${topResult.data.new_balance} new balance for ${topResult.data.name}`
                      : '❌ Failed'}
                  </p>
                )}
                <form onSubmit={handleWalletTopup}>
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label>UID</label>
                    <input
                      value={topForm.uid}
                      onChange={e => setTopForm({ ...topForm, uid: e.target.value })}
                      placeholder="e.g. D3FCB4C9"
                      required
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label>Amount ₹</label>
                    <input
                      type="number"
                      value={topForm.amount}
                      onChange={e => setTopForm({ ...topForm, amount: e.target.value })}
                      placeholder="500"
                      required
                    />
                  </div>
                  <button type="submit">💰 Top Up</button>
                </form>
              </div>
            </div>
          </>
        )}

        {/* ══════════════ PAYMENT LOG ══════════════ */}
        {page === 'payments' && <PaymentLog />}

        {/* ══════════════ SEARCH ══════════════ */}
        {page === 'search' && (
          <SearchPage
            getBadge={getBadge}
            renderAccessTable={renderAccessTable}
            users={users}
          />
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
//  SEARCH PAGE
// ══════════════════════════════════════════
function SearchPage({ getBadge, renderAccessTable, users }) {
  const [query,         setQuery]         = useState('');
  const [results,       setResults]       = useState(null);
  const [summary,       setSummary]       = useState(null);
  const [loadingSearch, setLoadingSearch] = useState(false);

  const isBlocked = (role) => (role || '').toUpperCase() === 'BLOCK';

  const handleSearchBlock = async (uid, name) => {
    if (!window.confirm(`⛔ Block card for "${name}"?`)) return;
    try {
      await axios.post(`${API}/users/${uid}/block`);
      alert(`🔒 ${name} has been BLOCKED`);
      setSummary(prev => prev?.uid === uid ? { ...prev, role: 'BLOCK' } : prev);
      setResults(prev => prev
        ? { ...prev, users: prev.users.map(u => u.uid === uid ? { ...u, role: 'BLOCK' } : u) }
        : prev
      );
    } catch { alert('Error blocking user'); }
  };

  const handleSearchUnblock = async (uid, name) => {
    if (!window.confirm(`✅ Unblock card for "${name}"?`)) return;
    try {
      await axios.post(`${API}/users/${uid}/unblock`);
      alert(`🔓 ${name} has been UNBLOCKED`);
      setSummary(prev => prev?.uid === uid ? { ...prev, role: 'ALLOW' } : prev);
      setResults(prev => prev
        ? { ...prev, users: prev.users.map(u => u.uid === uid ? { ...u, role: 'ALLOW' } : u) }
        : prev
      );
    } catch { alert('Error unblocking user'); }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoadingSearch(true);
    setSummary(null);
    try {
      const res = await axios.get(`${API}/search?q=${query}`);
      setResults(res.data);

      const uid =
        res.data.users?.length === 1
          ? res.data.users[0].uid
          : query.trim().length >= 8
            ? query.trim()
            : null;

      if (uid) {
        try {
          const sumRes = await axios.get(`${API}/user_summary/${uid}`);
          setSummary(sumRes.data);
        } catch { /* no summary */ }
      }
    } catch (err) { console.error(err); }
    setLoadingSearch(false);
  };

  // ── Chart helpers ─────────────────────────────────────────────
  const getSpendingByStall = () => {
    if (!summary?.payments) return [];
    const map = {};
    summary.payments.forEach(p => {
      if (p.event?.startsWith('PAY:') && p.status === 'APPROVED') {
        const stall = p.event.replace('PAY:', '') || 'General';
        map[stall] = (map[stall] || 0) + p.amount;
      }
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  };

  const getMoneyOverview = () => {
    if (!summary) return [];
    const data = [];
    if (summary.balance    > 0) data.push({ name: 'Current Balance', value: summary.balance    });
    if (summary.total_spent > 0) data.push({ name: 'Total Spent',    value: summary.total_spent });
    return data;
  };

  const getFlowChart = () => {
    if (!summary) return [];
    const data = [];
    if (summary.total_topup  > 0) data.push({ name: 'Total Topped Up',    value: summary.total_topup  });
    if (summary.total_spent  > 0) data.push({ name: 'Total Spent',        value: summary.total_spent  });
    if (summary.balance      > 0) data.push({ name: 'Remaining Balance',  value: summary.balance      });
    return data;
  };

  const spendingData = getSpendingByStall();
  const moneyData    = getMoneyOverview();
  const flowData     = getFlowChart();

  const renderCustomLabel = ({ name, percent }) =>
    `${name} (${(percent * 100).toFixed(0)}%)`;

  const tooltipStyle = {
    contentStyle : { background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 },
    itemStyle    : { color: '#fff' },
  };

  return (
    <>
      <div className="page-header"><span className="title">🔍 Search</span></div>

      <form onSubmit={handleSearch}>
        <div className="search-box">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by UID or Name..."
          />
          <button type="submit">Search</button>
        </div>
      </form>

      {loadingSearch && <div className="loading">Searching...</div>}

      {/* ── USER SUMMARY ───────────────────────────────────────── */}
      {summary && (
        <div className="section summary-card">
          <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <span>📋 User Summary — {summary.name}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {isBlocked(summary.role) ? (
                <button onClick={() => handleSearchUnblock(summary.uid, summary.name)} className="btn-unblock">
                  🔓 Unblock Card
                </button>
              ) : (
                <button onClick={() => handleSearchBlock(summary.uid, summary.name)} className="btn-block">
                  🔒 Block Card (Lost/Stolen)
                </button>
              )}
            </div>
          </h2>

          {isBlocked(summary.role) && (
            <div className="blocked-banner">
              ⛔ THIS CARD IS BLOCKED — All access and payments are denied
            </div>
          )}

          <div className="summary-grid">
            {[
              { label: '👤 Name',             value: summary.name                                                          },
              { label: '🆔 UID',              value: <code>{summary.uid}</code>                                            },
              { label: '🏷️ Role',             value: <span className={`badge ${getBadge(summary.role)}`}>{summary.role}</span> },
              { label: '💰 Current Balance', value: <span className="summary-balance">₹{summary.balance}</span>          },
              { label: '💸 Total Spent',     value: <span className="summary-spent">₹{summary.total_spent}</span>        },
              { label: '💰 Total Topped Up', value: <span className="summary-topup">₹{summary.total_topup}</span>        },
              { label: '🪪 Total Access',    value: `${summary.total_access} times`                                       },
              { label: '✅ Approved',         value: summary.approved_count                                                },
              { label: '❌ Declined',         value: summary.declined_count                                                },
              { label: '📧 Email',            value: summary.email || <span style={{ color: '#555' }}>Not set</span>      },
              { label: '🕐 Last Seen',        value: summary.last_access                                                 },
            ].map(({ label, value }) => (
              <div className="summary-item" key={label}>
                <div className="summary-label">{label}</div>
                <div className="summary-value">{value}</div>
              </div>
            ))}
          </div>

          {/* CHARTS */}
          <div className="charts-grid">
            {flowData.length > 0 && (
              <div className="chart-card">
                <h3>💰 Money Flow</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={flowData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" label={renderCustomLabel}>
                      {flowData.map((entry, idx) => (
                        <Cell key={idx} fill={
                          entry.name === 'Remaining Balance' ? '#ffd700' :
                          entry.name === 'Total Spent'       ? '#ef5350' : '#4caf50'
                        } />
                      ))}
                    </Pie>
                    <Tooltip formatter={v => `₹${v}`} {...tooltipStyle} />
                    <Legend wrapperStyle={{ color: '#ccc', fontSize: '0.85em' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {spendingData.length > 0 && (
              <div className="chart-card">
                <h3>🍕 Spending by Stall</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={spendingData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" label={renderCustomLabel}>
                      {spendingData.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={v => `₹${v}`} {...tooltipStyle} />
                    <Legend wrapperStyle={{ color: '#ccc', fontSize: '0.85em' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {moneyData.length > 0 && (
              <div className="chart-card">
                <h3>📊 Balance vs Spent</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={moneyData} cx="50%" cy="50%" outerRadius={100} paddingAngle={3} dataKey="value" label={renderCustomLabel}>
                      {moneyData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.name === 'Current Balance' ? '#ffd700' : '#ef5350'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={v => `₹${v}`} {...tooltipStyle} />
                    <Legend wrapperStyle={{ color: '#ccc', fontSize: '0.85em' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {spendingData.length === 0 && flowData.length === 0 && (
            <p style={{ color: '#666', textAlign: 'center', marginTop: 15 }}>No spending data yet.</p>
          )}

          {/* PAYMENT HISTORY */}
          {summary.payments?.length > 0 && (
            <>
              <h3 style={{ color: '#ffd700', marginTop: 25, marginBottom: 10 }}>💳 Payment History</h3>
              <table>
                <thead>
                  <tr><th>Time</th><th>Event</th><th>Amount</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {summary.payments.map((p, i) => (
                    <tr key={i}>
                      <td>{p.ts}</td>
                      <td>{p.event}</td>
                      <td>₹{p.amount}</td>
                      <td><span className={`badge ${getBadge(p.status)}`}>{p.status}</span></td>
                      <td>
                        {p.event?.startsWith('PAY:') && (
                          <ReceiptButtons
                            log={{ ...p, uid: summary.uid }}
                            userName={summary.name}
                            userEmail={summary.email || ''}
                            users={users}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* ── SEARCH RESULTS ─────────────────────────────────────── */}
      {results && (
        <>
          {/* USERS */}
          <div className="section">
            <h2>👥 Users ({results.users?.length || 0})</h2>
            <table>
              <thead>
                <tr>
                  <th>UID</th><th>Name</th><th>Role</th>
                  <th>Balance</th><th>Email</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(results.users || []).map(u => (
                  <tr key={u.uid} style={isBlocked(u.role) ? { background: '#1a0000' } : {}}>
                    <td><code>{u.uid}</code></td>
                    <td>
                      {u.name}
                      {isBlocked(u.role) && (
                        <span style={{ color: '#ff3333', marginLeft: 8, fontSize: '0.75em', fontWeight: 'bold' }}>
                          🔒 LOST CARD
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${getBadge(u.role)}`}>
                        {(u.role || 'ALLOW').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700 }}>₹{u.balance}</td>
                    <td>
                      <span className="email-cell">
                        {u.email || <span style={{ color: '#555' }}>—</span>}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {isBlocked(u.role) ? (
                          <button onClick={() => handleSearchUnblock(u.uid, u.name)} className="btn-unblock">🔓</button>
                        ) : (
                          <button onClick={() => handleSearchBlock(u.uid, u.name)} className="btn-block">🔒</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {(results.users?.length === 0) && (
                  <tr><td colSpan={6} className="empty">No users found matching "{query}".</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* VIP ACCESS LOGS */}
          <div className="section section-vip">
            <h2>🟢 VIP Access ({(results.access_logs || []).filter(l => l.decision === 'VIP').length})</h2>
            <table>
              <thead><tr><th>Time</th><th>UID</th><th>Name</th><th>Decision</th></tr></thead>
              <tbody>
                {(results.access_logs || []).filter(l => l.decision === 'VIP').length > 0
                  ? renderAccessTable((results.access_logs || []).filter(l => l.decision === 'VIP'))
                  : <tr><td colSpan={4} className="empty">No VIP access found.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* NORMAL ACCESS LOGS */}
          <div className="section section-allow">
            <h2>🔵 Normal Access ({(results.access_logs || []).filter(l => l.decision === 'ALLOW').length})</h2>
            <table>
              <thead><tr><th>Time</th><th>UID</th><th>Name</th><th>Decision</th></tr></thead>
              <tbody>
                {(results.access_logs || []).filter(l => l.decision === 'ALLOW').length > 0
                  ? renderAccessTable((results.access_logs || []).filter(l => l.decision === 'ALLOW'))
                  : <tr><td colSpan={4} className="empty">No normal access found.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* DENIED ACCESS LOGS */}
          <div className="section section-deny">
            <h2>🔴 Denied Access ({(results.access_logs || []).filter(l => l.decision === 'DENY').length})</h2>
            <table>
              <thead><tr><th>Time</th><th>UID</th><th>Name</th><th>Decision</th></tr></thead>
              <tbody>
                {(results.access_logs || []).filter(l => l.decision === 'DENY').length > 0
                  ? renderAccessTable((results.access_logs || []).filter(l => l.decision === 'DENY'))
                  : <tr><td colSpan={4} className="empty">No denied access found.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* TRANSACTION LOGS */}
          <div className="section">
            <h2>💳 Transactions ({(results.transaction_logs || []).length})</h2>
            <table>
              <thead>
                <tr>
                  <th>Time</th><th>UID</th><th>Event</th>
                  <th>Amount</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(results.transaction_logs || []).map((l, i) => (
                  <tr key={i}>
                    <td>{l.ts}</td>
                    <td><code>{l.uid}</code></td>
                    <td>{l.event}</td>
                    <td>₹{l.amount}</td>
                    <td>
                      <span className={`badge ${getBadge(l.status)}`}>{l.status}</span>
                    </td>
                    <td>
                      {l.event?.startsWith('PAY:') && (
                        <ReceiptButtons log={l} users={users} />
                      )}
                    </td>
                  </tr>
                ))}
                {(results.transaction_logs || []).length === 0 && (
                  <tr><td colSpan={6} className="empty">No transactions found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

export default App;