const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const dataFolder = path.join(__dirname, "..", "data");

if (!fs.existsSync(dataFolder)) {
    fs.mkdirSync(dataFolder, { recursive: true });
}

const dbPath = path.join(dataFolder, "codes.sqlite");

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Database Error:", err.message);
    } else {
        console.log("Connected to codes database.");
        console.log("Database Path:", dbPath);
    }
});

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS user_codes (
            code TEXT PRIMARY KEY,
            value REAL NOT NULL DEFAULT 0,
            course_id TEXT DEFAULT NULL,
            is_used INTEGER NOT NULL DEFAULT 0,
            used_by TEXT DEFAULT NULL,
            used_at DATETIME DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error("Error creating user_codes table:", err.message);
        } else {
            console.log("user_codes table ready.");
        }
    });

    db.run(`
        CREATE INDEX IF NOT EXISTS idx_user_codes_course_id
        ON user_codes(course_id)
    `, (err) => {
        if (err) {
            console.error("Error creating course_id index:", err.message);
        }
    });

    db.run(`
        CREATE INDEX IF NOT EXISTS idx_user_codes_is_used
        ON user_codes(is_used)
    `, (err) => {
        if (err) {
            console.error("Error creating is_used index:", err.message);
        }
    });

    db.run(`
        CREATE TRIGGER IF NOT EXISTS update_user_codes_timestamp
        AFTER UPDATE ON user_codes
        FOR EACH ROW
        BEGIN
            UPDATE user_codes
            SET updated_at = CURRENT_TIMESTAMP
            WHERE code = OLD.code;
        END;
    `, (err) => {
        if (err) {
            console.error("Error creating timestamp trigger:", err.message);
        }
    });
});

function generateUserCode() {
    return Math.floor(100000000 + Math.random() * 900000000).toString();
}

function generateUniqueUserCode(callback) {
    const code = generateUserCode();

    db.get(
        `SELECT code FROM user_codes WHERE code = ?`,
        [code],
        (err, row) => {
            if (err) {
                return callback(err);
            }

            if (row) {
                return generateUniqueUserCode(callback);
            }

            callback(null, code);
        }
    );
}

module.exports = {
    db,
    generateUserCode,
    generateUniqueUserCode
};
