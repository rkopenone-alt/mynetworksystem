const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'rescue.db');
const db = new sqlite3.Database(dbPath);

const tables = ['groups', 'rescue_requests', 'users', 'group_members', 'command_queue'];

db.serialize(() => {
    tables.forEach(table => {
        db.all(`PRAGMA table_info(${table})`, [], (err, rows) => {
            if (err) {
                console.error(`Error checking ${table}:`, err);
                return;
            }
            console.log(`Schema for ${table}:`);
            console.log(JSON.stringify(rows, null, 2));
        });
    });
});

setTimeout(() => db.close(), 2000);
