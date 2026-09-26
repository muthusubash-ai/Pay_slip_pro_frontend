import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Auto-clear expired JWT tokens before app loads
// This prevents 401 errors from stale sessions
const token = localStorage.getItem('access_token');
if (token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (Date.now() >= payload.exp * 1000) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  } catch {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
