/**
 * Pixel-Art Isometric Office Renderer
 *
 * Draws a top-down isometric office on an HTML5 Canvas.
 * Each desk belongs to a specialised agent role.
 * Agent sprites walk between desks when task hand-offs occur.
 *
 * Coordinate system
 *   Iso grid: column (x), row (y) → screen coords via toScreen()
 *   Tile size: TILE_W × TILE_H  (isometric diamond)
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const TILE_W = 64;   // width of one iso tile (diamond)
export const TILE_H = 32;   // height of one iso tile

export const COLS = 8;
export const ROWS = 8;

// Desk definitions  [col, row, role, label, colour]
export const DESKS = [
  { col: 3, row: 1, role: 'project_manager', label: 'PM',         color: '#FFD700' },
  { col: 1, row: 2, role: 'researcher',      label: 'Research',   color: '#4FC3F7' },
  { col: 5, row: 2, role: 'coder',           label: 'Code',       color: '#81C784' },
  { col: 1, row: 4, role: 'writer',          label: 'Write',      color: '#F48FB1' },
  { col: 5, row: 4, role: 'analyst',         label: 'Analyse',    color: '#CE93D8' },
  { col: 3, row: 4, role: 'reviewer',        label: 'Review',     color: '#FFAB40' },
  { col: 3, row: 6, role: 'archivist',       label: 'Archive',    color: '#80DEEA' },
];

// Pixel palette
const P = {
  floor:      '#1a1a2e',
  floorLine:  '#16213e',
  wall:       '#0f3460',
  wallTop:    '#533483',
  deskTop:    '#2d2d44',
  deskFront:  '#1e1e30',
  screen:     '#00f5ff',
  screenOff:  '#003344',
  carpet:     '#12122a',
  window:     '#4fc3f7',
  windowFrame:'#1a3a5c',
};

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------
export function toScreen(col, row, canvasW, canvasH) {
  // Isometric projection
  const originX = canvasW / 2;
  const originY = TILE_H * 2;
  const sx = originX + (col - row) * (TILE_W / 2);
  const sy = originY + (col + row) * (TILE_H / 2);
  return { x: sx, y: sy };
}

// ---------------------------------------------------------------------------
// Drawing primitives
// ---------------------------------------------------------------------------

function drawIsoDiamond(ctx, sx, sy, fillColor, strokeColor = null) {
  ctx.beginPath();
  ctx.moveTo(sx,              sy - TILE_H / 2);
  ctx.lineTo(sx + TILE_W / 2, sy);
  ctx.lineTo(sx,              sy + TILE_H / 2);
  ctx.lineTo(sx - TILE_W / 2, sy);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawIsoBox(ctx, sx, sy, w, h, d, topColor, leftColor, rightColor) {
  // Top face
  ctx.beginPath();
  ctx.moveTo(sx,       sy);
  ctx.lineTo(sx + w/2, sy + h/2);
  ctx.lineTo(sx,       sy + h);
  ctx.lineTo(sx - w/2, sy + h/2);
  ctx.closePath();
  ctx.fillStyle = topColor;
  ctx.fill();

  // Left face
  ctx.beginPath();
  ctx.moveTo(sx - w/2, sy + h/2);
  ctx.lineTo(sx,       sy + h);
  ctx.lineTo(sx,       sy + h + d);
  ctx.lineTo(sx - w/2, sy + h/2 + d);
  ctx.closePath();
  ctx.fillStyle = leftColor;
  ctx.fill();

  // Right face
  ctx.beginPath();
  ctx.moveTo(sx + w/2, sy + h/2);
  ctx.lineTo(sx,       sy + h);
  ctx.lineTo(sx,       sy + h + d);
  ctx.lineTo(sx + w/2, sy + h/2 + d);
  ctx.closePath();
  ctx.fillStyle = rightColor;
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Scene elements
// ---------------------------------------------------------------------------

function drawFloor(ctx, canvasW, canvasH) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const { x, y } = toScreen(c, r, canvasW, canvasH);
      const shade = (c + r) % 2 === 0 ? P.floor : P.carpet;
      drawIsoDiamond(ctx, x, y, shade, P.floorLine);
    }
  }
}

function drawDesk(ctx, col, row, color, canvasW, canvasH, isActive) {
  const { x, y } = toScreen(col, row, canvasW, canvasH);
  const deskH = 10;
  const deskD = 8;
  const lighter = lighten(color, 30);
  const darker  = darken(color, 40);

  drawIsoBox(
    ctx,
    x, y - deskH - deskD,
    TILE_W * 0.7, TILE_H * 0.7,
    deskH,
    isActive ? lighter : P.deskTop,
    isActive ? color    : P.deskFront,
    isActive ? darker   : '#111122',
  );

  // Monitor
  const mx = x;
  const my = y - deskH - deskD - 14;
  ctx.fillStyle = isActive ? P.screen : P.screenOff;
  ctx.fillRect(mx - 9, my, 18, 10);
  ctx.fillStyle = '#000';
  ctx.fillRect(mx - 1, my + 10, 2, 4);
  ctx.fillStyle = '#333';
  ctx.fillRect(mx - 4, my + 14, 8, 2);

  if (isActive) {
    // Glow
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    ctx.fillRect(mx - 9, my, 18, 10);
    ctx.restore();
  }
}

function drawLabel(ctx, col, row, label, color, canvasW, canvasH) {
  const { x, y } = toScreen(col, row, canvasW, canvasH);
  ctx.font = 'bold 8px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.fillText(label, x, y - 36);
}

// ---------------------------------------------------------------------------
// Agent sprite (tiny pixel person)
// ---------------------------------------------------------------------------

export function drawAgent(ctx, sx, sy, color, status, name) {
  const baseY = sy - 28;

  // Shadow
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.ellipse(sx, sy - 2, 8, 3, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();

  // Body (3-pixel-art style blocks)
  // Legs
  ctx.fillStyle = darken(color, 30);
  ctx.fillRect(sx - 4, baseY + 16, 3, 8);
  ctx.fillRect(sx + 1, baseY + 16, 3, 8);

  // Torso
  ctx.fillStyle = color;
  ctx.fillRect(sx - 5, baseY + 8, 10, 9);

  // Head
  ctx.fillStyle = '#ffcc99';
  ctx.fillRect(sx - 4, baseY, 8, 8);

  // Eyes
  ctx.fillStyle = '#333';
  ctx.fillRect(sx - 2, baseY + 2, 2, 2);
  ctx.fillRect(sx + 1, baseY + 2, 2, 2);

  // Status indicator dot
  const dotColor = status === 'working'  ? '#00ff88' :
                   status === 'thinking' ? '#ffff00' :
                   status === 'walking'  ? '#ff8800' :
                   status === 'error'    ? '#ff0000' : '#888';
  ctx.beginPath();
  ctx.arc(sx + 6, baseY - 2, 3, 0, Math.PI * 2);
  ctx.fillStyle = dotColor;
  ctx.fill();

  // Glow on active
  if (status === 'working' || status === 'thinking') {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    ctx.fillRect(sx - 5, baseY + 8, 10, 9);
    ctx.restore();
  }

  // Name tag
  ctx.font = '7px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(name.length > 8 ? name.slice(0, 8) : name, sx, baseY - 5);
}

// ---------------------------------------------------------------------------
// Task handoff particle effect
// ---------------------------------------------------------------------------

export function drawParticles(ctx, particles) {
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.restore();
  });
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

export function renderOffice(ctx, canvasW, canvasH, agents, particles, tick) {
  ctx.clearRect(0, 0, canvasW, canvasH);

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, canvasH);
  bg.addColorStop(0, '#0a0a1a');
  bg.addColorStop(1, '#0d0d22');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvasW, canvasH);

  drawFloor(ctx, canvasW, canvasH);

  // Draw desks
  DESKS.forEach(desk => {
    const isActive = agents.some(
      a => a.role === desk.role &&
           (a.status === 'working' || a.status === 'thinking')
    );
    drawDesk(ctx, desk.col, desk.row, desk.color, canvasW, canvasH, isActive);
    drawLabel(ctx, desk.col, desk.row, desk.label, desk.color, canvasW, canvasH);
  });

  // Draw agents
  agents.forEach(agent => {
    // Interpolated position (col, row floats for animation)
    const col = agent._renderCol ?? agent.desk[0];
    const row = agent._renderRow ?? agent.desk[1];
    const { x, y } = toScreen(col, row, canvasW, canvasH);

    // Bobbing animation when working
    const bobOffset = (agent.status === 'working' || agent.status === 'thinking')
      ? Math.sin(tick / 15) * 2
      : 0;

    drawAgent(ctx, x, y + bobOffset, agent.color || '#88aaff',
              agent.status, agent.name);
  });

  // Particles
  drawParticles(ctx, particles);

  // Scanline overlay for CRT effect
  ctx.save();
  ctx.globalAlpha = 0.04;
  for (let y = 0; y < canvasH; y += 2) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, y, canvasW, 1);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

function lighten(hex, amount) {
  return adjustColor(hex, amount);
}
function darken(hex, amount) {
  return adjustColor(hex, -amount);
}
function adjustColor(hex, amount) {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.max(0, Math.min(255, r + amount));
  g = Math.max(0, Math.min(255, g + amount));
  b = Math.max(0, Math.min(255, b + amount));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}
