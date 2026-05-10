const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'rescue_system.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Insert a dummy group
    db.run(`INSERT OR IGNORE INTO groups (group_name, role_type, description, zone) VALUES ('Alpha Rescue Team', 'rescue', 'Primary elite rescue squad', 'Sector A')`);
    
    // Get group ID
    db.get("SELECT id FROM groups WHERE group_name = 'Alpha Rescue Team'", (err, row) => {
        if (err || !row) return console.error('Failed to get group id');
        const groupId = row.id;

        // Insert Rescuer User
        db.run(`
            INSERT OR IGNORE INTO users (device_id, phone, name, serial_number, role, password, status)
            VALUES ('RES-999', '9876543210', 'Test Rescuer', 'R-001', 'rescuer', 'rescuer123', 'active')
        `);

        // Get Rescuer User ID
        db.get("SELECT id FROM users WHERE phone = '9876543210'", (err, uRow) => {
            if (!err && uRow) {
                // Link User to Group
                db.run(`INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)`, [groupId, uRow.id]);
                console.log('Rescuer added and linked to group.');
            }
        });

        // Insert Public User
        db.run(`
            INSERT OR IGNORE INTO users (phone, name, serial_number, role, password, status)
            VALUES ('9123456780', 'Test Public User', 'PUB-001', 'public', 'public123', 'active')
        `, function(err) {
            if (!err) {
                console.log('Public user added.');
            }
        });
    });
});
