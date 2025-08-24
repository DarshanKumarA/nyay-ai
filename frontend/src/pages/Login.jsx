// frontend/src/pages/Login.jsx

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { LuEye, LuEyeOff } from 'react-icons/lu';
import { loginUser, checkBackendStatus } from '../api/apiService';
import './AuthForms.css';

// NEW: SVG for the "Tipping Hat" animation
const tippingHatSVG = (
  <svg className="tipping-hat" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <g className="hat-group">
      {/* Hat Top */}
      <rect x="25" y="30" width="50" height="5" rx="2" />
      {/* Hat Body */}
      <rect x="35" y="35" width="30" height="20" rx="2" />
      {/* Tassel */}
      <line x1="60" y1="32.5" x2="70" y2="40" />
      <circle cx="70" cy="40" r="3" />
    </g>
  </svg>
);


function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBackendReady, setIsBackendReady] = useState(false);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
    }
  }, [location.state]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        await checkBackendStatus();
        setIsBackendReady(true);
      } catch (err) {
        console.log("Backend not ready yet, retrying...", err);
        setTimeout(checkStatus, 2000); 
      }
    };
    checkStatus();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      const response = await loginUser(username, password);
      const data = response.data;
      
      await login(data.access_token);

    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'Login failed.';
      setError(errorMessage === 'Failed to fetch' ? 'Could not connect to the server.' : errorMessage);
      setIsLoading(false);
    }
  };

  if (!isBackendReady) {
    return (
      <div className="auth-container loading-container">
        <div className="loader">
          {/* NEW: Wrapper div for the animation */}
          <div className="tipping-hat-wrapper">
            {tippingHatSVG}
          </div>
          <p>Starting up the legal AI engine...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <form onSubmit={handleSubmit} className="auth-form">
        <h2>Login to Nyay AI</h2>
        {error && <p className="error-message">{error}</p>}
        {successMessage && <p className="success-message">{successMessage}</p>}
        
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input type="text" id="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div className="form-group password-wrapper">
          <label htmlFor="password">Password</label>
          <input 
            type={showPassword ? 'text' : 'password'}
            id="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
          />
          <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
            {showPassword ? <LuEyeOff /> : <LuEye />}
          </button>
        </div>
        <button type="submit" className="auth-button" disabled={isLoading}>
          {isLoading ? 'Logging In...' : 'Login'}
        </button>
        <p className="auth-switch">
          Don't have an account? <Link to="/signup">Sign Up</Link>
        </p>
      </form>
    </div>
  );
}

export default Login;