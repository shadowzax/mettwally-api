const express = require("express");
const { db } = require("../../mydb/users");

const router = express.Router();

router.get("/", (req, res) => {
    try {
        db.all(
            `
            SELECT *
            FROM users
            ORDER BY created_at DESC
            `,
            [],
            (err, students) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: err.message
                    });
                }

                return res.status(200).json({
                    success: true,
                    count: students.length,
                    students
                });
            }
        );
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;