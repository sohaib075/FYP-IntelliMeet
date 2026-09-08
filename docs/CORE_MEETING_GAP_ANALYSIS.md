# IntelliMeet Core Meeting Dossier

Code-traced comparison of IntelliMeet's meeting system against Google Meet-style behaviour, with a LiveKit migration architecture, API and schema design, security findings by severity, a phased roadmap, and a test plan.

- Source read: all 77 project files in full (5 September 2026)
- Stack: React 19 · Vite 8 · TypeScript 6 · Zustand 5 · Express 5 · Mongoose 8 · Socket.IO 4 · raw WebRTC
- Verified by: `tsc`, runtime probes against the real code, grep sweep for hidden/duplicate implementations
- AI translation features (STT, translation, TTS, summaries, transcription) are deliberately **out of scope** for this document.
- A styled HTML version of this document is at `docs/CORE_MEETING_GAP_ANALYSIS.html`.

Findings marked **[verified]** were reproduced by running code, not only by reading it.

---

## Table of contents

1. Executive summary
2. Current IntelliMeet architecture
3. Current meeting flows, traced
4. Google Meet-like expected architecture
5. Comprehensive feature comparison
6. Critical problems
7. The meeting ID problem
8. Meeting ID solution
9. LiveKit migration analysis
10. Authentication analysis
11. Create meeting analysis
12. Join meeting analysis
13. Audio and video analysis
14. Screen sharing analysis
15. Host controls analysis
16. Participant management
17. Database recommendations
18. API recommendations
19. Security review
20. Error handling
21. File-by-file modification plan
22. LiveKit integration architecture
23. Target architecture diagram
24. Migration roadmap
25. Test plan
26. Final checklist and decisions

---

## 1. Executive summary

**Verdict.** IntelliMeet has a solid authentication and user service, and a working two-to-four-person mesh WebRTC call. It does not yet have a meeting system. There is no Meeting model, no meeting API, and no server-side concept of a meeting existing before someone joins. Any string typed into the URL becomes a live room, hosting is awarded to whoever connects first, and the signaling server accepts every command from every socket without checking who sent it.

The core recommendation is to **replace the custom peer-to-peer media layer with LiveKit** and to put a real Meeting record, server-generated IDs, and a token-issuing endpoint in front of it. That single change resolves NAT traversal, reconnection, host mute and removal, scaling past four participants, and most of the WebRTC bugs found in the room page, while shrinking the frontend meeting code by roughly two thirds.

**What is genuinely good**

- Express layering: Helmet, CORS, rate limits, validators, error envelope, graceful shutdown.
- Registration with hashed OTP, verified email, Google sign-in, hashed reset tokens, JWT invalidation on password change.
- Frontend auth pages call real endpoints with sensible validation and error mapping.
- Perfect-negotiation structure and track replacement for screen share show real WebRTC understanding.

**What blocks a credible demo**

- Meetings are not created anywhere. Rooms materialise on first socket join.
- No socket authentication. No host check on kick or force-mute. Host is stealable.
- STUN only, no TURN, no ICE queue. Calls fail on real campus networks.
- Production build fails with 8 TypeScript errors. No tests exist.
- Dashboard, scheduling, join validation, and settings are facades over localStorage.

---

## 2. Current IntelliMeet architecture

Two-package monolith: `IntelliMeet/backend` (CommonJS, Express 5) and `IntelliMeet/frontend` (Vite, React 19, TypeScript). No shared types package, no test directory, no lint configuration. A grep sweep for `livekit`, `AccessToken`, `RoomServiceClient`, `mediasoup` and `turn:` returns only two README sentences. There is exactly one WebRTC implementation and one socket client. No duplicate or abandoned meeting implementations exist.

### Frontend

| Area | Detail |
|---|---|
| Framework | React 19.2, Vite 8, TypeScript 6 with `strict` **off**, Tailwind 4, react-router 7, Zustand 5, Framer Motion, lucide icons |
| Routing | `src/App.tsx:40-84`. Public pages under `PublicLayout`; dashboard pages under `DashboardLayout` behind `ProtectedRoute`; meeting pages `/meeting/lobby/:meetingId` and `/meeting/room/:meetingId` protected but layout-less; `/meeting/ended` public |
| Auth pages | `src/pages/public/` Login, Register, VerifyEmail, ForgotPassword, ResetPassword. All call real endpoints |
| Meeting pages | `src/pages/meeting/` CreateMeetingPage (client-side ID, localStorage), JoinMeetingPage (length check only), LobbyPage (preview, fake connect delay), MeetingRoomPage (1268 lines: WebRTC, media, chat, participants, modals, layout), MeetingEndedPage, MeetingSummaryPage (static, AI, out of scope) |
| State | `src/store/useAuthStore.ts` persisted to localStorage key `intellimeet-auth-storage` including the JWT. `src/store/useMeetingStore.ts` in-memory only: participants, messages, local media flags, timer, dead `signalingLog`. `src/store/useToastStore.ts` |
| API client | `src/lib/api.ts`. Fetch wrapper, Bearer token from localStorage, base URL `VITE_API_URL` falling back to `http://localhost:3001/api`. Exposes `authApi` and `userApi`. **No `meetingApi`** |
| Sockets | `src/lib/socket.ts:21-28` singleton socket.io-client, `autoConnect:false`, **no auth payload**. `src/hooks/useMeetingConnection.ts` registers ten listeners and emits `join-room` on connect |
| WebRTC | Entirely inside one effect in `src/pages/meeting/MeetingRoomPage.tsx:102-276`. One `RTCPeerConnection` per remote participant in `peersRef`, STUN only, perfect-negotiation with monkey-patched flags, sender reconciliation loop |
| Media | `getUserMedia` three-tier fallback duplicated in `LobbyPage.tsx:30-60` and `MeetingRoomPage.tsx:321-357`. `getDisplayMedia` in `MeetingRoomPage.tsx:395-421` |

### Backend

| Area | Detail |
|---|---|
| Entry | `backend/server.js`. Express app, Helmet, general limiter on `/api`, CORS, 10 kB body limit, NoSQL key sanitizer, two routers, 404, error handler. Then an HTTP server with Socket.IO and the whole signaling implementation inline at lines 125-350 |
| Auth | `routes/authRoutes.js` → `controllers/authController.js`: register, login, verify-otp, resend-otp, forgot-password, reset-password, google. `middleware/authMiddleware.js` `protect()` verifies JWT and loads user fresh. `utils/jwt.js` signs `{ id }` |
| Users API | `routes/userRoutes.js`: profile get/put/delete, preferences patch, password put. All behind `protect` |
| Meeting API | **None.** No meeting routes, controller, service, or validator exists |
| Room logic | In-memory `rooms` Map at `server.js:125`. Created implicitly inside `join-room` at `server.js:154-156`. Deleted when empty or on `end-meeting` |
| Room validation | None. Any `roomId` string is accepted |
| Database | `config/db.js` Mongoose with 5 retries and SIGINT/SIGTERM shutdown. `config/environment.js` validates only `MONGODB_URI` and `JWT_SECRET` |
| Middleware | Helmet, `generalLimiter` and `authLimiter` (`middleware/rateLimiter.js`), `sanitize`, `protect`, `errorHandler`, express-validator chains in `validators/` |
| Email | `utils/email.js` Nodemailer SMTP, OTP and reset templates. Throws if SMTP is not configured |

### Database models that actually exist

| Model | File | Purpose | Notes |
|---|---|---|---|
| User | `models/User.js` | Accounts: name, email, phone, googleId, provider, hashed password, preferences, reset token, timestamps | `preferences` declared as a `Map` while a proper sub-schema sits unused above it. Dot-assignment in the controllers is a silent no-op. **[verified]** |
| PendingUser | `models/PendingUser.js` | Unverified sign-ups with hashed password and hashed OTP, TTL 10 minutes | Sound design |

No Meeting, Participant, Session, Room, or Message model exists. Meetings, participants, and chat live only in the process-memory `rooms` Map and vanish on restart.

---

## 3. Current meeting flows, traced

### Create meeting

```
DashboardPage.tsx:28-31 handleStartInstant()   or   CreateMeetingPage.tsx:38-70 handleCreate()
  ↓
generate id client-side: `im-${Math.random().toString(36).substring(2,6)}-${...}`   (CreateMeetingPage.tsx:42)
  ↓
setTimeout 1000 ms   // fake network latency
  ↓
localStorage["intellimeet_scheduled_meetings"] ← { id, title, duration:"1h", participants:1, host:"You" }   (:53-63)
  ↓
BREAK: no HTTP request. No POST /api/meetings exists. No Meeting record. Backend has never heard of this ID.
  ↓
navigate(`/meeting/lobby/${id}`)
```

### Join meeting by code

```
JoinMeetingPage.tsx:29-41 handleJoin()
  ↓
if (parsedId.length < 4) error   // "just length for testing flexibility"
  ↓
setTimeout 1500 ms with button text "Verifying meeting..."
  ↓
BREAK: nothing is verified. No GET request. Any 4+ character string passes.
  ↓
navigate(`/meeting/lobby/${parsedId}`)
  ↓
LobbyPage.tsx:91-101 handleJoin() → useMeetingStore.joinMeeting({ meetingId, title:'CPEC Quarterly Review', ... })   // title hard-coded
  ↓
setTimeout 1500 ms → navigate(`/meeting/room/${meetingId}`)
  ↓
MeetingRoomPage.tsx:303-316 mount effect: if store.status === 'idle' → joinMeeting(meetingId || 'direct-join')   // direct URL entry also works
  ↓
useMeetingConnection.ts:19-23 onConnect → socket.emit('join-room', meetingId, localUser)
   // localUser.id = `${Date.now()}-${counter}` generated in useMeetingStore.ts:114-115
  ↓
server.js:131-189 'join-room' handler
    if (!rooms.has(roomId)) rooms.set(roomId, {...})        ← ROOM CREATED ON DEMAND (server.js:154-156)
    isHost = existingIndex >= 0 ? previous.isHost : room.participants.length === 0   ← FIRST SOCKET BECOMES HOST (server.js:162-166)
  ↓
socket.emit('room-state', { participants, messages }) → useMeetingConnection.ts:25-43 onRoomState   // messages discarded
socket.to(roomId).emit('user-joined', updatedUser) → MeetingRoomPage.tsx:262-269 creates RTCPeerConnection per participant
```

### Leave meeting

```
MeetingRoomPage.tsx:450-470 handleLeaveCall()
    if no other participants → handleEndCallForEveryone(true)
       ← TS2554: function takes 0 args. A non-host last participant emits end-meeting and is rejected silently
  ↓
socket.emit('leave-room', meetingId, localUserId)   (:463)
  ↓
server.js:258-280 removes participant by userId   ← no check that the socket owns that userId; anyone can remove anyone
  ↓
stopAllLocalMedia() (:436-447) → leaveMeeting() resets store to status:'idle' → navigate('/dashboard')
RACE: before unmount, the mount effect at :303-316 sees status 'idle' and re-joins a phantom room; its 800 ms timer is never cleared
```

### End meeting for everyone

```
MeetingRoomPage.tsx:472-480 handleEndCallForEveryone() → socket.emit('end-meeting', meetingId, localUserId)
  ↓
server.js:285-312 finds participant by userId, checks isHost   // the ONLY host-validated action
    io.to(roomId).emit('meeting-ended') → socketsLeave → rooms.delete(roomId)
  ↓
useMeetingConnection.ts:86-93 onMeetingEnded → leaveMeeting() → window.location.replace('/meeting/ended')
   // peers not closed; the full reload does the cleanup
```

### Remove participant and force mute

```
MeetingRoomPage.tsx:503-519 handleRemoveParticipant() → socket.emit('remove-user', meetingId, targetId)   // button hidden unless localUser.isHost (client-side only)
MeetingRoomPage.tsx:499     handleForceMedia()        → socket.emit('force-media', meetingId, targetId, 'mute'|'video-off')
  ↓
server.js:230-252 'remove-user'  ← no isHost check. Emits 'kicked', disconnects target after 500 ms
server.js:216-227 'force-media'  ← no isHost check. Relays the action to the target socket
  ↓
useMeetingConnection.ts:71-78 onForceMedia → toggleMic()/toggleVideo()   // honoured client-side; nothing stops re-enabling
```

### Mute, camera, screen share (local)

```
useMeetingStore.ts:296-315 toggleMic()      → set localIsMuted → socket.emit('toggle-media', meetingId, localUserId, { isMuted })
useMeetingStore.ts:317-335 toggleVideo()    → emit { isVideoOff }
useMeetingStore.ts:337-357 toggleScreenShare() → emit { isScreenSharing }
  ↓
server.js:192-201 'toggle-media' → Object.assign(participant, mediaState)   ← merges ANY keys, including isHost and socketId
  ↓
MeetingRoomPage.tsx:213-259 sender reconciliation on every effect re-run: replaceTrack(currentVideoTrack | null), replaceTrack(currentAudioTrack | null)
MeetingRoomPage.tsx:395-421 handleScreenShareToggle() → getDisplayMedia({ video:true, audio:false }) → setScreenStream → effect swaps the single video sender
```

