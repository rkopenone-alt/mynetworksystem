const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'rescue.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err);
        return;
    }
    console.log('Database opened at', dbPath);
});

db.serialize(() => {
    db.all("SELECT * FROM users", (err, rows) => {
        if (err) console.error(err);
        console.log('=== USERS ===');
        console.log(rows);
    });

    db.all("SELECT * FROM rescue_requests", (err, rows) => {
        if (err) console.error(err);
        console.log('=== RESCUE REQUESTS ===');
        console.log(rows);
    });

    db.all("SELECT * FROM command_queue", (err, rows) => {
        if (err) console.error(err);
        console.log('=== COMMAND QUEUE ===');
        console.log(rows);
    });
});
db.close();
