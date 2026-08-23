const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const dataFolder = path.join(__dirname, "..", "data");

if (!fs.existsSync(dataFolder)) {
    fs.mkdirSync(dataFolder, { recursive: true });
}

const dbPath = path.join(dataFolder, "users.sqlite");

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log("Connected to database.");
    }
});

db.serialize(() => {
    db.run(`
        DROP TABLE IF EXISTS users
    `);

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
    `);

    db.run(`
        CREATE INDEX IF NOT EXISTS idx_user_codes_course_id
        ON user_codes(course_id)
    `);

    db.run(`
        CREATE INDEX IF NOT EXISTS idx_user_codes_is_used
        ON user_codes(is_used)
    `);

    db.run(`
        CREATE TRIGGER IF NOT EXISTS update_user_codes_timestamp
        AFTER UPDATE ON user_codes
        FOR EACH ROW
        BEGIN
            UPDATE user_codes
            SET updated_at = CURRENT_TIMESTAMP
            WHERE code = OLD.code;
        END;
    `);
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
