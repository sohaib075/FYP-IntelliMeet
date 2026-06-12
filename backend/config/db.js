/**
 * ============================================================
 * Database Connection
 * ============================================================
 * Establishes a MongoDB connection via Mongoose with:
 *  - Retry logic on initial connection failure
 *  - Event listeners for runtime errors & disconnections
 *  - Graceful shutdown on SIGINT / SIGTERM
 * ============================================================
 */

const mongoose = require('mongoose');
const config = require('./environment');

/** Maximum number of connection attempts before giving up */
const MAX_RETRIES = 5;

/** Delay between retries in milliseconds */
const RETRY_DELAY_MS = 5000;

/**
 * Connect to MongoDB with automatic retries.
 * @returns {Promise<void>}
 */
const connectDB = async () => {
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      await mongoose.connect(config.MONGODB_URI, {
        // Mongoose 7+ uses these by default, listed for clarity
        autoIndex: config.NODE_ENV !== 'production', // Disable auto-index in prod for performance
      });

      console.log(
        `✅  MongoDB connected — host: ${mongoose.connection.host}, db: ${mongoose.connection.name}`
      );
      return; // Success — exit the retry loop
    } catch (err) {
      retries += 1;
      console.error(
        `❌  MongoDB connection attempt ${retries}/${MAX_RETRIES} failed: ${err.message}`
      );

      if (retries >= MAX_RETRIES) {
        console.error('❌  Could not connect to MongoDB. Exiting.');
        process.exit(1);
      }

      console.log(`   ↻  Retrying in ${RETRY_DELAY_MS / 1000}s…`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
};

// ---- Runtime event listeners ----

mongoose.connection.on('error', (err) => {
  console.error(`❌  MongoDB runtime error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅  MongoDB reconnected');
});

// ---- Graceful shutdown ----

const gracefulShutdown = async (signal) => {
  console.log(`\n🛑  ${signal} received — closing MongoDB connection…`);
  await mongoose.connection.close();
  console.log('   MongoDB connection closed.');
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = connectDB;
