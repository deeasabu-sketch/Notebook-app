
const mongoose = require("mongoose");
const Note = require("../models/Note");

// CREATE NOTE
exports.createNote = async (req, res) => {
    try {
        const { title, content } = req.body;

        if (typeof title !== "string" || !title.trim() || typeof content !== "string" || !content.trim()) {
            return res.status(400).json({
                success: false,
                message: "Title and content are required"
            });
        }

        const note = await Note.create({
            userId: req.user._id,
            title: title.trim(),
            content: content.trim()
        });

        return res.status(201).json({
            success: true,
            message: "Note created successfully",
            data: note
        });

    } catch (error) {
        console.error("Create note failed:", error);
        return res.status(error.name === "ValidationError" ? 400 : 500).json({
            success: false,
            message: error.name === "ValidationError" ? error.message : "Failed to create note"
        });
    }
};

// GET OWN NOTES WITH PAGINATION
exports.getMyNotes = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(
            100,
            Math.max(1, parseInt(req.query.limit) || 10)
        );

        const skip = (page - 1) * limit;

        const [notes, total] = await Promise.all([
            Note.find({ userId: req.user._id })
                .sort({ createdAt: -1, _id: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),

            Note.countDocuments({ userId: req.user._id })
        ]);

        return res.status(200).json({
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
        console.error("List notes failed:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve notes"
        });
    }
};

// GET SINGLE NOTE
exports.getNoteById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid note ID"
            });
        }

        const note = await Note.findOne({
            _id: id,
            userId: req.user._id
        });

        if (!note) {
            return res.status(404).json({
                success: false,
                message: "Note not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: note
        });

    } catch (error) {
        console.error("Get note failed:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve note"
        });
    }
};

// UPDATE NOTE
exports.updateNote = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content } = req.body;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid note ID"
            });
        }

        if (title === undefined && content === undefined) {
            return res.status(400).json({
                success: false,
                message: "Provide title or content to update"
            });
        }

        const updateData = {};

        if (title !== undefined) {
            if (typeof title !== "string" || !title.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Title cannot be empty"
                });
            }
            updateData.title = title.trim();
        }

        if (content !== undefined) {
            if (typeof content !== "string" || !content.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Content cannot be empty"
                });
            }
            updateData.content = content.trim();
        }

        const note = await Note.findOneAndUpdate(
            {
                _id: id,
                userId: req.user._id
            },
            { $set: updateData },
            {
                returnDocument: "after",
                runValidators: true
            }
        );

        if (!note) {
            return res.status(404).json({
                success: false,
                message: "Note not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Note updated successfully",
            data: note
        });

    } catch (error) {
        console.error("Update note failed:", error);
        return res.status(error.name === "ValidationError" ? 400 : 500).json({
            success: false,
            message: error.name === "ValidationError" ? error.message : "Failed to update note"
        });
    }
};

// DELETE NOTE
exports.deleteNote = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid note ID"
            });
        }

        const note = await Note.findOneAndDelete({
            _id: id,
            userId: req.user._id
        });

        if (!note) {
            return res.status(404).json({
                success: false,
                message: "Note not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Note deleted successfully"
        });

    } catch (error) {
        console.error("Delete note failed:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete note"
        });
    }
};