---

## 4. Google Meet-like expected architecture

Behavioural baseline, not a reconstruction of Google's internals. Tiers: MongoDB for durable application state, Node API for security and business rules, LiveKit for live media and session state.

| Concern | Expected behaviour | Backend | Frontend | Real-time (LiveKit) | Database |
|---|---|---|---|---|---|
| Identity | You are who you signed in as | Verify JWT on every meeting call; never trust userId in a body | Send Bearer token | Identity = verified user id in token | User |
| Create meeting | One click yields a unique code and link that exists immediately | Generate ID, persist Meeting with host, return ID and URL | Call API then navigate; never invent IDs | Room created lazily on first token holder connect | Meeting row, status CREATED |
| Validate code | Wrong code says "not found"; never creates anything | Lookup by ID; 404 if absent; report status if ended | Validate format locally, then ask server before lobby | Nothing | Indexed unique meetingId |
| Lobby | Preview camera/mic, pick devices, initial mute state, meeting title | Provide title and host name | Device enumeration, permission errors, persistence | Not connected yet | None |
| Join | Authorised users connect in seconds; banned/locked users see a reason | Authorise, decide role, mint short-lived token | Exchange token for connection, publish tracks | Validate token, admit, fan out tracks | Optional first-join time |
| Host | Creator is host; controls appear and work only for them | Role from Meeting.hostId, never client | Render controls by server role | Token metadata carries role | Meeting.hostId |
| Mute and camera | Instant local feedback; others see within a second | Nothing for self-mute | Toggle via SDK | Mute state propagates automatically | None |
| Screen share | Separate stage; camera stays | Optionally restrict via token grants | Publish screen-share source | Separate track source; simulcast | None |
| Remove participant | Host removes; immediate disconnect | Verify host; RoomService.removeParticipant; optional ban | Host menu; removed user sees why | Executes disconnect | bannedUserIds |
| Host mute | Host mutes; participant may unmute later | Verify host; RoomService.mutePublishedTrack | "Muted by host" hint | Executes server-side | None |
| Leave vs end | Anyone leaves; only host ends; ending closes room | End: verify host, set ENDED, delete room | Distinct buttons; ended screen | deleteRoom disconnects all | status, endedAt |
| Refresh and reconnect | Same meeting, same role; brief loss recovers silently | Re-issue token | Re-validate, re-fetch token, reconnect | Auto reconnection; duplicate identity replacement | None |
| Cleanup | Empty rooms do not linger | Webhook marks ENDED on room_finished | None | emptyTimeout | status, endedAt |
| Errors | Every failure names cause and fix | Stable error codes | Map codes to copy | SDK errors surfaced | None |

---

## 5. Comprehensive feature comparison

Classification: **ESSENTIAL** must exist before the AI module. **RECOMMENDED** makes the demo credible. **OPTIONAL** nice to have. **OUT OF SCOPE** not an FYP goal.

| Module | Google Meet-like | IntelliMeet today (traced) | Gap | Class | Pri | Recommendation |
|---|---|---|---|---|---|---|
| Authentication | Verified account, session survives refresh, revocation | JWT works (`authController.js`, `authMiddleware.js`). Token in localStorage, no revocation, socket unauthenticated | Socket/meeting layer ignore auth | ESSENTIAL | P0 | Keep REST auth; require JWT on meeting endpoints; embed identity in LiveKit tokens |
| Create meeting | Server creates persistent meeting owned by creator | Client-side random ID + localStorage (`CreateMeetingPage.tsx:38-70`, `DashboardPage.tsx:28-31`) | No backend, record, or owner | ESSENTIAL | P0 | POST /api/meetings, Meeting model, hostId |
| Meeting IDs | Unguessable, readable, server-issued | `im-xxxx-xxxx` from Math.random | Not crypto-random, not registered | ESSENTIAL | P0 | `abc-defg-hij` from crypto.randomBytes, unique index |
| ID validation | Format then existence; unknown refused | Length ≥ 4 (`JoinMeetingPage.tsx:29-33`); server creates room (`server.js:154-156`) | Any string becomes a room | ESSENTIAL | P0 | GET /api/meetings/:id before lobby; token endpoint refuses unknown IDs |
| Join meeting | Authorised, role-aware, token-gated | Socket join with client-chosen id and name (`useMeetingConnection.ts:19-23`) | Impersonation trivial | ESSENTIAL | P0 | POST /api/meetings/:id/token |
| Lobby | Preview, device picker, toggles, errors | Preview and toggles exist; no picker; random audio meter; fake delay; hard-coded title | Partial | RECOMMENDED | P2 | enumerateDevices, real meter, error states, persist choices |
| Audio | Publish mic, mute propagates, device switching | Works via replaceTrack; no switching; no level detection | Fragile | ESSENTIAL | P1 | setMicrophoneEnabled, switchActiveDevice |
| Mute/unmute | Immediate, consistent across reconnects | Store flag + broadcast; reconnect re-sends stale snapshot (`useMeetingConnection.ts:17-23`) | State drift | ESSENTIAL | P1 | LiveKit track state as source of truth |
| Camera | On/off, switching, avatar when off | Works; avatar exists; no switching | Minor | ESSENTIAL | P1 | setCameraEnabled; device switch |
| Screen sharing | Separate stage, camera stays, one sharer, browser stop | Replaces camera track (`MeetingRoomPage.tsx:234-238`); no audio; browser stop OK | Wrong topology | ESSENTIAL | P1 | ScreenShare source; single sharer in UI |
| Participant list | Names, host badge, mic/cam state, sharer, count | Exists (`MeetingRoomPage.tsx:1042-1110`); host badge fallback on grid only (`:526-531`) | Inconsistent badge | ESSENTIAL | P1 | Drive from LiveKit participants + role metadata |
| Host role | Creator is host; server enforces | First socket is host (`server.js:162-166`) | Role is a race | ESSENTIAL | P0 | Meeting.hostId; requireHost |
| Remove participant | Host only, immediate, optional ban | Any socket may kick anyone (`server.js:230-252`) | No authorisation | ESSENTIAL | P0 | DELETE participants/:identity → removeParticipant |
| Host mute | Host mutes; participant can unmute | Any socket may force-mute (`server.js:216-227`); client merely toggles | Not enforced | ESSENTIAL | P0 | mutePublishedTrack behind requireHost |
| End meeting | Host only; room closed; rejoin refused | Host-checked in memory (`server.js:285-312`); rejoin recreates room | No persistent ENDED | ESSENTIAL | P0 | POST /end sets ENDED, deletes room |
| Leave meeting | Anyone leaves; meeting continues | Works, with phantom rejoin race (`MeetingRoomPage.tsx:303-316`) | Bug | ESSENTIAL | P1 | room.disconnect() |
| Meeting status | Created, active, ended | Implicit: in Map or not | Missing | ESSENTIAL | P0 | Enum on Meeting |
| Rejoin after refresh | Same meeting, same role | Store not persisted; new random id; role lost (`useMeetingStore.ts:114-115`) | Broken | ESSENTIAL | P1 | Identity = user id; re-fetch token |
| Reconnect | Silent recovery | No connection-state handling | Missing | ESSENTIAL | P1 | LiveKit handles; show banner |
| Invalid IDs | "Meeting not found" | Creates a room | Critical | ESSENTIAL | P0 | Section 8 |
| Meeting URL | One canonical link | Share link `https://intellimeet.app/join/<id>`, nonexistent route (`CreateMeetingPage.tsx:80`, `MeetingRoomPage.tsx:1120`) | Broken link | ESSENTIAL | P0 | `/meet/:meetingId` from window.location.origin |
| Security | Server enforces everything | Client-trusted throughout meeting layer | Critical | ESSENTIAL | P0 | Section 19 |
| Permissions/devices | Named errors | Fallback ladder logs to console only (`LobbyPage.tsx:30-60`) | No UX | RECOMMENDED | P2 | Map DOMException names |
| Active speaker | Highlight and ordering | Fake: first remote participant, unused (`MeetingRoomPage.tsx:533`) | Missing | RECOMMENDED | P2 | ActiveSpeakersChanged |
| Chat | Messages, history on join | Socket.IO; history sent and discarded (`useMeetingConnection.ts:25-43`) | Partial | RECOMMENDED | P1 | LiveKit data messages; drop Socket.IO |
| Grid layout | Responsive tiles, stage, avatar, badges | Decent; re-renders every second from timer (`MeetingRoomPage.tsx:93-99`) | Performance | RECOMMENDED | P2 | Split components; select store slices |
| Database | Meetings persist | Only users persist | Missing | ESSENTIAL | P0 | Meeting model |
| Dashboard / My Meetings | Real history | Hard-coded stats and mock rows (`DashboardPage.tsx:80-84,165-168`, `MyMeetingsPage.tsx:22-103`) | Facade | RECOMMENDED | P2 | GET /api/meetings |
| LiveKit readiness | Token endpoint, service, env separation | None | Missing | ESSENTIAL | P1 | Sections 9, 22 |
| Error handling | Stable codes | Envelope without codes (`utils/ApiError.js`); socket errors logged only | Partial | ESSENTIAL | P1 | Add `code` to ApiError |
| Responsive UI | Laptop and phone | Reasonable on desktop | Minor | RECOMMENDED | P2 | Verify after split |
| Lock, admit/deny | Host gates entry | None; "require login" switch inert (`CreateMeetingPage.tsx:185-188`) | Missing | OPTIONAL | P3 | Lock is cheap; admit queue is not |
| Co-host | Delegated controls | None | Missing | OPTIONAL | P3 | Skip unless time remains |
| Recording, breakout rooms, streaming, admin console, dial-in | Enterprise | None | — | OUT OF SCOPE | — | Future work |

---

## 6. Critical problems

1. **Any URL creates a meeting.** `server.js:154-156` instantiates a room for whatever `roomId` arrives. Combined with `MeetingRoomPage.tsx:303-316` joining on mount, visiting `/meeting/room/anything` yields a working call.
2. **Hosting is a race and is stealable.** First socket wins at `server.js:162-166`. Rejoining with another user's id at line 161 inherits their role. Sending `{ isHost: true }` through `toggle-media` is merged verbatim at line 197.
3. **Kick and force-mute are unauthorised.** `server.js:216-252`. README claims server enforcement; code enforces only `end-meeting`.
4. **No socket authentication.** `socket.ts:25` sends nothing; `server.js:114-127` checks nothing.
5. **Calls fail on real networks.** STUN only at `MeetingRoomPage.tsx:109-111`, no TURN, no ICE candidate queue (line 202 drops early candidates), early offers dropped (line 163), no connection-state feedback.
6. **Build is broken.** `npm run build` runs `tsc` first and fails with 8 errors: 7 Framer Motion variant typings in `LandingPage.tsx:73-161` and the real bug at `MeetingRoomPage.tsx:457`. **[verified]**
7. **Password reset link poisoning.** `authController.js:438-450` builds the reset URL from the Origin/Referer header.
8. **Google sign-in links accounts without checking `email_verified`.** `authController.js:540-554`.
9. **Preferences never save.** Map-typed field plus dot assignment. `User.js:114`, `authController.js:186-191,220-224`. **[verified]**
10. **Auth rate limit is half the configured value.** Applied by router and per route. `authRoutes.js:24-36`. Five successful logins per 15 min in production. **[verified]**
11. **Peer connections leak on unmount.** Cleanup at `MeetingRoomPage.tsx:273-275` removes only the socket listener.
12. **Leave re-joins a phantom room.** Store reset to `idle` races the mount effect; uncancelled 800 ms timer.
13. **Refresh loses everything.** No persisted meeting state; new random user id each load.
14. **Meeting state is process memory.** Restart drops every meeting; one instance only.

---

## 7. The meeting ID problem

**Yes, random IDs create rooms today.** Three cooperating causes; all must change.

Cause 1, server creates rooms on demand:

```js
// backend/server.js:152-156
socket.join(roomId);
if (!rooms.has(roomId)) {
  rooms.set(roomId, { participants: [], messages: [] });
}
```

Cause 2, the room page joins on mount for any URL:

```ts
// frontend/src/pages/meeting/MeetingRoomPage.tsx:303-316
if (status === 'idle') {
  joinMeeting({ meetingId: meetingId || 'direct-join', title: 'CPEC Quarterly Review', ... })
  setTimeout(() => setStatus('active'), 800)
}
```

Cause 3, the join page validates only length:

```ts
// frontend/src/pages/meeting/JoinMeetingPage.tsx:29-41
if (parsedId.length < 4) { setError('...'); return }
setTimeout(() => { navigate(`/meeting/lobby/${parsedId}`) }, 1500)
```

**Consequence for a LiveKit migration.** If the token endpoint mints a token for any room name the client asks for, the same defect reappears one layer down, because LiveKit also creates rooms on first connect. The fix is that the backend refuses to issue a token for a meeting it cannot find in MongoDB.

---

