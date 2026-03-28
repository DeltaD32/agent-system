/**
 * OfficePage
 *
 * Full-page view that combines:
 *  - The pixel-art isometric agent office (left / main)
 *  - The PM chat interface (right panel)
 *  - LLM backend status bar (bottom)
 *
 * Layout is responsive:
 *  ≥ 1200 px  → side-by-side (office + chat)
 *  < 1200 px  → stacked (office above chat)
 */

import React, { useState, useEffect } from 'react';
import PixelOffice from './PixelOffice/PixelOffice';
import PMChat from './chat/PMChat';
import AuthService from '../services/AuthService';

const API_BASE = process.env.REACT_APP_API_URL || '/api';

// ---------------------------------------------------------------------------
// LLM Status Bar
// ---------------------------------------------------------------------------
function LLMStatusBar() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const token = AuthService.getToken();
    const load = () => {
      fetch(`${API_BASE}/llm/status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(setStatus)
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const dot = (ok) => (
    <span style={{
      display: 'inline-block', width: 7, height: 7,
      borderRadius: '50%', marginRight: 4,
      background: ok ? '#00ff88' : '#444',
      boxShadow: ok ? '0 0 5px #00ff88' : 'none',
    }} />
  );

  return (
    <div style={{
      padding: '6px 16px',
      background: '#0d0d22',
      borderTop: '1px solid #1a3a5c',
      display: 'flex', gap: 24, alignItems: 'center',
      flexWrap: 'wrap',
    }}>
      <span style={{ color: '#556', fontFamily: 'monospace', fontSize: 10 }}>
        LLM BACKENDS
      </span>
      {status ? (
        <>
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aab' }}>
            {dot(status.local_ollama)}Local GPU (Ollama)
          </span>
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aab' }}>
            {dot(status.remote_ollama)}LAN GPU (Ollama)
          </span>
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aab' }}>
            {dot(status.claude_api)}Claude API
          </span>
        </>
      ) : (
        <span style={{ color: '#556', fontFamily: 'monospace', fontSize: 11 }}>
          Checking…
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spawn Agent Panel (mini control)
// ---------------------------------------------------------------------------
const ROLES = [
  'researcher', 'coder', 'writer', 'analyst', 'reviewer', 'archivist'
];

function SpawnPanel() {
  const [role, setRole]     = useState('researcher');
  const [remote, setRemote] = useState(false);
  const [busy, setBusy]     = useState(false);
  const [msg, setMsg]       = useState('');

  const spawn = async () => {
    setBusy(true);
    setMsg('');
    try {
      const token = AuthService.getToken();
      const resp = await fetch(`${API_BASE}/agents/spawn`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role, prefer_remote_gpu: remote }),
      });
      const data = await resp.json();
      setMsg(resp.ok ? `✓ ${data.name} spawned` : `✗ ${data.error}`);
    } catch {
      setMsg('✗ Request failed');
    } finally {
      setBusy(false);
    }
  };

  const selectStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid #1a3a5c',
    borderRadius: 4, padding: '4px 8px',
    color: '#dde', fontFamily: 'monospace', fontSize: 12,
    cursor: 'pointer',
  };

  return (
    <div style={{
      padding: '8px 14px',
      background: '#0d0d22',
      borderBottom: '1px solid #1a3a5c',
      display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
    }}>
      <span style={{ color: '#556', fontFamily: 'monospace', fontSize: 10 }}>
        SPAWN AGENT
      </span>
      <select value={role} onChange={e => setRole(e.target.value)} style={selectStyle}>
        {ROLES.map(r => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 4,
        fontFamily: 'monospace', fontSize: 11, color: '#aab', cursor: 'pointer',
      }}>
        <input type="checkbox" checked={remote}
               onChange={e => setRemote(e.target.checked)} />
        LAN GPU
      </label>
      <button
        onClick={spawn}
        disabled={busy}
        style={{
          background: busy ? '#1a3a5c' : '#4FC3F7',
          color: '#000', border: 'none', borderRadius: 4,
          padding: '4px 14px', cursor: busy ? 'not-allowed' : 'pointer',
          fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold',
        }}
      >
        {busy ? '…' : '+ Spawn'}
      </button>
      {msg && (
        <span style={{
          fontFamily: 'monospace', fontSize: 11,
          color: msg.startsWith('✓') ? '#81C784' : '#ff5555',
        }}>
          {msg}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OfficePage
// ---------------------------------------------------------------------------
export default function OfficePage() {
  const [wide, setWide] = useState(window.innerWidth >= 1200);

  useEffect(() => {
    const handler = () => setWide(window.innerWidth >= 1200);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', background: '#06060f', overflow: 'hidden',
    }}>
      {/* Top bar */}
      <div style={{
        padding: '8px 20px',
        background: '#0d0d22',
        borderBottom: '1px solid #1a3a5c',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{
          fontFamily: 'monospace', fontSize: 15, fontWeight: 'bold',
          color: '#00f5ff', letterSpacing: 2,
          textShadow: '0 0 12px #00f5ff',
        }}>
          ▶ AGENT HQ
        </span>
        <span style={{
          fontFamily: 'monospace', fontSize: 10, color: '#556',
        }}>
          Local AI Agent System
        </span>
      </div>

      <SpawnPanel />

      {/* Main content */}
      <div style={{
        flex: 1, display: 'flex',
        flexDirection: wide ? 'row' : 'column',
        overflow: 'hidden', gap: 0,
      }}>
        {/* Office canvas */}
        <div style={{
          flex: wide ? '0 0 auto' : '0 0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16, background: '#08081a',
          borderRight: wide ? '1px solid #1a3a5c' : 'none',
          borderBottom: wide ? 'none' : '1px solid #1a3a5c',
          overflow: 'auto',
        }}>
          <PixelOffice />
        </div>

        {/* Chat panel */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          minHeight: 0, minWidth: 0,
        }}>
          <PMChat style={{ flex: 1, minHeight: 0 }} />
        </div>
      </div>

      <LLMStatusBar />
    </div>
  );
}
