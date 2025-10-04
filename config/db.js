// ./config/db.js (Updated to remove deprecated options)
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Mongoose 6+ and newer drivers handle these options automatically.
        // We now just pass the URI.
        const conn = await mongoose.connect(process.env.MONGO_URI); 

        // The console log below is what you are seeing in your output
        console.log(`MongoDB Connected: ${conn.connection.host}`); 
    } catch (error) {
        // Adding robust error handling for connection failure
        console.error(`❌ Database connection error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;