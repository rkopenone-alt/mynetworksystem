const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'rescue.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    const requests = [
        { type: 'medical', status: 'pending', priority: 'Critical', urgency: 'high', sector: 'Sector 4', lat: 26.8467, lng: 80.9462 },
        { type: 'sos', status: 'pending', priority: 'Critical', urgency: 'high', sector: 'Sector 4', lat: 26.8470, lng: 80.9470 },
        { type: 'food', status: 'pending', priority: 'Normal', urgency: 'low', sector: 'Sector 4', lat: 26.8460, lng: 80.9450 },
        { type: 'supplies', status: 'pending', priority: 'Normal', urgency: 'low', sector: 'Sector 4', lat: 26.8455, lng: 80.9445 }
    ];

    requests.forEach(req => {
        db.run(`INSERT INTO rescue_requests (type, status, priority, urgency, sector, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.type, req.status, req.priority, req.urgency, req.sector, req.lat, req.lng],
            (err) => {
                if (err) console.error('Insert error:', err.message);
                else console.log(`Inserted ${req.type} request`);
            }
        );
    });
});

setTimeout(() => db.close(), 1000);
