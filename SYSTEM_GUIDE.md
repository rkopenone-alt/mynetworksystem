# 🛡️ Emergency Rescue Dispatch System - System Guide

This document contains critical information regarding the system architecture, credentials, and local deployment instructions.

## 🛠️ Technology Stack
- **Backend**: Node.js, Express.js
- **Database**: SQLite3 (`rescue.db`)
- **Realtime**: WebSockets (WS)
- **Frontend (Web Admin)**: HTML5, Vanilla JS, Lucide Icons, Leaflet Maps
- **Frontend (Mobile Apps)**: HTML5, CSS3, Vanilla JS (Mobile-first responsive prototypes)
- **Styling**: Premium Custom CSS (Dark/Light modes, Glassmorphism)

---

## 🔑 User Credentials (Demo / Testing)

### 👨‍✈️ Rescuer IDs (Login: Phone Number, Password: PIN)
*All rescuers use the PIN `123456` for testing.*

| Name | Group | Phone | Serial ID |
| :--- | :--- | :--- | :--- |
| **Arjun Singh** | Rescue Team | `919000000001` | MEM-01 |
| **Sarah Khan** | Rescue Team | `919000000002` | MEM-02 |
| **Neha Sharma** | Rescue Team | `919000000004` | MEM-04 |
| **Vikram Rao** | Delivery Team | `919000000003` | MEM-03 |
| **David Miller** | Delivery Team | `919000000005` | MEM-05 |
| **Maria Gomez** | Delivery Team | `919000000006` | MEM-06 |
| **Rahul Kumar** | Rescue Team | `919000000007` | MEM-07 |
| **Anita Das** | Delivery Team | `919000000008` | MEM-08 |
| **Kevin Peter** | Rescue Team | `919000000009` | MEM-09 |

### 👥 Public Citizen IDs (Login: Phone Number, Password: PIN)
| Name | Phone | Serial ID |
| :--- | :--- | :--- |
| **Amit Kumar** | `918000000001` | PUB-01 |
| **Sneha Reddy** | `918000000002` | PUB-02 |
| **Priya Sharma** | `918000000003` | PUB-03 |

---

## 📂 Project Structure & Deployment

### 🚀 How to Run Locally
1. **Kill existing ports** (if any):
   ```powershell
   npx kill-port 3001
   ```
2. **Start the Backend Server**:
   ```powershell
   cd system-backend
   node server.js
   ```
3. **Open Frontend Interfaces**:
   - **Web Admin**: Open `preview-web-admin.html` in your browser.
   - **Rescuer App**: Open `preview-rescuer.html` in your browser.
   - **Public App**: Open `preview-mobile-app.html` in your browser.

### 🔄 Database Management
- To reset all data and seed fresh dummy accounts:
  ```powershell
  node system-backend/hard_reset.js
  ```

---

## 📋 System Workflows

### 1. Task Categorization
- **Critical Tasks**: SOS Calls, Medical Emergencies, Pregnancy Assistance.
- **Normal Tasks**: Food Distribution, Medicine Delivery, Sanitary Supplies.

### 2. Admin Oversight
- **Action History**: Log is split into "Critical Task History" and "Normal Task History".
- **Live Command List**: Separated into "Critical Operations" and "Normal Logistics".
- **Member List**: Displays full details including encrypted IDs and passwords for administrative management.

### 3. Mobile Rescuer App
- **Task Feed**: Separated into "Critical Response" and "Normal Logistics" feeds.
- **Mission Logs**: Split into Critical and Normal history sections.

---

*Last Updated: 2026-05-07*
