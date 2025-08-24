// frontend/src/pages/PrecedentSearch.jsx

import React, { useState, useRef } from 'react';
import { useAnalysis } from '../context/AnalysisContext';
import { findPrecedentsForFile, submitFeedback } from '../api/apiService';
import Loader from '../components/LoadingSpinner';
import './PrecedentSearch.css';

function PrecedentSearch() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fullText, setFullText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  
  const { 
    precedentResult, 
    setPrecedentResult, 
    feedbackStatus, 
    setFeedbackStatus, 
    // --- UPDATED: Get the new, specific context function ---
    startNewPrecedentSearch, 
    setAnalysisContext 
  } = useAnalysis();

  const handleFileSelect = (file) => {
    if (file && (file.type === "application/pdf" || file.type === "text/plain")) {
      setSelectedFile(file);
      // --- FIX: Use the new, specific context function ---
      startNewPrecedentSearch();
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

  const handleSearch = async () => {
    if (!selectedFile) {
      setError("Please select a file first.");
      return;
    }
    
    setIsLoading(true);
    setError('');

    try {
      const response = await findPrecedentsForFile(selectedFile);
      const combinedData = response.data;
      
      const summaryResultForContext = {
        filename: combinedData.filename,
        summary_data: combinedData.summary_data,
        entity_data: combinedData.entity_data
      };
      
      await setAnalysisContext(summaryResultForContext, fullText);

      setPrecedentResult(combinedData.precedent_data);

    } catch (err) {
      const errorMessage = err.response?.data?.detail || "Failed to find precedents.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedback = async (precedentFilename) => {
    if (!precedentResult?.query_filename || !precedentFilename) return;

    setFeedbackStatus(prev => ({ ...prev, [precedentFilename]: 'loading' }));

    const feedbackData = {
      query_case_filename: precedentResult.query_filename,
      precedent_case_filename: precedentFilename,
      is_relevant: true,
    };

    try {
      await submitFeedback(feedbackData);
      setFeedbackStatus(prev => ({ ...prev, [precedentFilename]: 'success' }));
    } catch (err) {
      console.error("Feedback submission failed:", err);
      alert('Could not submit feedback.');
      setFeedbackStatus(prev => ({ ...prev, [precedentFilename]: 'error' }));
    }
  };
  
  const precedents = precedentResult?.analysis?.precedents 
    ? Object.entries(precedentResult.analysis.precedents) 
    : [];

  return (
    <div className="precedent-container">
      <h1>Precedent Analysis</h1>
      <p className="subtitle">Upload a case file to get a detailed analysis of relevant historical precedents.</p>
      
      <div className="upload-section">
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf,.txt" style={{ display: 'none' }} />
        <div className="upload-box" onClick={selectFile}>
          {selectedFile ? `Selected: ${selectedFile.name}` : "Click to select a case file"}
        </div>
        <button onClick={handleSearch} disabled={!selectedFile || isLoading}>
          {isLoading ? 'Analyzing...' : 'Find Precedents'}
        </button>
      </div>

      {isLoading && <Loader text="Performing full analysis..." />}
      {error && <div className="analysis-result error-message">{error}</div>}

      {precedentResult && !isLoading && (
        <div className="analysis-result">
          <h2>AI-Generated Analysis</h2>
          
          <div className="precedent-cards-container">
            {precedents.length > 0 ? (
              precedents.map(([filename, details], index) => (
                <div key={index} className="precedent-card">
                  <div className="card-header">
                    <h3>Precedent File: {filename}</h3>
                    <button 
                      className={`feedback-button ${feedbackStatus[filename] || ''}`}
                      onClick={() => handleFeedback(filename)}
                      disabled={feedbackStatus[filename] === 'loading' || feedbackStatus[filename] === 'success'}
                    >
                      {feedbackStatus[filename] === 'loading' ? 'Marking...' : 
                       feedbackStatus[filename] === 'success' ? '✓ Relevant' : 
                       'Mark as Relevant'}
                    </button>
                  </div>
                  <div className="precedent-details">
                      <h4>Facts:</h4>
                      <p>{details?.facts}</p>
                      <h4>Holding:</h4>
                      <p>{details?.holding}</p>
                      <h4>Relevance:</h4>
                      <p>{details?.relevance}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-precedents-message">
                <p>No relevant precedents were found in your personal database.</p>
              </div>
            )}
          </div>

          <div className="conclusion-section">
            <h3>Final Conclusion</h3>
            <p>{precedentResult.overall_relevance}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default PrecedentSearch;