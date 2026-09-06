/**
 * ============================================================
 * IntelliMeet — Server Entry Point
 * ============================================================
 * Owns the runtime concerns that `app.js` deliberately leaves out:
 *  - MongoDB connection (with retry logic)
 *  - HTTP listener
 *  - Socket.io signaling server (legacy mesh; used only when LiveKit
 *    is not configured)
 *  - Graceful shutdown
 *
 * The Express app itself, including the whole middleware chain and all
 * routes, lives in `app.js` so tests can mount it without a listener.
 * ============================================================
 */

// ---- Load environment variables FIRST (before any other import) ----
const config = require('./config/environment');

const http = require('http');
const { Server } = require('socket.io');

const app = require('./app');
const connectDB = require('./config/db');
const { verifyToken } = require('./utils/jwt');
const User = require('./models/User');
const meetingService = require('./services/meetingService');
const { normalizeMeetingId } = require('./utils/meetingId');

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
// Socket.io Signaling Server (interim — replaced by LiveKit later)
// ============================================================
// Security model:
//  - Every socket must present a valid JWT in the handshake. The user's
//    id and name come from the database, never from the client.
//  - A room exists only for a meeting that exists in MongoDB and is not
//    ENDED. Unknown ids are refused; nothing is created on demand.
//  - Host = Meeting.hostId. Host-only actions are checked server-side.
//  - Clients may only change their own media flags, and only a
//    whitelisted set of keys.
// ============================================================

/** In-memory presence: roomId -> { participants: [], messages: [] } */
const rooms = new Map();

/** Media flags a client is allowed to broadcast about itself */
const MEDIA_KEYS = ['isMuted', 'isVideoOff', 'isScreenSharing'];
/** Cosmetic fields a client may supply on join */
const JOIN_KEYS = ['initials', 'avatarColor', 'language', 'flag', ...MEDIA_KEYS];

const pick = (obj, keys) => {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
};

const emitError = (socket, code, message) => socket.emit('join-error', { code, message });

/** Authenticate the socket handshake with the same JWT the REST API uses */
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next(new Error('UNAUTHORIZED'));
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id);
    if (!user) return next(new Error('UNAUTHORIZED'));
    if (user.passwordChangedAfter(decoded.iat)) return next(new Error('UNAUTHORIZED'));
    socket.user = { id: String(user._id), name: user.fullName, doc: user };
    next();
  } catch (err) {
    next(new Error('UNAUTHORIZED'));
  }
});

/** Find the participant record for this socket in its current room */
const selfInRoom = (socket) => {
  const room = socket.roomId ? rooms.get(socket.roomId) : null;
  if (!room) return { room: null, me: null };
  const me = room.participants.find((p) => p.socketId === socket.id) || null;
  return { room, me };
};

/** Remove this socket's participant from its room and notify others */
const leaveCurrentRoom = (socket, { notify = true } = {}) => {
  const roomId = socket.roomId;
  if (!roomId) return;
  const room = rooms.get(roomId);
  socket.leave(roomId);
  socket.roomId = null;
  if (!room) return;

  const leaving = room.participants.filter((p) => p.socketId === socket.id);
  room.participants = room.participants.filter((p) => p.socketId !== socket.id);

  if (notify) {
    leaving.forEach((p) => socket.to(roomId).emit('user-left', p.id));
  }

  // Record the leave in history (best effort, non-blocking)
  if (leaving.length) {
    meetingService
      .findByMeetingId(roomId)
      .then((m) => m && meetingService.recordLeave(m, socket.user.id))
      .catch(() => {});
  }

  if (room.participants.length === 0) {
    rooms.delete(roomId);
    console.log(`[Socket] Room ${roomId} empty and deleted`);
  }
};

/** End a room for everyone (used by both the socket event and the REST endpoint) */
const endRoom = (roomId, endedBy) => {
  io.to(roomId).emit('meeting-ended', { meetingId: roomId, endedBy });
  io.in(roomId).socketsLeave(roomId);
  // Clear roomId on the affected sockets so their later disconnect is a no-op
  for (const [, s] of io.sockets.sockets) {
    if (s.roomId === roomId) s.roomId = null;
  }
  rooms.delete(roomId);
  console.log(`[Socket] Room ${roomId} ended by ${endedBy} and deleted`);
};

/** Disconnect one participant from the legacy mesh (host action via REST). */
const removeParticipantFromRoom = (roomId, userId, banned = false) => {
  const room = rooms.get(roomId);
  if (!room) return;
  const target = room.participants.find((p) => p.id === userId);
  if (!target) return;

  room.participants = room.participants.filter((p) => p.id !== userId);
  io.to(roomId).emit('user-left', userId);

  const targetSocket = io.sockets.sockets.get(target.socketId);
  if (targetSocket) {
    targetSocket.emit('kicked', { banned });
    targetSocket.roomId = null;
    targetSocket.leave(roomId);
    setTimeout(() => targetSocket.disconnect(true), 500);
  }
};

