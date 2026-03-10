# CCAPDEV-Phase2-Group52
Task is to **develop the back-end portion** of selected web application.

### Deliverables
**zip file** containing **all files** for the machine project

## 🚀 Project Overview
- This project uses a Model-View-Controller (MVC) architecture with Node.js, Express, Handlebars, and MongoDB. This replaces our previous localStorage prototype with a centralized database to ensure data consistency across all users.

## 🛠️ Tech Stack & Design
- Runtime: Node.js
- Framework: Express.js
- Template Engine: Handlebars
- Database: MongoDB (via Mongoose)
- Frontend: Bootstrap 5.3, jQuery 3.7.1, and Bootstrap Icons
- Visual Assets: Appropriate graphics, including a custom pixel-art (made in Canva) and Bootstrap Icons, are used to represent lab status.

## 📋 Prerequisites
Ensure you have the following installed:
- Node.js (v18 or higher recommended)
- MongoDB (Ensure the service is running locally on port 27017)

## 🚀 How to Run
### 1. Clone the repository to your local machine.
### 2. Install dependencies:
```bash
npm install express express-handlebars mongoose express-session
```
### 3. Start MongoDB: Make sure your local MongoDB instance is running.
### 4. Seed the Database: Run the data loader script to initialize users and lab data:
```bash
node load-data.js
```
### 5. Start the Server:
```bash
node app.js
```
### 6. Access the app: Open your browser and go to http://localhost:3000

## 🏗️ Architectural Changes (Why it's different now)
- Database (MongoDB): We no longer use localStorage. All data is now persistent on the server
- MVC Pattern:
  - models/: Database schemas
  - controllers/: Logic for handling requests
  - views/: HBS (Handlebars) templates for the UI
  - public/js/: Client-side interactivity (the "messenger" scripts)

## ⚠️ Known Issues & To-Do (To be fixed)
Heads up that transition to the MVC/Database architecture is still ongoing!!
- Reservation Logic Integration:
  - Validation: The client-side rooms.js needs to enforce the 1-hour minimum (2 slots) and 2-hour maximum (4 slots) rules strictly before sending data to the server
  - Atomic Batching: The reserveMultiple controller needs to fully sync with the anonModal so that multi-slot reservations are saved as a single transaction
- UI Synchronization:
  - Reservation Reflection: Existing database reservations are not yet visually reflected in the rooms.hbs availability grid;
  - we need to ensure the timeslots loop correctly identifies reserved: true states
  - User Interaction Parity: Restore front-end UX features like password toggle visibility and the reservation anonymity toggle,
  - ensuring they now communicate with the back-end via fetch instead of localStorage
- User Management & Profile:
  - CRUD Actions: The Cancel Reservation and Edit Photo buttons in the user profile need to be wired to the respective profileCon.js and reservationCon.js controller methods
  - Navigation: Fix the 'Back' buttons across lab pages to ensure they return to the dashboard rather than the 'View Labs' list

## 🔑 Demo Credentials
The following accounts are hardcoded to demonstrate different role-based features:
| Role | Email | Password |
| :--- | :--- | :--- |
| Technician (Admin) | admin@dlsu.edu.ph | admin |
| Faculty | oliver.berris@dlsu.edu.ph | 123 |
| Student | tara_uy@dlsu.edu.ph | 456 |

## 📁 Submission Guidelines
- File Format: CCAPDEV-Phase2-Group52.zip
- Collaboration: Students collaborated through the group's GitHub repository.

## 📋 Members
This table details the group members:
| Team Member | Role |
| :--- | :--- |
| **Dale Vernard Balila** | - |
| **Ram Miguel Liwanag** | - |
| **John Albert Teoxon** | - |
| **Tara Ysabel Uy** | Currently debugging and making the back-end connect with the front-end |
