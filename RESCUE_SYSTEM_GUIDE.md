# 🛡️ Field Rescuer App: System Modernization Guide

This guide provides an overview of the modernized emergency response system, including credentials, architectural details, and operational workflows.

## 🚀 Tech Stack
- **Backend**: Node.js with Express.js (Port 3001)
- **Database**: SQLite3 (Persistent local storage via `rescue.db`)
- **Admin UI**: HTML5, Vanilla CSS (Premium Dark/Glassmorphism), Leaflet.js (Mapping), Lucide Icons.
- **Mobile Apps**: HTML5 PWA Prototypes (Field Rescuer App & Public SOS App).
- **Communication**: WebSockets (Real-time synchronization) & REST API.

---

## 🔐 Credentials & Grouping

### 👨‍✈️ Field Rescuer Team (Total 9)
All rescuers use the **Security PIN: 123456**. 
*Login via Member ID (e.g., MEM-01) or Phone Number.*

| Member ID | Name | Assigned Group | Primary Role |
|-----------|------|----------------|--------------|
| **MEM-01** | Arjun Singh | Rescue Team | SOS/Medical |
| **MEM-02** | Sarah Khan | Rescue Team | SOS/Medical |
| **MEM-04** | Neha Sharma | Rescue Team | SOS/Medical |
| **MEM-07** | Rahul Kumar | Rescue Team | SOS/Medical |
| **MEM-09** | Kevin Peter | Rescue Team | SOS/Medical |
| **MEM-03** | Vikram Rao | Delivery Team | Food/Supplies |
| **MEM-05** | David Miller | Delivery Team | Food/Supplies |
| **MEM-06** | Maria Gomez | Delivery Team | Food/Supplies |
| **MEM-08** | Anita Das | Delivery Team | Food/Supplies |

### 👤 Public Users (Citizen App)
All users use the **Security PIN: 123456**.

| User ID | Name | Mobile Number |
|---------|------|---------------|
| **PUB-01** | Amit Kumar | 918000000001 |
| **PUB-02** | Sneha Reddy | 918000000002 |
| **PUB-03** | Priya Sharma | 918000000003 |

---

## 🛠️ Local Hosting & Development

### 1. Start the Backend Server
Navigate to the `system-backend` directory and run:
```powershell
node server.js
```
The server runs on `http://localhost:3001`.

### 2. Access the Command Center
Open `preview-web-admin.html` in any modern web browser.
- The dashboard automatically refreshes based on the **Async Refresh Setting** (Default: 5s).
- Configuration can be changed in the **System Configuration** tab.

### 3. Database Reset & Seeding
If you need to wipe all data and restore the default state:
```powershell
node system-backend/hard_reset.js
```

---

## 🔄 Operational Workflows

### 1. Task Classification
- **Critical Tasks**: SOS Alerts (🚨), Pregnancy Rescue (🤰), Medical Emergencies (🏥).
  - Listed in the **Critical Operations Hub** for high-visibility tracking.
  - Generates immediate administrative alerts.
- **Normal Tasks**: Food Distribution (📦), Medical Deliveries (💊), General Supplies.
  - Listed in the **Command List** for routine coordination.

### 2. Real-time Re-assignment
All active missions can be redirected to a different officer or team using the `🔄 RE-ASSIGN` button. This updates the field worker's app immediately via the sync handshake.

### 3. Async Refresh Synchronization
- **Admin**: Configure the interval (5s to 5m) in the settings page.
- **Mobile Apps**: Automatically detect the server-set interval during the sync loop and adjust their background refresh rate to match.

---

*Last Updated: May 2026 • System Version 3.2.0*
