// frontend/src/pages/Dashboard.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LuFileText, LuSearch, LuShieldCheck, LuClock } from 'react-icons/lu';
import { useAuth } from '../context/AuthContext';
// --- NEW: Import API service functions ---
import { fetchUserFiles, fetchUserStats } from '../api/apiService';
import './Dashboard.css';

function Dashboard() {
  const { isAuthenticated, user } = useAuth();
  const [recentFiles, setRecentFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ casesAnalyzed: 0, precedentsFound: 0, contradictionsFlagged: 0 });

  useEffect(() => {
    const fetchData = async () => {
      if (isAuthenticated) {
        setIsLoading(true);
        try {
          // --- UPDATED: Use the centralized API service ---
          const [filesResponse, statsResponse] = await Promise.all([
            fetchUserFiles(),
            fetchUserStats()
          ]);

          setRecentFiles(filesResponse.data);
          setStats(statsResponse.data);

        } catch (error) {
          console.error("Error fetching dashboard data:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };
    fetchData();
  }, [isAuthenticated]);

  const timeSince = (dateString) => {
    const date = new Date(dateString.replace(' ', 'T') + 'Z');
    const seconds = Math.floor((new Date() - date) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    
    return "just now";
  };

  if (!isAuthenticated) {
    return (
        <div className="dashboard-logged-out">
            <h1>Welcome to Nyay AI</h1>
            <p>Please log in to access your dashboard and analyze case files.</p>
        </div>
    )
  }

  return (
    <>
      {/* For best practice, these styles should be moved to your Dashboard.css file */}
      <style>{`
        .recent-activity ul {
          max-height: 300px; /* Adjust this value to fit your design */
          overflow-y: auto;
          padding-right: 10px; /* Add some space for the scrollbar */
        }
      `}</style>

      <div className="dashboard-container">
        <h1>Dashboard</h1>
        <p className="subtitle">Welcome back, {user?.full_name}. Here's an overview of your workspace.</p>

        <div className="stats-grid">
          <div className="stat-card">
            <h2>{isLoading ? '...' : stats.casesAnalyzed}</h2>
            <p>Cases Analyzed</p>
          </div>
          <div className="stat-card">
            <h2>{isLoading ? '...' : stats.precedentsFound}</h2>
            <p>Relevant Precedents Marked</p>
          </div>
          <div className="stat-card">
            <h2>{isLoading ? '...' : stats.contradictionsFlagged}</h2>
            <p>Contradictions Flagged</p>
          </div>
        </div>

        <div className="main-grid">
          <div className="recent-activity">
            <h2>Recent Activity</h2>
            {isLoading ? <p>Loading activity...</p> : (
              <ul>
                {recentFiles.length > 0 ? (
                  recentFiles.map(file => (
                    <li key={file.id}>
                      <div className="activity-icon"><LuFileText /></div>
                      <div className="activity-details">
                        <span className="activity-name">{file.filename}</span>
                        <span className="activity-time"><LuClock size={12} /> {timeSince(file.upload_date)}</span>
                      </div>
                    </li>
                  ))
                ) : (
                  <p className="no-activity">No files analyzed yet. Get started using the Quick Actions.</p>
                )}
              </ul>
            )}
          </div>
          <div className="quick-actions">
            <h2>Quick Actions</h2>
            <Link to="/summarize" className="action-card">
              <LuFileText size={24} /> <span>Summarize New Case</span>
            </Link>
            <Link to="/precedents" className="action-card">
              <LuSearch size={24} /> <span>Find Precedents</span>
            </Link>
            <Link to="/evidence" className="action-card">
              <LuShieldCheck size={24} /> <span>Analyze Evidence</span>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

export default Dashboard;