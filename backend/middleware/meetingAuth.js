/**
 * ============================================================
 * Meeting Authorisation Middleware
 * ============================================================
 *  meetingIdParam — normalise + validate :meetingId, 400 if malformed
 *  loadMeeting    — attach req.meeting, 404 if absent
 *  requireHost    — 403 unless req.user is the meeting's host
 *
 * All three assume `protect` has already run and set req.user.
 * ============================================================
 */

const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const { normalizeMeetingId } = require('../utils/meetingId');
const meetingService = require('../services/meetingService');

const meetingIdParam = (req, _res, next) => {
  const normalized = normalizeMeetingId(req.params.meetingId);
  if (!normalized) {
    return next(
      ApiError.of(400, 'INVALID_MEETING_ID', "That doesn't look like a meeting code. Codes look like abc-defg-hij.")
    );
  }
  req.params.meetingId = normalized;
  next();
};

const loadMeeting = async (req, _res, next) => {
  try {
    const meeting = await meetingService.findByMeetingId(req.params.meetingId);
    if (!meeting) {
      throw ApiError.of(404, 'MEETING_NOT_FOUND', 'Meeting not found. Check the code and try again.');
    }
    req.meeting = meeting;
    next();
  } catch (err) {
    next(err);
  }
};

const requireHost = (req, _res, next) => {
  if (!req.meeting || !req.user || !req.meeting.isHostUser(req.user._id)) {
    return next(ApiError.of(403, 'NOT_HOST', 'Only the host can do that.'));
  }
  next();
};

/**
 * Validate the :identity path parameter on host actions.
 *
 * A participant's LiveKit identity is always the user's MongoDB id, because
 * the token endpoint sets it. Checking that here keeps the behaviour
 * consistent: without it, a nonsense identity produced a 400 cast error when
 * banning (which writes to an ObjectId array) but a misleading 200 when
 * merely removing.
 */
const participantIdentityParam = (req, _res, next) => {
  const { identity } = req.params;
  if (!mongoose.Types.ObjectId.isValid(identity)) {
    return next(ApiError.of(400, 'INVALID_IDENTITY', 'That is not a valid participant.'));
  }
  next();
};

module.exports = { meetingIdParam, loadMeeting, requireHost, participantIdentityParam };
