// frontend/src/components/LoadingSpinner.jsx

import React from 'react';
import './LoadingSpinner.css';

const LoadingSpinner = ({ text = "Analyzing..." }) => {
  return (
    <div className="spinner-overlay">
      <div className="spinner-container">
        <div className="spinner"></div>
        <p className="spinner-text">{text}</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;
