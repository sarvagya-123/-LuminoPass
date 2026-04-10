import React, { useState } from 'react';
import axios from 'axios';

const API = 'http://localhost:5000/api';

function UserTable({ users, onDone }) {
  const [topupAmounts, setTopupAmounts] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', role: 'ALLOW', balance: 0 });

  const handleDelete = async (uid, name) => {
    if (!window.confirm(`Delete ${name}?`)) return;
    try {
      await axios.delete(`${API}/users/${uid}`);
      if (onDone) onDone();
    } catch (err) {
      alert('Error deleting user');
    }
  };

  const handleTopup = async (uid) => {
    const amount = parseInt(topupAmounts[uid] || 0, 10);
    if (amount <= 0) return;
    try {
      await axios.post(`${API}/topup`, { uid, amount });
      setTopupAmounts({ ...topupAmounts, [uid]: '' });
      if (onDone) onDone();
    } catch (err) {
      alert('Error adding funds');
    }
  };

  const handleBlock = async (uid, name) => {
    if (!window.confirm('⛔ Block card for "' + name + '"?\n\nThis will DENY all access and payments.')) return;
    try {
      await axios.post(API + '/users/' + uid + '/block');
      alert('🔒 ' + name + ' has been BLOCKED');
      if (onDone) onDone();
    } catch (err) {
      alert('Error blocking user');
    }
  };

  const handleUnblock = async (uid, name) => {
    if (!window.confirm('✅ Unblock card for "' + name + '"?')) return;
    try {
      await axios.post(API + '/users/' + uid + '/unblock');
      alert('🔓 ' + name + ' has been UNBLOCKED');
      if (onDone) onDone();
    } catch (err) {
      alert('Error unblocking user');
    }
  };

  const handleEditClick = (user) => {
    setEditingId(user.uid);
    setEditForm({
      name: user.name,
      role: (user.role || 'ALLOW').toUpperCase(),
      balance: user.balance
    });
  };

  const handleSave = async (uid) => {
    try {
      await axios.put(API + '/users/' + uid, {
        name: editForm.name,
        role: editForm.role,
        balance: parseFloat(editForm.balance)
      });
      setEditingId(null);
      if (onDone) onDone();
    } catch (err) {
      alert('Failed to update user');
    }
  };

  const getBadgeClass = (role) => {
    var r = (role || '').toUpperCase();
    if (r === 'VIP') return 'badge badge-vip';
    if (r === 'ALLOW') return 'badge badge-allow';
    if (r === 'BLOCK') return 'badge badge-block';
    return 'badge badge-deny';
  };

  var isBlocked = (role) => (role || '').toUpperCase() === 'BLOCK';

  return (
    <div className="section">
      <h2>👥 Registered Users ({users.length})</h2>
      <table>
        <thead>
          <tr>
            <th>UID</th>
            <th>Name</th>
            <th>Role</th>
            <th>Balance</th>
            <th>Top Up</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(function(u) {
            return (
              <tr key={u.uid} style={isBlocked(u.role) ? {background: '#1a0000'} : {}}>
                <td><code>{u.uid}</code></td>

                {editingId === u.uid ? (
                  <React.Fragment>
                    <td>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={function(e) { setEditForm({...editForm, name: e.target.value}); }}
                        style={{width:'100%', padding:'8px', borderRadius:'4px', border:'1px solid #444', background:'#000', color:'white'}}
                      />
                    </td>
                    <td>
                      <select
                        value={editForm.role}
                        onChange={function(e) { setEditForm({...editForm, role: e.target.value}); }}
                        style={{padding:'8px', borderRadius:'4px', border:'1px solid #ffd700', background:'#222', color:'#ffd700', fontWeight:'bold'}}
                      >
                        <option value="ALLOW">ALLOW</option>
                        <option value="VIP">VIP</option>
                        <option value="BLOCK">BLOCK (LOST)</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        value={editForm.balance}
                        onChange={function(e) { setEditForm({...editForm, balance: e.target.value}); }}
                        style={{width:'90px', padding:'8px', borderRadius:'4px', border:'1px solid #444', background:'#000', color:'white'}}
                      />
                    </td>
                    <td colSpan={2}>
                      <div style={{display:'flex', gap:'8px'}}>
                        <button className="btn-topup" onClick={function() { handleSave(u.uid); }}>Save</button>
                        <button className="btn-edit" onClick={function() { setEditingId(null); }}>Cancel</button>
                      </div>
                    </td>
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    <td>
                      {u.name}
                      {isBlocked(u.role) && <span style={{color:'#ff3333', marginLeft:'8px', fontSize:'0.8em'}}>🔒 LOST CARD</span>}
                    </td>
                    <td>
                      <span className={getBadgeClass(u.role)}>
                        {(u.role || 'ALLOW').toUpperCase()}
                      </span>
                    </td>
                    <td style={{fontWeight: 700}}>₹{u.balance}</td>
                    <td>
                      <div style={{display:'flex', gap:'5px'}}>
                        <input
                          type="number"
                          placeholder="₹"
                          value={topupAmounts[u.uid] || ''}
                          onChange={function(e) { setTopupAmounts({...topupAmounts, [u.uid]: e.target.value}); }}
                          style={{width:'80px', padding:'6px 8px'}}
                        />
                        <button className="btn-topup" onClick={function() { handleTopup(u.uid); }}>+Add</button>
                      </div>
                    </td>
                    <td>
                      <div style={{display:'flex', gap:'6px', flexWrap:'wrap'}}>
                        <button
                          onClick={function() { handleEditClick(u); }}
                          style={{
                            background:'#1565c0',
                            color:'#ffffff',
                            padding:'6px 12px',
                            fontSize:'0.78em',
                            fontWeight:'700',
                            border:'1px solid #42a5f5',
                            borderRadius:'8px',
                            cursor:'pointer'
                          }}
                        >
                          ✏️ Edit
                        </button>

                        {isBlocked(u.role) ? (
                          <button
                            onClick={function() { handleUnblock(u.uid, u.name); }}
                            style={{
                              background:'#1b5e20',
                              color:'#ffffff',
                              padding:'6px 12px',
                              fontSize:'0.78em',
                              fontWeight:'700',
                              border:'1px solid #4caf50',
                              borderRadius:'8px',
                              cursor:'pointer'
                            }}
                          >
                            🔓 Unblock
                          </button>
                        ) : (
                          <button
                            onClick={function() { handleBlock(u.uid, u.name); }}
                            style={{
                              background:'#b71c1c',
                              color:'#ffffff',
                              padding:'6px 12px',
                              fontSize:'0.78em',
                              fontWeight:'700',
                              border:'1px solid #ef5350',
                              borderRadius:'8px',
                              cursor:'pointer'
                            }}
                          >
                            🔒 Block
                          </button>
                        )}

                        <button className="btn-delete" onClick={function() { handleDelete(u.uid, u.name); }}>
                          🗑️ Delete
                        </button>
                      </div>
                    </td>
                  </React.Fragment>
                )}
              </tr>
            );
          })}

          {users.length === 0 && (
            <tr><td colSpan={6} className="empty">No users registered yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default UserTable;