## 8. Meeting ID solution

| Option | Example | Entropy | Readability | URL | Enumeration | Verdict |
|---|---|---|---|---|---|---|
| UUID v4 | `3f9c2a1e-8b7d-4c6a-9e2f-1a2b3c4d5e6f` | 122 bits | Poor | 36 chars | None | Over-strong, hostile |
| NanoID (21) | `V1StGXR8_Z5jdHi6B-myT` | 126 bits | Poor, mixed case | Fine | None | Wrong for a dictated code |
| Meet-style letters | `abc-defg-hij` | ≈47 bits (26^10 ≈ 1.4×10^14) | Excellent | 12 chars | Negligible with authenticated rate-limited lookup | **Recommended** |

Uniqueness is guaranteed by a unique index plus retry on `E11000`.

```js
// backend/utils/meetingId.js
const crypto = require('crypto');
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
const PATTERN = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/;

function generateMeetingId() {
  const bytes = crypto.randomBytes(10);
  let s = '';
  for (const b of bytes) s += ALPHABET[b % 26];
  return `${s.slice(0,3)}-${s.slice(3,7)}-${s.slice(7,10)}`;
}
function isValidMeetingId(id) { return PATTERN.test(id); }
function normalizeMeetingId(raw) {
  const letters = String(raw).toLowerCase().replace(/[^a-z]/g, '');
  return letters.length === 10 ? `${letters.slice(0,3)}-${letters.slice(3,7)}-${letters.slice(7)}` : null;
}
module.exports = { generateMeetingId, isValidMeetingId, normalizeMeetingId };
```

Validation flow:

```
User types a code or opens /meet/abc-defg-hij
  ↓ normalizeMeetingId → null? "That doesn't look like a meeting code. Codes look like abc-defg-hij."
  ↓ GET /api/meetings/abc-defg-hij (Bearer JWT)
  ↓ bad format → 400 INVALID_MEETING_ID
    not found  → 404 MEETING_NOT_FOUND      // nothing created, LiveKit untouched
    ENDED      → 200 with status → "This meeting has ended"
    banned     → 403 PARTICIPANT_BANNED
    locked (non-host) → 423 MEETING_LOCKED
  ↓ 200 → lobby with real title and host. Join requests a token; token endpoint re-runs the same checks.
```

Every rejection is terminal. The frontend never redirects to a fresh meeting, never generates a code, and the room page refuses to mount without a successful lookup.

---

## 9. LiveKit migration analysis

**Decision: migrate.** The mesh is the wrong topology past four participants, and every hard problem it gets wrong (NAT, candidate ordering, glare, reconnection, host mute, screen share as a second track) is what an SFU with a mature SDK solves. The migration also deletes the Socket.IO signaling path where the security holes live.

| Concern | Custom WebRTC now | With LiveKit |
|---|---|---|
| Scalability | Upload grows per peer; 4 in practice | One upload per participant |
| NAT and ICE | STUN only, early candidates dropped | TURN bundled, ICE internal |
| Signaling | Hand-written, unauthenticated | In SDK over signed WebSocket |
| Participants/rooms | In-memory Map, first-come host | Server-side room state, metadata, permissions |
| Tracks | One video sender; share replaces camera | Typed sources: Camera, Microphone, ScreenShare, ScreenShareAudio |
| Reconnection | None | Automatic; duplicate identity replacement |
| Mute | Client flag; host mute advisory | Protocol-level; server-enforced host mute |
| Bandwidth | Fixed | Simulcast, dynacast, adaptive stream |
| Recording later | Impossible | Egress available |
| AI pipeline later | Impossible in mesh | Agent / server participant can subscribe and publish |

### Fate of existing WebRTC code

| Location | Does | Fate |
|---|---|---|
| `MeetingRoomPage.tsx:82-90` refs | Peer map, local streams | Remove |
| `MeetingRoomPage.tsx:102-276` WebRTC effect | Negotiation, track plumbing | Remove → `useLiveKitRoom` |
| `MeetingRoomPage.tsx:321-357` | getUserMedia ladder | Remove → SDK enable with lobby device ids |
| `MeetingRoomPage.tsx:395-421` | Screen share | Remove → `setScreenShareEnabled` |
| `MeetingRoomPage.tsx:436-447` | Cleanup | Remove → `room.disconnect()` |
| `MeetingRoomPage.tsx:450-520` | leave/end/force/remove | Rewrite: leave = disconnect; others = REST |
| `MeetingRoomPage.tsx:526-541` | Host fallback, fake speaker, lang map | Remove |
| `MeetingRoomPage.tsx:560-1268` | Layout, grid, tiles, panels, modals, controls | **Retain**, split into components, feed from LiveKit hooks |
| `RemoteVideo` (`:18-30`) | srcObject binding | Rewrite as `ParticipantTile` with `track.attach()` |
| `useMeetingConnection.ts` | Socket listeners | Remove |
| `lib/socket.ts` | Socket singleton | Remove with dependency |
| `useMeetingStore.ts` participants, toggle*, sendMessage, signalingLog, reset | Socket mirrors | Rewrite: keep meetingId, title, role, timer, chat, events, unread; drop participants and media flags |
| `LobbyPage.tsx:30-69` | Preview | Retain idea; rewrite with `createLocalTracks` so tracks are reused on join |
| `server.js:112-350` | Socket.IO server | Remove |
| `server.js:1-107` | Express setup | Retain; add meeting and webhook routes |

**Explicit vs lazy room creation.** LiveKit creates a room when a participant with a valid `roomJoin` grant connects and deletes it after `emptyTimeout`. Because the token endpoint only issues tokens for meetings found in MongoDB, lazy creation is safe. Call `createRoom` idempotently from the token endpoint on first issue to set `emptyTimeout` and `maxParticipants`.

---

## 10. Authentication analysis

Flows: Login `LoginPage.tsx:64` → `authApi.login` → `POST /api/auth/login` → `authRoutes.js:29` → `authController.js:106 login()` → `comparePassword` → `generateToken` → `useAuthStore.login()` (`useAuthStore.ts:70`). Signup `RegisterPage.tsx:109` → `authController.js:48` → PendingUser upsert → OTP email → `VerifyEmailPage.tsx:88` → `authController.js:292` → raw `User.collection.insertOne` → JWT. Protection: `authMiddleware.js:31 protect()`; frontend `ProtectedRoute.tsx:4-12` reads a persisted boolean.

| Feature | Expected | Current | Status | Change |
|---|---|---|---|---|
| Signup | Email verified before account exists | PendingUser with hashed OTP, TTL 10 min | Complete | Replace raw insert at `authController.js:335` with a Mongoose save; delete thinking-aloud comments 317-333 |
| Login | Generic failure, hashed compare | `authController.js:106-137` | Complete | None |
| Logout | Client clears; optional revocation | `useAuthStore.ts:73-74` local only | Needs Improvement | Expiry 24 h or `tokenVersion` on User |
| Password hashing | bcrypt 10-12 | Hook `User.js:191-210`; register hard-codes 10 (`authController.js:63`) | Complete | Use config rounds in register |
| Password validation | Length + complexity | `authValidators.js:65-77`; reset checks length only (`authController.js:482`) | Partially Complete | Reuse chain for reset |
| JWT | Signed, verified, invalidated on password change | `utils/jwt.js`; `passwordChangedAfter` | Complete | None |
| Refresh tokens | Optional | None | Missing | Not needed |
| Protected routes (server) | All meeting/user routes | Users yes; meeting layer socket-only | Security Risk | All meeting routes behind `protect`; webhook behind signature |
| Protected routes (client) | Guard + server | Trusts localStorage boolean (`ProtectedRoute.tsx:7`) | Needs Improvement | Validate on boot via `/users/profile`; preserve attempted URL |
| Token storage | httpOnly preferred | localStorage, no `partialize` (`useAuthStore.ts:87`) | Security Risk | Persist token only; 24 h expiry |
| Token expiry | Graceful | `api.ts:103-108` clears storage but not the store | Incorrect | Call `logout()` and redirect |
| Invalid token | 401 | `jwt.js:40-52` | Complete | None |
| Duplicate accounts | Unique email | Index, lowercase, pre-check | Complete | None |
| Email validation | Format + normalisation | `isEmail` + `normalizeEmail` (strips Gmail dots) | Complete | Document or disable dot removal |
| Name validation | Safe chars | Letters/spaces at register; wider at profile | Needs Improvement | Unify; allow O'Brien, Ali-Khan |
| Google OAuth | Audience + `email_verified` | Audience yes; verified no (`authController.js:540`) | Security Risk | Require `email_verified === true`; client id via config, REQUIRED_VARS |
| Password reset | URL from config | From Origin header (`authController.js:438`) | Security Risk | `FRONTEND_URL` |
| Rate limiting | Strict on auth | Double-applied: 5 per 15 min prod; general 100/15 min | Incorrect | Remove per-route limiter (`authRoutes.js:28-36`); general 600 |
| Preferences | Saved | Never saved **[verified]** | Incorrect | Use `preferencesSchema` (`User.js:26-44`) as field type |

---

## 11. Create meeting analysis

Which button: `DashboardPage.tsx:28-31 handleStartInstant()` and `CreateMeetingPage.tsx:38-70 handleCreate()`. Which endpoint: none. ID generated: frontend, `Math.random`. Database record: none. WebRTC rooms: no. Socket.IO rooms: on first join. Meeting exists before join: no. Any random ID creates a room: yes.

Target flow:

```
DashboardPage "New meeting"  or  CreateMeetingPage "Create"
  ↓ meetingApi.create({ title })                       // frontend/src/lib/api.ts
  ↓ POST /api/meetings  Authorization: Bearer <jwt>
  ↓ backend/routes/meetingRoutes.js  router.post('/', protect, createMeetingValidation, createMeeting)
  ↓ backend/controllers/meetingController.js createMeeting → meetingService.createMeeting({ hostId: req.user._id, title })
  ↓ backend/services/meetingService.js  loop { id = generateMeetingId(); try Meeting.create catch E11000 → retry }
  ↓ 201 { meetingId, title, status:'CREATED', host:{id,name}, url:'/meet/abc-defg-hij', createdAt }
  ↓ navigate(`/meet/abc-defg-hij`) → lobby loads via GET → join requests token
```

No LiveKit call at creation. CREATED → ACTIVE happens via `participant_joined` webhook or when the host requests their first token. Scheduled mode: drop it or keep an optional `scheduledFor` date as metadata only.

---

## 12. Join meeting analysis

Defects today: no server validation, no authorisation, client-chosen identity, camera acquired twice (lobby then room), fake delays, hard-coded title, random audio meter (`LobbyPage.tsx:140-147`).

Target flow:

```
/join page or /meet/:meetingId link
  ↓ normalizeMeetingId → invalid → inline error
  ↓ GET /api/meetings/:id → 404 "Meeting not found" | ENDED "This meeting has ended" | 403 banned | 200 → LobbyPage
  ↓ Lobby: createLocalTracks({ audio: deviceId, video: deviceId }) → preview → toggles → pickers → remembered choices
  ↓ Join → POST /api/meetings/:id/token → { token, url, role }
  ↓ room.connect(url, token) → publish lobby tracks → room view
  ↓ Room renders from RoomEvents; role from metadata; timer from meeting.startedAt
```

| Pre-join requirement | Today | Target |
|---|---|---|
| Camera preview | Yes (`LobbyPage.tsx:130-150`) | Keep from LocalVideoTrack |
| Mic level meter | Random bars | AnalyserNode or components-react PreJoin |
| Toggles | Yes | Keep; pass initial state |
| Device selection | None | `Room.getLocalDevices`; persist in `intellimeet-devices` |
| Permission denied | Console only | Copy + Retry; allow audio-only or no-media join |
| No camera/mic | Silent | Avatar tile + notice; allow join |
| Device busy | Unhandled | `NotReadableError` → "used by another app" |
| Display name | Account | Account |
| Title and code | Hard-coded | From lookup; copy button |
| Join and Back | Join only | Both; Back stops tracks |
| Validation before lobby | None | Route guard calls GET first |

---

## 13. Audio and video analysis

**Audio today.** Acquisition `MeetingRoomPage.tsx:321-357`. Mute is a store flag (`useMeetingStore.ts:296-315`) broadcast over socket; the sender gets `replaceTrack(null)` via reconciliation at `:241-259`. Indicators come from the flag, not the track. No device switching, level detection, or device-removal handling; reconnect re-sends a stale snapshot.

**Video today.** Camera off replaces the track with null; avatar tile renders. Remote streams are cloned on every `ontrack` (`:143-152`), causing a visible restart on renegotiation. No switching, active speaker, or quality adaptation.

