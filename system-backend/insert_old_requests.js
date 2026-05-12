const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('rescue.db');

db.serialize(() => {
    db.run(`
        INSERT INTO rescue_requests 
        (device_id, phone, type, urgency, sector, details, status, created_at, updated_at) 
        VALUES 
        ('TEST-1', '9999999991', 'food', 'normal', 'Sector A', '{"food": "15 packets", "sanitary": "5 kits", "persons": 10}', 'pending', datetime('now', '-1 hours'), datetime('now', '-1 hours'))
    `, function(err) {
        if (err) console.error(err);
        else console.log('Dummy request 1 inserted!');
    });

    db.run(`
        INSERT INTO rescue_requests 
        (device_id, phone, type, urgency, sector, details, status, created_at, updated_at) 
        VALUES 
        ('TEST-2', '9999999992', 'medical', 'critical', 'Sector B', '{"med": "First aid", "persons": 2}', 'pending', datetime('now', '-2 hours'), datetime('now', '-2 hours'))
    `, function(err) {
        if (err) console.error(err);
        else console.log('Dummy request 2 inserted!');
    });

    db.run(`
        INSERT INTO rescue_requests 
        (device_id, phone, type, urgency, sector, details, status, created_at, updated_at) 
        VALUES 
        ('TEST-3', '9999999993', 'sos', 'critical', 'Sector C', '{"persons": 5}', 'pending', datetime('now', '-3 hours'), datetime('now', '-3 hours'))
    `, function(err) {
        if (err) console.error(err);
        else console.log('Dummy request 3 inserted!');
    });
});
