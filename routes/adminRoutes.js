
const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/roleMiddleware");

const {
    getAllUsers,
    createUser,
    updateUser,
    deleteUser,
    getAllNotes
} = require("../controllers/adminController");

// All admin routes require authentication and admin role
router.use(protect, adminOnly);

router.get("/users", getAllUsers);
router.post("/users", createUser);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

router.get("/notes", getAllNotes);

module.exports = router;
