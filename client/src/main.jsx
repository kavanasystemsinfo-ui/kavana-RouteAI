import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import AdminDashboard from './AdminDashboard.jsx'
import './index.css'

const path = window.location.pathname;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {path === '/admin' ? <AdminDashboard /> : <App />}
  </React.StrictMode>,
)
