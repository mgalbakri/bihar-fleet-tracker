const WebSocket = require('ws');
const config = require('../../config/default');

let wss = null;
const clients = new Set();

function init(server) {
  wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    clients.add(ws);
    const ip = req.socket.remoteAddress;
    console.log(`[WS] Client connected (${clients.size} total) from ${ip}`);

    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      payload: {
        message: 'BIHAR SENTINEL WebSocket connected',
        timestamp: new Date().toISOString(),
        heartbeatInterval: config.websocket.heartbeatIntervalMs
      }
    }));

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[WS] Client disconnected (${clients.size} remaining)`);
    });

    ws.on('error', (err) => {
      console.error('[WS] Client error:', err.message);
      clients.delete(ws);
    });
  });

  // Heartbeat to detect dead connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        clients.delete(ws);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });

    // Send heartbeat message to all connected clients
    broadcast('heartbeat', {
      timestamp: new Date().toISOString(),
      clients: clients.size
    });
  }, config.websocket.heartbeatIntervalMs);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  console.log('[WS] WebSocket server initialized on /ws');
  return wss;
}

// Broadcast typed message to all connected clients
function broadcast(type, payload) {
  const message = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
  let sent = 0;
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
      sent++;
    }
  }
  if (type !== 'heartbeat' && sent > 0) {
    console.log(`[WS] Broadcast '${type}' to ${sent} client(s)`);
  }
}

function getClientCount() {
  return clients.size;
}

module.exports = { init, broadcast, getClientCount };
