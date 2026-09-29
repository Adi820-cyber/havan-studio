import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import FeedbackWidget from './components/FeedbackWidget';
import './index.css';
// Loaded after index.css on purpose: the brand layer corrects it.
import './styles/brand.css';
import './styles/reveals.css';
import './styles/feedback.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      <FeedbackWidget />
    </ErrorBoundary>
  </React.StrictMode>
);
