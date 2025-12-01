import React, { useState } from 'react';
import JobBoard from './JobBoard';
import Matchmaker from './MatchMaker';
import BulkMatch from './BulkMatch';
import LoginPage from './LoginPage';
import ChatWidget from './ChatWidgetComponent';

import CloudDeploy from './CloudDeploy';
import {
  LayoutDashboard,
  Search,
  Users,
  Layers,
  Table,
  LogOut,
  Cloud
} from 'lucide-react';

import { DashboardProvider } from './context/DashboardContext';

// New Screens
import BulkAutoDrive from "./components/BulkAutoDrive";
import BulkMatrixView from "./BulkMatrixView";

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [view, setView] = useState('dashboard');

  const handleLogin = (newToken) => {
    setToken(newToken);
    setView('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  // if (!token) {
  //   return <LoginPage onLogin={handleLogin} />;
  // }

  return (
    <DashboardProvider>
      <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>

        {/* NAVBAR */}
        <nav
          style={{
            backgroundColor: '#1e293b',
            color: 'white',
            padding: '0 2rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: '64px',
            position: 'sticky',
            top: 0,
            zIndex: 50
          }}
        >

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.5rem' }}>🤖</span>
            <h2 style={{
              margin: 0,
              fontSize: '1.2rem',
              fontWeight: 'bold'
            }}>
              AI Recruiter
            </h2>
          </div>

          {/* Nav Items */}
          <div style={{ display: 'flex', gap: '20px' }}>

            {/* Dashboard */}
            <button
              onClick={() => setView('dashboard')}
              style={{
                background: 'none',
                border: 'none',
                color: view === 'dashboard' ? '#60a5fa' : '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.95rem',
                fontWeight: view === 'dashboard' ? '600' : '400'
              }}
            >
              <LayoutDashboard size={18} /> Dashboard
            </button>

            {/* Matchmaker */}
            <button
              onClick={() => setView('matchmaker')}
              style={{
                background: 'none',
                border: 'none',
                color: view === 'matchmaker' ? '#60a5fa' : '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.95rem',
                fontWeight: view === 'matchmaker' ? '600' : '400'
              }}
            >
              <Search size={18} /> Matchmaker
            </button>

            {/* Bulk Processor */}
            {/* <button
              onClick={() => setView('bulk')}
              style={{
                background: 'none',
               border: 'none',
                color: view === 'bulk' ? '#60a5fa' : '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.95rem',
                fontWeight: view === 'bulk' ? '600' : '400'
              }}
            >
              <Layers size={18} /> Bulk Processor
            </button> */}

            {/* Auto-Drive */}
            <button
              onClick={() => setView('autodrive')}
              style={{
                background: 'none',
                border: 'none',
                color: view === 'autodrive' ? '#60a5fa' : '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.95rem',
                fontWeight: view === 'autodrive' ? '600' : '400'
              }}
            >
              <Users size={18} /> Auto-Drive
            </button>

            {/* Cloud Deploy */}
            <button
              onClick={() => setView('cloudDeploy')}
              style={{
                background: 'none',
                border: 'none',
                color: view === 'cloudDeploy' ? '#60a5fa' : '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.95rem',
                fontWeight: view === 'cloudDeploy' ? '600' : '400'
              }}
            >
              <Cloud size={18} /> Cloud Deploy
            </button>

            {/* Matrix View */}
            {/* <button
              onClick={() => setView('matrix')}
              style={{
                background: 'none',
                border: 'none',
                color: view === 'matrix' ? '#60a5fa' : '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.95rem',
                fontWeight: view === 'matrix' ? '600' : '400'
              }}
            >
              <Table size={18} /> Matrix View
            </button> */}
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            style={{
              background: '#ef4444',
              border: 'none',
              color: 'white',
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.85rem',
              fontWeight: '600'
            }}
          >
            <LogOut size={16} /> Logout
          </button>
        </nav>

        {/* MAIN SCREEN AREA */}
        <main style={{ padding: '20px' }}>
          {view === 'dashboard' && <JobBoard />}
          {view === 'matchmaker' && <Matchmaker />}
          {/* {view === 'bulk' && <BulkMatch />} */}
          {view === 'autodrive' && <BulkAutoDrive />}
          {view === 'cloudDeploy' && <CloudDeploy />}
          {/* {view === 'matrix' && <BulkMatrixView />} */}
        </main>

        <ChatWidget />
      </div>
    </DashboardProvider>
  );
}

export default App;
