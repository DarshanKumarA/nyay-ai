// frontend/src/components/EntityDetailModal.jsx

import React, { useState, useEffect } from 'react';
import { LuSearch } from 'react-icons/lu';
import { findEntityInDocument } from '../api/apiService';
import Loader from './LoadingSpinner';
import './EntityDetailModal.css';

const EntityDetailModal = ({ isOpen, onClose, entity, filename }) => {
  const [contexts, setContexts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && entity && filename) {
      const fetchContexts = async () => {
        setIsLoading(true);
        setError('');
        setContexts([]);
        try {
          const response = await findEntityInDocument(filename, entity.text);
          setContexts(response.data);
        } catch (err) {
          const errorMessage = err.response?.data?.detail || 'Could not fetch entity details.';
          setError(errorMessage);
        } finally {
          setIsLoading(false);
        }
      };
      fetchContexts();
    }
  }, [isOpen, entity, filename]);

  if (!isOpen) {
    return null;
  }

  const highlightEntity = (text, entityToHighlight) => {
    if (!text || !entityToHighlight) return text;
    const regex = new RegExp(`(${entityToHighlight})`, 'gi');
    return text.split(regex).map((part, index) => 
      regex.test(part) ? <strong key={index}>{part}</strong> : part
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* --- REMOVED: The entire close button element --- */}
        <div className="modal-header">
          <span className={`entity-tag ${entity.type}`}>{entity.type.replace('_', ' ')}</span>
          <h2>{entity.text}</h2>
        </div>
        <div className="modal-body">
          {isLoading && <Loader text="Searching document..." />}
          {error && <p className="error-message">{error}</p>}
          {!isLoading && !error && (
            contexts.length > 0 ? (
              <ul className="context-list">
                {contexts.map((context, index) => (
                  <li key={index}>
                    <p>{highlightEntity(context, entity.text)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="no-results">
                <LuSearch size={40} />
                <p>No mentions of "{entity.text}" found in the document.</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default EntityDetailModal;