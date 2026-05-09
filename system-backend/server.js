const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ─── Database Setup ──────────────────────────────────────────────────────────
const db = new sqlite3.Database('./rescue.db', (err) => {
    if (err) console.error('DB Error:', err);
    else console.log('Connected to SQLite DB');
});

const run = (sql, params = []) => new Promise((res, rej) =>
    db.run(sql, params, function (err) { err ? rej(err) : res(this); }));

const all = (sql, params = []) => new Promise((res, rej) =>
    db.all(sql, params, (err, rows) => { err ? rej(err) : res(rows); }));

const get = (sql, params = []) => new Promise((res, rej) =>
    db.get(sql, params, (err, row) => { err ? rej(err) : res(row); }));

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS operation_zones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        zone_geometry TEXT,
        operation_type TEXT,
        operation_type_id INTEGER,
        assigned_group_id INTEGER,
        zone_name TEXT DEFAULT 'Zone',
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'active',
        radius REAL,
        radius_unit TEXT DEFAULT 'KM'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS rescuer_task_completions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER,
        rescuer_id INTEGER,
        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(task_id, rescuer_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_name TEXT UNIQUE,
        member_count INTEGER DEFAULT 0,
        role_type TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'rescuer',
        phone TEXT UNIQUE,
        device_id TEXT,
        serial_number TEXT,
        photo_url TEXT,
        password TEXT,
        status TEXT DEFAULT 'active',
        last_seen DATETIME,
        registered_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    // Alter existing table to add columns if not exists
    db.run(`ALTER TABLE users ADD COLUMN password TEXT`, (err) => { /* ignore */ });
    db.run(`ALTER TABLE users ADD COLUMN serial_number TEXT`, (err) => { /* ignore */ });
    db.run(`ALTER TABLE rescue_requests ADD COLUMN assigned_phone TEXT`, (err) => { /* ignore */ });
    db.run(`ALTER TABLE rescue_requests ADD COLUMN phone TEXT`, (err) => { /* ignore */ });

    // Backfill serial numbers for existing users
    db.all("SELECT id, role FROM users WHERE serial_number IS NULL", [], (err, rows) => {
        if (rows) {
            rows.forEach((row, idx) => {
                const prefix = row.role === 'public' ? 'PUB' : 'MEM';
                const sn = `${prefix}-${String(idx + 1).padStart(2, '0')}`;
                db.run("UPDATE users SET serial_number = ? WHERE id = ?", [sn, row.id]);
            });
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS group_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        group_id INTEGER,
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, group_id)
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
    db.run(`ALTER TABLE command_queue ADD COLUMN target_phone TEXT`, (err) => { /* ignore */ });
    db.run(`ALTER TABLE command_queue ADD COLUMN command_type TEXT DEFAULT 'zone'`, (err) => { /* ignore */ });
    db.run(`ALTER TABLE command_queue ADD COLUMN priority TEXT DEFAULT 'normal'`, (err) => { /* ignore */ });

    db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sos_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT,
        phone TEXT,
        lat REAL,
        lng REAL,
        details TEXT,
        status TEXT DEFAULT 'active',
        is_priority INTEGER DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS rescuer_locations (
        device_id TEXT PRIMARY KEY,
        group_id INTEGER,
        name TEXT,
        lat REAL,
        lng REAL,
        status TEXT DEFAULT 'active',
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);



    db.run(`CREATE TABLE IF NOT EXISTS operation_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT DEFAULT '#3b82f6',
        icon TEXT DEFAULT '🛡️',
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS map_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT,
        center_lat REAL,
        center_lng REAL,
        radius_km REAL,
        state TEXT,
        district TEXT,
        tile_count INTEGER DEFAULT 0,
        size_mb REAL DEFAULT 0,
        downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used DATETIME
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS command_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT,
        actor TEXT DEFAULT 'Commander',
        target TEXT,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT,
        type TEXT,
        message TEXT,
        action_required INTEGER DEFAULT 0,
        action_taken TEXT,
        read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS rescue_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT,
        phone TEXT,
        type TEXT DEFAULT 'pregnancy',
        lat REAL,
        lng REAL,
        details TEXT,
        status TEXT DEFAULT 'pending',
        urgency TEXT DEFAULT 'high',
        sector TEXT,
        assigned_user_id INTEGER,
        assigned_group_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Default settings
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('sos_interval', '15')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('sos_interval_unit', 'minutes')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('sharing_protocol', 'auto')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('refresh_interval', '5')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('normal_task_grouping_radius', '2')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('normal_task_grouping_unit', 'KM')`);

    // Default operation types
    db.run(`INSERT OR IGNORE INTO operation_types (name, color, icon) VALUES ('Rescue', '#3b82f6', '🛡️')`);
    db.run(`INSERT OR IGNORE INTO operation_types (name, color, icon) VALUES ('Medical', '#10b981', '🏥')`);
    db.run(`INSERT OR IGNORE INTO operation_types (name, color, icon) VALUES ('Food Supply', '#f59e0b', '🍱')`);
    db.run(`INSERT OR IGNORE INTO operation_types (name, color, icon) VALUES ('Evacuation', '#ef4444', '🚨')`);

    // Default groups
    db.get("SELECT COUNT(*) as count FROM groups", [], (err, row) => {
        if (row && row.count === 0) {
            db.run(`INSERT INTO groups (group_name, member_count, role_type) VALUES ('Group Alpha', 12, 'rescue')`);
            db.run(`INSERT INTO groups (group_name, member_count, role_type) VALUES ('Group Bravo', 5, 'food')`);
            db.run(`INSERT INTO groups (group_name, member_count, role_type) VALUES ('Group Charlie', 8, 'medical')`);
        }
    });

    // Default users
    db.get("SELECT COUNT(*) as count FROM users", [], (err, row) => {
        if (row && row.count === 0) {
            db.run(`INSERT INTO users (name, role, phone, device_id, serial_number, password) VALUES ('Arjun Singh', 'rescuer', '919000000001', 'DEV_001', 'MEM-01', '123456')`);
            db.run(`INSERT INTO users (name, role, phone, device_id, serial_number, password) VALUES ('Sarah Khan', 'rescuer', '919000000002', 'DEV_002', 'MEM-02', '123456')`);
            db.run(`INSERT INTO users (name, role, phone, device_id, serial_number, password) VALUES ('Amit Kumar', 'public', '918000000001', '918000000001', 'PUB-01', '123456')`);
            db.run(`INSERT INTO users (name, role, phone, device_id, serial_number, password) VALUES ('Vikram Rao', 'rescuer', '919000000003', 'DEV_003', 'MEM-03', '123456')`);
            db.run(`INSERT INTO users (name, role, phone, device_id, serial_number, password) VALUES ('Neha Sharma', 'rescuer', '919000000004', 'DEV_004', 'MEM-04', '123456')`);
        }
    });

    // Default rescue requests
    db.get("SELECT COUNT(*) as count FROM rescue_requests", [], (err, row) => {
        if (row && row.count === 0) {
            db.run(`INSERT INTO rescue_requests (device_id, type, lat, lng, details, urgency, sector) VALUES ('IND_USER_99', 'pregnancy', 13.085, 80.272, 'Labor initiated, urgent medical transport needed', 'critical', 'Sector 4')`);
            db.run(`INSERT INTO rescue_requests (device_id, type, lat, lng, details, urgency, sector) VALUES ('IND_USER_99', 'medical', 13.090, 80.260, 'Critical injury, cardiac arrest reported', 'high', 'Block 7')`);
            db.run(`INSERT INTO rescue_requests (device_id, type, lat, lng, details, urgency, sector) VALUES ('IND_USER_99', 'pregnancy', 13.075, 80.280, 'Pregnant woman stranded on second floor', 'high', 'Sector 2')`);
            db.run(`INSERT INTO rescue_requests (device_id, type, lat, lng, details, urgency, sector) VALUES ('IND_USER_99', 'medical', 13.068, 80.278, 'Multiple casualties, building collapse', 'critical', 'Sector 5')`);
        }
    });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
const broadcast = (type, data) => {
    wss.clients.forEach(client => {
        if (client.readyState === 1) client.send(JSON.stringify({ type, data }));
    });
};

const logCommand = async (action, actor, target, details) => {
    try {
        await run(`INSERT INTO command_log (action, actor, target, details) VALUES (?, ?, ?, ?)`,
            [action, actor, target, JSON.stringify(details)]);
        broadcast('COMMAND_LOG', { action, actor, target, details, timestamp: new Date().toISOString() });
    } catch (e) { console.error('Log error:', e); }
};

const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const groupTasks = async () => {
    const radiusSetting = await get(`SELECT value FROM settings WHERE key = 'normal_task_grouping_radius'`);
    const unitSetting = await get(`SELECT value FROM settings WHERE key = 'normal_task_grouping_unit'`);
    const radius = parseFloat(radiusSetting.value);
    const radiusInKm = unitSetting.value === 'MTR' ? radius / 1000 : radius;

    // Get all pending normal tasks
    const normalTypes = ['food', 'medical supply', 'other supply', 'supply'];
    const tasks = await all(`SELECT * FROM rescue_requests WHERE status = 'pending'`);
    const normalTasks = tasks.filter(t => normalTypes.some(type => t.type.toLowerCase().includes(type)));

    // Deactivate old zones for normal tasks
    await run(`UPDATE operation_zones SET status = 'inactive' WHERE zone_name LIKE 'Grouped Task Zone%'`);

    const groups = [];
    normalTasks.forEach(task => {
        let addedToGroup = false;
        for (const group of groups) {
            const dist = getDistance(task.lat, task.lng, group.center.lat, group.center.lng);
            if (dist <= radiusInKm) {
                group.tasks.push(task);
                addedToGroup = true;
                break;
            }
        }
        if (!addedToGroup) {
            groups.push({ center: { lat: task.lat, lng: task.lng }, tasks: [task] });
        }
    });

    for (const group of groups) {
        if (group.tasks.length > 0) {
            const zone_geometry = {
                type: 'Circle',
                center: group.center,
                radius: radiusInKm * 1000 // meters for Leaflet
            };
            const zone_name = `Grouped Task Zone (${group.tasks.length} tasks)`;
            const opType = group.tasks[0].type;
            
            const result = await run(
                `INSERT INTO operation_zones (zone_geometry, operation_type, zone_name, radius, radius_unit) VALUES (?, ?, ?, ?, ?)`,
                [JSON.stringify(zone_geometry), opType, zone_name, radius, unitSetting.value]
            );
            const zoneId = result.lastID;

            for (const task of group.tasks) {
                await run(`UPDATE rescue_requests SET sector = ? WHERE id = ?`, [zone_name, task.id]);
            }
        }
    }
    broadcast('RELOAD_MAP', {});
    await logCommand('TASKS_REGROUPED', 'System', 'All Tasks', { radius, unit: unitSetting.value });
};

// ─── Zones ────────────────────────────────────────────────────────────────────
app.get('/api/zones', async (req, res) => {
    try { res.json(await all(`SELECT oz.*, g.group_name FROM operation_zones oz LEFT JOIN groups g ON oz.assigned_group_id = g.id`)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/zones', async (req, res) => {
    const { zone_geometry, operation_type, operation_type_id, assigned_group_id, created_by, zone_name } = req.body;
    try {
        const result = await run(
            `INSERT INTO operation_zones (zone_geometry, operation_type, operation_type_id, assigned_group_id, created_by, zone_name) VALUES (?, ?, ?, ?, ?, ?)`,
            [JSON.stringify(zone_geometry), operation_type, operation_type_id, assigned_group_id, created_by, zone_name || 'Zone']
        );
        const zoneId = result.lastID;
        const payload = JSON.stringify({ zoneId, zone_geometry, operation_type, zone_name });

        // Create command queue entry
        await run(`INSERT INTO command_queue (group_id, operation_zone_id, command_payload) VALUES (?, ?, ?)`,
            [assigned_group_id, zoneId, payload]);

        // Create notifications for all members of the group
        const members = await all(`SELECT u.device_id, u.name FROM group_members gm JOIN users u ON gm.user_id = u.id WHERE gm.group_id = ?`, [assigned_group_id]);
        for (const m of members) {
            await run(`INSERT INTO notifications (device_id, type, message, action_required) VALUES (?, ?, ?, ?)`,
                [m.device_id, 'new_task', `Your new task is updated. Zone: ${zone_name || 'Zone'} - ${operation_type}. Please confirm to get into new task.`, 1]);
        }

        broadcast('NEW_ZONE', { id: zoneId, zone_geometry, operation_type, assigned_group_id, zone_name });
        await logCommand('ZONE_CREATED', created_by || 'Commander', `Zone: ${zone_name}`, { operation_type, assigned_group_id });
        res.json({ id: zoneId, message: 'Zone created and assigned' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/zones/:id', async (req, res) => {
    try {
        await run(`UPDATE operation_zones SET status = 'inactive' WHERE id = ?`, [req.params.id]);
        await logCommand('ZONE_DELETED', 'Commander', `Zone ID: ${req.params.id}`, {});
        res.json({ message: 'Zone deactivated' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Groups ───────────────────────────────────────────────────────────────────
app.get('/api/groups', async (req, res) => {
    try { res.json(await all(`SELECT g.*, COUNT(gm.id) as actual_count FROM groups g LEFT JOIN group_members gm ON g.id = gm.group_id GROUP BY g.id`)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/groups', async (req, res) => {
    const { group_name, role_type, description } = req.body;
    try {
        const result = await run(`INSERT INTO groups (group_name, role_type, description) VALUES (?, ?, ?)`, [group_name, role_type, description]);
        await logCommand('GROUP_CREATED', 'Commander', group_name, { role_type });
        const grp = await get(`SELECT * FROM groups WHERE id = ?`, [result.lastID]);
        broadcast('GROUP_UPDATE', grp);
        res.json(grp);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/groups/:id', async (req, res) => {
    const { group_name, role_type, description } = req.body;
    try {
        await run(`UPDATE groups SET group_name = ?, role_type = ?, description = ? WHERE id = ?`, [group_name, role_type, description, req.params.id]);
        const grp = await get(`SELECT * FROM groups WHERE id = ?`, [req.params.id]);
        broadcast('GROUP_UPDATE', grp);
        res.json(grp);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/groups/:id', async (req, res) => {
    try {
        await run(`DELETE FROM groups WHERE id = ?`, [req.params.id]);
        await run(`DELETE FROM group_members WHERE group_id = ?`, [req.params.id]);
        broadcast('GROUP_DELETED', { id: parseInt(req.params.id) });
        res.json({ message: 'Group deleted' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/groups/:id/members', async (req, res) => {
    try { res.json(await all(`SELECT u.* FROM group_members gm JOIN users u ON gm.user_id = u.id WHERE gm.group_id = ?`, [req.params.id])); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/groups/:id/members', async (req, res) => {
    const { user_id } = req.body;
    try {
        await run(`INSERT OR IGNORE INTO group_members (user_id, group_id) VALUES (?, ?)`, [user_id, req.params.id]);
        await run(`UPDATE groups SET member_count = (SELECT COUNT(*) FROM group_members WHERE group_id = ?) WHERE id = ?`, [req.params.id, req.params.id]);
        const grp = await get(`SELECT * FROM groups WHERE id = ?`, [req.params.id]);
        broadcast('GROUP_UPDATE', grp);
        res.json({ message: 'Member added' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/groups/:id/members/:userId', async (req, res) => {
    try {
        await run(`DELETE FROM group_members WHERE group_id = ? AND user_id = ?`, [req.params.id, req.params.userId]);
        await run(`UPDATE groups SET member_count = (SELECT COUNT(*) FROM group_members WHERE group_id = ?) WHERE id = ?`, [req.params.id, req.params.id]);
        res.json({ message: 'Member removed' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Users ────────────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
    const { phone, password } = req.body; // 'phone' here is the identifier (could be actual phone or SN)
    try {
        const user = await get(`SELECT * FROM users WHERE (phone = ? OR serial_number = ?) AND password = ? AND status = 'active'`, [phone, phone, password]);
        if (user) {
            // Fetch groups for user
            const userGroups = await all(`SELECT g.* FROM group_members gm JOIN groups g ON gm.group_id = g.id WHERE gm.user_id = ?`, [user.id]);
            user.groups = userGroups;
            res.json(user);
        } else {
            res.status(401).json({ error: 'Invalid credentials or inactive account' });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:id/history', async (req, res) => {
    try {
        // Fetch tasks accepted/completed by this rescuer
        const history = await all(`SELECT * FROM rescue_requests WHERE assigned_user_id = ? ORDER BY updated_at DESC LIMIT 50`, [req.params.id]);
        res.json(history);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users', async (req, res) => {
    try {
        const users = await all(`SELECT * FROM users ORDER BY registered_at DESC`);
        for (let user of users) {
            const userGroups = await all(`SELECT g.* FROM group_members gm JOIN groups g ON gm.group_id = g.id WHERE gm.user_id = ?`, [user.id]);
            user.groups = userGroups;
        }
        res.json(users);
    }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users', async (req, res) => {
    const { name, role, phone, device_id, group_ids, photo_url, password, serial_number } = req.body;
    try {
        const result = await run(`INSERT INTO users (name, role, phone, device_id, photo_url, password, serial_number) VALUES (?, ?, ?, ?, ?, ?, ?)`, [name, role, phone, device_id, photo_url, password, serial_number]);
        const userId = result.lastID;

        if (group_ids && Array.isArray(group_ids)) {
            for (const gid of group_ids) {
                await run(`INSERT OR IGNORE INTO group_members (user_id, group_id) VALUES (?, ?)`, [userId, gid]);
            }
        }

        const user = await get(`SELECT * FROM users WHERE id = ?`, [userId]);
        const userGroups = await all(`SELECT g.* FROM group_members gm JOIN groups g ON gm.group_id = g.id WHERE gm.user_id = ?`, [userId]);
        user.groups = userGroups;

        await logCommand('USER_ADDED', 'Commander', name, { role, group_ids });
        res.json(user);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/users/:id', async (req, res) => {
    const { name, role, phone, device_id, status, group_ids, photo_url, password, serial_number } = req.body;
    const userId = req.params.id;
    try {
        await run(`UPDATE users SET name = ?, role = ?, phone = ?, device_id = ?, status = ?, photo_url = ?, password = ?, serial_number = ? WHERE id = ?`, [name, role, phone, device_id, status, photo_url, password, serial_number, userId]);

        if (group_ids && Array.isArray(group_ids)) {
            await run(`DELETE FROM group_members WHERE user_id = ?`, [userId]);
            for (const gid of group_ids) {
                await run(`INSERT OR IGNORE INTO group_members (user_id, group_id) VALUES (?, ?)`, [userId, gid]);
            }
        }

        const user = await get(`SELECT * FROM users WHERE id = ?`, [userId]);
        const userGroups = await all(`SELECT g.* FROM group_members gm JOIN groups g ON gm.group_id = g.id WHERE gm.user_id = ?`, [userId]);
        user.groups = userGroups;

        res.json(user);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        await run(`DELETE FROM users WHERE id = ?`, [req.params.id]);
        await run(`DELETE FROM group_members WHERE user_id = ?`, [req.params.id]);
        res.json({ message: 'User deleted' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Operation Types ──────────────────────────────────────────────────────────
app.get('/api/operation-types', async (req, res) => {
    try { res.json(await all(`SELECT * FROM operation_types ORDER BY name`)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/operation-types', async (req, res) => {
    const { name, color, icon, description } = req.body;
    try {
        const result = await run(`INSERT INTO operation_types (name, color, icon, description) VALUES (?, ?, ?, ?)`, [name, color, icon, description]);
        const ot = await get(`SELECT * FROM operation_types WHERE id = ?`, [result.lastID]);
        res.json(ot);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/operation-types/:id', async (req, res) => {
    const { name, color, icon, description } = req.body;
    try {
        await run(`UPDATE operation_types SET name = ?, color = ?, icon = ?, description = ? WHERE id = ?`, [name, color, icon, description, req.params.id]);
        const ot = await get(`SELECT * FROM operation_types WHERE id = ?`, [req.params.id]);
        res.json(ot);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/operation-types/:id', async (req, res) => {
    try {
        await run(`DELETE FROM operation_types WHERE id = ?`, [req.params.id]);
        res.json({ message: 'Operation type deleted' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Settings ─────────────────────────────────────────────────────────────────
app.get('/api/settings', async (req, res) => {
    try {
        const rows = await all(`SELECT * FROM settings`);
        const settings = {};
        rows.forEach(r => settings[r.key] = r.value);
        res.json(settings);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/settings', async (req, res) => {
    const { key, value } = req.body;
    try {
        await run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, value]);
        broadcast('SETTINGS_UPDATED', { key, value });
        res.json({ message: 'Settings updated' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Map Cache ────────────────────────────────────────────────────────────────
app.get('/api/map-cache', async (req, res) => {
    try { res.json(await all(`SELECT * FROM map_cache ORDER BY downloaded_at DESC`)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/map-cache', async (req, res) => {
    const { name, type, center_lat, center_lng, radius_km, state, district } = req.body;
    // Simulate tile count and size
    const approxTiles = Math.round((radius_km || 10) * (radius_km || 10) * 3.14 * 4);
    const sizeMb = parseFloat(((approxTiles * 15) / 1024).toFixed(2));
    try {
        const result = await run(
            `INSERT INTO map_cache (name, type, center_lat, center_lng, radius_km, state, district, tile_count, size_mb) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, type || 'radius', center_lat, center_lng, radius_km, state, district, approxTiles, sizeMb]
        );
        const entry = await get(`SELECT * FROM map_cache WHERE id = ?`, [result.lastID]);
        broadcast('MAP_DOWNLOADED', entry);
        res.json(entry);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/map-cache/:id', async (req, res) => {
    try {
        await run(`DELETE FROM map_cache WHERE id = ?`, [req.params.id]);
        res.json({ message: 'Map cache deleted' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Sync ─────────────────────────────────────────────────────────────────────
app.post('/api/sync', async (req, res) => {
    const { phone, deviceId, role, location, sosAlert } = req.body;

    // Identify user by phone (primary) or deviceId
    const identifier = phone || deviceId;
    if (!identifier) return res.status(400).json({ error: 'phone or deviceId required' });

    // Try to find user in DB
    let user = await get(`SELECT * FROM users WHERE phone = ? OR device_id = ?`, [identifier, identifier]);

    // If user exists and we have a new deviceId, update it (pairing)
    if (user && deviceId && user.device_id !== deviceId) {
        await run(`UPDATE users SET device_id = ? WHERE id = ?`, [deviceId, user.id]);
        user.device_id = deviceId;
    }

    const effectiveDeviceId = user ? user.device_id : (deviceId || identifier);

    if (location) {
        db.run(`INSERT OR REPLACE INTO rescuer_locations (device_id, group_id, name, lat, lng, last_updated) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [effectiveDeviceId, location.groupId, location.name || (user ? user.name : null), location.lat, location.lng]);
        broadcast('RESCUER_UPDATE', { deviceId: effectiveDeviceId, ...location });
    }

    if (sosAlert) {
        const details = JSON.stringify(sosAlert.details || {});
        const isPriority = sosAlert.isPriority || 0;
        db.run(`INSERT INTO sos_alerts (device_id, phone, lat, lng, details, is_priority) VALUES (?, ?, ?, ?, ?, ?)`,
            [effectiveDeviceId, phone || (user ? user.phone : null), sosAlert.lat, sosAlert.lng, details, isPriority], async function (err) {
                if (!err) {
                    const alertData = { id: this.lastID, deviceId: effectiveDeviceId, lat: sosAlert.lat, lng: sosAlert.lng, details: sosAlert.details, is_priority: isPriority };
                    broadcast('SOS_ALERT', alertData);
                    await logCommand('SOS_RECEIVED', effectiveDeviceId, 'Command Center', alertData);
                    // Notify public user
                    const msg = isPriority
                        ? 'Your priority SOS request is received. A rescue team has been dispatched to your location.'
                        : 'Your SOS request is received. Our rescue team will reach you shortly. Please stay calm.';
                    await run(`INSERT INTO notifications (device_id, type, message, action_required) VALUES (?, ?, ?, ?)`,
                        [effectiveDeviceId, 'sos_ack', msg, 0]);
                }
            });
    }

    // Return pending commands + notifications
    // If it's a rescuer, fetch commands for their group
    let userGroupIds = [];
    if (user) {
        const groups = await all(`SELECT group_id FROM group_members WHERE user_id = ?`, [user.id]);
        userGroupIds = groups.map(g => g.group_id);
    }

    const [commands, zones, setting, notifs, myRequests, refreshSetting] = await Promise.all([
        all(`SELECT * FROM command_queue WHERE status = 'pending'`),
        all(`SELECT * FROM operation_zones WHERE status = 'active'`),
        get(`SELECT value FROM settings WHERE key = 'sos_interval'`),
        all(`SELECT * FROM notifications WHERE (device_id = ? OR device_id = ?) AND read = 0`, [effectiveDeviceId, phone || effectiveDeviceId]),
        all(`SELECT id, type, status, sector, urgency, assigned_phone, updated_at FROM rescue_requests WHERE phone = ? OR device_id = ? ORDER BY created_at DESC LIMIT 5`, [phone || effectiveDeviceId, effectiveDeviceId]),
        get(`SELECT value FROM settings WHERE key = 'refresh_interval'`)
    ]);

    // Mark notifications as sent (read)
    if (notifs.length > 0) {
        await run(`UPDATE notifications SET read = 1 WHERE device_id = ? OR device_id = ?`, [effectiveDeviceId, phone || effectiveDeviceId]);
    }

    // Filter commands: return commands targeting this user's phone or their group
    const filteredCommands = commands.filter(c => {
        if (c.target_phone && phone && c.target_phone === phone) return true;
        if (c.target_phone && c.target_phone === effectiveDeviceId) return true;
        if (!c.target_phone && (!c.group_id || userGroupIds.includes(c.group_id))) return true;
        return false;
    });

    res.json({
        commands: filteredCommands,
        zones,
        sos_interval: setting ? setting.value : '15',
        refresh_interval: refreshSetting ? refreshSetting.value : '5',
        notifications: notifs,
        my_requests: myRequests,
        user: user ? { id: user.id, name: user.name, role: user.role, phone: user.phone } : null
    });
});

// ─── SOS ──────────────────────────────────────────────────────────────────────
app.get('/api/sos', async (req, res) => {
    try { res.json(await all(`SELECT * FROM sos_alerts ORDER BY timestamp DESC`)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/sos/:id/status', async (req, res) => {
    const { status } = req.body;
    try {
        await run(`UPDATE sos_alerts SET status = ? WHERE id = ?`, [status, req.params.id]);
        res.json({ message: 'Updated' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Rescuers ──────────────────────────────────────────────────────────────────
app.get('/api/rescuers', async (req, res) => {
    try { res.json(await all(`SELECT * FROM rescuer_locations`)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Rescue Requests ────────────────────────────────────────────────────────────
app.get('/api/rescue-requests', async (req, res) => {
    const { status } = req.query;
    try {
        let query = `SELECT * FROM rescue_requests`;
        let params = [];
        if (status) {
            query += ` WHERE status = ?`;
            params.push(status);
        }
        query += ` ORDER BY urgency DESC, created_at DESC`;
        res.json(await all(query, params));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/rescue-requests', async (req, res) => {
    const { device_id, phone, type, lat, lng, details, urgency, sector } = req.body;
    try {
        const result = await run(`INSERT INTO rescue_requests (device_id, phone, type, lat, lng, details, urgency, sector) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [device_id, phone, type || 'pregnancy', lat, lng, details, urgency || 'high', sector || 'Unknown Zone']);
        const reqData = await get(`SELECT * FROM rescue_requests WHERE id = ?`, [result.lastID]);
        broadcast('NEW_RESCUE_REQUEST', reqData);
        await logCommand('RESCUE_REQUEST_CREATED', phone || device_id, 'Command Center', reqData);

        // Notify the user
        await run(`INSERT INTO notifications (device_id, type, message, action_required) VALUES (?, ?, ?, ?)`,
            [device_id, 'rescue_ack', `Your priority ${type} rescue request is received. A team will be assigned shortly.`, 0]);

        res.json(reqData);
        
        // Trigger regrouping after new request for normal tasks
        const normalTypes = ['food', 'supply', 'medical supply'];
        if (normalTypes.some(t => (type || '').toLowerCase().includes(t))) {
            setTimeout(groupTasks, 500);
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/rescue-requests/:id/accept', async (req, res) => {
    const { assigned_user_id, assigned_group_id } = req.body;
    try {
        await run(`UPDATE rescue_requests SET status = 'accepted', assigned_user_id = ?, assigned_group_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [assigned_user_id, assigned_group_id, req.params.id]);

        const reqData = await get(`SELECT * FROM rescue_requests WHERE id = ?`, [req.params.id]);

        // Find assigned user phone and device
        let assignedPhone = null;
        let assignedDeviceId = null;
        let assignedName = 'Team';
        if (assigned_user_id) {
            const user = await get(`SELECT phone, device_id, name FROM users WHERE id = ?`, [assigned_user_id]);
            if (user) {
                assignedPhone = user.phone;
                assignedDeviceId = user.device_id;
                assignedName = user.name;
                
                await run(`INSERT INTO notifications (device_id, type, message, action_required) VALUES (?, ?, ?, ?)`,
                    [assignedDeviceId || assignedPhone, 'dispatch', `NEW DISPATCH: ${reqData.type.toUpperCase()} at ${reqData.sector}. Urgency: ${reqData.urgency}. Please proceed immediately.`, 1]);
            }
        }

        // Determine if this is a critical mission or a normal task
        // Priority from request or heuristic fallback
        let commandType = req.body.priority || 'critical';
        if (!req.body.priority) {
            if (['food', 'delivery', 'supply'].includes(reqData.type.toLowerCase())) {
                commandType = 'normal';
            } else if (reqData.urgency === 'low' || reqData.urgency === 'medium') {
                commandType = 'normal';
            }
        }

        // AUTO-CREATE COMMAND FOR ACCEPTED REQUEST
        const cmdPayload = JSON.stringify({
            message: `${reqData.type.toUpperCase()} ${commandType === 'normal' ? 'TASK' : 'RESCUE'} at ${reqData.sector}`,
            sector: reqData.sector,
            urgency: reqData.urgency,
            rescue_req_id: reqData.id,
            requester_name: reqData.name,
            requester_phone: reqData.phone,
            details: reqData.details // Include quantities if available
        });

        await run(`INSERT INTO command_queue (group_id, target_phone, command_type, command_payload, status, priority) VALUES (?, ?, ?, ?, 'accepted', ?)`,
            [assigned_group_id || null, assignedPhone || assignedDeviceId || null, commandType, cmdPayload, commandType]);

        // Notify the original requester
        await run(`INSERT INTO notifications (device_id, type, message, action_required) VALUES (?, ?, ?, ?)`,
            [reqData.device_id, 'rescue_dispatched', `Update: ${assignedName} has been assigned to your ${reqData.type} request. Stay safe!`, 0]);

        broadcast('RESCUE_REQUEST_ACCEPTED', { ...reqData, assignedName, assigned_phone: assignedPhone, priority: commandType });
        await logCommand('RESCUE_REQUEST_ACCEPTED', 'Commander', `Request ID: ${req.params.id}`, { assigned_user_id, assigned_group_id, commandType });
        res.json(reqData);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/rescue-requests/:id/decline', async (req, res) => {
    try {
        await run(`UPDATE rescue_requests SET status = 'declined', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [req.params.id]);
        const reqData = await get(`SELECT * FROM rescue_requests WHERE id = ?`, [req.params.id]);

        broadcast('RESCUE_REQUEST_DECLINED', reqData);
        await logCommand('RESCUE_REQUEST_DECLINED', 'Commander', `Request ID: ${req.params.id}`, {});
        res.json({ message: 'Request declined' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Status update for rescuer to mark completed
app.put('/api/rescue-requests/:id/status', async (req, res) => {
    const { status, rescuer_phone } = req.body;
    const validStatuses = ['pending', 'accepted', 'completed', 'declined', 'in_progress'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    try {
        await run(`UPDATE rescue_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [status, req.params.id]);
        const reqData = await get(`SELECT * FROM rescue_requests WHERE id = ?`, [req.params.id]);

        if (status === 'completed') {
            // Notify original requester
            if (reqData.device_id) {
                await run(`INSERT INTO notifications (device_id, type, message, action_required) VALUES (?, ?, ?, ?)`,
                    [reqData.device_id, 'rescue_completed', `✅ Your rescue mission is complete! The rescue team has reached you. Stay safe.`, 0]);
            }
            // Also notify by phone if available
            if (reqData.phone) {
                await run(`INSERT INTO notifications (device_id, type, message, action_required) VALUES (?, ?, ?, ?)`,
                    [reqData.phone, 'rescue_completed', `✅ Your rescue mission is complete! The rescue team has reached you. Stay safe.`, 0]);
            }
        }

        broadcast('RESCUE_REQUEST_' + status.toUpperCase(), reqData);
        await logCommand('RESCUE_STATUS_UPDATE', rescuer_phone || 'Rescuer', `Request ID: ${req.params.id}`, { status });
        
        // Multi-rescuer completion logic
        if (status === 'completed') {
            const rescuer = await get(`SELECT id FROM users WHERE phone = ? OR device_id = ?`, [rescuer_phone, rescuer_phone]);
            if (rescuer) {
                await run(`INSERT OR IGNORE INTO rescuer_task_completions (task_id, rescuer_id) VALUES (?, ?)`, [req.params.id, rescuer.id]);
                
                // Check if all assigned rescuers completed
                const assignedRescuers = await all(`SELECT user_id FROM group_members WHERE group_id = ?`, [reqData.assigned_group_id]);
                const completedRescuers = await all(`SELECT rescuer_id FROM rescuer_task_completions WHERE task_id = ?`, [req.params.id]);
                
                if (completedRescuers.length < assignedRescuers.length) {
                    // Not everyone completed yet, revert status to in_progress or similar
                    await run(`UPDATE rescue_requests SET status = 'in_progress' WHERE id = ?`, [req.params.id]);
                    broadcast('RESCUE_REQUEST_IN_PROGRESS', { ...reqData, status: 'in_progress', pending_completions: assignedRescuers.length - completedRescuers.length });
                } else {
                    // Everyone completed, dissolve zone if it was the last task
                    const zoneTasks = await all(`SELECT id FROM rescue_requests WHERE sector = ? AND status != 'completed'`, [reqData.sector]);
                    if (zoneTasks.length === 0) {
                        await run(`UPDATE operation_zones SET status = 'inactive' WHERE zone_name = ?`, [reqData.sector]);
                        broadcast('ZONE_DISSOLVED', { zone_name: reqData.sector });
                        await logCommand('ZONE_DISSOLVED', 'System', reqData.sector, {});
                    }
                }
            }
        }
        
        res.json(reqData);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/rescue-requests/:id/location', async (req, res) => {
    const { lat, lng } = req.body;
    if (!lat || !lng) return res.status(400).json({ error: 'Lat and Lng are required' });
    try {
        await run(`UPDATE rescue_requests SET lat = ?, lng = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [lat, lng, req.params.id]);
        const reqData = await get(`SELECT * FROM rescue_requests WHERE id = ?`, [req.params.id]);
        broadcast('RESCUE_REQUEST_LOCATION_UPDATED', reqData);
        await logCommand('RESCUE_LOCATION_UPDATE', 'Admin', `Request ID: ${req.params.id}`, { lat, lng });
        res.json(reqData);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get all commands for admin dashboard
app.get('/api/commands', async (req, res) => {
    try {
        // Try to join with rescue_requests to get requester details
        const commands = await all(`
            SELECT cq.*, 
                   rr.id as requester_db_id,
                   rr.name as requester_name, 
                   rr.phone as requester_phone, 
                   rr.details as requester_details,
                   rr.type as requester_type,
                   rr.lat as requester_lat,
                   rr.lng as requester_lng,
                   rr.urgency as requester_urgency,
                   rr.created_at as request_time
            FROM command_queue cq
            LEFT JOIN rescue_requests rr ON CAST(rr.id AS TEXT) = CAST(json_extract(cq.command_payload, '$.rescue_req_id') AS TEXT)
            ORDER BY cq.created_at DESC
        `);
        res.json(commands);
    } catch (e) { 
        // Fallback if json_extract is not supported
        try {
            const commands = await all(`SELECT * FROM command_queue ORDER BY created_at DESC`);
            res.json(commands);
        } catch (innerError) {
            res.status(500).json({ error: innerError.message });
        }
    }
});

app.put('/api/commands/:id/reassign', async (req, res) => {
    const { assigned_user_id, assigned_group_id } = req.body;
    const cmdId = req.params.id;
    try {
        let assignedPhone = null;
        let assignedDeviceId = null;
        let assignedName = 'Team';

        if (assigned_user_id) {
            const user = await get(`SELECT phone, device_id, name FROM users WHERE id = ?`, [assigned_user_id]);
            if (user) {
                assignedPhone = user.phone;
                assignedDeviceId = user.device_id;
                assignedName = user.name;
            }
        }

        await run(`UPDATE command_queue SET group_id = ?, target_phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [assigned_group_id || null, assignedPhone || assignedDeviceId || null, cmdId]);

        const cmd = await get(`SELECT * FROM command_queue WHERE id = ?`, [cmdId]);
        
        // Notify new assignee
        if (assignedPhone || assignedDeviceId) {
            await run(`INSERT INTO notifications (device_id, type, message, action_required) VALUES (?, ?, ?, ?)`,
                [assignedDeviceId || assignedPhone, 'direct_command', `🚨 RE-ASSIGNED TASK: ${JSON.parse(cmd.command_payload).message}. Please acknowledge.`, 1]);
        }

        broadcast('COMMAND_REASSIGNED', cmd);
        await logCommand('COMMAND_REASSIGNED', 'Commander', `CMD ID: ${cmdId}`, { assigned_user_id, assigned_group_id });
        res.json(cmd);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Direct command from admin to a specific rescuer/group
app.post('/api/commands', async (req, res) => {
    const { target_phone, target_user_id, group_id, command_type, command_payload, actor } = req.body;
    let effectivePhone = target_phone;

    try {
        if (target_user_id && !effectivePhone) {
            const user = await get(`SELECT phone, device_id FROM users WHERE id = ?`, [target_user_id]);
            if (user) effectivePhone = user.phone || user.device_id;
        }

        const result = await run(
            `INSERT INTO command_queue (group_id, target_phone, command_type, command_payload, priority) VALUES (?, ?, ?, ?, ?)`,
            [group_id || null, effectivePhone || null, command_type || 'direct', JSON.stringify(command_payload), req.body.priority || 'normal']
        );
        const cmd = await get(`SELECT * FROM command_queue WHERE id = ?`, [result.lastID]);

        // Push notification to target device if phone provided
        if (effectivePhone) {
            const msgText = typeof command_payload === 'string' ? command_payload : (command_payload.message || JSON.stringify(command_payload));
            const isCritical = command_type === 'critical';
            const urgencyText = isCritical ? '🚨 CRITICAL TASK:' : '📢 COMMAND FROM HQ:';
            await run(`INSERT INTO notifications (device_id, type, message, action_required) VALUES (?, ?, ?, ?)`,
                [target_phone, 'direct_command', `${urgencyText} ${msgText}`, 1]);
        } else if (group_id) {
            // Target group
            const msgText = typeof command_payload === 'string' ? command_payload : (command_payload.message || JSON.stringify(command_payload));
            const isCritical = command_type === 'critical';
            const urgencyText = isCritical ? '🚨 CRITICAL GROUP TASK:' : '📢 GROUP COMMAND:';
            const members = await all(`SELECT u.device_id FROM group_members gm JOIN users u ON gm.user_id = u.id WHERE gm.group_id = ?`, [group_id]);
            for (const m of members) {
                if (m.device_id) {
                    await run(`INSERT INTO notifications (device_id, type, message, action_required) VALUES (?, ?, ?, ?)`,
                        [m.device_id, 'direct_command', `${urgencyText} ${msgText}`, 1]);
                }
            }
        }

        broadcast('NEW_COMMAND', { id: cmd.id, target_phone, group_id, command_type: command_type || 'direct', payload: command_payload });
        await logCommand('COMMAND_ISSUED', actor || 'Commander', target_phone || `Group ${group_id}`, command_payload);
        res.json(cmd);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get rescue requests by phone (for Public App status polling)
app.get('/api/rescue-requests/by-phone/:phone', async (req, res) => {
    try {
        const p = req.params.phone;
        const reqs = await all(
            `SELECT * FROM rescue_requests WHERE device_id = ? OR (phone IS NOT NULL AND phone = ?) ORDER BY created_at DESC LIMIT 10`,
            [p, p]
        );
        res.json(reqs);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Acknowledge command as processed
app.put('/api/commands/:id/acknowledge', async (req, res) => {
    try {
        await run(`UPDATE command_queue SET status = 'acknowledged', acknowledged_at = CURRENT_TIMESTAMP WHERE id = ?`, [req.params.id]);
        res.json({ message: 'Acknowledged' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Update command status (accept, decline, complete)
app.put('/api/commands/:id/status', async (req, res) => {
    const { status, rescuer_phone } = req.body;
    const validStatuses = ['pending', 'accepted', 'declined', 'completed', 'acknowledged'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    try {
        await run(`UPDATE command_queue SET status = ? WHERE id = ?`, [status, req.params.id]);
        const cmdData = await get(`SELECT * FROM command_queue WHERE id = ?`, [req.params.id]);

        broadcast('COMMAND_STATUS_UPDATE', cmdData);
        await logCommand('COMMAND_STATUS_UPDATE', rescuer_phone || 'Rescuer', `Command ID: ${req.params.id}`, { status });
        res.json(cmdData);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/commands/:id/location', async (req, res) => {
    const { lat, lng } = req.body;
    if (!lat || !lng) return res.status(400).json({ error: 'Lat and Lng are required' });
    try {
        const cmd = await get(`SELECT * FROM command_queue WHERE id = ?`, [req.params.id]);
        if (!cmd) return res.status(404).json({ error: 'Command not found' });
        
        const payload = JSON.parse(cmd.command_payload || '{}');
        payload.lat = lat;
        payload.lng = lng;
        payload.coords = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        
        await run(`UPDATE command_queue SET command_payload = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, 
            [JSON.stringify(payload), req.params.id]);
            
        const updatedCmd = await get(`SELECT * FROM command_queue WHERE id = ?`, [req.params.id]);
        broadcast('COMMAND_LOCATION_UPDATED', updatedCmd);
        await logCommand('COMMAND_LOCATION_UPDATE', 'Admin', `Command ID: ${req.params.id}`, { lat, lng });
        res.json(updatedCmd);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Reassign an existing command
app.put('/api/commands/:id/reassign', async (req, res) => {
    const { target_phone, target_user_id, group_id } = req.body;
    let effectivePhone = target_phone;
    let effectiveGroupId = group_id;

    try {
        if (target_user_id && !effectivePhone) {
            const user = await get(`SELECT phone, device_id FROM users WHERE id = ?`, [target_user_id]);
            if (user) effectivePhone = user.phone || user.device_id;
        }

        await run(`UPDATE command_queue SET target_phone = ?, group_id = ?, status = 'pending' WHERE id = ?`, [effectivePhone || null, effectiveGroupId || null, req.params.id]);
        const cmdData = await get(`SELECT * FROM command_queue WHERE id = ?`, [req.params.id]);

        // Notify new target
        const payload = JSON.parse(cmdData.command_payload || '{}');
        const msgText = payload.message || 'You have been reassigned a task.';

        if (effectivePhone) {
            await run(`INSERT INTO notifications (device_id, type, message, action_required) VALUES (?, ?, ?, ?)`,
                [effectivePhone, 'direct_command', `🔄 REASSIGNED: ${msgText}`, 1]);
        } else if (effectiveGroupId) {
            const members = await all(`SELECT u.device_id, u.phone FROM group_members gm JOIN users u ON gm.user_id = u.id WHERE gm.group_id = ?`, [effectiveGroupId]);
            for (const m of members) {
                const target = m.phone || m.device_id;
                if (target) {
                    await run(`INSERT INTO notifications (device_id, type, message, action_required) VALUES (?, ?, ?, ?)`,
                        [target, 'direct_command', `🔄 REASSIGNED GROUP TASK: ${msgText}`, 1]);
                }
            }
        }

        broadcast('COMMAND_REASSIGNED', cmdData);
        await logCommand('COMMAND_REASSIGNED', 'Commander', `Command ID: ${req.params.id}`, { target_phone, group_id });
        res.json(cmdData);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/dashboard-stats', async (req, res) => {
    try {
        const [sosCount, sosCompleted, foodCount, foodCompleted, medCount, medCompleted] = await Promise.all([
            get(`SELECT COUNT(*) as count FROM sos_alerts WHERE status != 'completed'`),
            get(`SELECT COUNT(*) as count FROM sos_alerts WHERE status = 'completed'`),
            get(`SELECT COUNT(*) as count FROM command_queue WHERE command_payload LIKE '%food%' AND status != 'completed'`),
            get(`SELECT COUNT(*) as count FROM command_queue WHERE command_payload LIKE '%food%' AND status = 'completed'`),
            get(`SELECT COUNT(*) as count FROM command_queue WHERE command_payload LIKE '%medical%' AND status != 'completed'`),
            get(`SELECT COUNT(*) as count FROM command_queue WHERE command_payload LIKE '%medical%' AND status = 'completed'`),
        ]);

        // Simulating some ongoing/completed stats based on data
        res.json({
            sos: { ongoing: sosCount.count || 3, completed: sosCompleted.count || 9, total: (sosCount.count || 3) + (sosCompleted.count || 9) },
            food: { ongoing: foodCount.count || 3, completed: foodCompleted.count || 2, total: (foodCount.count || 3) + (foodCompleted.count || 2) },
            medical: { ongoing: medCount.count || 0, completed: medCompleted.count || 4, total: (medCount.count || 0) + (medCompleted.count || 4) }
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Command Log ─────────────────────────────────────────────────────────────
app.get('/api/command-log', async (req, res) => {
    try { res.json(await all(`SELECT * FROM command_log ORDER BY timestamp DESC LIMIT 500`)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Notifications ────────────────────────────────────────────────────────────
app.get('/api/notifications', async (req, res) => {
    const { device_id } = req.query;
    try {
        const rows = device_id
            ? await all(`SELECT * FROM notifications WHERE device_id = ? ORDER BY created_at DESC`, [device_id])
            : await all(`SELECT * FROM notifications ORDER BY created_at DESC LIMIT 200`);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/notifications/action', async (req, res) => {
    const { notification_id, action } = req.body;
    try {
        await run(`UPDATE notifications SET action_taken = ?, read = 1 WHERE id = ?`, [action, notification_id]);
        const n = await get(`SELECT * FROM notifications WHERE id = ?`, [notification_id]);
        broadcast('NOTIFICATION_ACTION', { notification_id, action, device_id: n?.device_id });
        res.json({ message: 'Action recorded' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Settings ─────────────────────────────────────────────────────────────────
app.get('/api/settings', async (req, res) => {
    try {
        const rows = await all(`SELECT * FROM settings`);
        const settings = {};
        rows.forEach(r => settings[r.key] = r.value);
        res.json(settings);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/settings', async (req, res) => {
    const { key, value } = req.body;
    try {
        await run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, String(value)]);
        broadcast('SETTINGS_UPDATED', { key, value });
        
        res.json({ message: 'Setting updated' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Excel Export ─────────────────────────────────────────────────────────────
app.get('/api/export/log', async (req, res) => {
    try {
        const logs = await all(`SELECT * FROM command_log ORDER BY timestamp ASC`);
        const sos = await all(`SELECT * FROM sos_alerts ORDER BY timestamp ASC`);

        let csv = '=== COMMAND LOG ===\r\nID,Action,Actor,Target,Details,Timestamp\r\n';
        logs.forEach(l => {
            csv += `${l.id},"${l.action}","${l.actor}","${l.target || ''}","${(l.details || '').replace(/"/g, "''")}","${l.timestamp}"\r\n`;
        });
        csv += '\r\n=== SOS ALERTS ===\r\nID,Device ID,Latitude,Longitude,Priority,Status,Timestamp\r\n';
        sos.forEach(s => {
            csv += `${s.id},"${s.device_id}",${s.lat},${s.lng},${s.is_priority || 0},"${s.status}","${s.timestamp}"\r\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="rescue_log.csv"');
        res.send(csv);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = 3001;
server.listen(PORT, () => console.log(`Rescue Backend running on http://localhost:${PORT}`));
