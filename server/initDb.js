require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "root",
    multipleStatements: true
  });

  const schema = fs.readFileSync(path.join(__dirname, "..", "sql", "schema.sql"), "utf8");
  await connection.query(schema);
  await connection.changeUser({ database: process.env.MYSQL_DATABASE || "hospital_management" });

  const hash = await bcrypt.hash("password123", 10);

  await connection.query("DELETE FROM emergency_cases");
  await connection.query("DELETE FROM medical_records");
  await connection.query("DELETE FROM appointments");
  await connection.query("DELETE FROM doctor_schedule");
  await connection.query("DELETE FROM doctors");
  await connection.query("DELETE FROM patients");
  await connection.query("DELETE FROM users");

  await connection.query(
    `INSERT INTO users (id, name, email, password_hash, role) VALUES
      (1, 'Hospital Admin', 'admin@medicare.local', ?, 'admin'),
      (2, 'Dr. Ananya Sharma', 'doctor@medicare.local', ?, 'doctor'),
      (3, 'Rishabh Dev Saini', 'patient@medicare.local', ?, 'patient'),
      (4, 'Reception Staff', 'staff@medicare.local', ?, 'staff'),
      (5, 'Dr. Rohan Verma', 'verma@medicare.local', ?, 'doctor')`,
    [hash, hash, hash, hash, hash]
  );

  await connection.query(
    `INSERT INTO doctors (id, user_id, name, specialization, phone, email) VALUES
      (1, 2, 'Dr. Ananya Sharma', 'Cardiology', '9876500001', 'doctor@medicare.local'),
      (2, 5, 'Dr. Rohan Verma', 'General Medicine', '9876500002', 'verma@medicare.local'),
      (3, NULL, 'Dr. Meera Iyer', 'Orthopedics', '9876500003', 'iyer@medicare.local'),
      (4, NULL, 'Dr. Kabir Singh', 'Neurology', '9876500004', 'singh@medicare.local')`
  );

  await connection.query(
    `INSERT INTO doctor_schedule (doctor_id, weekday, start_time, end_time, slot_minutes) VALUES
      (1, 1, '10:00:00', '14:00:00', 30),
      (1, 3, '10:00:00', '14:00:00', 30),
      (1, 5, '10:00:00', '13:00:00', 30),
      (2, 1, '09:00:00', '13:00:00', 30),
      (2, 2, '09:00:00', '13:00:00', 30),
      (2, 4, '15:00:00', '18:00:00', 30),
      (3, 2, '11:00:00', '16:00:00', 30),
      (3, 4, '11:00:00', '16:00:00', 30),
      (4, 3, '10:00:00', '15:00:00', 30)`
  );

  await connection.query(
    `INSERT INTO patients (id, user_id, name, age, gender, phone, address, blood_group, medical_history) VALUES
      (1, 3, 'Rishabh Dev Saini', 21, 'male', '9000000001', 'Delhi', 'B+', 'Seasonal allergies'),
      (2, NULL, 'Priya Nair', 34, 'female', '9000000002', 'Noida', 'O+', 'Hypertension'),
      (3, NULL, 'Amit Kumar', 28, 'male', '9000000003', 'Ghaziabad', 'A+', 'None'),
      (4, NULL, 'Neha Gupta', 19, 'female', '9000000004', 'Gurgaon', 'AB+', 'Migraine')`
  );

  await connection.query(
    `INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, status) VALUES
      (1, 1, CURDATE(), '10:30:00', 'booked'),
      (2, 1, CURDATE(), '11:00:00', 'booked'),
      (3, 2, CURDATE(), '09:30:00', 'completed')`
  );

  await connection.query(
    `INSERT INTO medical_records (patient_id, doctor_id, diagnosis, prescription, visit_date) VALUES
      (1, 1, 'Mild arrhythmia follow-up', 'Continue beta blocker, review in 4 weeks', DATE_SUB(CURDATE(), INTERVAL 45 DAY)),
      (1, 2, 'Viral fever', 'Paracetamol 650mg, rest, fluids', DATE_SUB(CURDATE(), INTERVAL 90 DAY)),
      (2, 1, 'Hypertension review', 'Amlodipine 5mg daily', DATE_SUB(CURDATE(), INTERVAL 20 DAY))`
  );

  await connection.query(
    `INSERT INTO emergency_cases (patient_id, patient_name, age, symptoms, severity, priority, arrival_time, status) VALUES
      (2, 'Priya Nair', 34, 'Chest pain, shortness of breath', 'critical', 1, DATE_SUB(NOW(), INTERVAL 18 MINUTE), 'waiting'),
      (3, 'Amit Kumar', 28, 'Suspected fracture after fall', 'serious', 2, DATE_SUB(NOW(), INTERVAL 12 MINUTE), 'waiting'),
      (4, 'Neha Gupta', 19, 'Head injury, conscious', 'serious', 2, DATE_SUB(NOW(), INTERVAL 8 MINUTE), 'waiting'),
      (NULL, 'Rahul Mehta', 41, 'High fever', 'normal', 4, DATE_SUB(NOW(), INTERVAL 25 MINUTE), 'waiting')`
  );

  await connection.end();
  console.log("Database ready. Demo password for all accounts: password123");
  console.log("  admin@medicare.local");
  console.log("  doctor@medicare.local");
  console.log("  patient@medicare.local");
  console.log("  staff@medicare.local");
}

main().catch((err) => {
  console.error("init-db failed:", err.message);
  process.exit(1);
});
