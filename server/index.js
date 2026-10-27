require("dotenv").config();
const path = require("path");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { query } = require("./db");
const { EmergencyHeap, SEVERITY_PRIORITY } = require("./heap");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const heap = new EmergencyHeap();

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "medicare-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 }
  })
);
app.use(express.static(path.join(__dirname, "..", "public")));

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Login required" });
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: "Login required" });
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: "Not allowed for this role" });
    }
    next();
  };
}

async function loadHeap() {
  const rows = await query(
    "SELECT * FROM emergency_cases WHERE status = 'waiting' ORDER BY priority ASC, arrival_time ASC"
  );
  heap.rebuild(rows);
}

function timeToMinutes(t) {
  const [h, m] = String(t).slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return `${h}:${m}`;
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/me", (req, res) => {
  res.json({ user: req.session.user || null });
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, age, gender, phone, address, blood_group } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "Name, email, password required" });
    const existing = await query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length) return res.status(409).json({ error: "Email already registered" });
    const password_hash = await bcrypt.hash(password, 10);
    const result = await query(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'patient')",
      [name, email, password_hash]
    );
    await query(
      "INSERT INTO patients (user_id, name, age, gender, phone, address, blood_group) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [result.insertId, name, age || 0, gender || "other", phone || "", address || "", blood_group || ""]
    );
    req.session.user = { id: result.insertId, name, email, role: "patient" };
    res.json({ user: req.session.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const users = await query("SELECT * FROM users WHERE email = ?", [email]);
    if (!users.length) return res.status(401).json({ error: "Invalid credentials" });
    const user = users[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    res.json({ user: req.session.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/doctors", async (_req, res) => {
  try {
    const doctors = await query("SELECT * FROM doctors ORDER BY name");
    const schedules = await query("SELECT * FROM doctor_schedule ORDER BY weekday, start_time");
    res.json({
      doctors: doctors.map((d) => ({
        ...d,
        schedule: schedules.filter((s) => s.doctor_id === d.id)
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/doctors", requireRole("admin"), async (req, res) => {
  try {
    const { name, specialization, phone, email } = req.body;
    const result = await query(
      "INSERT INTO doctors (name, specialization, phone, email) VALUES (?, ?, ?, ?)",
      [name, specialization, phone || "", email || ""]
    );
    res.json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/schedules", requireRole("admin"), async (req, res) => {
  try {
    const { doctor_id, weekday, start_time, end_time, slot_minutes } = req.body;
    const result = await query(
      "INSERT INTO doctor_schedule (doctor_id, weekday, start_time, end_time, slot_minutes) VALUES (?, ?, ?, ?, ?)",
      [doctor_id, weekday, start_time, end_time, slot_minutes || 30]
    );
    res.json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/doctors/:id/slots", async (req, res) => {
  try {
    const doctorId = Number(req.params.id);
    const date = req.query.date;
    if (!date) return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });
    const weekday = new Date(`${date}T00:00:00`).getDay();
    const schedules = await query(
      "SELECT * FROM doctor_schedule WHERE doctor_id = ? AND weekday = ?",
      [doctorId, weekday]
    );
    const booked = await query(
      "SELECT appointment_time FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND status = 'booked'",
      [doctorId, date]
    );
    const taken = new Set(booked.map((b) => String(b.appointment_time).slice(0, 5)));
    const slots = [];
    for (const sch of schedules) {
      let t = timeToMinutes(sch.start_time);
      const end = timeToMinutes(sch.end_time);
      const step = sch.slot_minutes || 30;
      while (t + step <= end) {
        const label = minutesToTime(t);
        if (!taken.has(label)) slots.push(label);
        t += step;
      }
    }
    res.json({ date, weekday, slots });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function patientIdForUser(user) {
  if (user.role !== "patient") return null;
  const rows = await query("SELECT id FROM patients WHERE user_id = ?", [user.id]);
  return rows[0]?.id || null;
}

app.get("/api/appointments", requireAuth, async (req, res) => {
  try {
    const user = req.session.user;
    let sql = `
      SELECT a.*, p.name AS patient_name, d.name AS doctor_name, d.specialization
      FROM appointments a
      JOIN patients p ON p.id = a.patient_id
      JOIN doctors d ON d.id = a.doctor_id
    `;
    const params = [];
    if (user.role === "patient") {
      const pid = await patientIdForUser(user);
      sql += " WHERE a.patient_id = ?";
      params.push(pid);
    } else if (user.role === "doctor") {
      const docs = await query("SELECT id FROM doctors WHERE user_id = ?", [user.id]);
      if (!docs.length) return res.json({ appointments: [] });
      sql += " WHERE a.doctor_id = ?";
      params.push(docs[0].id);
    }
    sql += " ORDER BY a.appointment_date, a.appointment_time";
    const appointments = await query(sql, params);
    res.json({ appointments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/appointments", requireAuth, async (req, res) => {
  try {
    const { doctor_id, appointment_date, appointment_time, patient_id } = req.body;
    let pid = patient_id;
    if (req.session.user.role === "patient") {
      pid = await patientIdForUser(req.session.user);
    }
    if (!pid || !doctor_id || !appointment_date || !appointment_time) {
      return res.status(400).json({ error: "Missing appointment fields" });
    }
    try {
      const result = await query(
        "INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, status) VALUES (?, ?, ?, ?, 'booked')",
        [pid, doctor_id, appointment_date, appointment_time]
      );
      res.json({ id: result.insertId });
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ error: "That slot is already booked" });
      }
      throw err;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/appointments/:id", requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["booked", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    await query("UPDATE appointments SET status = ? WHERE id = ?", [status, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/patients", requireRole("admin", "staff", "doctor"), async (_req, res) => {
  try {
    const patients = await query("SELECT * FROM patients ORDER BY name");
    res.json({ patients });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/patients", requireRole("admin", "staff"), async (req, res) => {
  try {
    const { name, age, gender, phone, address, blood_group, medical_history } = req.body;
    const result = await query(
      "INSERT INTO patients (name, age, gender, phone, address, blood_group, medical_history) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [name, age, gender, phone || "", address || "", blood_group || "", medical_history || ""]
    );
    res.json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/records", requireAuth, async (req, res) => {
  try {
    let patientId = req.query.patient_id;
    if (req.session.user.role === "patient") {
      patientId = await patientIdForUser(req.session.user);
    }
    if (!patientId) return res.status(400).json({ error: "patient_id required" });
    const patients = await query("SELECT * FROM patients WHERE id = ?", [patientId]);
    const records = await query(
      `SELECT r.*, d.name AS doctor_name, d.specialization
       FROM medical_records r
       JOIN doctors d ON d.id = r.doctor_id
       WHERE r.patient_id = ?
       ORDER BY r.visit_date DESC`,
      [patientId]
    );
    res.json({ patient: patients[0] || null, records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/records", requireRole("doctor", "admin"), async (req, res) => {
  try {
    const { patient_id, diagnosis, prescription, visit_date } = req.body;
    let doctorId = req.body.doctor_id;
    if (req.session.user.role === "doctor") {
      const docs = await query("SELECT id FROM doctors WHERE user_id = ?", [req.session.user.id]);
      if (!docs.length) return res.status(400).json({ error: "Doctor profile missing" });
      doctorId = docs[0].id;
    }
    const result = await query(
      "INSERT INTO medical_records (patient_id, doctor_id, diagnosis, prescription, visit_date) VALUES (?, ?, ?, ?, ?)",
      [patient_id, doctorId, diagnosis, prescription || "", visit_date]
    );
    res.json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/emergency", requireAuth, async (_req, res) => {
  try {
    await loadHeap();
    res.json({ queue: heap.toArray(), next: heap.peek() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/emergency", requireRole("staff", "admin"), async (req, res) => {
  try {
    const { patient_id, patient_name, age, symptoms, severity } = req.body;
    const priority = SEVERITY_PRIORITY[severity];
    if (!priority) return res.status(400).json({ error: "Invalid severity" });
    const result = await query(
      `INSERT INTO emergency_cases (patient_id, patient_name, age, symptoms, severity, priority, arrival_time, status)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), 'waiting')`,
      [patient_id || null, patient_name, age || null, symptoms || "", severity, priority]
    );
    await loadHeap();
    res.json({ id: result.insertId, queue: heap.toArray() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/emergency/next", requireRole("staff", "admin", "doctor"), async (_req, res) => {
  try {
    await loadHeap();
    const next = heap.extractMin();
    if (!next) return res.status(404).json({ error: "Queue is empty" });
    await query("UPDATE emergency_cases SET status = 'in_treatment' WHERE id = ?", [next.id]);
    await loadHeap();
    res.json({ called: next, queue: heap.toArray() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/stats", requireRole("admin", "staff"), async (_req, res) => {
  try {
    const [[patients]] = [await query("SELECT COUNT(*) AS n FROM patients")];
    const [[doctors]] = [await query("SELECT COUNT(*) AS n FROM doctors")];
    const [[appointments]] = [await query("SELECT COUNT(*) AS n FROM appointments WHERE appointment_date = CURDATE()")];
    const [[emergency]] = [await query("SELECT COUNT(*) AS n FROM emergency_cases WHERE status = 'waiting'")];
    const severity = await query(
      "SELECT severity, COUNT(*) AS n FROM emergency_cases WHERE status = 'waiting' GROUP BY severity"
    );
    res.json({
      patients: patients.n,
      doctors: doctors.n,
      appointmentsToday: appointments.n,
      emergencyWaiting: emergency.n,
      severity
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function start() {
  try {
    await loadHeap();
  } catch (err) {
    console.warn("MySQL not ready yet:", err.message);
    console.warn("Start MySQL, copy .env.example to .env, then run: npm run init-db");
  }
  app.listen(PORT, () => {
    console.log(`MediCare HMS running at http://localhost:${PORT}`);
  });
}

start();
