# IntelliMeet — Real-Time Video Conferencing Platform

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [System Architecture (High-Level)](#3-system-architecture-high-level)
4. [Authentication Flow](#4-authentication-flow)
5. [Database Schema](#5-database-schema)
6. [Meeting Creation & Join Flow (Detailed)](#6-meeting-creation--join-flow-detailed)
7. [Signaling Server & WebRTC Flow (Core)](#7-signaling-server--webrtc-flow-core)
8. [Host Controls & Meeting Lifecycle](#8-host-controls--meeting-lifecycle)
9. [Media Handling (Camera/Mic/Screen Share)](#9-media-handling-cameramicscreen-share)
10. [Folder Structure](#10-folder-structure)
11. [Environment Variables / Setup Instructions](#11-environment-variables--setup-instructions)
12. [Known Limitations & Future Improvements](#12-known-limitations--future-improvements)

---

## 1. Project Overview

**IntelliMeet** is a comprehensive, real-time video conferencing web application (similar to Google Meet) developed as a Final Year Project. It enables seamless remote communication by offering robust high-quality video/audio streaming, dynamic user interaction, and extensive host administrative controls. 

**Target Use Case:** Academic meetings, remote team collaborations, and casual user-to-user communications demanding a lightweight, responsive, and easy-to-use virtual meeting environment.

**Key Features:**
- **User Authentication:** Secure JWT-based registration/login, OTP email verification, and Google OAuth integration.
- **Meeting Management:** Instantly create or schedule meetings with unique shareable links.
- **Real-Time Communication:** High-fidelity video and audio through LiveKit, a Selective Forwarding Unit, so each participant uploads once regardless of how many people are in the call. A legacy peer-to-peer mesh remains as an automatic fallback when LiveKit is not configured.
- **Interactive Capabilities:** In-meeting text chat and dynamic screen sharing.
- **Host Controls:** Robust administrative abilities including muting participants, disabling videos, kicking users, and safely ending the meeting for everyone.

---

## 2. Tech Stack

### Frontend
* **Framework:** React 19 (via Vite)
* **Language:** TypeScript
* **State Management:** Zustand
* **Routing:** React Router DOM v7
* **Styling:** Tailwind CSS v4, Radix UI primitives, Framer Motion (for micro-animations), `clsx` & `tailwind-merge`
* **Real-time Comms:** `socket.io-client` for signaling, native WebRTC API (`RTCPeerConnection`)
* **Media:** `livekit-client` and `@livekit/components-react` (SFU); `socket.io-client` only for the legacy peer-to-peer fallback
* **Third-Party Integrations:** `@react-oauth/google` for authentication

### Backend
* **Runtime:** Node.js
* **Framework:** Express.js 5.x
* **Database:** MongoDB via Mongoose ORM
* **Real-time Comms:** Socket.io v4
* **Security:** Helmet, Express Rate Limit, Custom NoSQL Injection Sanitizer, CORS
* **Authentication:** JWT (`jsonwebtoken`), Bcrypt (`bcryptjs`), Google Auth Library
* **Media:** `livekit-server-sdk` (token minting, room administration, webhook verification)
* **Utilities:** Nodemailer (for OTPs and password-reset links)
* **Testing:** Node's built-in test runner (`node --test`), no extra dependencies

---

## 3. System Architecture (High-Level)

IntelliMeet is a decoupled client-server architecture: a REST API for authentication and meeting records, and **LiveKit** for the media session. The Node API never carries audio or video; it authorises the join and mints a short-lived token, and the browser then connects straight to the LiveKit SFU. The diagram below shows the legacy peer-to-peer fallback, which is used only when LiveKit is not configured. See section 7a for the path that runs by default.

```mermaid
flowchart TD
    subgraph Frontend Client
        UI[React UI]
        WebRTC[WebRTC API\nP2P Media]
        Zustand[Zustand State]
    end

    subgraph Backend Server
        Express[Express REST API]
        Signaling[Socket.io Signaling Server]
    end

    subgraph External Services
        DB[(MongoDB)]
        STUNTURN((STUN / TURN\nServers))
    end

    UI <-->|HTTP/REST| Express
    UI <-->|WebSockets| Signaling
    Express <-->|Mongoose| DB
    WebRTC <..>|SDP / ICE| Signaling
    WebRTC <-->|Media Streams| WebRTC
    WebRTC <-->|Network Traversal| STUNTURN
```

1. **REST Request Flow:** The frontend hits `/api/auth` or `/api/users` to perform CRUD operations on the MongoDB database. 
2. **Real-time Request Flow:** Users connect to the Socket.io signaling server to join abstract "rooms" in memory. 
3. **WebRTC Media Flow:** Once the signaling server negotiates the connection via SDP offers and ICE candidates, media tracks (video/audio) flow directly Peer-to-Peer (P2P), alleviating server bandwidth.

---

## 4. Authentication Flow

Authentication is managed through standard credentials or Google OAuth, protected seamlessly via JSON Web Tokens.

1. **Registration (`/api/auth/register`):** User submits credentials. A `PendingUser` document is created, and an OTP is sent via Nodemailer.
2. **Verification (`/api/auth/verify-otp`):** Upon OTP validation, the user profile is formally written to the database.
3. **Login (`/api/auth/login`):** Validates password via Bcrypt. Generates a signed JWT securely sent to the frontend.
4. **Google OAuth (`/api/auth/google`):** Translates Google's OAuth payload into a persistent local session and returns a JWT.
5. **Protection:** The frontend explicitly attaches the JWT (`Bearer <token>`) using the `api.ts` wrapper. On the backend, protected routes employ `backend/middleware/authMiddleware.js` to cryptographically verify the JWT, rejecting unauthorized or expired tokens.

---

## 5. Database Schema

IntelliMeet enforces data schema at the application level via Mongoose models. **Meetings are persistent** (`Meeting` collection); only live *presence* (who is connected right now, their mute state) is kept in memory in `server.js`, because that is real-time session state, not application data.

### `Meeting` Collection (`backend/models/Meeting.js`)
* **`meetingId`** (String, Unique): Public code in Google Meet style, e.g. `abc-defg-hij`. Generated **server-side** with `crypto.randomBytes` (`backend/utils/meetingId.js`), never by the client.
* **`title`** (String): Shown in the lobby, room header and dashboard.
* **`hostId`** (ObjectId → User): The creator. **The only source of host authority.**
* **`status`** (Enum `CREATED | ACTIVE | ENDED`): `CREATED` on creation, `ACTIVE` when the first participant joins, `ENDED` when the host ends it. Ended meetings refuse joins.
* **`roomName`** (String): Real-time room name (equals `meetingId`; kept explicit for the LiveKit migration).
* **`startedAt`, `endedAt`, `endedReason`**: Lifecycle stamps.
* **`settings.locked`**: Host can lock the meeting so non-hosts cannot join.
* **`bannedUserIds`** (ObjectId[]): Users removed with "block" cannot rejoin.
* **`participants[]`**: Join history (`userId`, `displayName`, `firstJoinedAt`, `lastLeftAt`) for the dashboard. Never used for presence.


### `User` Collection (`backend/models/User.js`)
* **`fullName`** (String): Display name for the dashboard and lobby.
* **`email`** (String, Unique): Primary authentication index.
* **`phoneNumber`** (String): Optional contact information.
* **`googleId`** (String, Sparse Unique): Associates the account with Google OAuth.
* **`authProvider`** (Enum: 'local' | 'google'): Tracks registration origin.
* **`password`** (String, `select: false`): Bcrypt-hashed string.
* **`preferences`** (Sub-document): Maps language options (`spokenLanguage`, `listeningLanguage`).
* **`lastLoginAt`, `passwordChangedAt`**: Lifecycle stamps for JWT invalidation and security.

### `PendingUser` Collection (`backend/models/PendingUser.js`)
Used as a temporary holding zone (with a TTL index) for users who registered but haven't verified their OTP yet. Contains identical basic fields plus `otp` and `otpExpiresAt`.

---

## 6. Meeting Creation & Join Flow (Detailed)

1. **Meeting Creation (`frontend/src/pages/meeting/CreateMeetingPage.tsx` or the dashboard "Start Now" button):**
   - The frontend sends an authenticated `POST /api/meetings` (`backend/routes/meetingRoutes.js` → `controllers/meetingController.js` → `services/meetingService.js`).
   - The backend generates a unique `abc-defg-hij` code, creates the `Meeting` record with the caller as `hostId`, and returns the code plus the invite link `<FRONTEND_URL>/meet/<code>`.
   - The host navigates to the lobby `/meet/:meetingId`.
   
2. **Meeting Validation (Join page and Lobby):**
   - The code the user types (or a pasted invite link) is normalised client-side (`frontend/src/lib/meetingId.ts`), then validated with `GET /api/meetings/:meetingId`.
   - A wrong code returns `404 MEETING_NOT_FOUND` and the UI shows "Meeting not found". **Nothing is ever created for an unknown code.** Ended meetings show "This meeting has ended"; blocked users get `403 PARTICIPANT_BANNED`.
   - Only after a successful lookup does the Lobby (`LobbyPage.tsx`) request camera/mic access and show the real meeting title and host.
   
3. **Join Flow & Initialization:**
   - The lobby calls `joinMeeting()` in the store with the **authenticated user's id** as the participant id and navigates to `/meet/:meetingId/room`.
   - `useMeetingConnection.ts` opens a socket whose handshake carries the JWT. The server (`io.use` in `server.js`) verifies it and derives the participant's identity and name from the database.
   - `join-room` looks the meeting up in MongoDB. Unknown or ended meetings get `join-error` and the client is sent back to the lobby, which explains why. Otherwise the participant is added to the in-memory presence list with `isHost = (Meeting.hostId === user)`, and the meeting flips `CREATED → ACTIVE`.

4. **Status & Error Handling:**
   - Every API error carries a stable `code` (`MEETING_NOT_FOUND`, `MEETING_ENDED`, `NOT_HOST`, `PARTICIPANT_BANNED`, `TOKEN_INVALID`, …) that the frontend maps to copy in `describeApiError()` (`frontend/src/lib/api.ts`).
   - Direct navigation to `/meet/<anything>/room` never joins blindly: the room page redirects to the lobby, which validates first.

---

## 7. Signaling Server & WebRTC Flow (Core Section)

IntelliMeet ships **two media layers**. Which one runs is decided by the backend, not the client.

### 7a. LiveKit (default when configured)

```text
Browser ──HTTPS──▶ POST /api/meetings/:id/token   (JWT; authorises + mints a LiveKit token)
Browser ──WSS───▶ LiveKit SFU                     (one upload per person, N downloads)
Backend ──HTTPS─▶ LiveKit RoomService             (host: remove / mute / delete room)
LiveKit ──HTTPS─▶ POST /api/livekit/webhook       (participant_joined / left, room_finished)
```

The token is the single security gate. `backend/services/livekitService.js` is the only module that reads `LIVEKIT_API_SECRET`; it mints a token that is valid for **10 minutes**, scoped to **one room**, carries `identity = the authenticated user's id` and `metadata = { role }` derived from `Meeting.hostId`, and sets **`roomAdmin: false`** so a leaked token can never kick or mute anyone. Host actions therefore go through our REST API, which re-checks `requireHost` before calling LiveKit.

Because a token is only issued for a meeting that exists in MongoDB and is not ended, locked or banned, **an arbitrary code can never bring a room into being** — LiveKit's own lazy room creation is unreachable without a token.

The client (`frontend/src/hooks/useLiveKitMeeting.ts`) then calls `room.connect(url, token)` and publishes the camera and microphone chosen in the lobby. Reconnection, simulcast, adaptive quality, TURN traversal and duplicate-session replacement are handled by the SDK.

### 7b. Legacy peer-to-peer mesh (fallback)

Used only when the backend reports `LIVEKIT_NOT_CONFIGURED`. A Signaling Server is required to orchestrate raw WebRTC because peers do not inherently know each other's network addresses or codec capabilities. Our Socket.io implementation (`backend/server.js`) routes these initialization packages (SDP Offer/Answer and ICE Candidates) between authenticated members of the same room.

### Socket.io Event Dictionary
| Event | Direction | Payload | Purpose |
|-------|-----------|---------|---------|
| *(handshake)* | Client → Server | `auth: { token }` | JWT verified in `io.use()`. Unauthenticated sockets are rejected with `UNAUTHORIZED`. Identity and display name come from the database, never from the client. |
| `join-room` | Client → Server | `roomId`, `clientUser` | Backend looks the meeting up in MongoDB; unknown/ended/locked/banned → `join-error { code }`. Only cosmetic + media keys of `clientUser` are honoured. |
| `join-error` | Server → Client | `{ code, message }` | Join refused. Client returns to the lobby, which shows the reason. |
| `room-state` | Server → Client | `title`, `startedAt`, `participants[]`, `messages[]` | Sent to the newly joined user. `isHost` in `participants[]` is server-derived from `Meeting.hostId`. Chat history is restored. |
| `user-joined` | Server → Client | `participant` | Broadcast to *other* room members. Frontend creates a new `RTCPeerConnection`. |
| `duplicate-session` | Server → Client | — | The same user joined from another tab; this connection is superseded. |
| `signal` | Bi-directional | `to`, `from`, `signal` | Relays SDP/ICE payloads, only between sockets that are members of the same room. |
| `toggle-media`| Client → Server | `roomId`, `userId`, `mediaState` | Only the sender's own record is updated, and only `isMuted / isVideoOff / isScreenSharing` are accepted. |
| `send-message` | Client → Server | `roomId`, `{ message }` | Sender id/name are stamped server-side; last 100 kept for late joiners. |
| `force-media` | Client → Server | `roomId`, `targetUserId`, `'mute' \| 'video-off'` | **Host only** (checked server-side); non-hosts get `action-error { code: 'NOT_HOST' }`. |
| `remove-user` | Client → Server | `roomId`, `targetUserId`, `{ ban? }` | **Host only.** Target receives `kicked { banned }`; with `ban`, the user is added to `Meeting.bannedUserIds`. |
| `leave-room` | Client → Server | — | Leaves; meeting continues for others. |
| `user-left` | Server → Client | `userId` | Broadcast on leave/disconnect/removal. |
| `end-meeting` | Client → Server | — | **Host only.** Sets `Meeting.status = ENDED` in MongoDB, broadcasts `meeting-ended`, and clears the room. Also available as `POST /api/meetings/:id/end`. |

### Complete Signal Flow (Two-User Mesh Call)
1. **User A (Host)** navigates to Lobby, emits `join-room`. Backend creates Room memory object.
2. **User B (Participant)** emits `join-room`. Backend updates Room and broadcasts `user-joined(User B)` to User A.
3. **User A** receives `user-joined`. The frontend creates a new `RTCPeerConnection`.
4. **User A** adds their local tracks (Mic/Camera) to the connection, generates an **SDP Offer**, and sends it over Socket (`signal` event) directed to User B's socket ID.
5. **User B** receives the `signal` containing the Offer. They create their own `RTCPeerConnection`, set the Remote Description to the Offer, add their local tracks, generate an **SDP Answer**, and send it back via `signal`.
6. **User A** receives the Answer and sets it as the Remote Description.
7. Concurrently, both peers generate **ICE Candidates** (network routing details via STUN) and exchange them over the `signal` event, adding them to the connection upon receipt.
8. A direct Peer-to-Peer tunnel is established. The `ontrack` listener fires on both ends, attaching the incoming `MediaStream` directly to a `<video>` HTML element.

---

## 8. Host Controls & Meeting Lifecycle

The server enforces Host permissions to ensure security and order during meetings.

- **Host Determination:** The host is the meeting's creator, stored as `Meeting.hostId`. On every `join-room` the server sets `isHost = (Meeting.hostId === authenticated user)`. Join order is irrelevant, and a client cannot claim the role.
- **Administrative Actions** (all verified server-side against the in-memory participant record, which was itself derived from the database; non-hosts receive `NOT_HOST`):
  - **`force-media`:** The host can turn off a participant's microphone or camera. The server relays this to the target socket, which alters its local media state.
  - **`remove-user`:** Kicking a user disconnects their socket and broadcasts `user-left`. With the "prevent rejoining" option, the user is added to `Meeting.bannedUserIds` and both the API lookup and the socket join refuse them with `PARTICIPANT_BANNED`.
- **Leave vs. End Call:**
  - **"Leave Call":** Anyone (host included) exits gracefully. The server emits `user-left` and the meeting stays `ACTIVE` for the remaining participants; the host keeps the role and can rejoin with full controls. If the host is the last person in the room, leaving ends the meeting so no ghost room is left behind.
  - **"End Call for Everyone":** Host only. Emits `end-meeting` (or calls `POST /api/meetings/:id/end`). The server verifies the host, sets `Meeting.status = ENDED` in MongoDB, broadcasts `meeting-ended` to all sockets, tears down the in-memory room, and every client redirects to `/meeting/ended`. Further joins are refused with `MEETING_ENDED`.

---

## 9. Media Handling (Camera/Mic/Screen Share)

- **Local Tracks:** Instantiated utilizing `navigator.mediaDevices.getUserMedia({ video: true, audio: true })`. These streams are placed in a React `useRef` and bound to local video elements.
- **Screen Sharing:** Utilizes `navigator.mediaDevices.getDisplayMedia({ video: true })`.
- **Track Swapping:** When toggling screen share on/off, instead of rebuilding the entire P2P connection, the system finds the specific video `RTCRtpSender` on the existing `RTCPeerConnection` and dynamically calls `.replaceTrack(newTrack)`. This ensures seamless layout transitions without dropping the call.

---

## 10. Folder Structure

```text
IntelliMeet/
├── backend/
│   ├── config/       # Environment setup, DB connection (mongoose)
│   ├── controllers/  # API route logic (authController.js, meetingController.js)
│   ├── middleware/   # JWT (protect), meeting guards (loadMeeting, requireHost), rate limiters, error handler
│   ├── models/       # Mongoose schemas (User, PendingUser, Meeting)
│   ├── routes/       # Express Router definitions (auth, users, meetings)
│   ├── services/     # Business logic (meetingService.js) and livekitService.js — the only file holding the API secret
│   ├── utils/        # ApiError (with codes), meetingId generator, JWT, NodeMailer templates
│   ├── validators/   # express-validator chains
│   └── server.js     # Entry point, Express setup, and authenticated Socket.io signaling
└── frontend/
    ├── src/
    │   ├── assets/     # Static images and icons
    │   ├── components/ # Reusable UI pieces (Buttons, Inputs, Radix UI wrappers)
    │   ├── hooks/      # Custom React hooks (useMeetingConnection)
    │   ├── layouts/    # Wrapping layouts (Navbar, Sidebar)
    │   ├── lib/        # API client (api.ts), livekit.ts, socket.ts (legacy mesh), meetingId.ts
    │   ├── pages/      # Route-based views (CreateMeetingPage, LobbyPage, LiveKitMeetingRoom, MeshMeetingRoom)
    │   └── store/      # Zustand global state (Auth, Meeting, Toasts)
    ├── index.css       # Tailwind entry point
    └── package.json    # Vite and dependency configuration
```

---

## 11. Environment Variables / Setup Instructions

### Environment Variables

**Backend (`backend/.env`)**
```env
NODE_ENV=development
PORT=3001
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=12
CORS_ORIGIN=http://localhost:5173
FRONTEND_URL=http://localhost:5173   # used for links in emails and meeting invitations
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
GOOGLE_CLIENT_ID=your_google_oauth_client_id

# ---------- LiveKit (media server) ----------
# Optional: without these the app falls back to the legacy peer-to-peer mesh.
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxxxxxxx
LIVEKIT_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx   # backend only — NEVER expose to the frontend
```
A ready-to-copy template lives at `backend/.env.example`. `MONGODB_URI`, `JWT_SECRET` and `GOOGLE_CLIENT_ID` are required; the server refuses to start without them.

**Enabling LiveKit.** Create a project at [LiveKit Cloud](https://cloud.livekit.io) (free tier is enough for an FYP) or run `livekit-server --dev` locally, then set the three variables above and restart the backend. `GET /api/health` reports `"media": "livekit"` once it is active, and the meeting room switches over automatically — there is no frontend configuration, because the client receives the server URL inside its token response. To receive lifecycle events, point a LiveKit webhook at `https://<your-backend>/api/livekit/webhook`.

**Frontend (`frontend/.env`)** (template: `frontend/.env.example`)
```env
VITE_API_URL=http://localhost:3001/api
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

### Running the Tests

```bash
cd backend && npm test
```

99 tests across 7 files, built on Node's built-in runner with **no extra dependencies to install**. They mount the real Express app on an ephemeral port, so the whole middleware chain (auth, validators, rate limits, error handler) is exercised. LiveKit is stubbed, so the suite runs offline and uses none of your project quota. Fixtures use `@test.invalid` emails and are removed afterwards, so it is safe against your development database.

### Troubleshooting

**"Could not allocate a meeting id" when creating a second meeting.** Your `meetings` collection has stale indexes from an earlier version of the schema. The fatal one is a non-sparse unique index on `meeting_id`, a field the current schema does not use, which limits the entire collection to a single document. Mongoose adds indexes automatically but never removes obsolete ones. Fix it once with:

```bash
node scripts/fix-meeting-indexes.js
```

**Camera or microphone does not turn on.** Browsers only grant device access on a secure origin. `localhost` counts as secure, so a single machine is fine. Opening the app from another device at `http://192.168.x.x:5173` will not work regardless of your LiveKit setup, because the restriction applies to your frontend's origin. Serve the frontend over HTTPS (a tunnel such as `cloudflared`, or a deployment) for multi-device testing.

**`media` reports `mesh` instead of `livekit`.** One of `LIVEKIT_URL`, `LIVEKIT_API_KEY` or `LIVEKIT_API_SECRET` is missing or misspelled in `backend/.env`. Note that `npm run dev` uses `node --watch`, which does not restart on `.env` changes, so stop it and start it again.

### Local Setup Instructions

1. **Clone and Install:**
   ```bash
   git clone https://github.com/your-username/IntelliMeet.git
   cd IntelliMeet
   ```
2. **Start the Backend:**
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   *The backend will boot up on `localhost:3001` and connect to MongoDB.*
3. **Start the Frontend:**
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```
   *The frontend will be accessible at `http://localhost:5173`.*

---

## 12. Known Limitations & Future Improvements

- **Two media layers ship side by side.** With LiveKit configured, media flows through an SFU with built-in TURN, simulcast, automatic reconnection and server-enforced mute/removal. Without it, the app falls back to the original peer-to-peer mesh (`MeshMeetingRoom.tsx` + Socket.IO signalling), which relies on a public STUN server only, scales poorly past ~4 participants, and may fail entirely behind symmetric NAT or strict campus firewalls. Once LiveKit is verified in your environment, delete `MeshMeetingRoom.tsx`, `hooks/useMeetingConnection.ts`, `lib/socket.ts` and the Socket.IO block in `server.js`.
- **Host mute on the mesh is advisory:** `force-media` asks the target's client to mute itself. On LiveKit the same host action is a server-enforced track mute the client cannot ignore.
- **Presence is single-instance:** live participant lists (mesh) live in process memory, so that path runs as one backend instance. Meetings themselves are persistent and survive restarts, and LiveKit keeps its own presence.
- **Chat is session-scoped:** messages travel over LiveKit data messages (or Socket.IO on the mesh) and are not stored in MongoDB, so late joiners do not see earlier messages. This matches Google Meet.
- **Not yet built:** waiting-room admission, co-host, and recording. See `docs/CORE_MEETING_GAP_ANALYSIS.md`. (Lobby device pickers, mid-call device switching and the Rejoin flow are implemented.)
