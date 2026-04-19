const { Server } = require('socket.io');

const io = new Server(3001, {
  cors: {
    origin: '*',
  }
});

const activeRooms = {}; // Format: { "room123": ["socketId1", "socketId2"] }

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('create_room', () => {
    // Generate simple 6-character alphanumeric room code
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    activeRooms[roomId] = [socket.id];
    socket.join(roomId);
    console.log(`User ${socket.id} created and joined room ${roomId}`);
    
    // Explicit return required so client updates state
    socket.emit('room_created', { room: roomId });
  });

  socket.on('join_room', (data) => {
    const { room } = data;
    
    // Check constraints
    if (!activeRooms[room]) {
      return socket.emit('room_error', { message: `Room ${room} does not exist.` });
    }
    if (activeRooms[room].length >= 4) {
      return socket.emit('room_error', { message: `Room ${room} is full (max 4).` });
    }
    
    // Join logic
    activeRooms[room].push(socket.id);
    socket.join(room);
    console.log(`User ${socket.id} joined room ${room}`);
    
    // Send list of existing users to the new user so they can initiate P2P offers!
    const otherUsers = activeRooms[room].filter(id => id !== socket.id);
    socket.emit('room_joined', { room, otherUsers });
    
    // Notify everyone else that someone arrived (useful for UI)
    socket.to(room).emit('peer_joined', { sid: socket.id });
  });

  // Proxy WebRTC payloads point-to-point explicitly
  socket.on('offer', (data) => {
    socket.to(data.targetSid).emit('offer', { offer: data.offer, senderSid: socket.id });
  });

  socket.on('answer', (data) => {
    socket.to(data.targetSid).emit('answer', { answer: data.answer, senderSid: socket.id });
  });

  socket.on('ice_candidate', (data) => {
    socket.to(data.targetSid).emit('ice_candidate', { candidate: data.candidate, senderSid: socket.id });
  });

  // ML Predictions can still broadcast to the room safely, but must identify sender
  socket.on('gesture_prediction', (data) => {
    socket.to(data.room).emit('gesture_prediction', { prediction: data.prediction, senderSid: socket.id });
  });

  // Handle implicit browser dropouts automatically
  socket.on('disconnecting', () => {
    socket.rooms.forEach((room) => {
      if (room !== socket.id && activeRooms[room]) {
        // Clean up memory
        activeRooms[room] = activeRooms[room].filter(id => id !== socket.id);
        if (activeRooms[room].length === 0) {
          delete activeRooms[room];
        } else {
          // Tell peers to remove their UI elements
          socket.to(room).emit('peer_left', { sid: socket.id });
        }
      }
    });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

console.log('Node.js WebSocket Signaling server is running on ws://localhost:3001');
