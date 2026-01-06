const WebSocket = require('ws');
const port = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: port });

const rooms = new Map(); // roomId -> Set<ws>

console.log(`Relay server started on port ${port}`);

wss.on('connection', (ws) => {
    let currentRoom = null;

    ws.on('message', (messageRaw) => {
        try {
            const message = messageRaw.toString();
            const data = JSON.parse(message);

            if (data.type === 'join_room') {
                const roomId = data.roomId;
                if (!roomId) return;

                // Leave previous room if any
                if (currentRoom && rooms.has(currentRoom)) {
                    rooms.get(currentRoom).delete(ws);
                    broadcastRoomInfo(currentRoom); // Update old room
                }

                currentRoom = roomId;
                if (!rooms.has(roomId)) {
                    rooms.set(roomId, new Set());
                }
                rooms.get(roomId).add(ws);
                console.log(`Client joined room ${roomId}. Total in room: ${rooms.get(roomId).size}`);

                broadcastRoomInfo(roomId); // Update new room
            } else {
                // Broadcast to room
                if (currentRoom && rooms.has(currentRoom)) {
                    rooms.get(currentRoom).forEach(client => {
                        if (client !== ws && client.readyState === WebSocket.OPEN) {
                            client.send(messageRaw);
                        }
                    });
                }
            }
        } catch (e) {
            console.error('Error processing message:', e);
        }
    });

    ws.on('close', () => {
        if (currentRoom && rooms.has(currentRoom)) {
            rooms.get(currentRoom).delete(ws);
            if (rooms.get(currentRoom).size === 0) {
                rooms.delete(currentRoom);
            } else {
                broadcastRoomInfo(currentRoom); // Update room
            }
            console.log(`Client left room ${currentRoom}`);
        }
    });
});

function broadcastRoomInfo(roomId) {
    if (!rooms.has(roomId)) return;

    const count = rooms.get(roomId).size;
    const message = JSON.stringify({
        type: 'room_info',
        count: count
    });

    rooms.get(roomId).forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}
