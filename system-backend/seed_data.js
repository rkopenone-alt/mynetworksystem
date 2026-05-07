const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./rescue.db');

const rescuers = [
    { name: 'Officer Arjun Singh', phone: '919000000001', sn: 'MEM-01', pin: '123456' },
    { name: 'Officer Sarah Khan', phone: '919000000002', sn: 'MEM-02', pin: '123456' },
    { name: 'Officer Vikram Rao', phone: '919000000003', sn: 'MEM-03', pin: '123456' }
];

const publicUsers = [
    { name: 'Amit Kumar', phone: '918000000001', sn: 'PUB-01', pin: '123456' },
    { name: 'Sneha Reddy', phone: '918000000002', sn: 'PUB-02', pin: '123456' },
    { name: 'Priya Sharma', phone: '918000000003', sn: 'PUB-03', pin: '123456' }
];

db.serialize(() => {
    console.log('Seeding dummy data...');
    
    // Clear existing users for clean test (Optional, but user asked to feed data)
    // db.run("DELETE FROM users");

    const stmt = db.prepare("INSERT OR REPLACE INTO users (name, role, phone, serial_number, password, status) VALUES (?, ?, ?, ?, ?, 'active')");
    
    rescuers.forEach(r => {
        stmt.run(r.name, 'rescuer', r.phone, r.sn, r.pin);
    });
    
    publicUsers.forEach(p => {
        stmt.run(p.name, 'public', p.phone, p.sn, p.pin);
    });
    
    stmt.finalize();
    console.log('Dummy data seeded successfully.');
});

db.close();
