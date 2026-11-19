
const mongoose = require("mongoose");
const User = require("../models/User");
const Post = require("../models/Post");

// SCENARIO 1: GROUP USERS BY INTERESTS
exports.groupUsersByInterests = async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
        const skip = (page - 1) * limit;

        const [result] = await User.aggregate([
            {
                $match: {
                    interests: { $type: "array", $ne: [] }
                }
            },
            {
                $project: {
                    name: 1,
                    email: 1,
                    interests: { $setUnion: ["$interests", []] }
                }
            },
            {
                $unwind: "$interests"
            },
            {
                $group: {
                    _id: "$interests",
                    users: {
                        $push: {
                            id: "$_id",
                            name: "$name",
                            email: "$email"
                        }
                    },
                    totalUsers: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 }
            },
            {
                $facet: {
                    groups: [
                        { $skip: skip },
                        { $limit: limit },
                        {
                            $project: {
                                _id: 0,
                                interest: "$_id",
                                totalUsers: 1,
                                users: 1
                            }
                        }
                    ],
                    metadata: [{ $count: "total" }]
                }
            }
        ]);

        const total = result?.metadata?.[0]?.total || 0;

        return res.status(200).json({
            success: true,
            message: "Users grouped by interests",
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
            data: result?.groups || []
        });

    } catch (error) {
        console.error("Interest aggregation failed:", error);
        res.status(500).json({
            success: false,
            message: "Interest aggregation failed"
        });
    }
};

// SCENARIO 2: USER POSTS USING $LOOKUP
exports.getUserPosts = async (req, res) => {
    try {
        const { id } = req.params;
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
        const skip = (page - 1) * limit;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID"
            });
        }

        const result = await User.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(id)
                }
            },
            {
                $lookup: {
                    from: Post.collection.name,
                    localField: "_id",
                    foreignField: "userId",
                    pipeline: [
                        { $sort: { createdAt: -1, _id: -1 } },
                        {
                            $facet: {
                                posts: [
                                    { $skip: skip },
                                    { $limit: limit }
                                ],
                                metadata: [{ $count: "total" }]
                            }
                        }
                    ],
                    as: "postResults"
                }
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    posts: { $ifNull: [{ $arrayElemAt: ["$postResults.posts", 0] }, []] },
                    totalPosts: {
                        $ifNull: [
                            { $arrayElemAt: [{ $arrayElemAt: ["$postResults.metadata.total", 0] }, 0] },
                            0
                        ]
                    }
                }
            }
        ]);

        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const total = result[0].totalPosts;
        res.status(200).json({
            success: true,
            message: "User posts retrieved successfully",
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
            data: { _id: result[0]._id, name: result[0].name, posts: result[0].posts }
        });

    } catch (error) {
        console.error("User posts aggregation failed:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve user posts"
        });
    }
};
