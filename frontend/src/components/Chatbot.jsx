// frontend/src/components/Chatbot.jsx

import React, { useState, useEffect, useRef } from 'react';
import { LuBot, LuSendHorizontal, LuX, LuCopy, LuCheck, LuEraser } from 'react-icons/lu';
import { useNavigate, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { useAnalysis } from '../context/AnalysisContext';
import './Chatbot.css';

const Chatbot = () => {
  const { 
    isChatOpen, 
    setIsChatOpen, 
    chatHistory, 
    sendMessage,
    startNewSummary,
    summarizeResult,
  } = useAnalysis();

  const [input, setInput] = useState('');
  const [lastActionId, setLastActionId] = useState(null);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // --- NEW: State to manage the closing animation ---
  const [isClosing, setIsClosing] = useState(false);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 0);
  };

  useEffect(() => {
    scrollToBottom();

    const lastMessage = chatHistory[chatHistory.length - 1];
    const currentMessageId = `msg-${chatHistory.length - 1}`;

    if (
      lastMessage && 
      lastMessage.role === 'model' && 
      !lastMessage.isLoading &&
      lastMessage.action?.type === 'navigate' &&
      lastActionId !== currentMessageId
    ) {
      const page = lastMessage.action.page;
      setLastActionId(currentMessageId);

      if (page && page !== location.pathname) {
        setTimeout(() => {
          navigate(page);
          setIsChatOpen(false);
        }, 1500);
      }
    }
  }, [chatHistory, isChatOpen, navigate, setIsChatOpen, lastActionId, location.pathname]);

  const handleCopy = (textToCopy, messageId) => {
    navigator.clipboard.writeText(textToCopy);
    setCopiedMessageId(messageId);
    setTimeout(() => {
      setCopiedMessageId(null);
    }, 2000);
  };

  const handleClearChat = () => {
    startNewSummary();
  };

  // --- UPDATED: toggleChat function to handle animations ---
  const toggleChat = () => {
    if (isChatOpen) {
      setIsClosing(true);
      setTimeout(() => {
        setIsChatOpen(false);
        setIsClosing(false);
      }, 200); // This duration should match your CSS animation time
    } else {
      setIsChatOpen(true);
    }
  };

  const isAILoading = chatHistory[chatHistory.length - 1]?.isLoading;

  const handleSend = () => {
    if (input.trim() === '' || isAILoading) return;
    sendMessage(input);
    setInput('');
  };

  const handleSuggestionClick = (question) => {
    if (isAILoading) return;
    sendMessage(question);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const contextFilename = summarizeResult?.filename;

  return (
    <div className="chatbot-container">
      {isChatOpen && (
        <div className={`chat-window ${isClosing ? 'closing' : 'open'}`}>
          <div className="chat-header">
            <div className="chat-header-title">
              <span className="chat-status-dot"></span>
              <span>{contextFilename ? `Context: ${contextFilename}` : 'Nyay AI Assistant'}</span>
            </div>
            <div className="chat-header-actions">
              <button onClick={handleClearChat} className="header-action-btn" title="Clear Chat">
                <LuEraser />
              </button>
              <button onClick={toggleChat} className="header-action-btn" title="Close">
                <LuX />
              </button>
            </div>
          </div>
          <div className="chat-body">
            {chatHistory.map((msg, index) => {
              const messageId = `msg-${index}`;
              return (
                <div key={index} className={`chat-message ${msg.role === 'model' ? 'ai' : 'user'}`}>
                  <div className="message-content">
                    {msg.isLoading ? (
                      <div className="typing-indicator">
                        <span></span><span></span><span></span>
                      </div>
                    ) : (
                      <ReactMarkdown>{msg.parts[0].text}</ReactMarkdown>
                    )}
                    
                    {msg.suggestions && (
                      <div className="suggestions-wrapper">
                        {msg.suggestions.map((q, i) => (
                          <button key={i} onClick={() => handleSuggestionClick(q)} className="suggestion-btn">
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {msg.role === 'model' && !msg.isLoading && (
                    <div className="message-actions">
                      <button 
                        className="action-btn" 
                        onClick={() => handleCopy(msg.parts[0].text, messageId)}
                        title="Copy text"
                      >
                        {copiedMessageId === messageId ? <LuCheck /> : <LuCopy />}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          <div className="chat-footer">
            <div className="input-wrapper">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask a question..."
                disabled={isAILoading}
              />
              <button 
                onClick={handleSend} 
                className={`send-btn ${input.trim() ? 'active' : ''}`}
                disabled={!input.trim() || isAILoading}
              >
                <LuSendHorizontal />
              </button>
            </div>
          </div>
        </div>
      )}
      <button onClick={toggleChat} className="chatbot-toggle-btn">
        <LuBot />
      </button>
    </div>
  );
};

export default Chatbot;