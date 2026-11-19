
const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        title: {
            type: String,
            required: true,
            trim: true
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

// Supports per-user newest-first pagination and the aggregation $lookup.
postSchema.index({ userId: 1, createdAt: -1, _id: -1 });
// Supports newest-first pagination of the public post feed.
postSchema.index({ createdAt: -1, _id: -1 });

module.exports = mongoose.models.Post || mongoose.model("Post", postSchema);
