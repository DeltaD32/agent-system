/**
 * PMChat – Chat interface for the Project Manager agent.
 *
 * Features:
 *  - Scrollable message history
 *  - Typing indicator while the PM agent is processing
 *  - Inline display of agent events (spawn, task complete)
 *  - Pixel-art / terminal aesthetic to match the office
 */

import React, {
  useState, useEffect, useRef, useCallback
} from 'react';
import AuthService from '../../services/AuthService';

const API_BASE = process.env.REACT_APP_API_URL || '/api';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AgentEventBadge({ event }) {
  const colors = {
    spawned:       '#81C784',
    task_complete: '#4FC3F7',
    error:         '#ff5555',
  };
  const labels = {
    spawned:       '⚡ Agent spawned',
    task_complete: '✓ Task complete',
    error:         '✗ Error',
  };
  return (
    <span style={{
      fontSize: 10, fontFamily: 'monospace',
      background: 'rgba(0,0,0,0.5)',
      border: `1px solid ${colors[event.type] || '#555'}`,
      color: colors[event.type] || '#888',
      borderRadius: 3, padding: '1px 6px', marginLeft: 6,
    }}>
      {labels[event.type] || event.type}
      {event.agent?.name ? ` — ${event.agent.name}` : ''}
    </span>
  );
}

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
      marginBottom: 12,
      gap: 8,
    }}>
      {/* Avatar */}
      <div style={{
        width: 28, height: 28, borderRadius: 4, flexShrink: 0,
        background: isUser ? '#1a3a5c' : '#2d1a4c',
        border: `1px solid ${isUser ? '#4FC3F7' : '#FFD700'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, color: isUser ? '#4FC3F7' : '#FFD700',
        fontFamily: 'monospace',
      }}>
        {isUser ? 'U' : 'PM'}
      </div>

      {/* Bubble */}
      <div style={{
        maxWidth: '75%',
        background: isUser ? 'rgba(79,195,247,0.08)' : 'rgba(255,215,0,0.07)',
        border: `1px solid ${isUser ? 'rgba(79,195,247,0.25)' : 'rgba(255,215,0,0.2)'}`,
        borderRadius: 6, padding: '8px 12px',
      }}>
        <div style={{
          color: '#dde',
          fontSize: 13,
          fontFamily: '"Courier New", monospace',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {msg.content}
        </div>

        {/* Agent events */}
        {msg.agent_events?.length > 0 && (
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {msg.agent_events.map((ev, i) => (
              <AgentEventBadge key={i} event={ev} />
            ))}
          </div>
        )}

        <div style={{
          fontSize: 9, color: '#556', marginTop: 4,
          fontFamily: 'monospace', textAlign: isUser ? 'right' : 'left',
        }}>
          {new Date(msg.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  const [dots, setDots] = useState('.');
  useEffect(() => {
    const t = setInterval(() =>
      setDots(d => d.length >= 3 ? '.' : d + '.'), 400);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 4, flexShrink: 0,
        background: '#2d1a4c', border: '1px solid #FFD700',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, color: '#FFD700', fontFamily: 'monospace',
      }}>PM</div>
      <div style={{
        background: 'rgba(255,215,0,0.07)',
        border: '1px solid rgba(255,215,0,0.2)',
        borderRadius: 6, padding: '8px 14px',
        color: '#FFD700', fontFamily: 'monospace', fontSize: 14,
        letterSpacing: 2,
      }}>
        {dots}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PMChat({ style }) {
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // Fetch history on mount
  useEffect(() => {
    const token = AuthService.getToken();
    if (!token) return;
    fetch(`${API_BASE}/chat/history?limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setMessages(data);
      })
      .catch(() => {})
      .finally(() => setInitialLoad(false));
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const token = AuthService.getToken();
      const resp = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text }),
      });
      const data = await resp.json();
      if (data.reply) {
        setMessages(prev => [
          ...prev,
          {
            id: Date.now().toString() + '_pm',
            role: 'assistant',
            content: data.reply,
            agent_events: data.agent_events || [],
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString() + '_err',
          role: 'assistant',
          content: '⚠ Connection error. Please try again.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ---------------------------------------------------------------------------
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: '#0a0a1a',
      border: '1px solid #1a3a5c',
      borderRadius: 8,
      boxShadow: '0 0 20px rgba(0,245,255,0.08)',
      overflow: 'hidden',
      ...style,
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px',
        background: '#0d0d22',
        borderBottom: '1px solid #1a3a5c',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: '#FFD700',
          boxShadow: '0 0 8px #FFD700',
        }} />
        <span style={{
          fontFamily: 'monospace', fontSize: 13,
          color: '#FFD700', letterSpacing: 1,
        }}>
          PROJECT MANAGER
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: 10,
          color: '#556', fontFamily: 'monospace',
        }}>
          {messages.length} messages
        </span>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px 12px',
        display: 'flex', flexDirection: 'column',
      }}>
        {initialLoad && (
          <div style={{ color: '#556', fontFamily: 'monospace',
            fontSize: 12, textAlign: 'center', padding: 20 }}>
            Loading history…
          </div>
        )}
        {!initialLoad && messages.length === 0 && (
          <div style={{
            color: '#FFD700', fontFamily: 'monospace',
            fontSize: 13, textAlign: 'center', padding: 30,
            opacity: 0.7,
          }}>
            Hello. I'm your Project Manager.<br />
            How can I help you today?
          </div>
        )}
        {messages.map(msg => <Message key={msg.id} msg={msg} />)}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '10px 12px',
        borderTop: '1px solid #1a3a5c',
        display: 'flex', gap: 8,
        background: '#0d0d22',
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={loading}
          rows={2}
          placeholder="Message the Project Manager…  (Enter to send)"
          style={{
            flex: 1, resize: 'none',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid #1a3a5c',
            borderRadius: 4, padding: '8px 10px',
            color: '#dde', fontFamily: 'monospace', fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{
            background: loading ? '#1a3a5c' : '#FFD700',
            color: '#000', border: 'none', borderRadius: 4,
            padding: '0 18px', cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'monospace', fontWeight: 'bold', fontSize: 13,
            transition: 'background 0.2s',
          }}
        >
          {loading ? '…' : '→'}
        </button>
      </div>
    </div>
  );
}
