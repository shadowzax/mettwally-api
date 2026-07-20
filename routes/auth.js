const express = require("express");
const bcrypt = require("bcrypt");
const { db, generateId } = require("../mydb/users");
const jwt = require("jsonwebtoken");

const router = express.Router();

router.post("/register", async (req, res) => {
    try {
        const {
            first_name,
            second_name,
            third_name,
            last_name,
            phone_number,
            parent_phone,
            governorate,
            gender,
            grade,
            password
        } = req.body;

        if (
            !first_name ||
            !second_name ||
            !third_name ||
            !last_name ||
            !phone_number ||
            !parent_phone ||
            !governorate ||
            !gender ||
            !grade ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "جميع الحقول مطلوبة"
            });
        }

        if (!["ذكر", "انثى"].includes(gender)) {
            return res.status(400).json({
                success: false,
                message: "الجنس غير صحيح"
            });
        }

        if (!/^01\d{9}$/.test(phone_number)) {
            return res.status(400).json({
                success: false,
                message: "رقم الهاتف غير صحيح"
            });
        }

        if (!/^01\d{9}$/.test(parent_phone)) {
            return res.status(400).json({
                success: false,
                message: "رقم هاتف ولي الأمر غير صحيح"
            });
        }

        db.get(
            "SELECT id FROM users WHERE phone_number = ?",
            [phone_number],
            async (err, user) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: err.message
                    });
                }

                if (user) {
                    return res.status(409).json({
                        success: false,
                        message: "رقم الهاتف مستخدم بالفعل"
                    });
                }

                const hashedPassword = await bcrypt.hash(password, 10);
                const id = generateId();

                const display_name =
                    `${first_name} ${second_name} ${third_name} ${last_name}`;

                db.run(
                    `
                    INSERT INTO users (
                        id,
                        first_name,
                        second_name,
                        third_name,
                        last_name,
                        display_name,
                        phone_number,
                        parent_phone,
                        governorate,
                        gender,
                        grade,
                        password,
                        updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    `,
                    [
                        id,
                        first_name,
                        second_name,
                        third_name,
                        last_name,
                        display_name,
                        phone_number,
                        parent_phone,
                        governorate,
                        gender,
                        grade,
                        hashedPassword
                    ],
                    function (err) {
                        if (err) {
                            return res.status(500).json({
                                success: false,
                                message: err.message
                            });
                        }

                        res.status(201).json({
                            success: true,
                            message: "تم إنشاء الحساب بنجاح",
                            user: {
                                id,
                                first_name,
                                second_name,
                                third_name,
                                last_name,
                                display_name,
                                phone_number,
                                parent_phone,
                                governorate,
                                gender,
                                grade
                            }
                        });
                    }
                );
            }
        );
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
/*-------------------------------*/
router.post("/login", async (req, res) => {
    try {
        const { phone_number, password } = req.body;

        if (!phone_number || !password) {
            return res.status(400).json({
                success: false,
                message: "رقم الهاتف وكلمة السر مطلوبة"
            });
        }

        db.get(
            "SELECT * FROM users WHERE phone_number = ?",
            [phone_number],
            async (err, user) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: err.message
                    });
                }

                if (!user) {
                    return res.status(404).json({
                        success: false,
                        message: "المستخدم غير موجود"
                    });
                }

                const isMatch = await bcrypt.compare(password, user.password);

                if (!isMatch) {
                    return res.status(401).json({
                        success: false,
                        message: "كلمة المرور غير صحيحة"
                    });
                }

                const token = jwt.sign(
                    { userId: user.id },
                    "secretkey",
                    { expiresIn: "1y" }
                );

                return res.status(200).json({
                    success: true,
                    message: "تم تسجيل الدخول بنجاح",
                    token,
                    user: {
                        id: user.id,
                        first_name: user.first_name,
                        second_name: user.second_name,
                        third_name: user.third_name,
                        last_name: user.last_name,
                        display_name: user.display_name,
                        phone_number: user.phone_number,
                        governorate: user.governorate,
                        gender: user.gender,
                        grade: user.grade
                    }
                });
            }
        );

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
/*--------------------------*/
router.post("/check-token", async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: "التوكين مطلوب"
            });
        }

        jwt.verify(token, "secretkey", (err, decoded) => {
            if (err) {
                return res.status(401).json({
                    success: false,
                    message: "التوكين غير صالح"
                });
            }

            db.get(
                `SELECT * FROM users WHERE id = ?`,
                [decoded.userId],
                (err, user) => {
                    if (err) {
                        return res.status(500).json({
                            success: false,
                            message: err.message
                        });
                    }

                    if (!user) {
                        return res.status(404).json({
                            success: false,
                            message: "المستخدم غير موجود"
                        });
                    }

                    user.is_admin = Boolean(user.is_admin);
                    user.is_active = Boolean(user.is_active);

                    return res.status(200).json({
                        success: true,
                        message: "التوكين صالح",
                        user
                    });
                }
            );
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
module.exports = router;