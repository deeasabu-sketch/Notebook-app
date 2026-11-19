
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 100
        },

        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"]
        },

        password: {
            type: String,
            required: true,
            minlength: 8,
            select: false
        },

        role: {
            type: String,
            enum: ["user", "admin"],
            default: "user"
        },

        interests: {
            type: [String],
            default: []
        }
    },
    {
        timestamps: true
    }
);

// Password hashing
userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;

    this.password = await bcrypt.hash(this.password, 12);
});

// Password verification
userSchema.methods.comparePassword = async function (password) {
    return bcrypt.compare(password, this.password);
};

// Required indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ createdAt: -1, _id: -1 });
module.exports = mongoose.models.User || mongoose.model("User", userSchema);
