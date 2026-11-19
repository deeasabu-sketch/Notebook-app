
require("dotenv").config();

const mongoose = require("mongoose");
const User = require("./models/User");

async function createAdmin() {
    try {
        const email = process.env.ADMIN_EMAIL?.trim();
        const password = process.env.ADMIN_PASSWORD;

        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI missing in .env");
        }

        if (!email || !password || password.length < 12) {
            throw new Error("Valid admin credentials required in .env");
        }

        await mongoose.connect(process.env.MONGO_URI);

        const existing = await User.findOne({
            email: email.toLowerCase()
        });

        if (existing) {
            console.log("This email already exists:", email);
            return;
        }

        await User.create({
            name: "System Administrator",
            email,
            password,
            role: "admin"
        });

        console.log("Admin created successfully!");
        console.log("Admin Email:", email);

    } catch (error) {
        console.error("Admin creation failed:", error.message);
        process.exitCode = 1;

    } finally {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    }
}

createAdmin();
