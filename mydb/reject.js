const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const dataFolder = path.join(__dirname, "..", "data");

if (!fs.existsSync(dataFolder)) {
    fs.mkdirSync(dataFolder);
}

const dbPath = path.join(dataFolder, "rejected_users.sqlite");

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log("Connected to database.");
    }
});

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS rejected_users (
            id TEXT PRIMARY KEY,
            phone_number TEXT,
            password TEXT,
            rejection_reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    const requiredColumns = {
        phone_number: "TEXT",
        password: "TEXT",
        rejection_reason: "TEXT",
        created_at: "DATETIME DEFAULT CURRENT_TIMESTAMP"
    };

    db.all(`PRAGMA table_info(rejected_users)`, (err, columns) => {
        if (err) {
            return console.error(err.message);
        }

        const existing = columns.map(col => col.name);

        for (const [name, type] of Object.entries(requiredColumns)) {
            if (!existing.includes(name)) {
                db.run(`ALTER TABLE rejected_users ADD COLUMN ${name} ${type}`, (err) => {
                    if (err) {
                        console.error(`Error adding column ${name}:`, err.message);
                    } else {
                        console.log(`Added column: ${name}`);
                    }
                });
            }
        }
    });
});

function generateId() {
    return Math.floor(100000000 + Math.random() * 900000000).toString();
}

module.exports = {
    db,
    generateId
};