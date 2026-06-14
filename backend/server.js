/**
 * ============================================================
 * IntelliMeet — Server Entry Point
 * ============================================================
 * Bootstraps the Express application with:
 *  - Environment configuration & validation
 *  - MongoDB connection (with retry logic)
 *  - Security middleware (Helmet, CORS, rate limiting, sanitisation)
 *  - Body parsing with size limits
 *  - REST API routes (auth, users)
 *  - Socket.io signaling server (preserved from original)
 *  - Centralised error handling
 *  - Graceful shutdown
 *
 * Middleware execution order matters for security:
 *  1. Helmet (security headers)
 *  2. General rate limiter
 *  3. CORS
 *  4. Body parsers with size limits
 *  5. NoSQL injection sanitiser
 *  6. API routes
 *  7. 404 catch-all
 *  8. Global error handler
 * ============================================================
 */

// ---- Load environment variables FIRST (before any other import) ----
const config = require('./config/environment');

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');

// Internal modules
const connectDB = require('./config/db');
const sanitize = require('./middleware/sanitize');
const { generalLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const ApiError = require('./utils/ApiError');

// Route modules
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');

// ============================================================
// Express App Setup
// ============================================================
const app = express();

// ---- 1. Security Headers ----
app.use(helmet());

// ---- 2. General Rate Limiter ----
app.use('/api', generalLimiter);

// ---- 3. CORS Configuration ----
const corsOptions = {
  origin: config.CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400, // 24 hours
};
app.use(cors(corsOptions));

// ---- 4. Body Parsers ----
// Limit payload size to prevent large payload attacks
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ---- 5. NoSQL Injection Sanitiser ----
app.use(sanitize);

// ============================================================
// API Routes
// ============================================================

/** Health check — useful for load balancers and monitoring */
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'IntelliMeet API is running',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
  });
});

/** Authentication routes (register, login) */
app.use('/api/auth', authRoutes);

/** User routes (profile, preferences) — protected */
app.use('/api/users', userRoutes);

// ============================================================
// 404 Catch-All (for API routes only)
// Express 5 requires named splat parameters: {*path}
// ============================================================
app.all('/api/{*path}', (req, _res, next) => {
  next(ApiError.notFound(`Cannot ${req.method} ${req.originalUrl}`));
});

// ============================================================
// Global Error Handler (must be last middleware)
// ============================================================
app.use(errorHandler);

// ============================================================
// HTTP Server & Socket.io
// ============================================================
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: config.CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

// ============================================================
// Socket.io Signaling Server (preserved from original)
// ============================================================
// Store meeting rooms state in memory
const rooms = new Map(); // roomId -> { participants: [], messages: [] }

