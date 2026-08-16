import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';

/**
 * HashRouter, not BrowserRouter: GitHub Pages serves static files with no SPA
 * rewrite, so a deep link like /drill/analogies would 404 on refresh under
 * BrowserRouter. Hash routing keeps every route reloadable.
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
