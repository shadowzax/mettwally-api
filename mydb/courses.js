const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const dataFolder = path.join(__dirname, "..", "data");

if (!fs.existsSync(dataFolder)) {
    fs.mkdirSync(dataFolder);
}

const dbPath = path.join(dataFolder, "courses.sqlite");

const db = new sqlite3.Database(dbPath, err => {
    if (err) {
        console.error(err.message);
    } else {
        console.log("Connected to database.");
    }
});

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            name TEXT,
            description TEXT,
            image TEXT,

            price REAL DEFAULT 0,
            price_before_discount REAL DEFAULT 0,

            year INTEGER,

            first_free_video INTEGER DEFAULT 0,
            subscriptions_count INTEGER DEFAULT 0,

            is_to_send_parent_follow_up_message INTEGER DEFAULT 0,
            is_pinned INTEGER DEFAULT 0,

            prepaidable INTEGER DEFAULT 0,
            is_couponable INTEGER DEFAULT 1,

            commission REAL DEFAULT 0,

            sellable INTEGER DEFAULT 1,
            is_course_featured INTEGER DEFAULT 0,

            is_free INTEGER DEFAULT 0,

            sections TEXT DEFAULT '[]',

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(
        `ALTER TABLE courses ADD COLUMN is_free INTEGER DEFAULT 0`,
        () => {}
    );

    db.run(`
        DROP TRIGGER IF EXISTS update_courses_timestamp
    `);

    db.run(`
        CREATE TRIGGER update_courses_timestamp
        AFTER UPDATE ON courses
        FOR EACH ROW
        BEGIN
            UPDATE courses
            SET updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.id;
        END;
    `);
});

module.exports = {
    db
};