io.on('connection', (socket) => {
  console.log(`[Socket] User connected: ${socket.id}`);

  // Join a room
  socket.on('join-room', (roomId, user) => {
    // If the socket was already in a different room, clean up the old room
    if (socket.roomId && socket.roomId !== roomId) {
      const oldRoomId = socket.roomId;
      socket.leave(oldRoomId);
      const oldRoom = rooms.get(oldRoomId);
      if (oldRoom) {
        const leftUsers = oldRoom.participants.filter(p => p.socketId === socket.id);
        oldRoom.participants = oldRoom.participants.filter(p => p.socketId !== socket.id);
        
        leftUsers.forEach(u => {
          socket.to(oldRoomId).emit('user-left', u.id);
        });

        if (oldRoom.participants.length === 0) {
          rooms.delete(oldRoomId);
          console.log(`[Socket] Room ${oldRoomId} empty and deleted`);
        }
      }
    }

    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, { participants: [], messages: [] });
    }

    const room = rooms.get(roomId);

    // Check if participant already exists in the room
    const existingIndex = room.participants.findIndex((p) => p.id === user.id);
    const isFirstUser = room.participants.length === 0;
    const updatedUser = { 
      ...user, 
      socketId: socket.id,
      isHost: existingIndex >= 0 ? room.participants[existingIndex].isHost : isFirstUser 
    };

    if (existingIndex >= 0) {
      room.participants[existingIndex] = updatedUser;
    } else {
      room.participants.push(updatedUser);
    }

    // Send the current room state back to the newly joined user
    socket.emit('room-state', {
      participants: room.participants,
      messages: room.messages,
    });

    // Notify others in the room
    socket.to(roomId).emit('user-joined', updatedUser);

    // Save user info on socket for disconnect handling
    socket.roomId = roomId;
    socket.user = user;

    console.log(`[Socket] User ${user.name} joined room ${roomId}`);
  });

  // Handle media toggle (mute/video)
  socket.on('toggle-media', (roomId, userId, mediaState) => {
    const room = rooms.get(roomId);
    if (room) {
      const participant = room.participants.find((p) => p.id === userId);
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

  // Handle host forcing media off
  socket.on('force-media', (roomId, targetUserId, action) => {
    const room = rooms.get(roomId);
    if (room) {
      const targetUser = room.participants.find((p) => p.id === targetUserId);
      if (targetUser && targetUser.socketId) {
        const targetSocket = io.sockets.sockets.get(targetUser.socketId);
        if (targetSocket) {
          targetSocket.emit('force-media', action);
        }
      }
    }
  });

  // Handle participant removal (kicked by host)
  socket.on('remove-user', (roomId, targetUserId) => {
    const room = rooms.get(roomId);
    if (room) {
      // Find the socket ID of the target user
      const targetUser = room.participants.find((p) => p.id === targetUserId);
      if (targetUser && targetUser.socketId) {
        room.participants = room.participants.filter(
          (p) => p.id !== targetUserId
        );
        // Tell everyone the user was removed
        io.to(roomId).emit('user-left', targetUserId);

        // Disconnect the target socket
        const targetSocket = io.sockets.sockets.get(targetUser.socketId);
        if (targetSocket) {
          targetSocket.emit('kicked');
          setTimeout(() => {
            targetSocket.disconnect(true);
          }, 500);
        }
      }
    }
  });

  // ── Host: Leave Meeting (meeting continues for others) ──────────────
  // Emits user-left to remaining participants but does NOT end the meeting.
  // Edge case: if the host was the last participant, the room becomes empty
  // and we treat it like End Call (mark ended) to avoid a ghost room.
  socket.on('leave-room', (roomId, userId) => {
    console.log(`[Socket] leave-room: user ${userId} leaving room ${roomId}`);
    const room = rooms.get(roomId);
    if (!room) return;

    // Remove the participant
    room.participants = room.participants.filter((p) => p.id !== userId);

    // Notify remaining participants
    socket.to(roomId).emit('user-left', userId);
    socket.leave(roomId);
    socket.roomId = null;

    if (room.participants.length === 0) {
      // Room is now empty — clean it up
      rooms.delete(roomId);
      console.log(`[Socket] Room ${roomId} empty after host leave — deleted`);
    } else {
      console.log(
        `[Socket] Room ${roomId} continues with ${room.participants.length} participant(s) after host left`
      );
    }
  });

  // ── Host: End Meeting for Everyone ──────────────────────────────────
  // Only the host (validated by isHost flag in room state) may call this.
  // Broadcasts meeting-ended to all sockets then removes them from the room.
  socket.on('end-meeting', (roomId, userId) => {
    console.log(`[Socket] end-meeting requested by ${userId} in room ${roomId}`);
    const room = rooms.get(roomId);
    if (!room) {
      console.warn(`[Socket] end-meeting: room ${roomId} not found`);
      return;
    }

    // Server-side host validation — re-read from room state (not client cache)
    const requestingUser = room.participants.find((p) => p.id === userId);
    if (!requestingUser || !requestingUser.isHost) {
      console.warn(
        `[Socket] end-meeting: user ${userId} is not the host of room ${roomId} — rejected`
      );
      socket.emit('end-meeting-error', { message: 'Only the host can end the meeting.' });
      return;
    }

    // Broadcast meeting-ended to everyone in the room (including the host)
    io.to(roomId).emit('meeting-ended', { meetingId: roomId, endedBy: userId });

    // Force all sockets to leave the Socket.IO room
    io.in(roomId).socketsLeave(roomId);

    // Clean up in-memory room state
    rooms.delete(roomId);
    console.log(`[Socket] Room ${roomId} ended by host ${userId} and deleted`);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`[Socket] User disconnected: ${socket.id}`);

    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      if (room) {
        // Find all users tied to this socket to notify them
        const disconnectedUsers = room.participants.filter(
          (p) => p.socketId === socket.id
        );

        // Remove all from the room
        room.participants = room.participants.filter(
          (p) => p.socketId !== socket.id
        );

        // Notify others — meeting continues even if host disconnected abruptly.
        // Meeting only ends via explicit end-meeting or when room is empty.
        disconnectedUsers.forEach((user) => {
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

  // Handle WebRTC signaling
  socket.on('signal', ({ to, signal }) => {
    io.to(to).emit('signal', { from: socket.id, signal });
  });
});

// ============================================================
// Start Server
// ============================================================
const startServer = async () => {
  try {
    // Connect to MongoDB before accepting requests
    await connectDB();

    server.listen(config.PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════╗
║             IntelliMeet Server Started                   ║
╠══════════════════════════════════════════════════════════╣
║  Environment :  ${config.NODE_ENV.padEnd(39)}║
║  Port        :  ${String(config.PORT).padEnd(39)}║
║  API Health  :  http://localhost:${config.PORT}/api/health${' '.repeat(Math.max(0, 18 - String(config.PORT).length))}║
╚══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (err) {
    console.error('❌  Failed to start server:', err.message);
    process.exit(1);
  }
};

startServer();

// ============================================================
// Unhandled Rejection & Exception Handlers
// ============================================================
process.on('unhandledRejection', (err) => {
  console.error('❌  UNHANDLED REJECTION:', err.message);
  console.error(err.stack);
  // Graceful shutdown — let ongoing requests finish
  server.close(() => {
    process.exit(1);
  });
});

process.on('uncaughtException', (err) => {
  console.error('❌  UNCAUGHT EXCEPTION:', err.message);
  console.error(err.stack);
  process.exit(1);
});
