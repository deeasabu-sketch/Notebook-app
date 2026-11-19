
const mongoose = require("mongoose");
const User = require("../models/User");
const Note = require("../models/Note");
const Post = require("../models/Post");

// GET ALL USERS
exports.getAllUsers = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;

        const [users, total] = await Promise.all([
            User.find()
                .select("-password")
                .sort({ createdAt: -1, _id: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),

            User.countDocuments()
        ]);

        res.status(200).json({
            success: true,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            },
            data: users
        });

    } catch (error) {
        console.error("List users failed:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve users"
        });
    }
};

// CREATE USER
exports.createUser = async (req, res) => {
    try {
        const { name, email, password, role, interests } = req.body;

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

        if (role && !["user", "admin"].includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Invalid role"
            });
        }

        if (interests !== undefined && (!Array.isArray(interests) || !interests.every(value => typeof value === "string"))) {
            return res.status(400).json({ success: false, message: "Interests must be an array of strings" });
        }

        const user = await User.create({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password,
            role: role || "user",
            interests: interests ? interests.map(value => value.trim()).filter(Boolean) : []
        });

        res.status(201).json({
            success: true,
            message: "User created successfully",
            data: {
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
                message: "Email already exists"
            });
        }

        console.error("Create user failed:", error);
        res.status(error.name === "ValidationError" ? 400 : 500).json({
            success: false,
            message: error.name === "ValidationError" ? error.message : "Failed to create user"
        });
    }
};

// UPDATE USER
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, role, interests } = req.body;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID"
            });
        }

        if (id === req.user._id.toString() && role && role !== "admin") {
            return res.status(400).json({
                success: false,
                message: "You cannot remove your own admin role"
            });
        }

        if (role === "user") {
            const target = await User.findById(id).select("role").lean();
            if (target?.role === "admin") {
                const admins = await User.countDocuments({ role: "admin" });
                if (admins <= 1) {
                    return res.status(400).json({ success: false, message: "Cannot demote the last admin" });
                }
            }
        }

        const updateData = {};

        if (name !== undefined) {
            if (typeof name !== "string" || !name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid name"
                });
            }
            updateData.name = name.trim();
        }

        if (email !== undefined) {
            if (typeof email !== "string" || !email.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid email"
                });
            }
            updateData.email = email.trim().toLowerCase();
        }

        if (role !== undefined) {
            if (!["user", "admin"].includes(role)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid role"
                });
            }
            updateData.role = role;
        }

        if (interests !== undefined) {
            if (!Array.isArray(interests) ||
                !interests.every(x => typeof x === "string")) {
                return res.status(400).json({
                    success: false,
                    message: "Interests must be an array of strings"
                });
            }
            updateData.interests = interests;
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid fields provided"
            });
        }

        const user = await User.findByIdAndUpdate(
            id,
            { $set: updateData },
            { returnDocument: "after", runValidators: true }
        ).select("-password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "User updated successfully",
            data: user
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Email already exists"
            });
        }

        console.error("Update user failed:", error);
        res.status(error.name === "ValidationError" ? 400 : 500).json({
            success: false,
            message: error.name === "ValidationError" ? error.message : "Failed to update user"
        });
    }
};

// DELETE USER
exports.deleteUser = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID"
            });
        }

        if (id === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: "You cannot delete your own account"
            });
        }

        let deleted = false;

        await session.withTransaction(async () => {
            const user = await User.findById(id).session(session);

            if (!user) return;

            if (user.role === "admin") {
                const adminCount = await User.countDocuments({
                    role: "admin"
                }).session(session);

                if (adminCount <= 1) {
                    throw new Error("LAST_ADMIN");
                }
            }

            await Note.deleteMany({ userId: id }, { session });
            await Post.deleteMany({ userId: id }, { session });
            await User.deleteOne({ _id: id }, { session });

            deleted = true;
        });

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "User and related data deleted successfully"
        });

    } catch (error) {
        if (error.message === "LAST_ADMIN") {
            return res.status(400).json({
                success: false,
                message: "Cannot delete the last admin"
            });
        }

        console.error("Delete user failed:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete user"
        });

    } finally {
        await session.endSession();
    }
};

// GET ALL USERS' NOTES
exports.getAllNotes = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;

        const [notes, total] = await Promise.all([
            Note.find()
                .populate("userId", "name email")
                .sort({ createdAt: -1, _id: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),

            Note.countDocuments()
        ]);

        res.status(200).json({
            success: true,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            },
            data: notes
        });

    } catch (error) {
        console.error("List admin notes failed:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve notes"
        });
    }
};
