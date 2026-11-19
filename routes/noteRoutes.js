
const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
    createNote,
    getMyNotes,
    getNoteById,
    updateNote,
    deleteNote
} = require("../controllers/noteController");

// All note routes require authentication
router.use(protect);

router.post("/", createNote);
router.get("/", getMyNotes);
router.get("/:id", getNoteById);
router.put("/:id", updateNote);
router.delete("/:id", deleteNote);

module.exports = router;