| Action | Frontend call | LiveKit does | IntelliMeet still owns |
|---|---|---|---|
| Enable mic | `setMicrophoneEnabled(true, { deviceId })` | Acquire, publish, noise suppression | Button, error toast |
| Mute | `setMicrophoneEnabled(false)` | Mutes; subscribers get `TrackMuted` | Nothing |
| Unmute | `setMicrophoneEnabled(true)` | Unmutes | If host disabled publishing, show message |
| Switch mic | `room.switchActiveDevice('audioinput', id)` | Republishes | Picker |
| Device unplugged | `RoomEvent.MediaDevicesChanged` | Emits | Re-enumerate; fallback; toast |
| Enable camera | `setCameraEnabled(true, { deviceId })` | Simulcast publish | Tile |
| Camera off | `setCameraEnabled(false)` | Mutes; LED off | Avatar |
| Remote render | `track.attach(el)` or `<VideoTrack>` | Adaptive layer | Layout |
| Active speaker | `ActiveSpeakersChanged` | Detection | Highlight |
| Bandwidth | `adaptiveStream, dynacast` | Pauses unused layers | Nothing |
| Permission revoked | Track ends | Unpublishes | Message + retry |

| Mute edge case | LiveKit | IntelliMeet adds |
|---|---|---|
| Self mute/unmute | Native | Button bound to `isMicrophoneEnabled` |
| Host mutes | `mutePublishedTrack` enforced server-side | REST endpoint; toast |
| Participant unmutes afterwards | Allowed by default (server unmute needs `enable_remote_unmute`) | Policy: allow, like Meet |
| Host disables mic entirely | `updateParticipant` permission | Optional P3 |
| Permission revoked | Track ends | Error UI |
| Device removed | `MediaDevicesChanged` | Re-select default |
| Network reconnect | Automatic; state restored | Banner |
| Multiple tabs | Same identity replaces; old tab gets `DUPLICATE_IDENTITY` | Message in old tab |
| Refresh | New session, same identity | Re-fetch token on mount |

---

## 14. Screen sharing analysis

**Today.** `handleScreenShareToggle()` (`MeetingRoomPage.tsx:395-421`) calls `getDisplayMedia({ video:true, audio:false })`, sets `onended` (browser stop works), broadcasts the flag. Reconciliation **replaces the camera track** on the single video sender (`:234-238`) so viewers lose the presenter's face. Layout (`:622-683`) shows a stage when any participant has the flag; nothing prevents two simultaneous shares.

**Target.**

- `localParticipant.setScreenShareEnabled(true, { audio: true })` publishes `Track.Source.ScreenShare` (+ `ScreenShareAudio` when ticked). Camera untouched.
- Browser picker is native; SDK unpublishes on browser Stop.
- Render by source: tiles subscribe to Camera, stage to ScreenShare; `useTracks([Track.Source.ScreenShare])`.
- **One share at a time enforced in the UI**: disable other Share buttons with "Someone is already presenting". Server enforcement via per-participant permissions is P3.
- "Presenting" chip in participant list.

Recommendation: single share, camera stays visible, share audio allowed.

---

## 15. Host controls analysis

**Today.** Host = first socket (`server.js:162-166`). Client gates buttons at `MeetingRoomPage.tsx:1061`. Server checks role only for `end-meeting`. Force-mute is advisory. Remove works but is unauthorised. "Prevent rejoin" checkbox at `:1157` is never read. No lock, admit, or permission restriction.

**Role model.** `HOST` and `PARTICIPANT`. Creator is host via `Meeting.hostId`. Role computed server-side in the token endpoint, written into token `metadata` as `{"role":"HOST"}`, re-derived on every host action by `requireHost`. **Co-host:** not worth it for the FYP.

| Control | Flow | LiveKit | Verdict |
|---|---|---|---|
| Remove | `DELETE /api/meetings/:id/participants/:identity?ban=true` → requireHost → `removeParticipant` → optional ban | Immediate disconnect, reason `PARTICIPANT_REMOVED` | ESSENTIAL |
| Mute mic | `POST /participants/:identity/mute { source:'microphone' }` → `getParticipant` → `mutePublishedTrack` | Enforced; participant self-unmutes | ESSENTIAL |
| Turn off camera | Same with `source:'camera'` | Same | RECOMMENDED |
| Prevent re-entry | Ban adds user to `bannedUserIds`; token returns 403 | Token is the gate | RECOMMENDED |
| End for everyone | `POST /api/meetings/:id/end` → ENDED, endedAt → `deleteRoom` | Disconnects all, reason `ROOM_DELETED` | ESSENTIAL |
| Lock | `PATCH { locked:true }`; token 423 for non-hosts | Nothing | OPTIONAL |
| Admit/deny | Pending queue + restricted token + `updateParticipant` | Possible | OPTIONAL, only if ahead |
| Disable mic/cam (no self-enable) | `updateParticipant` with `canPublishSources` | Supported | OPTIONAL |
| Host-only screen share | Participant tokens without screen sources | Supported | OPTIONAL |

**Leave vs end.** Participant leaves: `room.disconnect()`, no REST call. Host leaves: same; meeting stays ACTIVE, `hostId` unchanged, host can return with controls; no role transfer. Host ends: existing modal (`MeetingRoomPage.tsx:1133-1180`) confirms then calls end. Everyone gone: `emptyTimeout` 300 s → `room_finished` → ENDED. Raise to 900 s if breaks matter.

---

## 16. Participant management

| Field | MongoDB | LiveKit | Frontend only | Notes |
|---|---|---|---|---|
| userId | hostId, participants[].userId, bannedUserIds | identity | — | One value, bound by the token |
| participantId / identity | — | `identity` = userId; `sid` per session | — | Use identity for API; sid changes on reconnect |
| displayName | User.fullName | `name` from token | — | Never client-supplied |
| role | Derived from hostId | `metadata` `{ role }` | Read from metadata | Refreshable via `updateParticipant` |
| Mic state | — | `isMicrophoneEnabled` | — | Never persist |
| Camera state | — | `isCameraEnabled` | — | Never persist |
| Screen sharing | — | `isScreenShareEnabled` | — | Never persist |
| Join time | participants[].firstJoinedAt via webhook | `joinedAt` | — | Only for dashboard history |
| Connection state | — | `connectionQuality`, state events | Banner | Replaces static icon at `MeetingRoomPage.tsx:579` |
| Speaking | — | `isSpeaking`, `audioLevel` | — | Highlight |
| Language pref | User.preferences | Later, metadata | — | Out of scope |

**Participant list UI.** Rebuild the panel at `MeetingRoomPage.tsx:1042-1110` as `ParticipantsPanel` fed by `useParticipants()`. Add "Presenting" chip, count, host-first sort, connection quality icon, host menu: Mute, Turn off camera, Remove, Remove and block.

---

## 17. Database recommendations

```js
// backend/models/Meeting.js
const meetingSchema = new mongoose.Schema({
  meetingId:  { type: String, required: true, unique: true, index: true,
                match: /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/ },
  title:      { type: String, trim: true, maxlength: 100, default: 'Untitled meeting' },
  hostId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status:     { type: String, enum: ['CREATED', 'ACTIVE', 'ENDED'], default: 'CREATED', index: true },
  roomName:   { type: String, required: true },           // equals meetingId today
  startedAt:  { type: Date, default: null },
  endedAt:    { type: Date, default: null },
  endedReason:{ type: String, enum: ['HOST_ENDED', 'EMPTY_TIMEOUT', null], default: null },
  settings: {
    locked:              { type: Boolean, default: false },
    screenShareHostOnly: { type: Boolean, default: false },
  },
  bannedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  participants: [{                                        // history, not presence
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    displayName:   String,
    firstJoinedAt: Date,
    lastLeftAt:    Date,
  }],
}, { timestamps: true });

meetingSchema.index({ hostId: 1, createdAt: -1 });
meetingSchema.index({ 'participants.userId': 1, createdAt: -1 });
```

| Field | Keep? | Why |
|---|---|---|
| meetingId | Yes | Public code; unique index is the collision guard |
| title | Yes | Lobby, room, dashboard |
| hostId | Yes | Only source of host authority |
| status | Yes | Gates token issue and rejoin |
| roomName | Yes, cheap | Decouples naming; = meetingId |
| startedAt, endedAt | Yes | Timer origin; duration |
| settings.locked | Optional | Only if lock is implemented |
| bannedUserIds | Yes | Makes remove-and-block real |
| participants[] | Optional | Dashboard history only; never presence |
| createdBy | No | Duplicate of hostId |
| scheduledFor | Optional | If scheduled mode stays |
| Participant, Session, Room, Message models | No | Presence in LiveKit; chat persistence is P3 |

Lifecycle:

```
CREATED ──(first host token, or participant_joined webhook)──▶ ACTIVE
ACTIVE  ──(POST /end by host)───────────────────────────────▶ ENDED  HOST_ENDED
ACTIVE  ──(room_finished webhook after emptyTimeout)────────▶ ENDED  EMPTY_TIMEOUT
CREATED ──(never joined; optional sweep after 24 h)─────────▶ ENDED  EMPTY_TIMEOUT
ENDED   → terminal. Token endpoint 410 MEETING_ENDED. GET returns 200 with status.
```

User model fix:

```js
// backend/models/User.js:113-118  replace
preferences: { type: Map, of: String, default: () => ({}) },
// with
preferences: { type: preferencesSchema, default: () => ({}) },
```

---

## 18. API recommendations

Existing auth and user routes stay. Join and token are the same operation. Leave needs no endpoint.

| Method and route | Auth | Authz | Request | Response | Errors | Purpose |
|---|---|---|---|---|---|---|
| `POST /api/meetings` | JWT | Any user | `{ title? }` | 201 `{ meetingId, title, status, host:{id,name}, url, createdAt }` | 401, 422, 500 ROOM_CREATION_FAILED | Create |
| `GET /api/meetings` | JWT | Any | `?role=host\|participant&status=` | 200 `{ meetings:[...] }` | 401 | Dashboard, replaces mocks |
| `GET /api/meetings/:meetingId` | JWT | Not banned | — | 200 `{ meetingId, title, status, host, isHost, startedAt, endedAt, locked }` | 400 INVALID_MEETING_ID, 404, 403 PARTICIPANT_BANNED | Validate before lobby; never creates |
| `POST /api/meetings/:meetingId/token` | JWT | Not banned; not locked unless host; not ENDED | `{}` | 200 `{ token, url, roomName, identity, role, expiresIn }` | 404, 410 MEETING_ENDED, 403, 423 MEETING_LOCKED, 500 TOKEN_GENERATION_FAILED | Authorise and mint; CREATED→ACTIVE on host |
| `POST /api/meetings/:meetingId/end` | JWT | Host | — | 200 `{ meetingId, status:'ENDED', endedAt }` | 403 NOT_HOST, 404, 410 | Set ENDED, delete room |
| `DELETE /api/meetings/:meetingId/participants/:identity` | JWT | Host; not self | `?ban=true` | 200 `{ removed:true, banned }` | 403, 404 PARTICIPANT_NOT_FOUND, 502 | Kick, optionally ban |
| `POST /api/meetings/:meetingId/participants/:identity/mute` | JWT | Host | `{ source:'microphone'\|'camera' }` | 200 `{ muted:true }` | 403, 404 TRACK_NOT_FOUND, 502 | Server-side mute |
| `PATCH /api/meetings/:meetingId` | JWT | Host | `{ title?, locked? }` | 200 meeting | 403, 404, 422 | Rename or lock (optional) |
| `POST /api/livekit/webhook` | LiveKit signature | — | raw body | 200 | 401 | participant_joined → ACTIVE + history; participant_left → lastLeftAt; room_finished → ENDED |

```js
// backend/routes/meetingRoutes.js
router.use(protect);
router.post('/',                       createMeetingValidation, createMeeting);
router.get('/',                        listMyMeetings);
router.get('/:meetingId',              meetingIdParam, loadMeeting, getMeeting);
router.post('/:meetingId/token',       meetingIdParam, loadMeeting, issueToken);
router.post('/:meetingId/end',         meetingIdParam, loadMeeting, requireHost, endMeeting);
router.patch('/:meetingId',            meetingIdParam, loadMeeting, requireHost, updateMeetingValidation, updateMeeting);
router.delete('/:meetingId/participants/:identity',    meetingIdParam, loadMeeting, requireHost, removeParticipant);
router.post('/:meetingId/participants/:identity/mute', meetingIdParam, loadMeeting, requireHost, muteValidation, muteParticipant);
```

The webhook must be mounted **before** `express.json()` with `express.raw({ type: 'application/webhook+json' })` and outside the general rate limiter.

---

## 19. Security review

