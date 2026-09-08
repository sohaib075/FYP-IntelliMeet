require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function seedUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const usersToCreate = [
      {
        fullName: 'Test User A',
        email: 'testa@intellimeet.local',
        password: 'Password123!',
      },
      {
        fullName: 'Test User B',
        email: 'testb@intellimeet.local',
        password: 'Password123!',
      },
      {
        fullName: 'Test User C',
        email: 'testc@intellimeet.local',
        password: 'Password123!',
      }
    ];

    for (const u of usersToCreate) {
      let existingUser = await User.findOne({ email: u.email });
      if (!existingUser) {
        await User.create(u);
        console.log(`Created user: ${u.email}`);
      } else {
        console.log(`User already exists: ${u.email}`);
      }
    }

    console.log('Done.');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding users:', error);
    process.exit(1);
  }
}

seedUsers();
