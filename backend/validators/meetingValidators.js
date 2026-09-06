/**
 * ============================================================
 * Meeting Validators
 * ============================================================
 */

const { body, query } = require('express-validator');
const { validate } = require('./authValidators');

const createMeetingValidation = [
  body('title')
    .optional({ values: 'falsy' })
    // isString() must come BEFORE trim(). Without it express-validator coerces:
    // an object title became the literal string "[object Object]", and an array
    // title reached the controller intact and crashed it on title.trim().
    .isString()
    .withMessage('Title must be text')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters'),

  body('scheduledFor')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('scheduledFor must be an ISO-8601 date')
    .toDate(),

  validate,
];

const updateMeetingValidation = [
  body('title')
    .optional()
    .isString()
    .withMessage('Title must be text')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters'),

  body('locked').optional().isBoolean().withMessage('locked must be a boolean').toBoolean(),

  validate,
];

const muteValidation = [
  body('source')
    .optional()
    .isIn(['microphone', 'camera'])
    .withMessage("source must be 'microphone' or 'camera'"),

  validate,
];

const listMeetingsValidation = [
  query('status')
    .optional()
    .isIn(['CREATED', 'ACTIVE', 'ENDED'])
    .withMessage('status must be CREATED, ACTIVE or ENDED'),

  validate,
];

module.exports = {
  createMeetingValidation,
  updateMeetingValidation,
  listMeetingsValidation,
  muteValidation,
};