/** Ask one participant's client to mute itself (legacy mesh host action). */
const forceMediaInRoom = (roomId, userId, action) => {
  const room = rooms.get(roomId);
  if (!room) return;
  const target = room.participants.find((p) => p.id === userId);
  if (!target || !target.socketId) return;
  const targetSocket = io.sockets.sockets.get(target.socketId);
  if (targetSocket) targetSocket.emit('force-media', action);
};

// Expose to the REST layer so host actions work regardless of which media
// layer is running (LiveKit when configured, legacy mesh otherwise).
app.set('realtime', {
  endRoom,
  removeParticipant: removeParticipantFromRoom,
  forceMedia: forceMediaInRoom,
});

io.on('connection', (socket) => {
  console.log(`[Socket] User connected: ${socket.id} (${socket.user.name})`);

  /**
   * Register a listener that cannot take the process down.
   *
   * Socket.IO dispatches listeners inside a process.nextTick with no try/catch
   * of its own, so ANY synchronous throw (or rejected promise) in a handler
   * escapes to process.on('uncaughtException') and exits the server. Client
   * payloads are untrusted, so every handler is wrapped here rather than
   * relying on each one to validate perfectly.
   */
  const on = (event, handler) => {
    socket.on(event, async (...args) => {
      try {
        await handler(...args);
      } catch (err) {
        console.error(`[Socket] '${event}' handler failed:`, (err && err.message) || err);
      }
    });
  };

  // ── Join a room ──────────────────────────────────────────────────────
  // Payload from client: (roomId, clientUser). Only cosmetic + media keys
  // are honoured from clientUser; identity and host status are server-side.
  on('join-room', async (rawRoomId, clientUser) => {
    try {
      const roomId = normalizeMeetingId(rawRoomId);
      if (!roomId) {
        return emitError(socket, 'INVALID_MEETING_ID', "That doesn't look like a meeting code.");
      }

      const meeting = await meetingService.findByMeetingId(roomId);
      if (!meeting) {
        return emitError(socket, 'MEETING_NOT_FOUND', 'Meeting not found. Check the code and try again.');
      }
      try {
        meetingService.assertJoinable(meeting, socket.user.doc);
      } catch (err) {
        return emitError(socket, err.code || 'FORBIDDEN', err.message);
      }

      // If the socket was already in a different room, clean up the old room
      if (socket.roomId && socket.roomId !== roomId) {
        leaveCurrentRoom(socket);
      }

      socket.join(roomId);
      socket.roomId = roomId;

      if (!rooms.has(roomId)) {
        rooms.set(roomId, { participants: [], messages: [] });
      }
      const room = rooms.get(roomId);

      const isHost = meeting.isHostUser(socket.user.id);
      const participant = {
        ...pick(clientUser, JOIN_KEYS),
        id: socket.user.id,
        name: socket.user.name,
        socketId: socket.id,
        isHost,
        joinedAt: Date.now(),
      };

      // Same user joining again (refresh / second tab) replaces their entry
      const existingIndex = room.participants.findIndex((p) => p.id === socket.user.id);
      if (existingIndex >= 0) {
        const previous = room.participants[existingIndex];
        room.participants[existingIndex] = participant;
        // Tell the previous connection it has been superseded
        if (previous.socketId !== socket.id) {
          const prevSocket = io.sockets.sockets.get(previous.socketId);
          if (prevSocket) {
            prevSocket.emit('duplicate-session');
            prevSocket.roomId = null;
            prevSocket.leave(roomId);
          }
        }
      } else {
        room.participants.push(participant);
      }

      // Persist history + CREATED → ACTIVE (best effort)
      meetingService.recordJoin(meeting, socket.user.doc).catch((err) => {
        console.warn('[Socket] recordJoin failed:', err.message);
      });

      // Send the current room state back to the newly joined user
      socket.emit('room-state', {
        meetingId: roomId,
        title: meeting.title,
        startedAt: meeting.startedAt ? meeting.startedAt.getTime() : Date.now(),
        participants: room.participants,
        messages: room.messages,
      });

      // Notify others in the room
      socket.to(roomId).emit('user-joined', participant);

      console.log(`[Socket] ${socket.user.name} joined room ${roomId}${isHost ? ' as host' : ''}`);
    } catch (err) {
      console.error('[Socket] join-room failed:', err);
      emitError(socket, 'INTERNAL_ERROR', 'Could not join the meeting. Please try again.');
    }
  });

  // ── Media toggle (own flags only, whitelisted keys only) ─────────────
  on('toggle-media', (_roomId, _userId, mediaState) => {
    const { room, me } = selfInRoom(socket);
    if (!room || !me) return;
    const safe = pick(mediaState, MEDIA_KEYS);
    Object.assign(me, safe);
    socket.to(socket.roomId).emit('media-toggled', me.id, safe);
  });

  // ── Chat (sender identity is server-side) ────────────────────────────
  on('send-message', (_roomId, message) => {
    const { room, me } = selfInRoom(socket);
    if (!room || !me) return;
    const text = message && typeof message.message === 'string' ? message.message.slice(0, 2000) : '';
    if (!text.trim()) return;
    const safeMessage = {
      senderId: me.id,
      senderName: me.name,
      senderInitials: me.initials || me.name.substring(0, 2).toUpperCase(),
      message: text,
      timestamp: typeof message.timestamp === 'string' ? message.timestamp : new Date().toISOString(),
    };
    room.messages.push(safeMessage);
    if (room.messages.length > 100) room.messages.shift();
    socket.to(socket.roomId).emit('chat-message', safeMessage);
  });

  // ── Host: force a participant's mic/camera off ───────────────────────
  on('force-media', (_roomId, targetUserId, action) => {
    const { room, me } = selfInRoom(socket);
    if (!room || !me) return;
    if (!me.isHost) return socket.emit('action-error', { code: 'NOT_HOST', message: 'Only the host can do that.' });
    if (!['mute', 'video-off'].includes(action)) return;
    const target = room.participants.find((p) => p.id === targetUserId);
    if (!target || !target.socketId) return;
    const targetSocket = io.sockets.sockets.get(target.socketId);
    if (targetSocket) targetSocket.emit('force-media', action);
  });

  // ── Host: remove a participant (optionally block re-entry) ───────────
  on('remove-user', async (_roomId, targetUserId, options) => {
    const { room, me } = selfInRoom(socket);
    if (!room || !me) return;
    if (!me.isHost) return socket.emit('action-error', { code: 'NOT_HOST', message: 'Only the host can do that.' });
    if (targetUserId === me.id) return;

    const target = room.participants.find((p) => p.id === targetUserId);
    if (!target) return;

    room.participants = room.participants.filter((p) => p.id !== targetUserId);
    io.to(socket.roomId).emit('user-left', targetUserId);

    if (options && options.ban === true) {
      try {
        const meeting = await meetingService.findByMeetingId(socket.roomId);
        if (meeting) await meetingService.banUser(meeting, targetUserId);
      } catch (err) {
        console.warn('[Socket] ban failed:', err.message);
      }
    }

    const targetSocket = io.sockets.sockets.get(target.socketId);
    if (targetSocket) {
      targetSocket.emit('kicked', { banned: !!(options && options.ban) });
      targetSocket.roomId = null;
      targetSocket.leave(socket.roomId);
      setTimeout(() => targetSocket.disconnect(true), 500);
    }
  });

  // ── Leave (meeting continues for others) ─────────────────────────────
  on('leave-room', () => {
    console.log(`[Socket] leave-room: ${socket.user.name} leaving ${socket.roomId}`);
    leaveCurrentRoom(socket);
  });

  // ── Host: end meeting for everyone ───────────────────────────────────
  on('end-meeting', async () => {
    const { room, me } = selfInRoom(socket);
    if (!room || !me) return;
    if (!me.isHost) {
      return socket.emit('end-meeting-error', { code: 'NOT_HOST', message: 'Only the host can end the meeting.' });
    }
    const roomId = socket.roomId;
    try {
      const meeting = await meetingService.findByMeetingId(roomId);
      if (meeting) await meetingService.endMeeting(meeting, 'HOST_ENDED');
    } catch (err) {
      console.error('[Socket] end-meeting persist failed:', err.message);
    }
    endRoom(roomId, me.id);
  });

  // ── Disconnect ───────────────────────────────────────────────────────
  on('disconnect', () => {
    console.log(`[Socket] User disconnected: ${socket.id}`);
    leaveCurrentRoom(socket);
  });

  // ── WebRTC signaling relay (only between members of the same room) ───
  //
  // The payload is validated rather than destructured in the parameter list.
  // Destructuring there threw on a null or absent payload BEFORE any guard in
  // the body could run, and Socket.IO has no try/catch around listener
  // dispatch, so the TypeError reached process.on('uncaughtException') and
  // killed the whole server. One malformed event from any logged-in account
  // took the API and every live meeting down with it.
  on('signal', (payload) => {
    const to = payload && payload.to;
    const signal = payload && payload.signal;
    if (typeof to !== 'string' || !signal) return;

    const { room } = selfInRoom(socket);
    if (!room) return;
    const targetIsMember = room.participants.some((p) => p.socketId === to);
    if (!targetIsMember) return;
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
