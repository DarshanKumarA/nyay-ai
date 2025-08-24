// frontend/src/components/Sidebar.jsx

import React from 'react';
import { NavLink } from 'react-router-dom';
import { VscLaw } from 'react-icons/vsc';
import { LuLayoutDashboard, LuFileText, LuSearch, LuShieldCheck, LuSettings, LuBrainCircuit } from 'react-icons/lu';
import { useAuth } from '../context/AuthContext';
import './Sidebar.css';

function Sidebar() {
  const { isAuthenticated, user } = useAuth();

  const getInitials = (name) => {
    if (!name) return '';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name[0].toUpperCase();
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <VscLaw size={30} />
        <h1>Nyay AI</h1>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/" end><LuLayoutDashboard /> Dashboard</NavLink>
        <NavLink to="/summarize"><LuFileText /> Summarize Case</NavLink>
        <NavLink to="/precedents"><LuSearch /> Precedent Analysis</NavLink>
        <NavLink to="/evidence"><LuShieldCheck /> Evidence Analysis</NavLink>
        {/* --- NEW: Add the link to the new page --- */}
        <NavLink to="/personalize"><LuBrainCircuit /> Personalize AI</NavLink>
      </nav>
      <div className="sidebar-footer">
        <NavLink to="/settings"><LuSettings /> Settings</NavLink>
        
        {isAuthenticated && user && (
          <div className="user-profile">
            <div className="user-avatar">{getInitials(user.full_name)}</div>
            <span>{user.full_name}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default Sidebar;
