import React, { useState } from 'react';
import axios from 'axios';

const API = 'http://localhost:5000/api';

function RegisterForm({ onDone }) {
  const [form, setForm] = useState({ uid: '', name: '', role: 'ALLOW', balance: 500 });
  const [msg, setMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/users`, {
        uid: form.uid,
        name: form.name,
        role: form.role,
        balance: form.balance
      });
      setMsg(`✅ ${form.name} saved!`);
      setForm({ uid: '', name: '', role: 'ALLOW', balance: 500 });
      if (onDone) onDone();
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.error || 'Error'));
    }
  };

  return (
    <div className="section">
      <h2>➕ Register New User</h2>
      {msg && <p className={msg.startsWith('✅') ? 'msg-success' : 'msg-error'}>{msg}</p>}

      <form onSubmit={submit}>
        <div className="form-row">
          <div className="form-group">
            <label>UID</label>
            <input
              value={form.uid}
              onChange={e => setForm({ ...form, uid: e.target.value })}
              placeholder="e.g. A015FA0E"
              required
            />
          </div>

          <div className="form-group">
            <label>Name</label>
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Guest name"
              required
            />
          </div>

          <div className="form-group">
            <label>Role</label>
            <select
              value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value })}
            >
              <option value="ALLOW">ALLOW</option>
              <option value="VIP">VIP</option>
              <option value="BLOCK">⛔ BLOCK (LOST)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Balance ₹</label>
            <input
              type="number"
              value={form.balance}
              onChange={e => setForm({ ...form, balance: e.target.value })}
              step="50"
            />
          </div>

          <button type="submit">Register</button>
        </div>
      </form>
    </div>
  );
}

export default RegisterForm;