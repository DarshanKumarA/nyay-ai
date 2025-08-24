// frontend/src/context/AnalysisContext.jsx

import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import { generateSuggestedQuestions, sendChatMessage } from '../api/apiService';

export const AnalysisContext = createContext();

export function useAnalysis() {
  return useContext(AnalysisContext);
}

const useStateWithSessionStorage = (storageKey, initialValue) => {
  const [value, setValue] = useState(() => {
    try {
      const storedValue = sessionStorage.getItem(storageKey);
      return storedValue ? JSON.parse(storedValue) : initialValue;
    } catch (error) {
      console.error(`Error reading from sessionStorage for key "${storageKey}":`, error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      if (value === null || value === undefined) {
        sessionStorage.removeItem(storageKey);
      } else {
        sessionStorage.setItem(storageKey, JSON.stringify(value));
      }
    } catch (error) {
      console.error(`Error writing to sessionStorage for key "${storageKey}":`, error);
    }
  }, [storageKey, value]);

  return [value, setValue];
};

const initialChatState = [
  { role: 'model', parts: [{ text: 'Hello! I am Nyay AI. How can I assist you with your legal analysis today?' }] }
];

export const AnalysisProvider = ({ children }) => {
  const [summarizeResult, setSummarizeResult] = useStateWithSessionStorage('summarizeResult', null);
  const [precedentResult, setPrecedentResult] = useStateWithSessionStorage('precedentResult', null);
  const [evidenceResult, setEvidenceResult] = useStateWithSessionStorage('evidenceResult', null);
  
  const [feedbackStatus, setFeedbackStatus] = useState({});

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState(initialChatState);
  const [chatContext, setChatContext] = useState(null);
  // --- REVERT: Re-introduce the global loading state ---
  const [isChatLoading, setIsChatLoading] = useState(false);

  const setAnalysisContext = useCallback(async (summaryResult, fullText) => {
    setSummarizeResult(summaryResult);
    setChatContext(fullText);
    setIsChatOpen(false);
    
    try {
      const response = await generateSuggestedQuestions(summaryResult);
      const questions = response.data.questions;
      
      if (questions && questions.length > 0) {
        const suggestionsMessage = {
          role: 'model',
          parts: [{ text: "I've analyzed the document. Here are some questions you might want to ask:" }],
          suggestions: questions,
        };
        setChatHistory([...initialChatState, suggestionsMessage]);
      } else {
        setChatHistory(initialChatState);
      }

    } catch (error) {
      console.error("Failed to fetch suggested questions:", error);
      setChatHistory(initialChatState);
    }
  }, [setSummarizeResult]);

  const startNewSummary = useCallback(() => {
    setSummarizeResult(null);
    setChatContext(null);
    setChatHistory(initialChatState);
  }, [setSummarizeResult]);

  const startNewPrecedentSearch = useCallback(() => {
    setPrecedentResult(null);
    setFeedbackStatus({});
  }, [setPrecedentResult]);

  const startNewEvidenceAnalysis = useCallback(() => {
    setEvidenceResult(null);
  }, [setEvidenceResult]);

  // --- REVERTED: Back to simple, non-streaming sendMessage logic ---
  const sendMessage = useCallback(async (question) => {
    const newUserMessage = { role: 'user', parts: [{ text: question }] };
    setChatHistory(prev => [...prev, newUserMessage]);
    setIsChatLoading(true);

    try {
      const requestPayload = {
        history: chatHistory, 
        question: question,
        context: chatContext,
      };
      const response = await sendChatMessage(requestPayload);
      const { response_type, answer, page } = response.data;

      const aiMessage = { 
        role: 'model', 
        parts: [{ text: answer }],
        action: response_type === 'navigate' ? { type: 'navigate', page: page } : null
      };
      setChatHistory(prev => [...prev, aiMessage]);

    } catch (error) {
      console.error("Error sending chat message:", error);
      const errorMessage = { role: 'model', parts: [{ text: "Sorry, I encountered an error. Please try again." }] };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  }, [chatHistory, chatContext]);

  const value = useMemo(() => ({
    summarizeResult,
    precedentResult,
    setPrecedentResult,
    evidenceResult,
    setEvidenceResult, 
    feedbackStatus,
    setFeedbackStatus,
    isChatOpen,
    setIsChatOpen,
    chatHistory,
    isChatLoading, // Re-add to context
    sendMessage,
    setAnalysisContext,
    startNewSummary,
    startNewPrecedentSearch,
    startNewEvidenceAnalysis,
  }), [
    summarizeResult,
    precedentResult,
    setPrecedentResult,
    evidenceResult,
    setEvidenceResult, 
    feedbackStatus,
    isChatOpen,
    chatHistory,
    isChatLoading, // Re-add to dependency array
    sendMessage,
    setAnalysisContext,
    startNewSummary,
    startNewPrecedentSearch,
    startNewEvidenceAnalysis,
  ]);

  return (
    <AnalysisContext.Provider value={value}>
      {children}
    </AnalysisContext.Provider>
  );
};