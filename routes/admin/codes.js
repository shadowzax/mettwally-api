const express = require("express");
const router = express.Router();

const {
    db,
    generateUniqueUserCode
} = require("../../mydb/codes");

function generateCode() {
    return new Promise((resolve, reject) => {
        generateUniqueUserCode((err, code) => {
            if (err) {
                return reject(err);
            }

            resolve(code);
        });
    });
}

function generateRandomValue() {
    return Math.floor(Math.random() * 501) + 501;
}

router.get("/generate", async (req, res) => {
    try {
        const course_id = req.query.course_id || null;
        const codes = [];

        for (let i = 0; i < 10; i++) {
            const code = await generateCode();
            const value = generateRandomValue();

            await new Promise((resolve, reject) => {
                db.run(
                    `
                    INSERT INTO user_codes (
                        code,
                        value,
                        course_id
                    )
                    VALUES (?, ?, ?)
                    `,
                    [
                        code,
                        value,
                        course_id
                    ],
                    function (err) {
                        if (err) {
                            return reject(err);
                        }

                        codes.push({
                            code,
                            value,
                            course_id,
                            is_used: 0,
                            used_by: null,
                            used_at: null
                        });

                        resolve();
                    }
                );
            });
        }

        return res.status(201).json({
            success: true,
            message: "تم إنشاء 10 أكواد بنجاح",
            count: codes.length,
            codes
        });

    } catch (error) {
        console.error("Generate Codes Error:", error);

        return res.status(500).json({
            success: false,
            message: "حدث خطأ أثناء إنشاء الأكواد",
            error: error.message
        });
    }
});

router.get("/codes", (req, res) => {
    db.all(
        `
        SELECT
            code,
            value,
            course_id,
            is_used,
            used_by,
            used_at,
            created_at,
            updated_at
        FROM user_codes
        ORDER BY created_at DESC
        `,
        [],
        (err, rows) => {
            if (err) {
                console.error("Get Codes Error:", err);

                return res.status(500).json({
                    success: false,
                    message: "حدث خطأ أثناء جلب الأكواد",
                    error: err.message
                });
            }

            return res.json({
                success: true,
                count: rows.length,
                codes: rows
            });
        }
    );
});

module.exports = router;
