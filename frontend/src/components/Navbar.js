import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function Navbar() {
  const loc = useLocation();
  const isActive = (path) => loc.pathname === path ? 'active' : '';

  return (
    <nav className="navbar">
      <div className="logo">⚡ LuminoPass</div>
      <div className="links">
        <Link to="/" className={isActive('/')}>Dashboard</Link>
        <Link to="/wallet" className={isActive('/wallet')}>Wallet</Link>
        <Link to="/search" className={isActive('/search')}>Search</Link>
      </div>
    </nav>
  );
}

export default Navbar;