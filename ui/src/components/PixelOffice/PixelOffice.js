/**
 * PixelOffice
 *
 * React component that renders the isometric pixel-art agent office.
 * Connects to the WebSocket endpoint for real-time agent state updates
 * and animates agent movement between desks on task hand-off.
 */

import React, {
  useRef, useEffect, useCallback, useState
} from 'react';
import { renderOffice, toScreen, TILE_W, TILE_H, DESKS } from './renderer';

const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;

const CANVAS_W = 700;
const CANVAS_H = 480;
const WALK_SPEED = 0.06;   // grid units per frame

// ---------------------------------------------------------------------------
// Particle factory
// ---------------------------------------------------------------------------
function makeParticles(fromScreen, toScreen_, color, count = 12) {
  return Array.from({ length: count }, () => ({
    x: fromScreen.x + (Math.random() - 0.5) * 20,
    y: fromScreen.y + (Math.random() - 0.5) * 20,
    vx: (toScreen_.x - fromScreen.x) / 40 + (Math.random() - 0.5) * 2,
    vy: (toScreen_.y - fromScreen.y) / 40 + (Math.random() - 0.5) * 2,
    r: Math.random() * 3 + 1,
    alpha: 1,
    color,
  }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function PixelOffice({ style }) {
  const canvasRef  = useRef(null);
  const agentsRef  = useRef([]);           // mutable agent state for RAF loop
  const particlesRef = useRef([]);
  const tickRef    = useRef(0);
  const wsRef      = useRef(null);
  const rafRef     = useRef(null);
  const [connected, setConnected] = useState(false);
  const [agentList, setAgentList] = useState([]);  // for legend display

  // ---- Animation loop ----
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    tickRef.current += 1;
    const tick = tickRef.current;

    // Animate agent positions toward desk targets
    agentsRef.current = agentsRef.current.map(agent => {
      const targetCol = agent.desk[0];
      const targetRow = agent.desk[1];
      const curCol = agent._renderCol ?? targetCol;
      const curRow = agent._renderRow ?? targetRow;
      const dc = targetCol - curCol;
      const dr = targetRow - curRow;
      const dist = Math.sqrt(dc * dc + dr * dr);
      if (dist < WALK_SPEED) {
        return { ...agent, _renderCol: targetCol, _renderRow: targetRow,
                 status: agent.status === 'walking' ? 'idle' : agent.status };
      }
      return {
        ...agent,
        _renderCol: curCol + (dc / dist) * WALK_SPEED,
        _renderRow: curRow + (dr / dist) * WALK_SPEED,
        status: 'walking',
      };
    });

    // Update particles
    particlesRef.current = particlesRef.current
      .map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        alpha: p.alpha - 0.02,
      }))
      .filter(p => p.alpha > 0);

    renderOffice(ctx, CANVAS_W, CANVAS_H, agentsRef.current,
                 particlesRef.current, tick);

    rafRef.current = requestAnimationFrame(animate);
  }, []);

  // ---- WebSocket ----
  const connectWS = useCallback(() => {
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        // Reconnect after 3 s
        setTimeout(connectWS, 3000);
      };
      ws.onerror = () => ws.close();

      ws.onmessage = (e) => {
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }
        if (msg === 'pong' || msg?.event === 'ping') return;
        handleWSEvent(msg);
      };
    } catch (err) {
      setTimeout(connectWS, 3000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleWSEvent = useCallback((msg) => {
    const { event, data } = msg;

    if (event === 'snapshot') {
      agentsRef.current = data.agents.map(normaliseAgent);
      setAgentList([...data.agents]);
      return;
    }

    if (event === 'agent_spawned') {
      agentsRef.current = [...agentsRef.current, normaliseAgent(data)];
      setAgentList(agentsRef.current.map(a => ({ ...a })));
      return;
    }

    if (event === 'agent_despawned') {
      agentsRef.current = agentsRef.current.filter(a => a.id !== data.agent_id);
      setAgentList(agentsRef.current.map(a => ({ ...a })));
      return;
    }

    if (event === 'agent_status_updated' || event === 'agent_task_assigned') {
      agentsRef.current = agentsRef.current.map(a =>
        a.id === data.id ? { ...a, ...normaliseAgent(data) } : a
      );
      setAgentList(agentsRef.current.map(a => ({ ...a })));
      return;
    }

    if (event === 'agent_moved') {
      const { agent_id, destination } = data;
      const fromAgent = agentsRef.current.find(a => a.id === agent_id);
      if (fromAgent) {
        const fromSc = toScreen(
          fromAgent._renderCol ?? fromAgent.desk[0],
          fromAgent._renderRow ?? fromAgent.desk[1],
          CANVAS_W, CANVAS_H
        );
        const toSc = toScreen(destination[0], destination[1], CANVAS_W, CANVAS_H);
        const pts = makeParticles(fromSc, toSc, fromAgent.color || '#88aaff');
        particlesRef.current = [...particlesRef.current, ...pts];
      }
      agentsRef.current = agentsRef.current.map(a =>
        a.id === agent_id ? { ...a, desk: destination, status: 'walking' } : a
      );
      return;
    }
  }, []);

  // ---- Mount / unmount ----
  useEffect(() => {
    connectWS();
    rafRef.current = requestAnimationFrame(animate);

    // Keepalive ping
    const ping = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send('ping');
      }
    }, 25000);

    return () => {
      wsRef.current?.close();
      cancelAnimationFrame(rafRef.current);
      clearInterval(ping);
    };
  }, [animate, connectWS]);

  // ---------------------------------------------------------------------------
  return (
    <div style={{ position: 'relative', display: 'inline-block', ...style }}>
      {/* Status indicator */}
      <div style={{
        position: 'absolute', top: 8, right: 12,
        fontSize: 10, fontFamily: 'monospace',
        color: connected ? '#00ff88' : '#ff4444',
        zIndex: 10,
        textShadow: `0 0 6px ${connected ? '#00ff88' : '#ff4444'}`,
      }}>
        {connected ? '● LIVE' : '○ OFFLINE'}
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{
          display: 'block',
          imageRendering: 'pixelated',
          borderRadius: 8,
          border: '1px solid #1a3a5c',
          boxShadow: '0 0 30px rgba(0,245,255,0.12)',
        }}
      />

      {/* Agent legend */}
      <div style={{
        position: 'absolute', bottom: 8, left: 8,
        display: 'flex', flexWrap: 'wrap', gap: 4,
      }}>
        {agentList.map(a => (
          <span key={a.id} style={{
            fontSize: 9, fontFamily: 'monospace',
            background: 'rgba(0,0,0,0.7)',
            border: `1px solid ${a.color || '#555'}`,
            borderRadius: 3, padding: '1px 5px',
            color: a.color || '#aaa',
          }}>
            {a.name} [{a.status}]
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normaliseAgent(raw) {
  return {
    ...raw,
    _renderCol: raw._renderCol ?? raw.desk?.[0] ?? 0,
    _renderRow: raw._renderRow ?? raw.desk?.[1] ?? 0,
    color: raw.color || roleColor(raw.role),
  };
}

function roleColor(role) {
  const map = {
    project_manager: '#FFD700',
    researcher:      '#4FC3F7',
    coder:           '#81C784',
    writer:          '#F48FB1',
    analyst:         '#CE93D8',
    reviewer:        '#FFAB40',
    archivist:       '#80DEEA',
  };
  return map[role] || '#88aaff';
}
