
const User = require("../models/User");
const jwt = require("jsonwebtoken");

const generateToken = (user) => {
    return jwt.sign(
        {
            id: user._id,
            role: user.role
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || "1d"
        }
    );
};

// REGISTER
exports.register = async (req, res) => {
    try {
        const { name, email, password, interests } = req.body;

        if (typeof name !== "string" || !name.trim() || typeof email !== "string" || !email.trim() || typeof password !== "string") {
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters"
            });
        }

        if (interests !== undefined && (!Array.isArray(interests) || !interests.every(value => typeof value === "string"))) {
            return res.status(400).json({ success: false, message: "Interests must be an array of strings" });
        }

        const existingUser = await User.findOne({
            email: email.toLowerCase().trim()
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email already registered"
            });
        }

        // Never accept role from public registration
        const user = await User.create({
            name,
            email,
            password,
            interests: interests ? interests.map(value => value.trim()).filter(Boolean) : [],
            role: "user"
        });

        const token = generateToken(user);

        return res.status(201).json({
            success: true,
            message: "Registration successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Email already registered"
            });
        }

        console.error("Registration failed:", error);
        return res.status(error.name === "ValidationError" ? 400 : 500).json({
            success: false,
            message: error.name === "ValidationError" ? error.message : "Registration failed"
        });
    }
};

// LOGIN
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const user = await User.findOne({
            email: email.toLowerCase().trim()
        }).select("+password");

        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const token = generateToken(user);

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Login failed:", error);
        return res.status(500).json({
            success: false,
            message: "Login failed"
        });
    }
};
