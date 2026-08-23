const express = require("express");
const jwt = require("jsonwebtoken");

const router = express.Router();

const { db: usersDb } = require("../mydb/users");
const { db: codesDb } = require("../mydb/codes");

const JWT_SECRET = "secretkey";

router.post("/activate-code", (req, res) => {
    const { token, code } = req.body;

    if (!token) {
        return res.status(400).json({
            success: false,
            message: "التوكين مطلوب"
        });
    }

    if (!code) {
        return res.status(400).json({
            success: false,
            message: "الكود مطلوب"
        });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error("JWT Error:", err.message);

            return res.status(401).json({
                success: false,
                message: "التوكين غير صالح أو منتهي الصلاحية"
            });
        }

        const userId = decoded.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "بيانات المستخدم غير موجودة داخل التوكين"
            });
        }

        const cleanUserId = String(userId).trim();
        const cleanCode = String(code).trim();

        console.log("========== ACTIVATE CODE ==========");
        console.log("Token User ID:", cleanUserId);
        console.log("Code:", cleanCode);

        if (!/^\d{9}$/.test(cleanCode)) {
            return res.status(400).json({
                success: false,
                message: "الكود يجب أن يكون 9 أرقام"
            });
        }

        usersDb.get(
            `
            SELECT
                *
            FROM users
            WHERE CAST(id AS TEXT) = ?
            LIMIT 1
            `,
            [cleanUserId],
            (userErr, user) => {
                if (userErr) {
                    console.error("Users DB Error:", userErr);

                    return res.status(500).json({
                        success: false,
                        message: "حدث خطأ أثناء البحث عن المستخدم",
                        error: userErr.message
                    });
                }

                console.log("User Found:", user ? true : false);

                if (!user) {
                    usersDb.all(
                        `
                        SELECT
                            id,
                            phone_number,
                            display_name,
                            wallet_balance
                        FROM users
                        LIMIT 20
                        `,
                        [],
                        (debugErr, rows) => {
                            console.log(
                                "First Users:",
                                debugErr ? debugErr.message : rows
                            );

                            return res.status(404).json({
                                success: false,
                                message: "المستخدم غير موجود",
                                token_user_id: cleanUserId
                            });
                        }
                    );

                    return;
                }

                codesDb.get(
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
                    WHERE code = ?
                    LIMIT 1
                    `,
                    [cleanCode],
                    (codeErr, codeData) => {
                        if (codeErr) {
                            console.error("Codes DB Error:", codeErr);

                            return res.status(500).json({
                                success: false,
                                message: "حدث خطأ أثناء التحقق من الكود",
                                error: codeErr.message
                            });
                        }

                        if (!codeData) {
                            return res.status(404).json({
                                success: false,
                                message: "الكود غير صحيح"
                            });
                        }

                        if (Number(codeData.is_used) === 1) {
                            return res.status(400).json({
                                success: false,
                                message: "هذا الكود تم استخدامه من قبل"
                            });
                        }

                        const codeValue = Number(codeData.value);

                        if (!Number.isFinite(codeValue) || codeValue <= 0) {
                            return res.status(400).json({
                                success: false,
                                message: "قيمة الكود غير صحيحة"
                            });
                        }

                        const currentBalance = Number(
                            user.wallet_balance || 0
                        );

                        if (!Number.isFinite(currentBalance)) {
                            return res.status(500).json({
                                success: false,
                                message: "رصيد المحفظة غير صحيح"
                            });
                        }

                        const newBalance =
                            currentBalance + codeValue;

                        codesDb.run(
                            `
                            UPDATE user_codes
                            SET
                                is_used = 1,
                                used_by = ?,
                                used_at = CURRENT_TIMESTAMP,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE code = ?
                            AND is_used = 0
                            `,
                            [
                                user.id,
                                cleanCode
                            ],
                            function (codeUpdateErr) {
                                if (codeUpdateErr) {
                                    console.error(
                                        "Code Update Error:",
                                        codeUpdateErr
                                    );

                                    return res.status(500).json({
                                        success: false,
                                        message: "حدث خطأ أثناء تفعيل الكود",
                                        error: codeUpdateErr.message
                                    });
                                }

                                if (this.changes === 0) {
                                    return res.status(400).json({
                                        success: false,
                                        message: "هذا الكود تم استخدامه بالفعل"
                                    });
                                }

                                usersDb.run(
                                    `
                                    UPDATE users
                                    SET
                                        wallet_balance = ?,
                                        updated_at = CURRENT_TIMESTAMP
                                    WHERE CAST(id AS TEXT) = ?
                                    `,
                                    [
                                        newBalance,
                                        cleanUserId
                                    ],
                                    function (updateErr) {
                                        if (updateErr) {
                                            console.error(
                                                "Wallet Update Error:",
                                                updateErr
                                            );

                                            codesDb.run(
                                                `
                                                UPDATE user_codes
                                                SET
                                                    is_used = 0,
                                                    used_by = NULL,
                                                    used_at = NULL,
                                                    updated_at = CURRENT_TIMESTAMP
                                                WHERE code = ?
                                                `,
                                                [cleanCode]
                                            );

                                            return res.status(500).json({
                                                success: false,
                                                message: "حدث خطأ أثناء تحديث المحفظة",
                                                error: updateErr.message
                                            });
                                        }

                                        if (this.changes === 0) {
                                            codesDb.run(
                                                `
                                                UPDATE user_codes
                                                SET
                                                    is_used = 0,
                                                    used_by = NULL,
                                                    used_at = NULL,
                                                    updated_at = CURRENT_TIMESTAMP
                                                WHERE code = ?
                                                `,
                                                [cleanCode]
                                            );

                                            return res.status(404).json({
                                                success: false,
                                                message: "لم يتم العثور على المستخدم أثناء تحديث المحفظة",
                                                token_user_id: cleanUserId
                                            });
                                        }

                                        console.log(
                                            "Wallet:",
                                            currentBalance,
                                            "=>",
                                            newBalance
                                        );

                                        return res.status(200).json({
                                            success: true,
                                            message: "تم تفعيل الكود وإضافة قيمته إلى المحفظة بنجاح",
                                            code: cleanCode,
                                            added_value: codeValue,
                                            old_wallet_balance: currentBalance,
                                            wallet_balance: newBalance
                                        });
                                    }
                                );
                            }
                        );
                    }
                );
            }
        );
    });
});

module.exports = router;