| Severity | Finding | Location | Impact | Fix |
|---|---|---|---|---|
| CRITICAL | Unauthenticated signaling; any client joins any room with any identity | `socket.ts:25`, `server.js:114-131` | Eavesdropping, impersonation | Removed by migration; token endpoint is the only door |
| CRITICAL | No host check on remove-user, force-media, leave-room | `server.js:216-280` | Anyone kicks or mutes anyone | `requireHost` on REST |
| CRITICAL | Host role by joining first, rejoining with host's id, or merging `isHost` via toggle-media | `server.js:161-166, 197` | Takeover | Role from `Meeting.hostId` only |
| CRITICAL | Arbitrary room names create rooms | `server.js:154-156`, `MeetingRoomPage.tsx:303-316` | Squatting, phantom meetings | Section 8 |
| HIGH | Reset URL from Origin/Referer | `authController.js:438-450` | Reset-token theft | `FRONTEND_URL` from config |
| HIGH | `email_verified` unchecked; auto-link by email | `authController.js:540-554` | Account linking without proof | Require `email_verified === true` |
| HIGH | JWT + full user in localStorage | `useAuthStore.ts:63-90` | XSS steals 7-day session | `partialize` to token; 24 h expiry |
| HIGH | Google client id from `process.env`, unvalidated | `authController.js:33, 533` | Audience check skipped if unset | Add to `REQUIRED_VARS` |
| MEDIUM | Auth limiter double-applied; general limit low | `authRoutes.js:24-36`, `rateLimiter.js:45-47` | Lockouts behind NAT | Apply once; raise general; per-user token limit |
| MEDIUM | Dev error handler returns stack traces | `errorHandler.js:90-96` | Leak if NODE_ENV unset (default is development) | Require NODE_ENV or default to production semantics |
| MEDIUM | No revocation on logout | `useAuthStore.ts:73` | Stolen token lives to expiry | Shorter expiry; `tokenVersion` |
| MEDIUM | forgot-password reveals email existence | `authController.js:420-423` | Enumeration | Generic message |
| MEDIUM | Verify-OTP bypasses model validation | `authController.js:335-343` | Schema drift | Save through Mongoose |
| MEDIUM | No LiveKit secret yet, but client-side pattern would tempt client-side tokens | — | — | Section 22 |
| LOW | Live secrets in `.env`; no `.env.example` | `backend/.env`, `frontend/.env` | Accidental commit | Add examples; rotate SMTP password if shared |
| LOW | Query sanitisation is a no-op on Express 5, harmless because default query parser is flat **[verified]** | `sanitize.js:51-56` | None | Set `app.set('query parser','simple')` explicitly |
| LOW | CORS allows any localhost port in dev | `environment.js:66-70` | Fine | Ensure production sets `CORS_ORIGIN` |
| OK | No `dangerouslySetInnerHTML`, `innerHTML`, `eval`. Helmet on. 10 kB body limit. Bcrypt. Hashed OTP/reset tokens | — | — | Keep |

Invalid-action matrix after migration:

| Attempt | Stopped by | Response |
|---|---|---|
| Participant removes host or another participant | `requireHost` | 403 NOT_HOST |
| Participant ends meeting | `requireHost` | 403 NOT_HOST |
| Participant asks for host token | Role computed server-side | 200, role PARTICIPANT |
| Participant edits hostId | No endpoint accepts it | 422 or ignored |
| Nonexistent meeting | `loadMeeting` | 404 |
| Join ended meeting | Status check | 410 |
| Forge LiveKit token | HMAC with secret | Refused by LiveKit |
| Expired token | `exp` check | Refused; client re-requests |
| Token for room A on room B | `roomJoin` names one room | Refused |
| Spoof identity | Set from JWT | Impossible |
| Banned user rejoins | `bannedUserIds` | 403 PARTICIPANT_BANNED |

---

## 20. Error handling

Keep the envelope `{ success, message, errors?, timestamp }` and add a machine-readable `code`.

```js
// backend/utils/ApiError.js   constructor(statusCode, message, errors = [], code = null)
// backend/utils/apiResponse.js sendError(res, statusCode, message, errors = [], code = null)
//   → { success:false, code:'MEETING_NOT_FOUND', message:'Meeting not found.', errors:[], timestamp }
// frontend/src/lib/api.ts   ApiError gains `code`; guard response.json() → ApiError('Server unavailable', status, [], 'NETWORK')
```

| Code | HTTP | When | User-facing copy |
|---|---|---|---|
| INVALID_MEETING_ID | 400 | Format fails after normalisation | That doesn't look like a meeting code. Codes look like abc-defg-hij. |
| MEETING_NOT_FOUND | 404 | No document | Meeting not found. Check the code and try again. |
| MEETING_ENDED | 410 | ENDED on token or end | This meeting has ended. |
| MEETING_LOCKED | 423 | Locked, not host | The host has locked this meeting. |
| PARTICIPANT_BANNED | 403 | In bannedUserIds | You were removed from this meeting and can't rejoin. |
| NOT_HOST | 403 | requireHost fails | Only the host can do that. |
| PARTICIPANT_NOT_FOUND | 404 | Identity not in room | That person is no longer in the meeting. |
| TRACK_NOT_FOUND | 404 | No such publication | Their microphone is already off. |
| UNAUTHORIZED | 401 | Bad JWT | Please sign in again. |
| FORBIDDEN | 403 | Generic | You don't have permission to do that. |
| VALIDATION_FAILED | 422 | express-validator | field-level messages |
| TOKEN_GENERATION_FAILED | 500 | SDK throws | We couldn't connect you. Try again in a moment. |
| ROOM_CREATION_FAILED | 502 | createRoom fails | Same |
| LIVEKIT_ERROR | 502 | RoomService fails | Same |
| RATE_LIMITED | 429 | Limiter | Too many attempts. Wait a few minutes. |
| MEDIA_PERMISSION_DENIED | client | NotAllowedError | IntelliMeet needs camera and microphone access. Allow it in your browser's site settings, then retry. |
| MEDIA_DEVICE_BUSY | client | NotReadableError | Your camera or microphone is being used by another app. |
| MEDIA_DEVICE_NOT_FOUND | client | NotFoundError | No camera or microphone was found. You can still join to listen. |
| BROWSER_UNSUPPORTED | client | No mediaDevices / RTCPeerConnection | Your browser doesn't support video calls. Use Chrome, Edge, Firefox or Safari. |
| LIVEKIT_CONNECTION_ERROR | client | room.connect rejects | Couldn't reach the meeting server. Check your connection and retry. |

---

## 21. File-by-file modification plan

### Keep unchanged

| File | Why |
|---|---|
| `backend/config/db.js` | Correct |
| `backend/middleware/authMiddleware.js` | Reused as `protect` on meeting routes |
| `backend/middleware/sanitize.js` | Works for bodies |
| `backend/utils/jwt.js` | Correct |
| `backend/models/PendingUser.js` | Correct |
| `backend/validators/authValidators.js` | `validate` helper reused |
| `frontend/src/components/ui/*`, `components/common/Logo.tsx`, `components/layout/*` | Presentation only |
| `frontend/src/layouts/*` | Cosmetic header title aside |
| `frontend/src/pages/public/*` except LandingPage | Already work |
| `frontend/src/components/auth/*`, `store/useToastStore.ts` | Fine |
| `frontend/src/pages/meeting/MeetingEndedPage.tsx` | Reused with a reason param |

### Small modifications

| File | Change |
|---|---|
| `backend/config/environment.js` | Add `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `FRONTEND_URL`, `GOOGLE_CLIENT_ID` to `REQUIRED_VARS` and exports |
| `backend/server.js` | Remove lines 112-350; mount webhook with raw body before `express.json`; mount `/api/meetings`; `app.listen` |
| `backend/routes/authRoutes.js` | Delete per-route `authLimiter` |
| `backend/middleware/rateLimiter.js` | General 600; add `tokenLimiter` 30 per 5 min per user |
| `backend/models/User.js` | Preferences field type (line 114) |
| `backend/controllers/authController.js` | Reset URL from config; `email_verified`; Mongoose save on verify; config salt rounds; generic forgot message |
| `backend/utils/ApiError.js`, `utils/apiResponse.js`, `middleware/errorHandler.js` | Carry `code` |
| `backend/package.json` | Add `livekit-server-sdk`; remove `socket.io`, `multer` |
| `frontend/src/lib/api.ts` | `meetingApi`; `code`; guard `response.json()`; logout on 401 |
| `frontend/src/store/useAuthStore.ts` | `partialize` |
| `frontend/src/App.tsx` | `/meet/:meetingId` (lobby), `/meet/:meetingId/room`; redirects for old paths; remove `/status-preview` |
| `frontend/src/pages/meeting/CreateMeetingPage.tsx` | Replace 38-70 with `meetingApi.create`; share link from origin; remove or wire the require-login switch |
| `frontend/src/pages/meeting/JoinMeetingPage.tsx` | Replace 29-41 with normalise + `meetingApi.get`; render codes |
| `frontend/src/pages/dashboard/DashboardPage.tsx`, `MyMeetingsPage.tsx` | Remove mocks/literals; `meetingApi.list`; start-instant calls create |
| `frontend/src/pages/public/LandingPage.tsx` | Type variants (`ease: 'easeInOut' as const` / `Variants`) |
| `frontend/tsconfig.json` | `strict: true`, `noUnusedLocals: true` |
| `frontend/vite.config.ts` | Optional `/api` proxy |
| `frontend/package.json` | Add `livekit-client`, `@livekit/components-react`; remove `socket.io-client`, `recharts`, unused Radix; rename from `temp-app` |

### Major refactoring

| File | Change |
|---|---|
| `frontend/src/pages/meeting/MeetingRoomPage.tsx` | ~150-line container: guards, `useLiveKitRoom`, composes `ControlBar`, `VideoGrid`, `ScreenShareStage`, `ChatPanel`, `ParticipantsPanel`, modals. Lines 82-276 and 321-447 deleted; JSX moves into components |
| `frontend/src/pages/meeting/LobbyPage.tsx` | Loads meeting via API; real title; device pickers; real meter; permission states; remembered devices; hands tracks to room |
| `frontend/src/store/useMeetingStore.ts` | Shrinks to metadata, role, chat, unread, events, timer, panel state. Delete participants, media flags, signalingLog, logSignaling, reset, toggle* |

### Remove

| File or code | Why |
|---|---|
| `frontend/src/lib/socket.ts` | No Socket.IO |
| `frontend/src/hooks/useMeetingConnection.ts` | Replaced by `useLiveKitRoom` |
| `frontend/src/pages/public/StatusPreviewPage.tsx` | Design sheet as a public route |
| `frontend/src/pages/meeting/MeetingSummaryPage.tsx` | AI, out of scope, hard-coded; unlink until AI phase |
| `server.js:112-350` | Signaling server |
| Dead code: `signalingLog`, `logSignaling`, `reset()`; `videoRef`, `activeSpeaker`, `endCallError`, `dismissEvent`; unused `useCallback`; unused icons in Login, Register, VerifyEmail, Landing, Profile | Confirmed unreferenced by grep |

### New files

| File | Purpose |
|---|---|
| `backend/models/Meeting.js` | Schema from section 17 |
| `backend/utils/meetingId.js` | generate, validate, normalise |
| `backend/services/meetingService.js` | `createMeeting`, `findByMeetingId`, `assertJoinable`, `markActive`, `endMeeting`, `banUser`, `recordJoin`, `recordLeave`, `listForUser` |
| `backend/services/livekitService.js` | `createParticipantToken`, `ensureRoom`, `removeParticipant`, `muteTrack`, `deleteRoom`, `getParticipant`. Only file touching the secret |
| `backend/controllers/meetingController.js` | Thin handlers |
| `backend/controllers/livekitWebhookController.js` | `WebhookReceiver.receive` and dispatch |
| `backend/middleware/meetingAuth.js` | `meetingIdParam`, `loadMeeting`, `requireHost` |
| `backend/routes/meetingRoutes.js`, `routes/livekitRoutes.js` | Section 18 |
| `backend/validators/meetingValidators.js` | title, mute source, locked |
| `backend/.env.example`, `frontend/.env.example` | Section 22 |
| `frontend/src/hooks/useLiveKitRoom.ts` | Owns the Room: connect, publish, RoomEvents, state, role, participants, speakers, data, cleanup |
| `frontend/src/hooks/useMediaDevices.ts` | Enumerate, persist, map permission errors |
| `frontend/src/hooks/useMeetingGuard.ts` | Load meeting by route param; used by lobby and room |
| `frontend/src/components/meeting/` `VideoGrid`, `ParticipantTile`, `ScreenShareStage`, `ControlBar`, `ChatPanel`, `ParticipantsPanel`, `HostParticipantMenu`, `LeaveMeetingModal`, `RemoveParticipantModal`, `ConnectionBanner`, `MeetingErrorScreen` | Extracted from the 1268-line page |
| `frontend/src/lib/meetingErrors.ts` | Code → copy map |
| `backend/tests/` (supertest + mongodb-memory-server) | Section 25 |

---

## 22. LiveKit integration architecture

### Environment separation

```
# backend/.env.example
LIVEKIT_URL=wss://your-project.livekit.cloud      # or ws://localhost:7880 for a local server
LIVEKIT_API_KEY=APIxxxxxxxx
LIVEKIT_API_SECRET=****                              # never leaves the backend
FRONTEND_URL=http://localhost:5173

