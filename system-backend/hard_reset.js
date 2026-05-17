const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./rescue.db');

const rescuers = [
    { name: 'Arjun Singh', phone: '919000000001', sn: 'MEM-01', pin: '123456', group: 'Alpha Rescue' },
    { name: 'Sarah Khan', phone: '919000000002', sn: 'MEM-02', pin: '123456', group: 'Alpha Rescue' },
    { name: 'Neha Sharma', phone: '919000000004', sn: 'MEM-04', pin: '123456', group: 'Alpha Rescue' },
    { name: 'Vikram Rao', phone: '919000000003', sn: 'MEM-03', pin: '123456', group: 'Bravo Delivery' },
    { name: 'David Miller', phone: '919000000005', sn: 'MEM-05', pin: '123456', group: 'Bravo Delivery' },
    { name: 'Maria Gomez', phone: '919000000006', sn: 'MEM-06', pin: '123456', group: 'Bravo Delivery' }
];

const publicUsers = [
    { name: 'Amit Kumar', phone: '918000000001', sn: 'PUB-01', pin: '123456' },
    { name: 'Sneha Reddy', phone: '918000000002', sn: 'PUB-02', pin: '123456' },
    { name: 'Priya Sharma', phone: '918000000003', sn: 'PUB-03', pin: '123456' }
];

const groups = [
    { name: 'Alpha Rescue', role: 'rescuer', desc: 'Primary emergency response and life saving' },
    { name: 'Bravo Delivery', role: 'rescuer', desc: 'Food, medical supplies and logistics' }
];

async function hardReset() {
    console.log('Performing Hard Reset of Database...');
    
    return new Promise((resolve, reject) => {
        db.serialize(async () => {
            try {
                // 1. Clear Existing Data (Drop and Recreate)
                db.run("DROP TABLE IF EXISTS users");
                db.run("DROP TABLE IF EXISTS groups");
                db.run("DROP TABLE IF EXISTS group_members");
                db.run("DROP TABLE IF EXISTS rescue_requests");
                db.run("DROP TABLE IF EXISTS command_queue");
                db.run("DROP TABLE IF EXISTS settings");
                db.run("DROP TABLE IF EXISTS operation_zones");
                db.run("DROP TABLE IF EXISTS command_log");
                db.run("DROP TABLE IF EXISTS notifications");
                db.run("DROP TABLE IF EXISTS sos_alerts");
                db.run("DROP TABLE IF EXISTS rescuer_locations");
                db.run("DROP TABLE IF EXISTS operation_types");
                db.run("DROP TABLE IF EXISTS map_cache");

                // 2. Re-create Tables (Synced with server.js)
                db.run(`CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT, role TEXT, phone TEXT UNIQUE, device_id TEXT, serial_number TEXT, password TEXT, 
                    status TEXT DEFAULT 'active', photo_url TEXT, last_seen DATETIME,
                    registered_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);
                db.run(`CREATE TABLE IF NOT EXISTS groups (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    group_name TEXT, role_type TEXT, description TEXT
                )`);
                db.run(`CREATE TABLE IF NOT EXISTS group_members (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, group_id INTEGER, assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, group_id)
                )`);
                db.run(`CREATE TABLE IF NOT EXISTS rescue_requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    device_id TEXT, phone TEXT, type TEXT DEFAULT 'pregnancy', lat REAL, lng REAL, details TEXT, status TEXT DEFAULT 'pending', urgency TEXT DEFAULT 'high', sector TEXT, assigned_user_id INTEGER, assigned_group_id INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);
                db.run(`CREATE TABLE IF NOT EXISTS command_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    group_id INTEGER,
                    target_phone TEXT,
                    operation_zone_id INTEGER,
                    command_payload TEXT,
                    command_type TEXT DEFAULT 'zone',
                    status TEXT DEFAULT 'pending',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    acknowledged_at DATETIME
                )`);
                db.run(`CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY, value TEXT
                )`);
                db.run(`CREATE TABLE IF NOT EXISTS notifications (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    device_id TEXT, type TEXT, message TEXT, action_required INTEGER DEFAULT 0, action_taken TEXT, read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);
                db.run(`CREATE TABLE IF NOT EXISTS command_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT, actor TEXT DEFAULT 'Commander', target TEXT, details TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);
                db.run(`CREATE TABLE IF NOT EXISTS sos_alerts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, device_id TEXT, phone TEXT, lat REAL, lng REAL, details TEXT, status TEXT DEFAULT 'active', is_priority INTEGER DEFAULT 0, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);
                db.run(`CREATE TABLE IF NOT EXISTS operation_history (
                    id TEXT PRIMARY KEY, name TEXT, date TEXT, zone_data TEXT, status TEXT DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);

                // 3. Create Groups
                const groupStmt = db.prepare("INSERT INTO groups (group_name, role_type, description) VALUES (?, ?, ?)");
                groups.forEach(g => groupStmt.run(g.name, g.role, g.desc));
                groupStmt.finalize();

                // 4. Insert Rescuers
                const rescuerStmt = db.prepare("INSERT INTO users (name, role, phone, serial_number, password, status) VALUES (?, 'rescuer', ?, ?, ?, 'active')");
                rescuers.forEach(r => rescuerStmt.run(r.name, r.phone, r.sn, r.pin));
                rescuerStmt.finalize();

                // 5. Insert Public Users
                const publicStmt = db.prepare("INSERT INTO users (name, role, phone, serial_number, password, status) VALUES (?, 'public', ?, ?, ?, 'active')");
                publicUsers.forEach(p => publicStmt.run(p.name, p.phone, p.sn, p.pin));
                publicStmt.finalize();

                // 6. Link Rescuers to Groups
                for (const r of rescuers) {
                    const user = await new Promise((res) => db.get("SELECT id FROM users WHERE serial_number = ?", [r.sn], (err, row) => res(row)));
                    const group = await new Promise((res) => db.get("SELECT id FROM groups WHERE group_name = ?", [r.group], (err, row) => res(row)));
                    
                    if (user && group) {
                        db.run("INSERT INTO group_members (user_id, group_id) VALUES (?, ?)", [user.id, group.id]);
                    }
                }
                
                // 7. Add default settings
                db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('sos_interval', '15')`);
                db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('refresh_interval', '5')`);
                db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('retry_intervals', '3, 7, 15')`);

                // 8. Ready for live testing
                console.log('No dummy requests added. System is clean.');


                console.log('Database Hard Reset and Seeding Completed Successfully.');
                resolve();
            } catch (e) {
                console.error('Reset error:', e);
                reject(e);
            }
        });
    });
}

hardReset().then(() => db.close());
