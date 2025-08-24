// frontend/src/api/apiService.js

import axios from 'axios';

const baseURL = 'http://127.0.0.1:8000';

// 1. Create a configured instance of axios
const api = axios.create({
  baseURL: baseURL,
});

// 2. Set up an interceptor to automatically add the auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 3. Define and export functions for each specific API endpoint

// --- NEW: Health Check Endpoint ---
export const checkBackendStatus = () => {
  return api.get('/');
};

// --- Auth Endpoints ---
export const loginUser = (username, password) => {
  const formData = new FormData();
  formData.append('username', username);
  formData.append('password', password);
  return api.post('/login', formData);
};

export const signupUser = (userData) => {
  return api.post('/signup', userData);
};

export const fetchCurrentUser = () => {
  return api.get('/users/me');
};

// --- Dashboard & File Endpoints ---
export const fetchUserFiles = () => {
  return api.get('/users/me/files');
};

export const fetchUserStats = () => {
  return api.get('/users/me/stats');
};

// --- Feature Endpoints ---
export const summarizeFile = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/summarize', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const findPrecedentsForFile = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/find_precedents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const analyzeContradictions = (filenames) => {
  return api.post('/analyze_contradictions', { filenames });
};

export const submitFeedback = (feedbackData) => {
  return api.post('/feedback', feedbackData);
};

export const findEntityInDocument = (filename, entityText) => {
  const requestBody = { entity_text: entityText };
  return api.post(`/documents/${filename}/find-entity`, requestBody);
};

export const sendChatMessage = (chatPayload) => {
  return api.post('/chat', chatPayload);
};

export const generateSuggestedQuestions = (summaryData) => {
  return api.post('/generate-suggested-questions', summaryData);
};


// --- Settings & Personalization ---
export const updateUserProfile = (profileData) => {
  return api.put('/users/me', profileData);
};

export const changeUserPassword = (passwordData) => {
  return api.post('/users/me/change-password', passwordData);
};

export const startRetrainingModel = () => {
  return api.post('/users/me/retrain-model');
};

export default api;