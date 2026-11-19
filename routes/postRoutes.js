const express = require("express");
const protect = require("../middleware/authMiddleware");
const { createPost, getPublicPosts } = require("../controllers/postController");
const router = express.Router();

router.get("/", getPublicPosts);
router.post("/", protect, createPost);

module.exports = router;
