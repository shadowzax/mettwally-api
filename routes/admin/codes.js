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
        const { value, count, course_id = null } = req.query;

        if (
            value === undefined ||
            value === null ||
            value === "" ||
            isNaN(Number(value)) ||
            Number(value) <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "القيمة مطلوبة ويجب أن تكون أكبر من صفر"
            });
        }

        if (
            count === undefined ||
            count === null ||
            count === "" ||
            isNaN(Number(count)) ||
            !Number.isInteger(Number(count)) ||
            Number(count) <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "عدد الأكواد مطلوب ويجب أن يكون رقمًا صحيحًا أكبر من صفر"
            });
        }

        const codeValue = Number(value);
        const codeCount = Number(count);

        if (codeCount > 10000) {
            return res.status(400).json({
                success: false,
                message: "الحد الأقصى لإنشاء الأكواد هو 10000 كود"
            });
        }

        const codes = [];

        for (let i = 0; i < codeCount; i++) {
            const code = await generateCode();

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
                        codeValue,
                        course_id || null
                    ],
                    function (err) {
                        if (err) {
                            return reject(err);
                        }

                        codes.push({
                            code,
                            value: codeValue,
                            course_id: course_id || null,
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
            message: `تم إنشاء ${codes.length} كود بنجاح`,
            count: codes.length,
            value: codeValue,
            course_id: course_id || null,
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
