import mongoose from 'mongoose';

/**
 * Connect to MongoDB with enterprise connection management
 */
export async function connectDB() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/flow_wallet_db';

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true,
    });

    console.log(`🍃 [wallet-service] MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    console.error('❌ [wallet-service] MongoDB Connection Error:', error.message);
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ [wallet-service] MongoDB disconnected. Waiting for reconnect...');
  });

  mongoose.connection.on('error', (err) => {
    console.error('❌ [wallet-service] MongoDB runtime error:', err);
  });
}

export default connectDB;
