// frontend/src/pages/Settings.jsx

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
// --- NEW: Import API service functions ---
import { updateUserProfile, changeUserPassword } from '../api/apiService';
import './Settings.css';

function Settings() {
  const { user, refreshUser } = useAuth();
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setAge(user.age);
    }
  }, [user]);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const profileData = {
        full_name: fullName,
        age: parseInt(age, 10)
      };
      // --- UPDATED: Use the centralized API service ---
      await updateUserProfile(profileData);
      setMessage('Profile updated successfully!');
      await refreshUser();
    } catch (err) {
      // --- UPDATED: Better error handling for axios ---
      const errorMessage = err.response?.data?.detail || 'Failed to update profile.';
      setError(errorMessage);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    try {
      const passwordData = {
        current_password: currentPassword,
        new_password: newPassword
      };
      // --- UPDATED: Use the centralized API service ---
      await changeUserPassword(passwordData);
      setMessage('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      // --- UPDATED: Better error handling for axios ---
      const errorMessage = err.response?.data?.detail || 'Failed to change password.';
      setError(errorMessage);
    }
  };

  return (
    <div className="settings-container">
      <h1>Settings</h1>
      <p className="subtitle">Manage your account details and password.</p>
      
      {message && <div className="message-banner success">{message}</div>}
      {error && <div className="message-banner error">{error}</div>}

      <div className="settings-grid">
        <div className="settings-card">
          <h2>Update Profile</h2>
          <form onSubmit={handleProfileUpdate}>
            <div className="form-group">
              <label>Full Name</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Age</label>
              <input type="number" value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
            <button type="submit">Save Changes</button>
          </form>
        </div>

        <div className="settings-card">
          <h2>Change Password</h2>
          <form onSubmit={handlePasswordChange}>
            <div className="form-group">
              <label>Current Password</label>
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <button type="submit">Change Password</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Settings;