# frontend/.env.example
VITE_API_URL=http://localhost:3001/api
VITE_GOOGLE_CLIENT_ID=...
# No VITE_LIVEKIT_* at all. The token response carries the URL.
```

Verified: no LiveKit variables exist yet, no secret anywhere in `frontend/`, and the only frontend env reads are `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID`.

### Token generation

```js
// backend/services/livekitService.js
const { AccessToken, RoomServiceClient, TrackSource } = require('livekit-server-sdk');
const config = require('../config/environment');

const roomService = new RoomServiceClient(config.LIVEKIT_URL, config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET);

async function createParticipantToken({ roomName, identity, name, role, screenShareHostOnly }) {
  const at = new AccessToken(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET, {
    identity,                       // String(user._id) — stable across refreshes
    name,                           // user.fullName — never client-supplied
    ttl: '10m',                     // only needs to outlive the connect handshake
    metadata: JSON.stringify({ role }),
  });
  const sources = [TrackSource.CAMERA, TrackSource.MICROPHONE];
  if (role === 'HOST' || !screenShareHostOnly) sources.push(TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO);
  at.addGrant({
    room: roomName, roomJoin: true,
    canPublish: true, canSubscribe: true, canPublishData: true,
    canPublishSources: sources,
    roomAdmin: false,               // host actions go through the backend
  });
  return at.toJwt();
}

async function ensureRoom(roomName) {
  return roomService.createRoom({ name: roomName, emptyTimeout: 300, maxParticipants: 50 });  // idempotent
}
async function removeParticipant(roomName, identity) { return roomService.removeParticipant(roomName, identity); }
async function muteTrack(roomName, identity, source) {
  const p = await roomService.getParticipant(roomName, identity);
  const pub = p.tracks.find(t => t.source === (source === 'camera' ? TrackSource.CAMERA : TrackSource.MICROPHONE));
  if (!pub) throw ApiError.notFound('Track not found', [], 'TRACK_NOT_FOUND');
  return roomService.mutePublishedTrack(roomName, identity, pub.sid, true);
}
async function deleteRoom(roomName) { return roomService.deleteRoom(roomName); }
```

- Token lifetime: 10 minutes; authenticates the handshake only.
- Identity: MongoDB user id string; same identity on refresh means LiveKit replaces the old session.
- Name: account full name, server-side.
- Room: `meeting.roomName`.
- Role: metadata, readable by all; authority remains the backend.
- `roomAdmin` false so a leaked token never grants kick or mute.

### Responsibilities

- **Backend:** auth, role decisions, existence/status/lock/ban checks, token minting, host actions via RoomService, webhook-driven status.
- **Frontend:** lobby devices and preview, `room.connect`, publishing, rendering from RoomEvents, chat over `publishData`, error and reconnect UX.
- **LiveKit:** presence, tracks, mute state, speakers, quality, reconnection, duplicate identity, simulcast, TURN, executing kick/mute/delete.
- **MongoDB:** meeting metadata, host, status, times, bans, settings, participant history, users.

### Chat

Recommendation: LiveKit data messages, reliable mode. `publishData` reaches everyone in order; `DataReceived` gives the sender participant so name comes from LiveKit. Late joiners see no history, like Meet. Persistence is a P3 endpoint if wanted. Existing `ChatMessage` type and panel markup carry over.

### Refresh, reconnect, multiple tabs

- **Refresh:** auth rehydrates → route mounts → `useMeetingGuard` re-validates → `useLiveKitRoom` fetches a new token → connects with the same identity → old session dropped → role from metadata.
- **Network blip:** `Reconnecting` → retries → `Reconnected`; banner. After give-up, `Disconnected` → Rejoin button.
- **Meeting ended during blip:** rejoin token returns 410 → ended screen.
- **Multiple tabs:** newest wins; old tab receives `DUPLICATE_IDENTITY` → "You joined from another tab or device."

### Browser notes

| Browser | Status | Note |
|---|---|---|
| Chrome, Edge | Full | Tab audio on share |
| Firefox | Full | No system audio on share; no `audiooutput` picker |
| Safari | Good | Call `room.startAudio()` on Join; share needs Safari 13+ |
| No `navigator.mediaDevices` | Blocked | BROWSER_UNSUPPORTED before lobby |

HTTPS or localhost is required for `getUserMedia`; the frontend needs HTTPS when demoed across devices.

---

## 23. Target architecture diagram

```
                              INTELLIMEET  (after migration)

   ┌──────────────────────────── React frontend (Vite) ────────────────────────────┐
   │  Auth pages   Dashboard   /join   /meet/:id (lobby)   /meet/:id/room           │
   │  useAuthStore     meetingApi      useMeetingGuard      useLiveKitRoom          │
   │                                   useMediaDevices      VideoGrid · ControlBar  │
   └───────────────┬──────────────────────────────────────────────┬─────────────────┘
                   │ HTTPS  Bearer JWT                            │ WSS + LiveKit token
                   │ /api/auth /api/users /api/meetings           │ (10 min, identity = userId)
                   ▼                                              ▼
   ┌──────────── Node.js + Express 5 ────────────┐      ┌──────────── LiveKit ─────────────┐
   │ protect → loadMeeting → requireHost         │      │  SFU · TURN · simulcast          │
   │ meetingController  authController           │      │  rooms · participants · tracks   │
   │ meetingService     livekitService ──────────┼─────▶│  RoomServiceClient API           │
   │ livekitWebhookController ◀──────────────────┼──────│  webhooks: participant_joined,   │
   │ ApiError codes · rate limits · validators   │      │  participant_left, room_finished │
   └───────────────┬─────────────────────────────┘      └──────┬───────────┬───────────┬──┘
                   │ Mongoose                                  │           │           │
                   ▼                                       ┌───┴───┐   ┌───┴───┐   ┌───┴───┐
   ┌──────────── MongoDB ────────────┐                     │ P1    │   │ P2    │   │ P3    │
   │ User · PendingUser · Meeting    │                     │ host  │   │       │   │ share │
   │ (hostId, status, bans, history) │                     └───────┘   └───────┘   └───────┘
   └─────────────────────────────────┘                   camera + mic up, N streams down each

   Persistent state ── MongoDB      Security and rules ── Node API      Live session ── LiveKit
