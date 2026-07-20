const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const dataFolder = path.join(__dirname, "..", "data");

if (!fs.existsSync(dataFolder)) {
    fs.mkdirSync(dataFolder);
}

const dbPath = path.join(dataFolder, "settings.sqlite");

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log("Connected to settings database.");
    }
});

db.serialize(() => {

    db.run(`
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY,

            allow_login INTEGER DEFAULT 1,
            allow_register INTEGER DEFAULT 1,

            maintenance_mode INTEGER DEFAULT 0,

            global_notice_enabled INTEGER DEFAULT 1,
            global_notice TEXT DEFAULT '{"title":"","description":""}',

            site_name TEXT DEFAULT 'Educational Platform',
            site_description TEXT DEFAULT '',

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`INSERT OR IGNORE INTO settings (id) VALUES (1)`);

    const requiredColumns = [
        "allow_login",
        "allow_register",
        "maintenance_mode",
        "global_notice_enabled",
        "global_notice",
        "site_name",
        "site_description"
    ];

    db.all(`PRAGMA table_info(settings)`, (err, columns) => {
        if (err) {
            return console.error(err.message);
        }

        const existing = columns.map(col => col.name);

        requiredColumns.forEach((name) => {
            if (!existing.includes(name)) {
                db.run(`ALTER TABLE settings ADD COLUMN ${name} TEXT`, (err) => {
                    if (err) {
                        console.error(`Error adding column ${name}:`, err.message);
                    } else {
                        console.log(`Added column: ${name}`);
                    }
                });
            }
        });
    });

});

module.exports = { db };