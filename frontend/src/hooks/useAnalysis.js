// frontend/src/hooks/useAnalysis.js
import { useContext } from 'react';
import { AnalysisContext } from '../context/AnalysisContext';

export const useAnalysis = () => {
  return useContext(AnalysisContext);
};