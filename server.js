const { WebSocketServer, WebSocket } = require('ws');

// Fly.io sets PORT dynamically (defaults to 8080)
const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

// Track connected clients
const clients = new Map();

wss.on('connection', (ws) => {
    const clientId = Math.random().toString(36).substring(2, 9);
    clients.set(clientId, ws);
    console.log(`[+] Client connected: ${clientId}`);

    // Send assigned ID back to executor
    ws.send(JSON.stringify({ type: 'init', id: clientId }));

    ws.on('message', (rawMessage) => {
        try {
            const parsed = JSON.parse(rawMessage);

            // Forward to specific client ID or broadcast to all
            if (parsed.targetId) {
                const targetSocket = clients.get(parsed.targetId);
                if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
                    targetSocket.send(JSON.stringify({
                        senderId: clientId,
                        payload: parsed.payload
                    }));
                }
            } else {
                // Broadcast to everyone except sender
                wss.clients.forEach((client) => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            senderId: clientId,
                            payload: parsed.payload
                        }));
                    }
                });
            }
        } catch (err) {
            console.error('Invalid payload format:', err);
        }
    });

    ws.on('close', () => {
        console.log(`[-] Client disconnected: ${clientId}`);
        clients.delete(clientId);
    });
});

console.log(`Relay server running on port ${PORT}`);
