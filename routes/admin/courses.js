const express = require("express");
const { db } = require("../../mydb/courses");

const router = express.Router();
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const fs = require("fs");
const API_KEY = "cd3664692e0290e136732602b869ba5e";
const axios = require("axios");
async function uploadImage(filePath, expiration = 0) {
    const image = fs.readFileSync(filePath);
    const base64Image = image.toString("base64");

    const formData = new URLSearchParams();
    formData.append("key", API_KEY);
    formData.append("image", base64Image);

    if (expiration) {
        formData.append("expiration", expiration);
    }

    const response = await axios.post(
        "https://api.imgbb.com/1/upload",
        formData,
        {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
        }
    );

    if (response.data && response.data.success) {
        return response.data.data.url; 
    } else {
        throw new Error(
            response.data?.error?.message || "Upload failed"
        );
    }
}

router.post("/course", upload.single("image"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: "image is required"
            });
        }

        const {
            name,
            description,
            price,
            price_before_discount,
            commission,
            year,
            first_free_video,
            is_to_send_parent_follow_up_message,
            is_pinned,
            prepaidable,
            is_couponable,
            sellable,
            is_course_featured,
            is_free = 0
        } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                error: "name is required"
            });
        }

        if (![1, 2, 3].includes(Number(year))) {
            return res.status(400).json({
                success: false,
                error: "year must be 1, 2 or 3"
            });
        }

        const image = await uploadImage(req.file.path);

        const freeCourse = Number(is_free) === 1 ? 1 : 0;

        db.run(
            `
            INSERT INTO courses (
                name,
                description,
                image,
                price,
                price_before_discount,
                year,
                first_free_video,
                is_to_send_parent_follow_up_message,
                is_pinned,
                prepaidable,
                is_couponable,
                commission,
                sellable,
                is_course_featured,
                is_free
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                name,
                description || "",
                image,
                freeCourse ? 0 : (Number(price) || 0),
                freeCourse ? 0 : (Number(price_before_discount) || 0),
                Number(year),
                Number(first_free_video) || 0,
                Number(is_to_send_parent_follow_up_message) || 0,
                Number(is_pinned) || 0,
                Number(prepaidable) || 0,
                Number(is_couponable ?? 1),
                Number(commission) || 0,
                Number(sellable ?? 1),
                Number(is_course_featured) || 0,
                freeCourse
            ],
            function (err) {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        error: err.message
                    });
                }

                db.get(
                    "SELECT * FROM courses WHERE id = ?",
                    [this.lastID],
                    (err, course) => {
                        if (err) {
                            return res.status(500).json({
                                success: false,
                                error: err.message
                            });
                        }

                        return res.status(201).json({
                            success: true,
                            message: "تم إنشاء الكورس بنجاح",
                            course
                        });
                    }
                );
            }
        );
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: err.message
        });
    }
});
router.get("/courses", (req, res) => {
    db.all(
        `
        SELECT
            id,
            name,
            description,
            image,
            price,
            price_before_discount,
            commission,
            year,
            first_free_video,
            is_to_send_parent_follow_up_message,
            is_pinned,
            prepaidable,
            is_couponable,
            sellable,
            is_course_featured
        FROM courses
        ORDER BY id DESC
        `,
        [],
        (err, courses) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    error: err.message
                });
            }

            return res.status(200).json({
                success: true,
                count: courses.length,
                courses
            });
        }
    );
});

router.get("/courses/delete", (req, res) => {
    db.run("DELETE FROM courses", function (err) {
        if (err) {
            return res.status(500).json({
                success: false,
                error: err.message
            });
        }

        db.run("DELETE FROM sqlite_sequence WHERE name = 'courses'", (resetErr) => {
            if (resetErr) {
                return res.status(500).json({
                    success: false,
                    error: resetErr.message
                });
            }

            return res.status(200).json({
                success: true,
                message: "All courses deleted successfully"
            });
        });
    });
});
module.exports = router;