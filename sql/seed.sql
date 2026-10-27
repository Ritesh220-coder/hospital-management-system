-- Optional sample data for MySQL Workbench.
-- Prefer `npm run init-db` so demo passwords are hashed correctly (password123).

USE hospital_management;

SET @hash = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8i6j9eYQb0n8v6n1pQ3m0xQJ0k1q2u';

INSERT INTO users (name, email, password_hash, role) VALUES
  ('Hospital Admin', 'admin@medicare.local', @hash, 'admin'),
  ('Dr. Ananya Sharma', 'doctor@medicare.local', @hash, 'doctor'),
  ('Rishabh Dev Saini', 'patient@medicare.local', @hash, 'patient'),
  ('Reception Staff', 'staff@medicare.local', @hash, 'staff'),
  ('Dr. Rohan Verma', 'verma@medicare.local', @hash, 'doctor')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO doctors (user_id, name, specialization, phone, email) VALUES
  (2, 'Dr. Ananya Sharma', 'Cardiology', '9876500001', 'doctor@medicare.local'),
  (5, 'Dr. Rohan Verma', 'General Medicine', '9876500002', 'verma@medicare.local'),
  (NULL, 'Dr. Meera Iyer', 'Orthopedics', '9876500003', 'iyer@medicare.local'),
  (NULL, 'Dr. Kabir Singh', 'Neurology', '9876500004', 'singh@medicare.local');

INSERT INTO doctor_schedule (doctor_id, weekday, start_time, end_time, slot_minutes) VALUES
  (1, 1, '10:00:00', '14:00:00', 30),
  (1, 3, '10:00:00', '14:00:00', 30),
  (1, 5, '10:00:00', '13:00:00', 30),
  (2, 1, '09:00:00', '13:00:00', 30),
  (2, 2, '09:00:00', '13:00:00', 30),
  (2, 4, '15:00:00', '18:00:00', 30),
  (3, 2, '11:00:00', '16:00:00', 30),
  (3, 4, '11:00:00', '16:00:00', 30),
  (4, 3, '10:00:00', '15:00:00', 30);

INSERT INTO patients (user_id, name, age, gender, phone, address, blood_group, medical_history) VALUES
  (3, 'Rishabh Dev Saini', 21, 'male', '9000000001', 'Delhi', 'B+', 'Seasonal allergies'),
  (NULL, 'Priya Nair', 34, 'female', '9000000002', 'Noida', 'O+', 'Hypertension'),
  (NULL, 'Amit Kumar', 28, 'male', '9000000003', 'Ghaziabad', 'A+', 'None'),
  (NULL, 'Neha Gupta', 19, 'female', '9000000004', 'Gurgaon', 'AB+', 'Migraine');

INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, status) VALUES
  (1, 1, CURDATE(), '10:30:00', 'booked'),
  (2, 1, CURDATE(), '11:00:00', 'booked'),
  (3, 2, CURDATE(), '09:30:00', 'completed');

INSERT INTO medical_records (patient_id, doctor_id, diagnosis, prescription, visit_date) VALUES
  (1, 1, 'Mild arrhythmia follow-up', 'Continue beta blocker, review in 4 weeks', DATE_SUB(CURDATE(), INTERVAL 45 DAY)),
  (1, 2, 'Viral fever', 'Paracetamol 650mg, rest, fluids', DATE_SUB(CURDATE(), INTERVAL 90 DAY)),
  (2, 1, 'Hypertension review', 'Amlodipine 5mg daily', DATE_SUB(CURDATE(), INTERVAL 20 DAY));

INSERT INTO emergency_cases (patient_id, patient_name, age, symptoms, severity, priority, arrival_time, status) VALUES
  (2, 'Priya Nair', 34, 'Chest pain, shortness of breath', 'critical', 1, DATE_SUB(NOW(), INTERVAL 18 MINUTE), 'waiting'),
  (3, 'Amit Kumar', 28, 'Suspected fracture after fall', 'serious', 2, DATE_SUB(NOW(), INTERVAL 12 MINUTE), 'waiting'),
  (4, 'Neha Gupta', 19, 'Head injury, conscious', 'serious', 2, DATE_SUB(NOW(), INTERVAL 8 MINUTE), 'waiting'),
  (NULL, 'Rahul Mehta', 41, 'High fever', 'normal', 4, DATE_SUB(NOW(), INTERVAL 25 MINUTE), 'waiting');
