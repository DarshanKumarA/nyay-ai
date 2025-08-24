// frontend/src/App.jsx

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Summarize from './pages/Summarize';
import PrecedentSearch from './pages/PrecedentSearch';
import EvidenceAnalysis from './pages/EvidenceAnalysis';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Signup from './pages/Signup';
import PersonalizeAI from './pages/PersonalizeAI';
import AuthProvider, { useAuth } from './context/AuthContext';
import { AnalysisProvider } from './context/AnalysisContext';
// --- NEW: Import the Chatbot component ---
import Chatbot from './components/Chatbot';
import './App.css';

const AppLayout = () => {
  const { logout } = useAuth();

  useEffect(() => {
    const handleTabClose = () => {
      logout();
    };
    window.addEventListener('beforeunload', handleTabClose);
    return () => {
      window.removeEventListener('beforeunload', handleTabClose);
    };
  }, [logout]);


  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="main-header">
          <button className="login-button" onClick={logout}>Logout</button>
        </div>
        <div className="page-content">
          <Outlet />
        </div>
      </main>
      {/* --- NEW: Render the Chatbot component --- */}
      <Chatbot />
    </div>
  );
};

const ProtectedRoutes = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <AppLayout /> : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <AnalysisProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route element={<ProtectedRoutes />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/summarize" element={<Summarize />} />
              <Route path="/precedents" element={<PrecedentSearch />} />
              <Route path="/evidence" element={<EvidenceAnalysis />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/personalize" element={<PersonalizeAI />} />
            </Route>
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </AnalysisProvider>
    </AuthProvider>
  );
}

export default App;