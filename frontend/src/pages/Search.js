import React, { useState } from 'react';
import axios from 'axios';
import UserTable from '../components/UserTable';
import AccessLog from '../components/AccessLog';
import TransactionLog from '../components/TransactionLog';

const API = 'http://localhost:5000/api';

function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/search?q=${query}`);
      setResults(res.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="page-header">
        <span className="title">🔍 Search</span>
      </div>

      <form onSubmit={handleSearch}>
        <div className="search-box">
          <input value={query} onChange={e => setQuery(e.target.value)}
                 placeholder="Search by UID or Name..." />
          <button type="submit">Search</button>
        </div>
      </form>

      {loading && <div className="loading">Searching...</div>}

      {results && (
        <>
          <UserTable users={results.users} onDone={() => {}} />
          <AccessLog logs={results.access_logs} />
          <TransactionLog logs={results.transaction_logs} />
          {results.users.length === 0 && results.access_logs.length === 0 && (
            <div className="loading">No results for "{query}"</div>
          )}
        </>
      )}
    </div>
  );
}

export default Search;