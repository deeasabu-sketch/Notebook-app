
const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200
        },

        content: {
            type: String,
            required: true
        }
    },
    {
        timestamps: true
    }
);

// Supports user's note listing and sorting
noteSchema.index({ userId: 1, createdAt: -1, _id: -1 });
noteSchema.index({ createdAt: -1, _id: -1 });

module.exports = mongoose.models.Note || mongoose.model("Note", noteSchema);
