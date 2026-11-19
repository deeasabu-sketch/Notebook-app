
const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/roleMiddleware");

const {
    groupUsersByInterests,
    getUserPosts
} = require("../controllers/aggregationController");

// Admin-only interest grouping
router.get(
    "/interests",
    protect,
    adminOnly,
    groupUsersByInterests
);

// Public posts: visible to everyone
router.get(
    "/users/:id/posts",
    getUserPosts
);

module.exports = router;
