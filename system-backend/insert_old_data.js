const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('rescue.db');

db.serialize(() => {
    const payload1 = JSON.stringify({
        type: 'food',
        desc: 'OLD TEST TASK',
        priority: 'normal',
        zone: 'Sector B',
        team: 'Alpha Team',
        time: '05:20 PM',
        requesterName: 'Old User'
    });

    db.run(`
        INSERT INTO command_queue 
        (command_payload, command_type, status, created_at, acknowledged_at) 
        VALUES 
        (?, 'food', 'completed', datetime('now', '-2 days'), datetime('now', '-2 days'))
    `, [payload1], function(err) {
        if (err) {
            console.error(err);
        } else {
            console.log('Old entry 1 inserted successfully!');
        }
    });

    const payload2 = JSON.stringify({
        type: 'medical',
        desc: 'CRITICAL OLD TASK',
        priority: 'critical',
        zone: 'Sector A',
        team: 'Beta Team',
        time: '08:00 AM',
        requesterName: 'John Doe'
    });

    db.run(`
        INSERT INTO command_queue 
        (command_payload, command_type, status, created_at, acknowledged_at) 
        VALUES 
        (?, 'medical', 'completed', datetime('now', '-5 days'), datetime('now', '-5 days'))
    `, [payload2], function(err) {
        if (err) {
            console.error(err);
        } else {
            console.log('Old entry 2 inserted successfully!');
        }
    });
});
