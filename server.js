const { WebSocketServer, WebSocket } = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

// Store clients categorized by role
const senders = new Set();
const receivers = new Set();

wss.on('connection', (ws, req) => {
    // Determine client role from URL query parameters (e.g., wss://your-app.fly.dev?role=sender)
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const role = urlParams.get('role'); // "sender" or "receiver"

    if (role === 'sender') {
        senders.add(ws);
        console.log('[+] Sender connected');
    } else if (role === 'receiver') {
        receivers.add(ws);
        console.log('[+] Receiver connected');
    } else {
        console.log('[-] Connection rejected: Invalid or missing role parameter');
        ws.close(1008, 'Role required: ?role=sender or ?role=receiver');
        return;
    }

    ws.on('message', (rawMessage) => {
        // ENFORCE ONE-WAY RULE: Only process messages originating from Senders
        if (!senders.has(ws)) {
            console.warn('[!] Security Alert: Receiver attempted to send data. Ignoring.');
            return;
        }

        // Relay the data ONLY to connected Receivers
        receivers.forEach((receiver) => {
            if (receiver.readyState === WebSocket.OPEN) {
                receiver.send(rawMessage);
            }
        });
    });

    ws.on('close', () => {
        senders.delete(ws);
        receivers.delete(ws);
        console.log('[-] Client disconnected');
    });
});

console.log(`One-way relay running on port ${PORT}`);const { WebSocketServer, WebSocket } = require('ws');

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
