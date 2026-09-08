/**
 * ============================================================
 * AI request validators
 * ============================================================
 * Mirrors the defensive style of authValidators.js: `isString` runs FIRST, so
 * a non-string body (an array, an object, a number) is rejected as a 400
 * rather than reaching a sanitiser that assumes it has a string.
 * ============================================================
 */

const { body } = require('express-validator');
const { validate } = require('./authValidators');
const { SUPPORTED_CODES } = require('../config/languages');
const { MAX_INPUT_CHARS } = require('../services/translationService');

/** Reject non-strings before any sanitiser touches the value. */
const mustBeText = (field, label) =>
  body(field)
    .isString()
    .withMessage(`${label} must be text`)
    .bail()
    .trim();

const translateValidation = [
  mustBeText('text', 'Text')
    .notEmpty()
    .withMessage('There is no text to translate')
    .bail()
    .isLength({ max: MAX_INPUT_CHARS })
    .withMessage(`Text must be ${MAX_INPUT_CHARS} characters or fewer`),

  mustBeText('sourceLanguage', 'Source language')
    .isIn(SUPPORTED_CODES)
    .withMessage('That source language is not supported'),

  mustBeText('targetLanguage', 'Target language')
    .isIn(SUPPORTED_CODES)
    .withMessage('That target language is not supported'),

  validate,
];

module.exports = { translateValidation };
