/**
 * ============================================================
 * Migration: drop stale indexes on the `meetings` collection
 * ============================================================
 * Run with:  node scripts/fix-meeting-indexes.js
 *
 * WHY THIS EXISTS
 * ---------------
 * An earlier version of the Meeting schema used snake_case field names
 * (`meeting_id`, `host`, `participants.user`). Mongoose creates indexes
 * automatically but NEVER drops ones it no longer needs, so those indexes
 * survived the rename to `meetingId` / `hostId` / `participants.userId`.
 *
 * One of them is actively fatal:
 *
 *   meeting_id_1  { meeting_id: 1 }  unique: true, sparse: false
 *
 * No current document has a `meeting_id` field, so every document indexes
 * as `meeting_id: null`. A non-sparse unique index treats those as equal,
 * which means the collection can hold EXACTLY ONE meeting. Creating a
 * second one fails with:
 *
 *   E11000 duplicate key error ... index: meeting_id_1 dup key: { meeting_id: null }
 *
 * which surfaces to the user as "Could not allocate a meeting id".
 *
 * This script drops only indexes that reference fields the current schema
 * does not define. It never touches data and never drops `_id_`.
 * ============================================================
 */

const mongoose = require('mongoose');
const config = require('../config/environment');

/** Indexes belonging to the obsolete schema. Safe to drop. */
const STALE_INDEXES = [
  'meeting_id_1',
  'host_1',
  'host_1_status_1_scheduledFor_-1',
  'participants.user_1_createdAt_-1',
];

const run = async () => {
  await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  const collection = mongoose.connection.db.collection('meetings');

  const before = await collection.indexes();
  console.log('Indexes before:');
  before.forEach((i) => console.log(`  ${i.name}${i.unique ? '  (unique)' : ''}`));

  let dropped = 0;
  for (const name of STALE_INDEXES) {
    if (!before.some((i) => i.name === name)) continue;
    try {
      await collection.dropIndex(name);
      console.log(`  dropped ${name}`);
      dropped += 1;
    } catch (err) {
      console.warn(`  could not drop ${name}: ${err.message}`);
    }
  }

  const after = await collection.indexes();
  console.log(`\nDropped ${dropped} stale index(es). Indexes now:`);
  after.forEach((i) => console.log(`  ${i.name}${i.unique ? '  (unique)' : ''}`));

  await mongoose.disconnect();
  console.log('\nDone. Creating more than one meeting will now work.');
};

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exitCode = 1;
});
