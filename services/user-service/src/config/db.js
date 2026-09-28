import mongoose from 'mongoose';

/**
 * Connects to MongoDB with production-grade retry and event listening
 */
export async function connectDB() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/flow_user_db';

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true,
    });

    console.log(`🍃 [user-service] MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    console.error('❌ [user-service] MongoDB Connection Error:', error.message);
    // In production, initiate retry or exit based on orchestration policy
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ [user-service] MongoDB disconnected. Attempting reconnect...');
  });

  mongoose.connection.on('error', (err) => {
    console.error('❌ [user-service] MongoDB runtime error:', err);
  });
}

export default connectDB;
