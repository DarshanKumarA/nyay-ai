// frontend/src/pages/Summarize.jsx

import React, { useState, useRef } from 'react';
import { useAnalysis } from '../context/AnalysisContext';
import { summarizeFile } from '../api/apiService';
import Loader from '../components/LoadingSpinner';
import EntityDetailModal from '../components/EntityDetailModal';
import './Summarize.css';

const HighlightedText = ({ text, entities, activeEntity, onEntityClick }) => {
  if (!text || !entities) { return <p>{text}</p>; }
  const allEntities = Object.values(entities).flat();
  const uniqueEntities = [...new Set(allEntities)].sort((a, b) => b.length - a.length);
  const entityTypeMap = {};
  Object.entries(entities).forEach(([category, items]) => {
    items.forEach(item => { entityTypeMap[item] = category; });
  });
  if (uniqueEntities.length === 0) { return <p>{text}</p>; }
  const regex = new RegExp(`(${uniqueEntities.map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  const parts = text.split(regex);
  return (
    <p className="summary-text">
      {parts.map((part, index) => {
        const entityType = entityTypeMap[part];
        if (entityType) {
          const isActive = activeEntity && activeEntity.text === part;
          return (
            <span 
              key={index} 
              className={`entity clickable ${entityType} ${isActive ? 'active' : ''}`} 
              data-tooltip={entityType.replace('_', ' ')}
              onClick={() => onEntityClick({ text: part, type: entityType })}
            >
              {part}
            </span>
          );
        }
        return part;
      })}
    </p>
  );
};

const KeyEntitiesPanel = ({ entities, onEntityHover, onEntityClick }) => {
  if (!entities || Object.keys(entities).length === 0) { return null; }
  return (
    <div className="summary-section key-entities-panel">
      <h3>Key Entities</h3>
      {Object.entries(entities).map(([category, items]) => {
        if (items.length === 0) return null;
        return (
          <div key={category} className="entity-category">
            <h4>{category.replace('_', ' ')}</h4>
            <div className="entity-list">
              {[...new Set(items)].map((item, index) => (
                <span 
                  key={index} 
                  className={`entity-tag clickable ${category}`} 
                  onMouseEnter={() => onEntityHover({ text: item, type: category })} 
                  onMouseLeave={() => onEntityHover(null)}
                  onClick={() => onEntityClick({ text: item, type: category })}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

function Summarize() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fullText, setFullText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeEntity, setActiveEntity] = useState(null);
  const fileInputRef = useRef(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState(null);

  // --- UPDATED: Get the new, specific context function ---
  const { summarizeResult, setAnalysisContext, startNewSummary } = useAnalysis();

  const handleFileSelect = (file) => {
    if (file && (file.type === "application/pdf" || file.type === "text/plain")) {
      setSelectedFile(file);
      // --- FIX: Use the new, specific context function ---
      startNewSummary();
      setError('');
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setFullText(e.target.result);
      };
      reader.readAsText(file);

    } else {
      setError("Please select a valid PDF or TXT file.");
    }
  };

  const handleFileChange = (event) => handleFileSelect(event.target.files[0]);
  const selectFile = () => fileInputRef.current.click();

  const handleSummarize = async () => {
    if (!selectedFile) {
      setError("Please select a file first.");
      return;
    }
    
    setIsLoading(true);
    setError('');

    try {
      const response = await summarizeFile(selectedFile);
      setAnalysisContext(response.data, fullText);
    } catch (err) {
      const errorMessage = err.response?.data?.detail || "Failed to generate brief.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEntityClick = (entity) => {
    setSelectedEntity(entity);
    setIsModalOpen(true);
  };

  return (
    <div className="summarize-container">
      <EntityDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        entity={selectedEntity}
        filename={summarizeResult?.filename}
      />

      <h1>Intelligent Brief Generation</h1>
      <p className="subtitle">Upload a PDF or TXT document to generate a dynamic, AI-powered summary with highlighted key entities.</p>
      
      <div className="upload-section">
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf,.txt" style={{ display: 'none' }} />
        <div className="upload-box" onClick={selectFile}>
          {selectedFile ? `Selected: ${selectedFile.name}` : "Click to select a case file"}
        </div>
        <button onClick={handleSummarize} disabled={!selectedFile || isLoading}>
          {isLoading ? 'Generating...' : 'Generate Brief'}
        </button>
      </div>

      {isLoading && <Loader text="Generating Brief..." />}
      {error && <div className="summary-result error-message">{error}</div>}

      {summarizeResult && !isLoading && (
        <div className="summary-result">
          <h2>Intelligent Brief for: {summarizeResult.filename}</h2>
          
          <div className="summary-section">
            <h3>Quick Summary</h3>
            <p>{summarizeResult.summary_data.one_sentence_summary}</p>
          </div>

          <div className="summary-main-grid">
            <div className="summary-content">
              <div className="summary-section">
                <h3>Detailed Overview</h3>
                <HighlightedText 
                  text={summarizeResult.summary_data.detailed_summary}
                  entities={summarizeResult.entity_data}
                  activeEntity={activeEntity}
                  onEntityClick={handleEntityClick}
                />
              </div>

              <div className="summary-card-grid">
                <div className="summary-section">
                  <h3>Key Arguments</h3>
                  <ul>
                    {summarizeResult.summary_data.key_arguments?.map((arg, index) => (
                      <li key={index}>{arg}</li>
                    ))}
                  </ul>
                </div>

                <div className="summary-section">
                  <h3>Involved Parties</h3>
                  <ul>
                    {summarizeResult.summary_data.involved_parties?.map((party, index) => (
                      <li key={index}>{party}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            
            <KeyEntitiesPanel 
              entities={summarizeResult.entity_data}
              onEntityHover={setActiveEntity}
              onEntityClick={handleEntityClick}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default Summarize;