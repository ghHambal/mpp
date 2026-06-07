-- DROP OLD SCHOOL SYSTEM TABLES IF THEY EXIST
DROP TABLE IF EXISTS subject_scores, schedules, appointments, subjects, sdt, config_users, config_app CASCADE;

-- DROP COUNCIL TABLES IF THEY EXIST (for clean slate)
DROP TABLE IF EXISTS council_attendance, council_evaluation, council_members, council_activities, council_departments, council_settings, council_admin CASCADE;

-- 1. COUNCIL SETTINGS
CREATE TABLE council_settings (
    key text PRIMARY KEY,
    value text NOT NULL
);

-- 2. COUNCIL DEPARTMENTS
CREATE TABLE council_departments (
    id integer PRIMARY KEY,
    name_th text NOT NULL,
    is_active boolean DEFAULT true
);

-- 3. COUNCIL MEMBERS
CREATE TABLE council_members (
    id serial PRIMARY KEY,
    student_code text NOT NULL UNIQUE,
    fullname text NOT NULL,
    class_name text NOT NULL,
    department_id integer REFERENCES council_departments(id) ON DELETE SET NULL,
    image_url text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 4. COUNCIL ACTIVITIES
CREATE TABLE council_activities (
    id serial PRIMARY KEY,
    activity_name text NOT NULL,
    is_active boolean DEFAULT true
);

-- 5. COUNCIL ATTENDANCE
CREATE TABLE council_attendance (
    id serial PRIMARY KEY,
    member_id integer REFERENCES council_members(id) ON DELETE CASCADE,
    date date NOT NULL,
    activity_id integer REFERENCES council_activities(id) ON DELETE CASCADE,
    status text NOT NULL CHECK (status IN ('present', 'absent')),
    remark text,
    timestamp timestamp with time zone DEFAULT timezone('utc'::text, now()),
    UNIQUE (member_id, date, activity_id)
);

-- 6. COUNCIL PERFORMANCE EVALUATION
CREATE TABLE council_evaluation (
    id serial PRIMARY KEY,
    member_id integer REFERENCES council_members(id) ON DELETE CASCADE,
    criteria text NOT NULL,
    level text NOT NULL CHECK (level IN ('ดีมาก', 'ดี', 'พอใช้', 'ไม่ผ่าน')),
    remark text,
    timestamp timestamp with time zone DEFAULT timezone('utc'::text, now()),
    UNIQUE (member_id, criteria)
);

-- 7. COUNCIL ADMIN ACCOUNTS
CREATE TABLE council_admin (
    id serial PRIMARY KEY,
    username text NOT NULL UNIQUE,
    password text NOT NULL
);

-- ================================================
-- SEED INITIAL DATA
-- ================================================

-- Seed Settings
INSERT INTO council_settings (key, value) VALUES
('siteName', 'ระบบจัดการสภานักเรียน'),
('logoUrl', 'https://cdn-icons-png.flaticon.com/512/2997/2997322.png'),
('footerText', '© โรงเรียนมูลนิธิอาซิซสถาน · Student Council Management');

-- Seed Departments
INSERT INTO council_departments (id, name_th, is_active) VALUES
(1, 'ฝ่ายบริหารงานทั่วไป', true),
(2, 'ฝ่ายวิชาการ', true),
(3, 'ฝ่ายพัฒนาคุณธรรม จริยธรรม', true),
(4, 'ฝ่ายปกครองและวินัย', true),
(5, 'ฝ่ายประชาสัมพันธ์', true),
(6, 'ฝ่ายบริการและสวัสดิการ', true),
(7, 'ฝ่ายกิจกรรมและนันทนาการ', true),
(8, 'ฝ่ายกีฬาและอนามัย', true),
(9, 'ฝ่ายสารสนเทศและเทคโนโลยี', true);

-- Seed default activities
INSERT INTO council_activities (activity_name, is_active) VALUES
('ประชุมสภานักเรียน', true),
('กิจกรรมหน้าเสาธง', true),
('เวรดูแลนักเรียนช่วงเช้า', true);

-- Seed default Admin account (admin / admin1234)
INSERT INTO council_admin (username, password) VALUES
('admin', 'admin1234');

-- ================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Enable public read/write access for simplicity (like Apps Script)
-- ================================================
ALTER TABLE council_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE council_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE council_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE council_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE council_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE council_evaluation ENABLE ROW LEVEL SECURITY;
ALTER TABLE council_admin ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read settings" ON council_settings FOR SELECT USING (true);
CREATE POLICY "Allow public insert settings" ON council_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update settings" ON council_settings FOR UPDATE USING (true);

CREATE POLICY "Allow public read departments" ON council_departments FOR SELECT USING (true);
CREATE POLICY "Allow public insert departments" ON council_departments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update departments" ON council_departments FOR UPDATE USING (true);

CREATE POLICY "Allow public read members" ON council_members FOR SELECT USING (true);
CREATE POLICY "Allow public insert members" ON council_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update members" ON council_members FOR UPDATE USING (true);
CREATE POLICY "Allow public delete members" ON council_members FOR DELETE USING (true);

CREATE POLICY "Allow public read activities" ON council_activities FOR SELECT USING (true);
CREATE POLICY "Allow public insert activities" ON council_activities FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update activities" ON council_activities FOR UPDATE USING (true);

CREATE POLICY "Allow public read attendance" ON council_attendance FOR SELECT USING (true);
CREATE POLICY "Allow public insert attendance" ON council_attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update attendance" ON council_attendance FOR UPDATE USING (true);

CREATE POLICY "Allow public read evaluation" ON council_evaluation FOR SELECT USING (true);
CREATE POLICY "Allow public insert evaluation" ON council_evaluation FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update evaluation" ON council_evaluation FOR UPDATE USING (true);

CREATE POLICY "Allow public read admin" ON council_admin FOR SELECT USING (true);
CREATE POLICY "Allow public insert admin" ON council_admin FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update admin" ON council_admin FOR UPDATE USING (true);
