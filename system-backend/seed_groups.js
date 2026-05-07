const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./rescue.db');

const rescuers = [
    { name: 'Officer Arjun Singh', phone: '919000000001', sn: 'MEM-01', pin: '123456', group: 'Rescue team' },
    { name: 'Officer Sarah Khan', phone: '919000000002', sn: 'MEM-02', pin: '123456', group: 'Rescue team' },
    { name: 'Officer Vikram Rao', phone: '919000000003', sn: 'MEM-03', pin: '123456', group: 'Delivery team' },
    { name: 'Officer Neha Sharma', phone: '919000000004', sn: 'MEM-04', pin: '123456', group: 'Rescue team' },
    { name: 'Officer David Miller', phone: '919000000005', sn: 'MEM-05', pin: '123456', group: 'Delivery team' },
    { name: 'Officer Maria Gomez', phone: '919000000006', sn: 'MEM-06', pin: '123456', group: 'Delivery team' }
];

const groups = [
    { name: 'Rescue team', role: 'rescuer', desc: 'Primary emergency response and life saving' },
    { name: 'Delivery team', role: 'rescuer', desc: 'Food, medical supplies and logistics' }
];

async function seed() {
    console.log('Seeding Groups and Additional Rescuers...');
    
    return new Promise((resolve, reject) => {
        db.serialize(async () => {
            try {
                // 1. Create Groups
                const groupStmt = db.prepare("INSERT OR IGNORE INTO groups (group_name, role_type, description) VALUES (?, ?, ?)");
                groups.forEach(g => groupStmt.run(g.name, g.role, g.desc));
                groupStmt.finalize();

                // 2. Insert Rescuers
                const userStmt = db.prepare("INSERT OR REPLACE INTO users (name, role, phone, serial_number, password, status) VALUES (?, 'rescuer', ?, ?, ?, 'active')");
                rescuers.forEach(r => userStmt.run(r.name, r.phone, r.sn, r.pin));
                userStmt.finalize();

                // 3. Link Rescuers to Groups
                for (const r of rescuers) {
                    const user = await new Promise((res) => db.get("SELECT id FROM users WHERE serial_number = ?", [r.sn], (err, row) => res(row)));
                    const group = await new Promise((res) => db.get("SELECT id FROM groups WHERE group_name = ?", [r.group], (err, row) => res(row)));
                    
                    if (user && group) {
                        db.run("INSERT OR IGNORE INTO group_members (user_id, group_id) VALUES (?, ?)", [user.id, group.id]);
                        // Update member count
                        db.run("UPDATE groups SET member_count = (SELECT COUNT(*) FROM group_members WHERE group_id = ?) WHERE id = ?", [group.id, group.id]);
                    }
                }

                console.log('Groups and Rescuers seeded and linked successfully.');
                resolve();
            } catch (e) {
                reject(e);
            }
        });
    });
}

seed().then(() => db.close());
