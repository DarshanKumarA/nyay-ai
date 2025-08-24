// frontend/src/pages/Signup.jsx

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LuEye, LuEyeOff } from 'react-icons/lu';
// --- NEW: Import the centralized API function ---
import { signupUser } from '../api/apiService';
import './AuthForms.css';

function Signup() {
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!fullName || !age || !username || !password) {
      setError("All fields are required.");
      setIsLoading(false);
      return;
    }

    try {
      // --- UPDATED: Use the apiService function ---
      const userData = {
        full_name: fullName,
        age: parseInt(age, 10),
        username: username,
        password: password,
      };
      await signupUser(userData);

      navigate('/login', { 
        state: { message: 'Account created successfully! Please log in.' } 
      });

    } catch (err) {
      // --- UPDATED: Handle potential axios error structure ---
      const errorMessage = err.response?.data?.detail || err.message || 'Signup failed.';
      setError(errorMessage === 'Failed to fetch' ? 'Could not connect to the server.' : errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <form onSubmit={handleSubmit} className="auth-form">
        <h2>Create an Account</h2>
        {error && <p className="error-message">{error}</p>}
        <div className="form-group">
          <label htmlFor="fullName">Full Name</label>
          <input type="text" id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className="form-group">
          <label htmlFor="age">Age</label>
          <input type="number" id="age" value={age} onChange={(e) => setAge(e.target.value)} required />
        </div>
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
          {isLoading ? 'Creating Account...' : 'Sign Up'}
        </button>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}

export default Signup;