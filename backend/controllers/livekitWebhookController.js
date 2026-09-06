/**
 * ============================================================
 * LiveKit Webhook Controller
 * ============================================================
 * LiveKit calls this endpoint to report room and participant
 * lifecycle events. The request is authenticated by a signature
 * over the RAW body, so this route must be mounted with
 * `express.raw()` BEFORE `express.json()`.
 *
 * Events we act on:
 *   participant_joined → history + CREATED → ACTIVE
 *   participant_left   → history (lastLeftAt)
 *   room_finished      → ACTIVE → ENDED (EMPTY_TIMEOUT)
 *
 * Everything else is acknowledged and ignored. We always answer 200
 * for events we cannot act on, so LiveKit does not retry forever.
 * ============================================================
 */

const meetingService = require('../services/meetingService');
const livekitService = require('../services/livekitService');
const User = require('../models/User');

const handleWebhook = async (req, res) => {
  const receiver = livekitService.webhookReceiver();
  if (!receiver) {
    // LiveKit is not configured — nothing legitimate can be calling us.
    return res.status(503).json({ success: false, code: 'LIVEKIT_NOT_CONFIGURED' });
  }

  let event;
  try {
    // req.body is a Buffer thanks to express.raw()
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');
    event = await receiver.receive(raw, req.get('Authorization'));
  } catch (err) {
    console.warn('[LiveKit webhook] signature verification failed:', err?.message || err);
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
  }

  try {
    const roomName = event.room?.name;
    if (!roomName) return res.status(200).json({ success: true });

    const meeting = await meetingService.findByMeetingId(roomName);
    if (!meeting) {
      console.warn(`[LiveKit webhook] ${event.event} for unknown room ${roomName}`);
      return res.status(200).json({ success: true });
    }

    switch (event.event) {
      case 'participant_joined': {
        const identity = event.participant?.identity;
        if (!identity) break;

        // "End for everyone" deletes the room, but anyone still holding a
        // valid token can reconnect and LiveKit will silently recreate it,
        // leaving people in a meeting that is officially over. Close it again.
        if (meeting.status === 'ENDED') {
          console.warn(`[LiveKit webhook] ${identity} joined ENDED meeting ${roomName} — closing the room`);
          await livekitService.removeParticipant(meeting.roomName, identity).catch(() => {});
          await livekitService.deleteRoom(meeting.roomName).catch(() => {});
          break;
        }

        // Defence in depth. Removing someone disconnects them but does not
        // invalidate the token they already hold, and LiveKit has no
        // revocation list. If a banned user reconnects with a cached token,
        // bypassing our API entirely, eject them again here.
        if (meeting.isBanned(identity)) {
          console.warn(`[LiveKit webhook] banned user ${identity} reconnected to ${roomName} — removing`);
          await livekitService.removeParticipant(meeting.roomName, identity).catch((err) => {
            console.error('[LiveKit webhook] could not eject banned user:', err.message);
          });
          break;
        }

        // `identity` is our own user id, but it arrives over the network, so
        // an invalid ObjectId must not throw.
        const user = await User.findById(identity).catch(() => null);
        if (user) await meetingService.recordJoin(meeting, user);
        else await meetingService.markActive(meeting);
        break;
      }

      case 'participant_left': {
        const identity = event.participant?.identity;
        if (identity) await meetingService.recordLeave(meeting, identity);
        break;
      }

      case 'room_finished': {
        // The room closed: either the host ended it (we already set ENDED,
        // so this is a no-op) or it sat empty past departureTimeout.
        //
        // Guard against a stale event. Webhooks can arrive late, and by then
        // someone may have re-joined and LiveKit may have created a fresh
        // room under the same name. Ending the meeting on that stale event
        // would kick out people who are actively in the call.
        const live = await livekitService.listParticipants(roomName);
        if (live.length > 0) {
          console.log(
            `[LiveKit webhook] ignoring stale room_finished for ${roomName}: ${live.length} participant(s) currently connected`
          );
          break;
        }
        await meetingService.endMeeting(meeting, 'EMPTY_TIMEOUT');
        break;
      }

      default:
        break;
    }
  } catch (err) {
    // Never fail the webhook on our own bookkeeping errors — LiveKit would
    // retry, and the media session is unaffected either way.
    console.error('[LiveKit webhook] handler error:', err?.message || err);
  }

  return res.status(200).json({ success: true });
};

module.exports = { handleWebhook };
