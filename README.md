# MediCare — Hospital Management System

Semester macro project: **patient records**, **doctor schedules**, **appointments**, and an **emergency priority queue** (binary min-heap).

## What it demonstrates

- Web: HTML, CSS, JavaScript dashboards for patient, doctor, admin, and emergency staff
- Backend: Node.js + Express + session login
- DBMS: MySQL tables, primary/foreign keys, unique appointment slots
- DSA: heap-based priority queue — critical cases are served before later, less severe arrivals; equal severity uses arrival time

## Screens

1. Home / landing
2. Patient dashboard
3. Appointment booking
4. Doctor dashboard
5. Emergency priority queue
6. Admin dashboard
7. Medical records

## Setup

1. Install [Node.js](https://nodejs.org/) and MySQL 8 (or run MySQL with Docker).
2. Copy environment values:

```
copy .env.example .env
```

3. Start MySQL. With Docker:

```
docker compose up -d
```

If you used Docker, the schema files in `sql/` load automatically. Still run step 4 so demo passwords are hashed correctly.

4. Install packages, seed data, start the server:

```
npm install
npm run init-db
npm start
```

Open [http://localhost:3000](http://localhost:3000).

### Demo logins (password `password123`)

| Role | Email |
| --- | --- |
| Admin | `admin@medicare.local` |
| Doctor | `doctor@medicare.local` |
| Patient | `patient@medicare.local` |
| Reception / emergency staff | `staff@medicare.local` |

## Priority queue (DSA)

Severity maps to a smaller number = higher urgency:

| Severity | Priority |
| --- | --- |
| Critical | 1 |
| Serious | 2 |
| Moderate | 3 |
| Normal | 4 |

Implementation: `server/heap.js`. Waiting rows are loaded from `emergency_cases`, inserted into the heap, and **Call next patient** runs `extractMin()`.

## Project layout

```
public/          UI pages, CSS, JS
server/index.js  Express APIs
server/heap.js   Min-heap
sql/             MySQL schema
```
