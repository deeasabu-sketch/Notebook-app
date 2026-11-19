const Post = require("../models/Post");

exports.createPost = async (req, res) => {
    try {
        const { title, content } = req.body;
        if (typeof title !== "string" || !title.trim() || typeof content !== "string" || !content.trim()) {
            return res.status(400).json({ success: false, message: "Title and content are required" });
        }
        const post = await Post.create({ userId: req.user._id, title: title.trim(), content: content.trim() });
        return res.status(201).json({ success: true, message: "Post created", data: post });
    } catch (error) {
        if (error.name === "ValidationError") return res.status(400).json({ success: false, message: error.message });
        console.error("Create post failed:", error);
        return res.status(500).json({ success: false, message: "Failed to create post" });
    }
};

exports.getPublicPosts = async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
        const skip = (page - 1) * limit;
        const [posts, total] = await Promise.all([
            Post.find()
                .populate("userId", "name")
                .sort({ createdAt: -1, _id: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Post.countDocuments()
        ]);
        return res.status(200).json({
            success: true,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
            data: posts
        });
    } catch (error) {
        console.error("List public posts failed:", error);
        return res.status(500).json({ success: false, message: "Failed to retrieve public posts" });
    }
};
