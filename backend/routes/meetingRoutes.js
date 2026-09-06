/**
 * ============================================================
 * Meeting Routes
 * ============================================================
 * All routes require a valid JWT.
 *
 * POST   /api/meetings                                       — create (caller becomes host)
 * GET    /api/meetings                                       — list the caller's meetings
 * GET    /api/meetings/:meetingId                            — validate / look up (never creates)
 * POST   /api/meetings/:meetingId/token                      — authorise + mint a LiveKit token
 * PATCH  /api/meetings/:meetingId                            — host: rename or lock
 * POST   /api/meetings/:meetingId/end                        — host: end for everyone
 * DELETE /api/meetings/:meetingId/participants/:identity     — host: remove (optionally ban)
 * POST   /api/meetings/:meetingId/participants/:identity/mute— host: server-side mute
 * ============================================================
 */

const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/authMiddleware');
const {
  meetingIdParam,
  loadMeeting,
  requireHost,
  participantIdentityParam,
} = require('../middleware/meetingAuth');
const { tokenLimiter } = require('../middleware/rateLimiter');
const {
  createMeetingValidation,
  updateMeetingValidation,
  listMeetingsValidation,
  muteValidation,
} = require('../validators/meetingValidators');
const {
  createMeeting,
  listMyMeetings,
  getMeeting,
  updateMeeting,
  endMeeting,
  issueToken,
  removeParticipant,
  muteParticipant,
} = require('../controllers/meetingController');

router.use(protect);

router.post('/', createMeetingValidation, createMeeting);
router.get('/', listMeetingsValidation, listMyMeetings);

router.get('/:meetingId', meetingIdParam, loadMeeting, getMeeting);

router.post('/:meetingId/token', tokenLimiter, meetingIdParam, loadMeeting, issueToken);

router.patch('/:meetingId', meetingIdParam, loadMeeting, requireHost, updateMeetingValidation, updateMeeting);
router.post('/:meetingId/end', meetingIdParam, loadMeeting, requireHost, endMeeting);

router.delete(
  '/:meetingId/participants/:identity',
  meetingIdParam,
  participantIdentityParam,
  loadMeeting,
  requireHost,
  removeParticipant
);
router.post(
  '/:meetingId/participants/:identity/mute',
  meetingIdParam,
  participantIdentityParam,
  loadMeeting,
  requireHost,
  muteValidation,
  muteParticipant
);

module.exports = router;
