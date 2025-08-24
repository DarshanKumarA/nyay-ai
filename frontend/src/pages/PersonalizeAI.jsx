// frontend/src/pages/PersonalizeAI.jsx

import React, { useState, useEffect } from 'react';
// --- NEW: Import the API service function ---
import { startRetrainingModel } from '../api/apiService';
import { LuBrainCircuit, LuCheck } from 'react-icons/lu';
import Loader from '../components/LoadingSpinner';
import './PersonalizeAI.css'; 

const steps = [
  "Locating feedback data...",
  "Found training examples...",
  "This might take a while...",
  "Fine-tuning model...",
];

const RetrainingModal = ({ onRetrain, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState('retraining'); // 'retraining', 'success', 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    const animationTimer = setInterval(() => {
      setCurrentStep(prevStep => {
        const nextStep = prevStep + 1;
        if (nextStep < steps.length) {
          return nextStep;
        }
        
        clearInterval(animationTimer);
        onRetrain()
          .then(result => {
            // --- UPDATED: Handle axios response ---
            setMessage(result.data.message);
            setStatus('success');
          })
          .catch(err => {
            // --- UPDATED: Handle axios error ---
            const errorMessage = err.response?.data?.detail || 'An unknown error occurred.';
            setMessage(errorMessage);
            setStatus('error');
          });
        
        return prevStep;
      });
    }, 3000);

    return () => clearInterval(animationTimer);
  }, [onRetrain]);

  let content;
  if (status === 'retraining') {
    content = (
      <>
        <Loader text="" />
        <p className="modal-status-text">{steps[currentStep]}</p>
      </>
    );
  } else if (status === 'success') {
    content = (
      <>
        <div className="success-icon">
          <LuCheck size={60} />
        </div>
        <p className="modal-status-text">Fine-Tune Complete!</p>
        <p className="modal-message">{message}</p>
      </>
    );
  } else if (status === 'error') {
    content = (
      <>
        <p className="modal-status-text error">Retraining Failed</p>
        <p className="modal-message">{message}</p>
      </>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        {content}
        {status !== 'retraining' && (
          <button onClick={onClose} className="modal-close-button">Close</button>
        )}
      </div>
    </div>
  );
};


function PersonalizeAI() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <div className="settings-container">
        {isModalOpen && (
          <RetrainingModal 
            // --- UPDATED: Pass the API service function directly ---
            onRetrain={startRetrainingModel}
            onClose={closeModal}
          />
        )}

        <h1>Personalize AI</h1>
        <p className="subtitle">Improve your AI's accuracy by retraining it with your feedback.</p>

        <div className="settings-card personalize-ai-card">
            <h2><LuBrainCircuit /> Start Retraining</h2>
            <p>
                Click the button below to start the retraining process. Your personal AI model will be updated in the background
                based on all the precedents you've marked as relevant. This may take a few minutes to complete, and the new model will be used for your next analysis.
            </p>
            <button onClick={openModal} disabled={isModalOpen}>
              {isModalOpen ? 'Retraining in Progress...' : 'Retrain My Model'}
            </button>
        </div>
    </div>
  );
}

export default PersonalizeAI;