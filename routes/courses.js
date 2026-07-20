const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const { db: coursesDb } = require("../mydb/courses");
const { db: usersDb } = require("../mydb/users");

router.get("/purchased-courses", (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            error: "No token provided"
        });
    }

    const token = authHeader.split(" ")[1];

    let decoded;

    try {
        decoded = jwt.verify(token, "secretkey");
    } catch (err) {
        return res.status(401).json({
            success: false,
            error: "Invalid or expired token"
        });
    }

    const userId = decoded.userId || decoded.id;

    usersDb.get(
        "SELECT enrolled_courses FROM users WHERE id = ?",
        [userId],
        (userErr, user) => {
            if (userErr) {
                return res.status(500).json({
                    success: false,
                    error: userErr.message
                });
            }

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: "User not found"
                });
            }

            let enrolledCourses = [];

            try {
                enrolledCourses = JSON.parse(user.enrolled_courses || "[]");

                if (!Array.isArray(enrolledCourses)) {
                    enrolledCourses = [];
                }
            } catch {
                enrolledCourses = [];
            }

            if (enrolledCourses.length === 0) {
                return res.status(200).json({
                    success: true,
                    count: 0,
                    courses: []
                });
            }

            const placeholders = enrolledCourses.map(() => "?").join(",");

            coursesDb.all(
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
                    subscriptions_count,
                    is_to_send_parent_follow_up_message,
                    is_pinned,
                    prepaidable,
                    is_couponable,
                    sellable,
                    is_course_featured,
                    created_at,
                    updated_at
                FROM courses
                WHERE id IN (${placeholders})
                ORDER BY id DESC
                `,
                enrolledCourses,
                (courseErr, courses) => {
                    if (courseErr) {
                        return res.status(500).json({
                            success: false,
                            error: courseErr.message
                        });
                    }

                    return res.status(200).json({
                        success: true,
                        count: courses.length,
                        courses
                    });
                }
            );
        }
    );
});


router.post("/purchase", (req, res) => {
    const { course_id } = req.body;

    if (!course_id) {
        return res.status(400).json({
            success: false,
            error: "course_id is required"
        });
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            error: "No token provided"
        });
    }

    const token = authHeader.split(" ")[1];

    let decoded;

    try {
        decoded = jwt.verify(token, "secretkey");
    } catch (err) {
        return res.status(401).json({
            success: false,
            error: "Invalid or expired token"
        });
    }

    const userId = decoded.userId || decoded.id;

    usersDb.get(
        "SELECT * FROM users WHERE id = ?",
        [userId],
        (userErr, user) => {
            if (userErr) {
                return res.status(500).json({
                    success: false,
                    error: userErr.message
                });
            }

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: "User not found"
                });
            }

            coursesDb.get(
                "SELECT * FROM courses WHERE id = ?",
                [Number(course_id)],
                (courseErr, course) => {
                    if (courseErr) {
                        return res.status(500).json({
                            success: false,
                            error: courseErr.message
                        });
                    }

                    if (!course) {
                        return res.status(404).json({
                            success: false,
                            error: "Course not found"
                        });
                    }

                    const walletBalance = Number(user.wallet_balance || 0);
                    const coursePrice = Number(course.price || 0);

                    if (walletBalance < coursePrice) {
                        return res.status(400).json({
                            success: false,
                            error: "Insufficient wallet balance"
                        });
                    }

                    let enrolledCourses = [];

                    try {
                        enrolledCourses = JSON.parse(user.enrolled_courses || "[]");

                        if (!Array.isArray(enrolledCourses)) {
                            enrolledCourses = [];
                        }
                    } catch {
                        enrolledCourses = [];
                    }

                    if (enrolledCourses.includes(Number(course_id))) {
                        return res.status(400).json({
                            success: false,
                            error: "Course already purchased"
                        });
                    }

                    enrolledCourses.push(Number(course_id));

                    const newBalance = walletBalance - coursePrice;

                    usersDb.run(
                        `UPDATE users
                         SET wallet_balance = ?,
                             enrolled_courses = ?,
                             enrolled_courses_count = ?,
                             updated_at = CURRENT_TIMESTAMP
                         WHERE id = ?`,
                        [
                            newBalance,
                            JSON.stringify(enrolledCourses),
                            enrolledCourses.length,
                            userId
                        ],
                        function (updateErr) {
                            if (updateErr) {
                                return res.status(500).json({
                                    success: false,
                                    error: updateErr.message
                                });
                            }

                            coursesDb.run(
                                `UPDATE courses
                                 SET subscriptions_count = COALESCE(subscriptions_count, 0) + 1,
                                     updated_at = CURRENT_TIMESTAMP
                                 WHERE id = ?`,
                                [Number(course_id)],
                                (subErr) => {
                                    if (subErr) {
                                        return res.status(500).json({
                                            success: false,
                                            error: subErr.message
                                        });
                                    }

                                    usersDb.get(
                                        "SELECT * FROM users WHERE id = ?",
                                        [userId],
                                        (finalErr, updatedUser) => {
                                            if (finalErr) {
                                                return res.status(500).json({
                                                    success: false,
                                                    error: finalErr.message
                                                });
                                            }

                                            return res.status(200).json({
                                                success: true,
                                                message: "Course purchased successfully",
                                                wallet_balance: updatedUser.wallet_balance,
                                                enrolled_courses: JSON.parse(updatedUser.enrolled_courses || "[]"),
                                                user: updatedUser
                                            });
                                        }
                                    );
                                }
                            );
                        }
                    );
                }
            );
        }
    );
});

router.get("/:year", (req, res) => {
    const year = parseInt(req.params.year, 10);

    if (![1, 2, 3].includes(year)) {
        return res.status(400).json({
            success: false,
            error: "Invalid year"
        });
    }

    coursesDb.all(
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
            subscriptions_count,
            is_to_send_parent_follow_up_message,
            is_pinned,
            prepaidable,
            is_couponable,
            sellable,
            is_course_featured,
            CASE
                WHEN price <= 0 THEN 1
                ELSE 0
            END AS is_free,
            created_at,
            updated_at
        FROM courses
        WHERE year = ?
        ORDER BY id DESC
        `,
        [year],
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

router.get("/course/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id) || id <= 0) {
        return res.status(400).json({
            success: false,
            error: "Invalid course id"
        });
    }

    try {
        const course = await new Promise((resolve, reject) => {
            coursesDb.get(
                "SELECT * FROM courses WHERE id = ?",
                [id],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!course) {
            return res.status(404).json({
                success: false,
                error: "Course not found"
            });
        }

        let isEnrolled = Number(course.price) === 0;

        const authHeader = req.headers.authorization;

        if (!isEnrolled && authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.split(" ")[1];

            try {
                const decoded = jwt.verify(token, "secretkey");
                const userId = decoded.userId || decoded.id;

                const user = await new Promise((resolve, reject) => {
                    usersDb.get(
                        "SELECT enrolled_courses FROM users WHERE id = ?",
                        [userId],
                        (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        }
                    );
                });

                if (user) {
                    let enrolledCourses = [];

                    try {
                        enrolledCourses = JSON.parse(user.enrolled_courses || "[]");

                        if (!Array.isArray(enrolledCourses)) {
                            enrolledCourses = [];
                        }
                    } catch {
                        enrolledCourses = [];
                    }

                    isEnrolled = enrolledCourses.includes(id);
                }
            } catch {}
        }

        if (typeof course.sections === "string") {
            try {
                course.sections = JSON.parse(course.sections);
            } catch {
                course.sections = [];
            }
        }

        const jsonFields = [
            "live_sessions",
            "teacher",
            "teachers",
            "videos",
            "books",
            "exams",
            "attachments"
        ];

        if (isEnrolled) {
            jsonFields.forEach(field => {
                if (typeof course[field] === "string") {
                    try {
                        course[field] = JSON.parse(course[field]);
                    } catch {}
                }
            });

            course.is_enrolled = true;

            return res.status(200).json({
                success: true,
                course
            });
        }

        const publicCourse = {};

        for (const key in course) {
            if (
                key === "sections" ||
                (
                    !jsonFields.includes(key) &&
                    !key.toLowerCase().includes("source")
                )
            ) {
                publicCourse[key] = course[key];
            }
        }

        publicCourse.is_enrolled = false;

        return res.status(200).json({
            success: true,
            course: publicCourse
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: err.message
        });
    }
});
/*
router.get("/course/:id/init-sections", (req, res) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id) || id <= 0) {
        return res.status(400).json({
            success: false,
            error: "Invalid course id"
        });
    }

    coursesDb.get(
        `SELECT * FROM courses WHERE id = ?`,
        [id],
        (err, course) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    error: err.message
                });
            }

            if (!course) {
                return res.status(404).json({
                    success: false,
                    error: "Course not found"
                });
            }

            let sections = [];

            try {
                sections = course.sections ? JSON.parse(course.sections) : [];
            } catch {
                sections = [];
            }

            if (!Array.isArray(sections)) {
                sections = [];
            }

            const sectionId = Date.now();
            const now = new Date().toISOString();

            sections.push({
                id: sectionId,
                name: "أساسيات JavaScript",
                description: "أساسيات JavaScript",
                current_index: sections.length + 1,
                created_at: now,
                updated_at: now,
                sectionables: [
                    {
                        id: sectionId + 1,
                        sectionable_type: "video",
                        group_name: "الدرس الأول",
                        sectionable_id: 101,
                        section_id: sectionId,
                        view_limit: 0,
                        exam_finish_limit: 0,
                        exam_open_limit: 0,
                        exam_resume_limit: 0,
                        visible_from: now,
                        visible_to: "2035-01-01T00:00:00.000Z",
                        index: 1,
                        is_locked_on: 0,
                        sectionable: {
                            id: 101,
                            name: "مقدمة JavaScript",
                            description: "مقدمة JavaScript",
                            duration: 25,
                            platform: "youtube",
                            source: "abcd1234"
                        }
                    },
                    {
                        id: sectionId + 2,
                        sectionable_type: "book",
                        group_name: "الدرس الأول",
                        sectionable_id: 201,
                        section_id: sectionId,
                        view_limit: 0,
                        exam_finish_limit: 0,
                        exam_open_limit: 0,
                        exam_resume_limit: 0,
                        visible_from: now,
                        visible_to: "2035-01-01T00:00:00.000Z",
                        index: 2,
                        is_locked_on: 0,
                        sectionable: {
                            id: 201,
                            name: "ملخص الدرس",
                            description: "ملخص الدرس",
                            source: "books/javascript-intro.pdf"
                        }
                    },
                    {
                        id: sectionId + 3,
                        sectionable_type: "exam",
                        group_name: "الدرس الأول",
                        sectionable_id: 301,
                        section_id: sectionId,
                        view_limit: 0,
                        exam_finish_limit: 0,
                        exam_open_limit: 1,
                        exam_resume_limit: 0,
                        visible_from: now,
                        visible_to: "2035-01-01T00:00:00.000Z",
                        index: 3,
                        is_locked_on: 1,
                        sectionable: {
                            id: 301,
                            name: "اختبار الدرس الأول",
                            description: "اختبار الدرس الأول",
                            question_quantity: 10,
                            duration: 20,
                            pass_from: 7
                        }
                    }
                ]
            });

            coursesDb.run(
                `UPDATE courses SET sections = ? WHERE id = ?`,
                [JSON.stringify(sections), id],
                function (err) {
                    if (err) {
                        return res.status(500).json({
                            success: false,
                            error: err.message
                        });
                    }

                    coursesDb.get(
                        `SELECT * FROM courses WHERE id = ?`,
                        [id],
                        (err, updatedCourse) => {
                            if (err) {
                                return res.status(500).json({
                                    success: false,
                                    error: err.message
                                });
                            }

                            return res.status(200).json({
                                success: true,
                                course: updatedCourse
                            });
                        }
                    );
                }
            );
        }
    );
});
*/
router.get("/course/:id/init-sections", (req, res) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id) || id <= 0) {
        return res.status(400).json({
            success: false,
            error: "Invalid course id"
        });
    }

    coursesDb.get(
        `SELECT * FROM courses WHERE id = ?`,
        [id],
        (err, course) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    error: err.message
                });
            }

            if (!course) {
                return res.status(404).json({
                    success: false,
                    error: "Course not found"
                });
            }

            let sections = [];

            try {
                sections = course.sections ? JSON.parse(course.sections) : [];
            } catch {
                sections = [];
            }

            if (!Array.isArray(sections)) {
                sections = [];
            }

            const sectionId = Date.now();
            const now = new Date().toISOString();

            sections.push({
                id: sectionId,
                name: "الوحدة الاول",
                description: "رياضيات",
                current_index: sections.length + 1,
                created_at: now,
                updated_at: now,
                sectionables: [
                    {
                        id: sectionId + 1,
                        sectionable_type: "video",
                        group_name: "الدرس الأول",
                        sectionable_id: 101,
                        section_id: sectionId,
                        view_limit: 0,
                        exam_finish_limit: 0,
                        exam_open_limit: 0,
                        exam_resume_limit: 0,
                        visible_from: now,
                        visible_to: "2035-01-01T00:00:00.000Z",
                        index: 1,
                        is_locked_on: 0,
                        sectionable: {
                            id: 101,
                            name: "الوحده الاولي الدرس الاول",
                            description: "الوحده الاولي الدرس الاول",
                            duration: 25,
                            platform: "youtube",
                            source: "zJrThdvh3zM"
                        }
                    },
                    {
                        id: sectionId + 2,
                        sectionable_type: "book",
                        group_name: "الدرس الأول",
                        sectionable_id: 201,
                        section_id: sectionId,
                        view_limit: 0,
                        exam_finish_limit: 0,
                        exam_open_limit: 0,
                        exam_resume_limit: 0,
                        visible_from: now,
                        visible_to: "2035-01-01T00:00:00.000Z",
                        index: 2,
                        is_locked_on: 0,
                        sectionable: {
                            id: 201,
                            name: "ملخص الدرس",
                            description: "ملخص الدرس",
                            source: "https://files.catbox.moe/ky7lga.pdf"
                        }
                    }
                ]
            });

            coursesDb.run(
                `UPDATE courses SET sections = ? WHERE id = ?`,
                [JSON.stringify(sections), id],
                function (err) {
                    if (err) {
                        return res.status(500).json({
                            success: false,
                            error: err.message
                        });
                    }

                    coursesDb.get(
                        `SELECT * FROM courses WHERE id = ?`,
                        [id],
                        (err, updatedCourse) => {
                            if (err) {
                                return res.status(500).json({
                                    success: false,
                                    error: err.message
                                });
                            }

                            return res.status(200).json({
                                success: true,
                                course: updatedCourse
                            });
                        }
                    );
                }
            );
        }
    );
});
module.exports = router;