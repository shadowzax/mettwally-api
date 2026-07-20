const sqlite3 = require("sqlite3").verbose();

const path = require("path");

const fs = require("fs");

const dataFolder = path.join(__dirname, "..", "data");

if (!fs.existsSync(dataFolder)) {
    fs.mkdirSync(dataFolder);
}

const dbPath = path.join(dataFolder, "users.sqlite");

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log("Connected to database.");
    }
});

const defaultProfilePicture =
    "https://i.ibb.co/WNSTVC8T/i-wasn-t-ready-for-this-flashback-anime-blue-lock-s2-character-rin-rules-feel-free-to.jpg";

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,

            first_name TEXT,
            second_name TEXT,
            third_name TEXT,
            last_name TEXT,

            display_name TEXT,

            phone_number TEXT,
            parent_phone TEXT,
            governorate TEXT,

            grade TEXT,

            password TEXT,

            account_type TEXT DEFAULT 'طالب',
            role_id TEXT,

            account_status TEXT DEFAULT 'active',

            is_active INTEGER DEFAULT 1,
            is_admin INTEGER DEFAULT 0,

            gender TEXT,

            profile_picture TEXT DEFAULT '${defaultProfilePicture}',

            enrolled_courses TEXT DEFAULT '[]',
            enrolled_courses_count INTEGER DEFAULT 0,

            exam_results TEXT DEFAULT '[]',
            quiz_results TEXT DEFAULT '[]',

            last_login DATETIME,
            last_activity DATETIME,

            wallet_balance REAL DEFAULT 0,

            videos_watched INTEGER DEFAULT 0,
            total_video_views INTEGER DEFAULT 0,
            lecture_open_minutes INTEGER DEFAULT 0,

            quizzes_started INTEGER DEFAULT 0,
            quizzes_completed INTEGER DEFAULT 0,

            exams_started INTEGER DEFAULT 0,
            exams_completed INTEGER DEFAULT 0,

            average_score REAL DEFAULT 0,

            courses_completed INTEGER DEFAULT 0,

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    const requiredColumns = {
        first_name: "TEXT",
        second_name: "TEXT",
        third_name: "TEXT",
        last_name: "TEXT",

        display_name: "TEXT",

        phone_number: "TEXT",
        parent_phone: "TEXT",
        governorate: "TEXT",

        grade: "TEXT",

        password: "TEXT",

        account_type: "TEXT DEFAULT 'طالب'",
        role_id: "TEXT",

        account_status: "TEXT DEFAULT 'active'",

        is_active: "INTEGER DEFAULT 1",
        is_admin: "INTEGER DEFAULT 0",

        gender: "TEXT",

        profile_picture: `TEXT DEFAULT '${defaultProfilePicture}'`,

        enrolled_courses: "TEXT DEFAULT '[]'",
        enrolled_courses_count: "INTEGER DEFAULT 0",

        exam_results: "TEXT DEFAULT '[]'",
        quiz_results: "TEXT DEFAULT '[]'",

        last_login: "DATETIME",
        last_activity: "DATETIME",

        wallet_balance: "REAL DEFAULT 0",

        videos_watched: "INTEGER DEFAULT 0",
        total_video_views: "INTEGER DEFAULT 0",
        lecture_open_minutes: "INTEGER DEFAULT 0",

        quizzes_started: "INTEGER DEFAULT 0",
        quizzes_completed: "INTEGER DEFAULT 0",

        exams_started: "INTEGER DEFAULT 0",
        exams_completed: "INTEGER DEFAULT 0",

        average_score: "REAL DEFAULT 0",

        courses_completed: "INTEGER DEFAULT 0"
    };

    db.all(`PRAGMA table_info(users)`, (err, columns) => {
        if (err) {
            return console.error(err.message);
        }

        const existing = columns.map(col => col.name);

        for (const [name, type] of Object.entries(requiredColumns)) {
            if (!existing.includes(name)) {
                db.run(
                    `ALTER TABLE users ADD COLUMN ${name} ${type}`,
                    (err) => {
                        if (err) {
                            console.error(`Error adding column ${name}:`, err.message);
                        } else {
                            console.log(`Added column: ${name}`);
                        }
                    }
                );
            }
        }

        if (existing.includes("account_status")) {
            db.run(`UPDATE users SET account_status = 'active'`);
        }
    });

    db.run(`
        CREATE TRIGGER IF NOT EXISTS update_users_timestamp
        AFTER UPDATE ON users
        FOR EACH ROW
        BEGIN
            UPDATE users
            SET updated_at = CURRENT_TIMESTAMP
            WHERE id = OLD.id;
        END;
    `);
});

function generateId() {
    return Math.floor(100000000 + Math.random() * 900000000).toString();
}

module.exports = { db, generateId };