```

Today's shape for comparison: React ⇄ Socket.IO (unauthenticated) ⇄ in-memory Map, and React ⇄ raw RTCPeerConnection ⇄ React via public STUN. MongoDB only knows about users.

---

## 24. Migration roadmap

| Phase | Priority | Work | Done when | Effort |
|---|---|---|---|---|
| 1 Stabilise | P0 | Fix 8 tsc errors; `strict: true`; limiter dedupe; preferences schema; reset URL from config; `email_verified`; 401 logs out store; `.env.example` files | `npm run build` passes; backend boots with required vars | 1 day |
| 2 Meeting model and ID | P0 | `Meeting.js`, `meetingId.js`, `meetingService.js`, `meetingAuth.js`, `meetingRoutes.js` (create, list, get); error codes; `meetingApi`; Create/Join pages call API; dashboard reads real data; `/meet/:id` with `useMeetingGuard` | Random code → "Meeting not found"; create returns `abc-defg-hij` in Mongo with creator as host | 2 days |
| 3 Interim socket lock-down (optional) | P0 | Only if LiveKit is >1 week away: socket auth handshake; join refuses unknown meetings; host from hostId; host checks on remove/force; whitelist toggle-media keys | Old demo not trivially exploitable | 1 day, discarded later |
| 4 LiveKit backend | P1 | LiveKit Cloud or `livekit-server --dev`; env; `livekitService.js`; token, end, remove, mute endpoints; webhook | Postman: token only for existing meetings; 403 non-host; webhook flips status | 2 days |
| 5 LiveKit frontend | P1 | `useLiveKitRoom`; room page from extracted components; tiles/grid/stage from tracks; chat over data; leave/end/kick/mute wired; ended/removed screens; delete WebRTC + Socket.IO | Three laptops on different networks with screen share; host mute/kick; refresh rejoins | 4 days |
| 6 Lobby and devices | P2 | Pickers; real meter; permission screens; remembered devices; tracks to room; Safari `startAudio` | Section 12 table passes | 2 days |
| 7 Polish | P2 | Active speaker; connection banner; participant sort; unread only when chat closed; timer from `startedAt`; phone check | Demo runs cleanly | 2 days |
| 8 Tests and cleanup | P2 | Supertest suite; Playwright smoke; dead code; unused deps; StatusPreview; README | Local CI script passes | 2 days |
| 9 Optional | P3 | Lock; remove-and-ban UI; host-only share; chat persistence; co-host | If time remains | as available |

P0 to P2 ≈ three working weeks for one developer who knows the codebase.

---

## 25. Test plan

Backend: Jest or `node --test` with supertest and mongodb-memory-server; LiveKit mocked at the `livekitService` boundary. Frontend: short Playwright script against a local LiveKit dev server.

| Area | Test | Expected |
|---|---|---|
| Auth | Valid login | 200, token, sanitised user, `lastLoginAt` updated |
| Auth | Wrong password / unknown email | 401, identical message |
| Auth | Expired JWT on `/api/meetings` | 401; frontend logs out |
| Auth | Create meeting logged out | 401; no Meeting doc |
| Auth | Verify with wrong OTP | 401; PendingUser remains |
| Auth | Google token with `email_verified:false` | 401; no link |
| Create | Authenticated create | 201; id matches pattern; CREATED; hostId = caller |
| Create | 1000 creates | All unique |
| Create | Forced duplicate key (mock) | Retry succeeds |
| Create | Title > 100 chars | 422 |
| Create | No LiveKit call | `ensureRoom` not invoked |
| Invalid ID | GET `zzz-zzzz-zzz` | 404; count unchanged; no room |
| Invalid ID | GET `random123` | 400 INVALID_MEETING_ID |
| Invalid ID | GET `ABC DEFG HIJ` for existing | 200 after normalisation |
| Invalid ID | Token for nonexistent | 404; no token; no room |
| Invalid ID | Browser to `/meet/zzz-zzzz-zzz` | Not-found screen; no LiveKit connection in network log |
| Invalid ID | Browser to `/meet/zzz-zzzz-zzz/room` | Same; room never mounts |
| Join | Participant token | 200; `video.room` = id; `sub` = user id; role PARTICIPANT; ttl 600 |
| Join | Host token | role HOST; ACTIVE; `startedAt` |
| Join | ENDED meeting | 410 |
| Join | Banned user | 403 |
| Join | Locked: participant then host | 423 then 200 |
| Join | Body with `role:'HOST'` or `identity` | Ignored |
| Host | Host removes | 200; `removeParticipant(room, identity)` |
| Host | Remove with `?ban=true` | Ban list; next token 403 |
| Host | Participant removes | 403; service not called |
| Host | Participant ends | 403; unchanged |
| Host | Host ends | 200; ENDED; `deleteRoom`; second end 410 |
| Host | Host mutes mic | `mutePublishedTrack(sid, true)` |
| Host | Mute with no mic track | 404 TRACK_NOT_FOUND |
| Webhook | `room_finished` | ENDED, EMPTY_TIMEOUT |
| Webhook | `participant_joined` new user | History entry; ACTIVE |
| Webhook | Bad signature | 401; nothing changes |
| Webhook | Unknown room | 200, ignored, logged |
| Media | Mute | Instant local; remote within 1 s |
| Media | Unmute after host mute | Allowed |
| Media | Camera off/on | Avatar then video; LED off |
| Media | Share start | Stage for others; camera tile remains |
| Media | Stop via browser bar | Stage gone; button re-enabled |
| Media | Second share during share | Disabled with message |
| Media | Deny camera in lobby | Copy shown; audio-only join allowed |
| Media | Unplug camera mid-call | Fallback or avatar; toast |
| Network | Wi-Fi off 10 s | Reconnecting → Reconnected; no duplicate tile |
| Network | Off 60 s | Disconnected screen; Rejoin works |
| Network | Refresh mid-call | Back within seconds; same role; one tile |
| Network | Second tab | First shows "joined elsewhere"; second live |
| Network | Host ends while participant offline | Rejoin → "ended" |
| Security | Fake host in localStorage/metadata | Controls may render; every REST call 403 |
| Security | DELETE participants with another user's JWT | 403 |
| Security | Fake userId in body | Ignored; no controller reads `req.body.userId` |
| Security | Token with wrong secret | Refused |
| Security | Token > 10 min | Refused; re-fetched |
| Security | Room A token on room B | Refused |
| Regression | `npm run build` both | Exit 0 |
| Regression | Preferences PATCH then GET | Persist |
| Regression | 11 logins in 15 min (prod) | 10 succeed, 11th 429 |

---

## 26. Final checklist and decisions

### Checklist

Progress log: Phases 1-5 of the roadmap were implemented on 5 September 2026 (see "Implementation status" below). Remaining items are Phase 6-7 polish plus anything that needs a live LiveKit server to verify.

- [x] Authentication secure: JWT required on every meeting route
- [x] Auth limiter applied once; general limit raised
- [x] Reset link built from FRONTEND_URL
- [x] Google email_verified enforced
- [x] Preferences persist
- [x] Frontend build passes with strict TypeScript
- [x] Meeting ID generated server-side, crypto-random, abc-defg-hij
- [x] Meeting saved in MongoDB with hostId and status
- [x] Invalid or malformed ID rejected with a code
- [x] Invalid ID cannot create a LiveKit room (the token endpoint is the only door and requires a Meeting row)
- [x] Direct URL to unknown meeting shows Not found
- [x] Host role derived from Meeting.hostId only
- [x] requireHost on end, patch, remove, mute (REST); host checks also on the socket path
- [x] LiveKit token endpoint authorises before minting
- [x] Token TTL 10 min, identity = user id, roomAdmin false
- [x] LIVEKIT_API_SECRET exists only in backend env
- [x] Frontend has no VITE_LIVEKIT_* secret (the URL arrives in the token response)
- [x] Audio publishes and mutes via SDK
- [x] Video publishes and toggles via SDK
- [x] Screen share is a separate source; camera stays
- [x] One presenter at a time enforced in UI
- [x] Participant list from LiveKit with host badge and presenting chip
- [x] Remove participant via RoomService
- [x] Remove and ban blocks rejoin
- [x] Host mute via mutePublishedTrack
- [x] Leave disconnects without ending
- [x] End meeting sets ENDED and deletes the LiveKit room
- [x] ENDED meetings refuse joins (lookup, token and socket)
- [x] Webhook signature verified; room_finished ends meeting
- [x] Refresh rejoins with same identity and role (identity = user id; role from hostId)
- [x] Reconnecting banner (Rejoin button on hard disconnect still to add)
- [x] Duplicate tab handled (LiveKit replaces the session; mesh sends `duplicate-session`)
- [ ] Device selection persisted
- [x] Permission errors have copy (lobby and in-room banner)
- [x] Safari startAudio on join (audio-unlock banner)
- [x] API errors carry stable codes
- [x] Dashboard and My Meetings read real data
- [x] Mock arrays, fake stats, StatusPreview removed
- [ ] Socket.IO and WebRTC code and deps removed (kept as a fallback until LiveKit is verified in your environment)
- [x] .env.example in both packages
- [ ] Backend test suite runs offline
- [x] README matches the shipped behaviour

### Implementation status (5 September 2026)

Done, verified by `tsc` (strict), `vite build`, and an end-to-end script against the dev database:

- Backend: `models/Meeting.js`, `utils/meetingId.js`, `services/meetingService.js`, `middleware/meetingAuth.js`, `validators/meetingValidators.js`, `controllers/meetingController.js`, `routes/meetingRoutes.js`; `server.js` socket layer now authenticates the handshake, refuses unknown meetings, derives host from the database, checks host on kick/force-mute/end, whitelists media keys, restores chat history, supports ban and duplicate-tab replacement; `ApiError`/`sendError`/`errorHandler` carry `code`; auth limiter applied once; general limit 600; `User.preferences` uses the sub-schema; verify-otp saves through Mongoose; reset URL from `FRONTEND_URL`; Google `email_verified` enforced; `.env.example`.
- Frontend: `strict: true` with zero errors; `lib/meetingId.ts`; `meetingApi` + `describeApiError` in `lib/api.ts`; socket handshake sends the JWT; `/meet/:id` (lobby validates first) and `/meet/:id/room`; Create, Join, Dashboard, My Meetings, Lobby, Ended pages rewritten on real data; room page never joins blindly; remove-and-block wired; StatusPreview route removed.

**Phases 4-5 — LiveKit (also 5 September 2026).**

- Backend: `services/livekitService.js` (the only file that touches the API secret), token endpoint `POST /api/meetings/:id/token`, host endpoints `DELETE /participants/:identity` and `POST /participants/:identity/mute`, `controllers/livekitWebhookController.js` + `routes/livekitRoutes.js` mounted with `express.raw()` before `express.json()` and outside the general limiter, `tokenLimiter` keyed by user, `deleteRoom` on end, `GET /api/health` reports `media: livekit | mesh`.
- Frontend: `lib/livekit.ts` (room options, disconnect-reason mapping, role/avatar helpers), `hooks/useLiveKitMeeting.ts` (authorise → connect → publish, with reconnect and audio-unlock state), `components/meeting/ParticipantTile.tsx`, `pages/meeting/LiveKitMeetingRoom.tsx` (grid, screen-share stage, chat over data messages, participants panel with host menu, control bar, dialogs with Escape), `pages/meeting/MeetingRoomPage.tsx` reduced to a lazy-loading router.
- Verified: tokens carry `sub` = user id, the server-derived role in metadata, `roomAdmin: false`, a 600-second TTL and the right `canPublishSources`; a participant sending `{role:'HOST'}` still gets a PARTICIPANT token; unknown and malformed codes are refused before any room is created; ended meetings return 410; banned users 403; webhook signatures verified and forged ones rejected; `room_finished` sets ENDED. Frontend `tsc --strict` clean and `vite build` splits LiveKit (589 kB) out of the main bundle (664 kB).

**Migration safety.** Both media layers ship. The room asks for a token; if the backend answers `LIVEKIT_NOT_CONFIGURED` it renders the original mesh room, so nothing breaks before credentials exist. REST host actions drive whichever layer is live. Deleting `MeshMeetingRoom.tsx`, `hooks/useMeetingConnection.ts`, `lib/socket.ts` and the Socket.IO block in `server.js` completes the migration.

**Live verification against LiveKit Cloud (5 September 2026).** Credentials were configured and the whole system was driven through a real browser with two signed-in accounts. Confirmed working end to end:

| Checked in a real browser | Result |
|---|---|
| Dashboard on real data | Zeros and a proper empty state; no mock rows |
| Create meeting | Server-issued code `ugm-esni-gzf`, host recorded |
| Lobby as host | "You are the host", real title, camera-permission fallback message |
| Lobby as the other user | "Hosted by LK Tester A" — role derived server-side |
| Join | LiveKit Cloud reported the participant with identity = MongoDB user id and signed `{"role":"HOST"}` metadata |
| Two participants | Both tiles rendered; LiveKit reported HOST and PARTICIPANT correctly |
| Chat | Delivered over LiveKit data messages; sender name taken from LiveKit, not the payload |
| Host menu | Shown only for the other participant, with mute / camera off / remove |
| Remove and block | LiveKit dropped the participant, ban persisted, their browser landed on "You were removed" |
| Rejoin after ban | Refused with "You were removed from this meeting and can't rejoin" |
| End for everyone | LiveKit room deleted, status ENDED, host redirected |
| Console errors | None in either tab |

**Two real bugs found by that run, both fixed.**

1. **Only one meeting could ever exist.** The `meetings` collection carried stale indexes from an earlier schema (`meeting_id`, `host`, `participants.user`). The worst was a non-sparse **unique** index on `meeting_id`, a field no current document has, so every document indexed as `meeting_id: null` and the second insert failed with a duplicate-key error surfaced as "Could not allocate a meeting id". Mongoose creates indexes but never drops obsolete ones. Fixed by `backend/scripts/fix-meeting-indexes.js`, which drops only indexes referencing fields the current schema does not define.

2. **Duplicate join history.** `recordJoin` did read-then-push, and Mongoose turns array mutations into `$push`, so two concurrent calls both appended the same person. React StrictMode double-invokes the join effect in development, which triggered it every time; a double-click or fast refresh would do the same in production. It inflated `participantCount` on the dashboard. Fixed with an atomic conditional update (`{'participants.userId': {$ne: id}}` + `$push`) plus a conditional `CREATED → ACTIVE` flip, and a frontend guard that de-duplicates in-flight token requests. Verified with 10 concurrent token requests producing exactly 2 history entries.

**Adversarial code audit (5 September 2026).** Because the LiveKit React layer was written in one pass, it was put through a five-dimension review (React lifecycle, SDK usage, security, state races, backend service), with every finding sent to two independent skeptics instructed to refute it. 26 findings were raised; 6 survived. Acted on as follows.

| Finding | Verdict | Action |
|---|---|---|
| `emptyTimeout` used where `departureTimeout` was meant | Confirmed against the SDK's own doc comments | **Fixed.** `emptyTimeout` is the grace *before anyone joins*; `departureTimeout` is the grace *after the last person leaves* and was unset, so it fell back to LiveKit's 20-second default. A 20-second gap where everyone reloaded would fire `room_finished` and permanently end the meeting. Now sets `departureTimeout: 300`, verified by reading the room back from LiveKit. |
| `room_finished` could end a meeting that had been re-joined | Confirmed | **Fixed.** The handler now calls `listParticipants` first and ignores the event if anyone is connected, which closes the stale-webhook race. |
| Removing someone does not invalidate their token | Confirmed | **Fixed.** LiveKit has no revocation list, so a removed user could reconnect with a cached token by driving the SDK directly. Token TTL cut from 600s to 180s, and the `participant_joined` webhook now ejects banned users on sight. |
| Any authenticated user could forge a `room_finished` webhook | **Refuted by direct test** | No change needed. Three attacks were run against the real receiver: no header, a valid participant token reused as the webhook auth, and a self-signed token with the correct body hash. All three were rejected ("authorization header is empty", "sha256 checksum of body does not match", "signature verification failed") while a genuine signature was accepted. The verifier reasoned about reachability without testing the signature check. |
| StrictMode fires two token requests, duplicating the participant row | Confirmed, and found independently by live testing | **Fixed**, see above. |
| No `requireHost` on the token route | Confirmed as described, but intentional | Any authorised user must be able to get a token; that route's gate is `assertJoinable`, not host status. |

Also fixed from the lower-severity findings: a microphone failure no longer skips the camera (separate try/catch), publishing is cancellation-guarded so the camera light goes out when someone leaves mid-connect, a failed chat send now removes the optimistic message and restores the draft instead of looking delivered, the host menu closes on Escape or an outside click, the chat panel opens scrolled to the newest message, and incoming chat is length-capped with a bounded history.

**Phases 6 and 8 (5 September 2026).**

*Lobby and devices.* `hooks/useMediaDevices.ts` enumerates cameras, microphones and speakers, remembers the choice in `localStorage`, and re-resolves when a device is unplugged so a stale id cannot throw `OverconstrainedError`. `hooks/useAudioLevel.ts` replaces the placeholder that animated random bar heights with a real meter driven by an `AnalyserNode`, so it only moves when you actually speak. Pickers appear once the browser exposes device labels, and the chosen devices are used both for the lobby preview and for the tracks published into the call. The lobby's mic and camera toggles now persist to `sessionStorage` via `lib/joinPrefs.ts`, which also fixes a privacy bug: after a refresh the in-memory store was empty, so the room published camera and microphone regardless of what the user had chosen. With nothing stored the room now joins with both **off**.

*Automated test suite.* 99 tests across 7 files, run with `npm test`. Built on Node's own runner with **no new dependencies**: the real Express app is mounted on an ephemeral port so tests exercise the whole middleware chain, LiveKit is stubbed so tests run offline and consume no quota, and fixtures are scoped by id so a shared development database stays clean. `app.js` was split out of `server.js` to make this possible, which also separates the Express app from the runtime concerns (listener, Mongo, sockets).

| File | Tests | Covers |
|---|---|---|
| `meetingId.test.js` | 25 | id generation, validation, normalisation, property tests |
| `meetings.crud.test.js` | 19 | create and list, auth, title rules, the stale-index regression |
| `meetings.lookup.test.js` | 10 | 404/400 paths, normalisation, "lookup creates nothing" |
| `meetings.token.test.js` | 13 | authorisation, role derivation, privilege-escalation attempts, concurrency |
| `meetings.host.test.js` | 14 | end, remove, ban, mute, lock, and their 403s |
| `auth.test.js` | 11 | login, enumeration resistance, route protection, preference round-trip |
| `livekit.webhook.test.js` | 8 | signature verification, stale-event race, banned-user ejection |

*Two more production bugs found by the test authors, both fixed.*

1. **A mistyped code could drop you into a stranger's meeting.** `normalizeMeetingId` ran its URL-extraction regex against every input, unanchored, so any string merely *containing* a code pattern was truncated to it: `abcd-defg-hij` silently became `bcd-defg-hij`, and `abc-defg-hijk` became `abc-defg-hij`. Two agents found this independently. Extraction is now gated on the input actually looking like a link, and a link without hyphens falls back to the last path segment. Verified across 16 cases.
2. **The NoSQL sanitiser never protected query strings.** `req.query` is a prototype getter in Express 5 that re-parses on each access, so both assigning to it and mutating what it returns were silently discarded. Confirmed by probe: `?%24ne=1` still reached the handler as `{'$ne': '1'}`. The middleware now reads the query once, strips the keys, and pins the cleaned object onto the request. Bodies and params were always fine.

*Dependency cleanup.* Removed six packages that nothing imported: `recharts`, three unused Radix packages, `@livekit/components-styles`, and `multer`.

**Audit follow-up.** The original audit workflow was cut short before every finding was adjudicated, so the untriaged ones were reviewed by hand and probed directly. Three more real defects came out of that, all fixed and covered by tests.

1. **"End for everyone" was not final.** Ending deletes the LiveKit room, but anyone still holding a token could reconnect within its lifetime and LiveKit would silently recreate the room, leaving people in a meeting that was officially over. The `participant_joined` webhook now ejects them and deletes the room again. Covered by a new test that asserts both the ejection and that the latecomer is not written into the attendance history.
2. **Errors from Mongoose carried no machine-readable code.** A cast error, duplicate key, validation failure or JWT rejection reached the client with a message but no `code`, so the frontend could not branch on them. All five transformers now emit codes, and the two JWT ones use `TOKEN_INVALID` so an expired session logs the user out while a wrong password does not.
3. **Host actions answered inconsistently for a bogus participant id.** Removing with `?ban=true` returned a 400 cast error while removing without it returned a misleading 200. A `participantIdentityParam` guard now rejects anything that is not a valid id with `400 INVALID_IDENTITY` on both routes.

**Final state.** 100 tests passing, frontend type-checks clean under `strict`, production build splits LiveKit out of the main bundle, and a live run against the configured LiveKit Cloud project confirms room options (`emptyTimeout` and `departureTimeout` both 300), a 180-second token TTL, role derivation, ban enforcement and end-for-everyone.

**Phase 7 polish (5 September 2026).** Three items completed, verified in a live LiveKit session.

- **Recovery from a dropped connection.** An unexpected disconnect used to eject the user to the "meeting ended" page, which is both wrong and alarming mid-demo, since the meeting is usually still running. `lost` is now the one disconnect reason that does not navigate away: it shows a Connection lost screen offering **Rejoin** (re-authorises and reconnects through the same token flow) or Leave. Reasons the user or host actually chose still go straight to the ended page.
- **Switching devices mid-call.** A settings control in the bar opens camera and microphone pickers backed by `room.switchActiveDevice`, so a wrong microphone can be fixed without leaving. The choice persists to the same storage the lobby uses. With no devices available it explains that rather than showing empty dropdowns.
- **Connection quality.** Replaces the old permanently-green icon with a per-participant indicator that appears **only** when quality is Poor or Lost. A badge that is always green is noise people stop reading, so it would never warn anyone.

**Verified running.** Both servers were started, an account was driven through login, dashboard, meeting creation, lobby and join, and LiveKit Cloud confirmed the live session with the correct identity and server-signed `{"role":"HOST"}` metadata. The control bar renders all seven controls including the new settings button, and the settings panel degrades gracefully where no devices are available.

---

## Whole-project error sweep (8 September 2026)

Five agents swept the project along different lenses (routes driven in a browser, dead code and facades, backend failure modes, configuration and docs, security), each verifying findings by running code rather than reading it. Every finding then went to an independent skeptic instructed to refute it. **49 raised, 20 survived.** All 20 are fixed.

### The critical one

**Any logged-in user could kill the entire backend with a single malformed socket event.** `socket.on('signal', ({ to, signal }) => …)` destructured its payload in the parameter list, so emitting `signal` with `null` or no argument threw before any guard in the body could run. Socket.IO has no try/catch around listener dispatch, so the `TypeError` reached `process.on('uncaughtException')`, which calls `process.exit(1)`. With no supervisor, the API and every live meeting stayed down until someone restarted it. Registration is public, so the only precondition was an account.

Fixed by validating instead of destructuring, and by routing every socket handler through a wrapper that catches throws and rejected promises, so no future payload can do the same. Verified by firing 30 malformed events across all nine events and confirming the server stayed up.

### Backend

| Fixed | Was |
|---|---|
| Body-parser errors return 413 / 400 with codes | Every one became a **500**. `http-errors` keeps `status` and `statusCode` non-enumerable, so the handler's `{...err}` copy lost them |
| Non-string values rejected with 422 across all auth and user routes | `{"email":["a@b.com"]}` on **login** returned a 500 from `email.toLowerCase is not a function`; arrays crashed `bcrypt` and `title.trim()`; an object title was stored as the literal `"[object Object]"` |
| `verify-otp`, `resend-otp`, `forgot-password`, `reset-password`, `google` now validated | They had **no validators at all** and took raw input straight to the controller |
| Email normalisation consistent across register and verify | `register` normalised but `verify-otp` did not, so OTP verification could never succeed for a Gmail address containing a dot or `+tag` |
| Changing the account email requires the current password | A stolen JWT alone could change the recovery address, then password-reset to it: silent, permanent account takeover |
| CORS now runs before the rate limiter | A 429 had no `Access-Control-Allow-Origin`, so the browser blocked it and the user saw "Unable to connect to server" instead of being told they were rate limited |
| `participantIdentityParam` guard | A bogus participant id gave 400 when banning but a misleading 200 when merely removing |
| `npm run dev` watches source only | `node --watch` was watching `node_modules`, causing restart storms and an eventual exit |

### Frontend

Removed rather than left as convincing fakes: the "Active Sessions" panel that showed the same invented device and location to every user; "Download my data" and "Request data deletion", which only fired a success toast; three hard-coded notifications including a meeting called "CPEC Quarterly Review" that never existed; the decorative "Remember me" checkbox; and the dead "Change Avatar" button. The `/meeting/summary/:id` route is now unrouted, since it still served an invented transcript and action items.

Made real: Settings now saves the display name **to the server** (it previously reported success, wrote only to local state, and reverted on next login); the contact form composes a real email instead of silently discarding the message; `ScrollToTop` scrolls `#root`, the element that actually scrolls, so long pages no longer open halfway down; and the legal pages carry a fixed date instead of `new Date()`, which made them claim to have been revised today, every day.

