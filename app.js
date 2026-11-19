
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const noteRoutes = require("./routes/noteRoutes");
const adminRoutes = require("./routes/adminRoutes");
const aggregationRoutes = require("./routes/aggregationRoutes");
const postRoutes = require("./routes/postRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API requests connect lazily. This lets Vercel reuse one Mongoose connection
// across invocations and keeps the function process alive if MongoDB is down.
app.use("/api", async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (error) {
        console.error("MongoDB unavailable");
        res.status(503).json({ success: false, message: "Database temporarily unavailable" });
    }
});

// Vercel serves files in public/ from its CDN. This static middleware also
// serves those same files when running the app locally.
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "index.html"));
});
app.use(express.static(path.join(__dirname, "frontend")));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/notes", noteRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/aggregation", aggregationRoutes);
app.use("/api/posts", postRoutes);

app.use("/api", (req, res) => {
    res.status(404).json({ success: false, message: "API route not found" });
});

app.use((error, req, res, next) => {
    console.error("Unhandled request error");
    if (res.headersSent) return next(error);
    res.status(error.status || 500).json({ success: false, message: "Internal server error" });
});

// Server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Server startup failed");
        process.exitCode = 1;
    }
};

// Vercel imports the Express app as a function. Only start a listening server
// when this file is launched directly with `node app.js`.
if (require.main === module) startServer();

module.exports = app;
