const express = require("express");
const { db } = require("../../mydb/users");

const router = express.Router();

router.get("/", (req, res) => {
    try {
        db.all(
            `
            SELECT *
            FROM users
            WHERE is_admin = 1
            ORDER BY created_at DESC
            `,
            [],
            (err, users) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: err.message
                    });
                }

                return res.status(200).json({
                    success: true,
                    count: users.length,
                    users
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
/*------------------------------------------------*/
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

router.post("/assistant", upload.single("profile_picture"), async (req, res) => {
    const { phone_number } = req.body;

    if (!phone_number) {
        return res.status(400).json({
            success: false,
            error: "phone_number is required"
        });
    }

    try {
        let profilePicture = "https://i.ibb.co/RkspxsPG/3177440-1.jpg";

        if (req.file) {
            profilePicture = await uploadImage(req.file.path);
        }

        db.run(
            `UPDATE users
             SET account_type = ?,
                 profile_picture = ?,
                 is_admin = ?
             WHERE phone_number = ?`,
            ["اسيستانت", profilePicture, 1, phone_number],
            function (err) {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        error: err.message
                    });
                }

                if (this.changes === 0) {
                    return res.status(404).json({
                        success: false,
                        error: "User not found"
                    });
                }

                db.get(
                    `SELECT *
                     FROM users
                     WHERE phone_number = ?`,
                    [phone_number],
                    (err, user) => {
                        if (err) {
                            return res.status(500).json({
                                success: false,
                                error: err.message
                            });
                        }

                        return res.status(200).json({
                            success: true,
                            message: "تم ترقية المستخدم إلى أسيستانت بنجاح",
                            user
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
module.exports = router;