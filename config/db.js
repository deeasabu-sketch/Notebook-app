
const mongoose = require("mongoose");

let connectionPromise;

const connectDB = async () => {
    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI is not configured");
    }

    const state = mongoose.connection.readyState;
    if (state === 1) return mongoose.connection;
    if (state === 2 && connectionPromise) return connectionPromise;
    if (state !== 2) connectionPromise = null;

    if (!connectionPromise) {
        connectionPromise = mongoose.connect(process.env.MONGO_URI)
            .then(() => {
                console.log("MongoDB connected");
                return mongoose.connection;
            })
            .catch((error) => {
                connectionPromise = null;
                throw error;
            });
    }

    return connectionPromise;
};

module.exports = connectDB;
