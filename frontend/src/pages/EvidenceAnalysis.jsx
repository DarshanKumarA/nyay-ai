// frontend/src/pages/EvidenceAnalysis.jsx

import React, { useState, useEffect } from 'react';
import { useAnalysis } from '../context/AnalysisContext';
import { fetchUserFiles, analyzeContradictions } from '../api/apiService';
import { LuFileCheck2, LuFlaskConical } from 'react-icons/lu';
import Loader from '../components/LoadingSpinner';
import './EvidenceAnalysis.css';

function EvidenceAnalysis() {
  const [allFiles, setAllFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [error, setError] = useState('');

  // --- UPDATED: Get the new, specific context function ---
  const { evidenceResult, startNewEvidenceAnalysis, setEvidenceResult } = useAnalysis();

  useEffect(() => {
    const loadFiles = async () => {
      setIsLoadingFiles(true);
      setError('');
      try {
        const response = await fetchUserFiles();
        const data = response.data;
        
        const uniqueFiles = [];
        const seenFilenames = new Set();
        for (const file of data) {
            if (!seenFilenames.has(file.filename)) {
                seenFilenames.add(file.filename);
                uniqueFiles.push(file);
            }
        }
        setAllFiles(uniqueFiles);

      } catch (err) {
        const errorMessage = err.response?.data?.detail || 'Could not fetch your case files.';
        setError(errorMessage);
      } finally {
        setIsLoadingFiles(false);
      }
    };
    loadFiles();
  }, []);

  const handleFileSelectionChange = (filename) => {
    setSelectedFiles(prevSelected => {
      if (prevSelected.includes(filename)) {
        return prevSelected.filter(f => f !== filename);
      } else {
        return [...prevSelected, filename];
      }
    });
  };
  
  const handleAnalyzeContradictions = async () => {
    if (selectedFiles.length < 2) {
      setError("Please select at least two files to compare.");
      return;
    }
    setIsLoadingAnalysis(true);
    // --- FIX: Use the new, specific context function ---
    startNewEvidenceAnalysis();
    setError('');

    try {
      const response = await analyzeContradictions(selectedFiles);
      setEvidenceResult(response.data.contradiction_report || []);
    } catch (err) {
      const errorMessage = err.response?.data?.detail || "Failed to analyze contradictions.";
      setError(errorMessage);
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  return (
    <div className="evidence-container">
      <h1>Evidentiary Cross-Verification</h1>
      <p className="subtitle">Select multiple documents from the same case to automatically detect contradictions.</p>
      
      <div className="file-selection-container">
        <h3><LuFileCheck2 /> Select Files to Compare</h3>
        {isLoadingFiles && <Loader text="Loading your files..." />}
        {!isLoadingFiles && allFiles.length === 0 && (
          <p className="no-files-message">You haven't uploaded any case files yet. Please upload documents via the "Summarize Case" page first.</p>
        )}
        {!isLoadingFiles && allFiles.length > 0 && (
          <div className="file-list">
            {allFiles.map(file => (
              <div key={file.id} className="file-item">
                <input 
                  type="checkbox" 
                  id={`file-${file.id}`} 
                  checked={selectedFiles.includes(file.filename)}
                  onChange={() => handleFileSelectionChange(file.filename)}
                />
                <label htmlFor={`file-${file.id}`}>{file.filename}</label>
              </div>
            ))}
          </div>
        )}
      </div>

      <button 
        onClick={handleAnalyzeContradictions} 
        disabled={selectedFiles.length < 2 || isLoadingAnalysis}
        className="analyze-button"
      >
        {isLoadingAnalysis ? 'Analyzing...' : `Analyze (${selectedFiles.length}) Files`}
      </button>

      {isLoadingAnalysis && <Loader text="Cross-referencing documents..." />}
      {error && <div className="analysis-results error-message">{error}</div>}

      {evidenceResult && !isLoadingAnalysis && (
        <div className="analysis-results">
          <div className="analysis-card contradiction">
            <h3><LuFlaskConical /> Analysis Report</h3>
            <ul>
                {evidenceResult.map((item, index) => (
                    <li key={index}>{item}</li>
                ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default EvidenceAnalysis;