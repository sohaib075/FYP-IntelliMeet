const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Store meeting rooms state in memory
const rooms = new Map(); // roomId -> { participants: [], messages: [] }

io.on('connection', (socket) => {
  console.log(`[Socket] User connected: ${socket.id}`);

  // Join a room
  socket.on('join-room', (roomId, user) => {
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, { participants: [], messages: [] });
    }
    
    const room = rooms.get(roomId);
    
    // Check if participant already exists in the room
    const existingIndex = room.participants.findIndex(p => p.id === user.id);
    if (existingIndex >= 0) {
      room.participants[existingIndex] = { ...user, socketId: socket.id };
    } else {
      room.participants.push({ ...user, socketId: socket.id });
    }

    // Send the current room state back to the newly joined user
    socket.emit('room-state', {
      participants: room.participants,
      messages: room.messages
    });

    // Notify others in the room
    socket.to(roomId).emit('user-joined', user);

    // Save user info on socket for disconnect handling
    socket.roomId = roomId;
    socket.user = user;
    
    console.log(`[Socket] User ${user.name} joined room ${roomId}`);
  });

  // Handle media toggle (mute/video)
  socket.on('toggle-media', (roomId, userId, mediaState) => {
    const room = rooms.get(roomId);
    if (room) {
      const participant = room.participants.find(p => p.id === userId);
      if (participant) {
        Object.assign(participant, mediaState);
        socket.to(roomId).emit('media-toggled', userId, mediaState);
      }
    }
  });

  // Handle chat messages
  socket.on('send-message', (roomId, message) => {
    const room = rooms.get(roomId);
    if (room) {
      room.messages.push(message);
      // Keep only last 100 messages
      if (room.messages.length > 100) room.messages.shift();
      
      socket.to(roomId).emit('chat-message', message);
    }
  });

  // Handle participant removal (kicked by host)
  socket.on('remove-user', (roomId, targetUserId) => {
    const room = rooms.get(roomId);
    if (room) {
      // Find the socket ID of the target user
      const targetUser = room.participants.find(p => p.id === targetUserId);
      if (targetUser && targetUser.socketId) {
        room.participants = room.participants.filter(p => p.id !== targetUserId);
        // Tell everyone the user was removed
        io.to(roomId).emit('user-left', targetUserId);
        
        // Disconnect the target socket
        const targetSocket = io.sockets.sockets.get(targetUser.socketId);
        if (targetSocket) {
          targetSocket.disconnect(true);
        }
      }
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`[Socket] User disconnected: ${socket.id}`);
    
    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      if (room) {
        // Find all users tied to this socket to notify them
        const disconnectedUsers = room.participants.filter(p => p.socketId === socket.id);
        
        // Remove all from the room
        room.participants = room.participants.filter(p => p.socketId !== socket.id);
        
        // Notify others
        disconnectedUsers.forEach(user => {
          socket.to(socket.roomId).emit('user-left', user.id);
        });

        // Clean up empty rooms
        if (room.participants.length === 0) {
          rooms.delete(socket.roomId);
          console.log(`[Socket] Room ${socket.roomId} empty and deleted`);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