### Documentation

The README described the peer-to-peer mesh as the architecture when LiveKit is the default path, listed `recharts` and `Multer` in the stack after both were removed, and called lobby device pickers and the Rejoin flow "not yet built" when both ship.

### Verification

108 tests passing (8 new, covering every crash above), frontend type-checks clean under `strict`, production build splits LiveKit out of the main bundle, 9 of 9 backend error-path probes return the right status and code, and every frontend change was confirmed in the running app.

**Still open:** camera and microphone capture has no end-to-end verification, because the automated browser blocks device access. That path needs one manual call on a machine with a webcam. The legacy mesh (`MeshMeetingRoom.tsx`, `useMeetingConnection.ts`, `lib/socket.ts`, and the Socket.IO block in `server.js`) is still present as a fallback; now that LiveKit is verified in this environment it can be deleted, which would also drop the `socket.io` and `socket.io-client` dependencies.

### Decisions

1. **Replace custom WebRTC with LiveKit?** Yes. The mesh cannot pass four participants or a campus NAT; every host control is a one-line RoomService call; the migration deletes the insecure signaling server.
2. **What remains?** The UI: tile markup, grid rules, control bar, chat and participant panels, modals, ended page, lobby preview concept. Moved into components and fed from LiveKit hooks.
3. **What is removed?** `MeetingRoomPage.tsx:82-276` and `:321-447`, `useMeetingConnection.ts`, `lib/socket.ts`, `server.js:112-350`, the store's participants and media flags, both socket.io packages.
4. **Create in MongoDB before the LiveKit room exists?** Yes, always. Creation is a database write with no external dependency.
5. **Auto-create the LiveKit room on first valid participant?** Yes, gated by the token endpoint. Call `createRoom` idempotently at first token issue only to set `emptyTimeout` and `maxParticipants`.
6. **Prevent random IDs creating rooms?** Only the backend can mint a token, and it refuses unless `Meeting.findOne({ meetingId })` succeeds and status is not ENDED. Frontend validation is UX, not security.
7. **Only authenticated users create meetings?** Yes.
8. **Unauthenticated join?** Not in this phase. Guest join is a P3 extension with `guest-<random>` identities when the host enables it.
9. **Best ID format?** Ten crypto-random lowercase letters as `abc-defg-hij`, unique index, normalised input, authenticated rate-limited lookup.
10. **Where are host permissions stored?** `Meeting.hostId`, projected into token metadata for display, re-checked by `requireHost` on every privileged call.
11. **Secure token generation?** Only in `backend/services/livekitService.js` with `livekit-server-sdk` and the backend secret, after `protect`, `loadMeeting`, ban and status checks. 10-minute TTL, one room, `roomAdmin` false, identity and name server-side.
12. **Realistic host controls?** Essential: remove, mute mic, end. Recommended: camera off, remove-and-block. Optional: lock, host-only share. Skip: waiting room, co-host, per-participant permission editing.
13. **State model?** CREATED → ACTIVE → ENDED with `endedReason`. SCHEDULED only when scheduling has real UI.
14. **Chat transport?** LiveKit data messages, reliable mode. Persistence later via a separate endpoint if wanted.
15. **Minimum before the AI module?** Phases 1-5: passing build, Meeting model and validated IDs, secure token endpoint, LiveKit room with audio, video, screen share, participant list, host mute, remove, end, leave, refresh and reconnect. The translation pipeline needs a server-side participant subscribing to audio, which only exists once media flows through LiveKit.

---

## Mobile responsiveness pass (8 September 2026)

The app was built desktop-first and had never been opened at phone width. At
375×812 no page scrolled sideways, so nothing looked broken from the outside,
but two screens were unusable: the dashboard rendered its 260px sidebar as a
permanent fixed column, leaving content in a sliver that wrapped one word per
line, and the meeting room printed its call timer on top of the meeting code
while a 320px chat panel left roughly 55px of width for video.

Scope was every route the marker can reach. Desktop had to stay pixel-identical,
so every change is mobile-first base classes with `sm:` / `md:` / `lg:` variants
restoring the previous values — no existing desktop class was edited in place.

### What changed

| Area | Problem at 375px | Fix |
|---|---|---|
| `layouts/DashboardLayout.tsx` | Fixed 260px sidebar crushed all content | Slide-in drawer with backdrop + hamburger, `lg:static` restores the desktop column; closes on route change |
| `layouts/DashboardLayout.tsx` | Header read "Dashboard" on every page | Title derived from the route via longest-prefix match on `navItems` |
| `pages/meeting/LiveKitMeetingRoom.tsx` | Three header groups overlapped; timer sat on the meeting code | Each group `flex-1 min-w-0` with truncation; logo, divider and code hidden below `sm:` |
| `pages/meeting/LiveKitMeetingRoom.tsx` | 320px sidebar left ~55px for video | Sidebar is a full-width overlay below `sm:`, `sm:static sm:w-80` above |
| `pages/meeting/LiveKitMeetingRoom.tsx` | Control bar clipped the Leave button | `h-16 gap-1.5 px-2` with 44px controls; Leave label hidden below `sm:` |
| `pages/meeting/LiveKitMeetingRoom.tsx` | Overlay sidebar opened by default, so joining a call showed an empty chat instead of the video | `sidebar` initial state reads `matchMedia("(min-width: 640px)")` |
| `pages/meeting/MeshMeetingRoom.tsx` | `grid-cols-3` header collision; control bar overflowed ~421px into 375px; sidebar buried the control bar; host controls were hover-only and unreachable on touch | Flex header, narrower controls (~321px), `bottom-[86px] md:bottom-auto`, `hidden max-md:flex group-hover:flex`, drawer defaults closed below `md:` |
| `pages/public/VerifyEmailPage.tsx` | Six fixed-width OTP boxes needed 328px inside 311px of usable width | `flex-1 min-w-0 max-w-[48px]` |
| `pages/meeting/LobbyPage.tsx` | "Camera unavailable" ran underneath the mic/camera toggles | Placeholder avatar `h-16 sm:h-24`, `pb-14 sm:pb-0` lifts the label clear |

The remaining pages — landing, the five auth screens, contact/privacy/terms/404,
dashboard and my-meetings, profile and settings, create/join/ended — needed
padding, type-scale and grid-collapse work rather than structural change. That
was done by seven agents with disjoint file ownership so no two could touch the
same file.

### Verification

- `npx tsc --noEmit` — 0 errors. `npm run build` — succeeds; bundle sizes
  unchanged (`index` 666kB, `LiveKitMeetingRoom` 595kB), so no import crept
  across a chunk boundary.
- `npm test` (backend) — 108/108 pass; no backend file was touched.
- All 16 reachable routes measured at 375×812 by comparing
  `documentElement.scrollWidth` against `clientWidth`: every one reports 375 vs
  375, i.e. no horizontal scroll anywhere. The Settings tab strip does extend
  past the viewport, but inside its own `overflow-x-auto` container, which is
  deliberate.
- Meeting room joined at 375px: lands on video, all seven controls 44px and
  within bounds, chat and people overlays open and close, no overflow.
- Re-measured at 1440×900 and 768×1024. Desktop is unchanged — dashboard
  sidebar `static` at 260px with the hamburger hidden, meeting sidebar `static`
  at x=1121 w=319 with chat open on join, login showcase panel still rendered,
  profile still a two-column grid.

### Known limitation

Device capture is blocked in the automated browser, so tiles were verified with
the camera-off placeholder rather than live video. The video element itself is
`object-cover` inside the same aspect-ratio box at every width, so the grid
geometry is exercised either way, but a real handset check is still worth doing
before the demo.
