# DEPAZ — ระบบจัดการสภานักเรียน

ระบบบริหารจัดการและติดตามการเข้าร่วมกิจกรรมของคณะกรรมการสภานักเรียน โรงเรียนมูลนิธิอาซิซสถาน พัฒนาด้วย Vite + JavaScript + Tailwind CSS และเชื่อมต่อฐานข้อมูลระบบคลาวด์ด้วย Supabase

---

## 🚀 คุณสมบัติระบบ (Features)
*   **ระบบหน้าหลัก (Dashboard):** แสดงข้อมูลสรุปสถิติสมาชิก ฝ่ายสภา กิจกรรม และอัตราการเข้าร่วมกิจกรรมเฉลี่ยของแต่ละฝ่ายในรูปแบบแผนภูมิแท่ง (ApexCharts)
*   **ระบบกิจกรรมสภา (Student Council Events):** ค้นหาและดูรายละเอียดกิจกรรมสภาแบ่งตามหมวดหมู่ (กิจกรรมสภา, พัฒนาศักยภาพ, ภาระหน้าที่, กิจกรรมพิเศษ)
*   **ระบบรายชื่อสมาชิก (Members Management):** แสดงข้อมูลสมาชิกสภานักเรียน คัดกรองตามฝ่ายและเพศ พร้อมอัตราการเข้าร่วมกิจกรรม
*   **แผงควบคุมแอดมิน (Admin Panel):**
    *   เพิ่ม/แก้ไข/ลบ กิจกรรมและรายชื่อสมาชิก
    *   ระบบเช็คชื่อเข้าร่วมกิจกรรม (Attendance Checking)
    *   ระบบประเมินผลสมรรถนะการทำงานคณะกรรมการสภา (Evaluations)
    *   นำเข้าข้อมูลสมาชิกจากไฟล์ Excel (.xlsx, .xls) หรือ CSV
    *   ส่งออกข้อมูลสมาชิกและการเช็คชื่อเป็นไฟล์ Excel
    *   ตั้งค่าระบบทั่วไป และ Telegram Bot สำหรับส่งการแจ้งเตือน
*   **พื้นที่ของฉัน (Member Profile):** สมาชิกเข้าสู่ระบบด้วยรหัสนักเรียน เพื่อดูประวัติการปฏิบัติหน้าที่ ประวัติการเช็คชื่อ สถิติส่วนตัว และดาวน์โหลดเกียรติบัตร
*   **ระบบเกียรติบัตร (Certificate Campaign):** แอดมินสามารถเปิดแคมเปญ ออกเกียรติบัตร และพิมพ์ใบประกาศนียบัตรตามระดับการเช็คชื่อหรือการประเมินได้

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)
*   **Frontend Framework:** Vite (Vanilla JS / ESM)
*   **CSS Style:** Tailwind CSS (via CDN) & Vanilla CSS
*   **Database & Auth:** Supabase Client (PostgreSQL)
*   **Charts:** ApexCharts
*   **Popups & Alerts:** SweetAlert2
*   **Spreadsheet Parsing:** SheetJS (XLSX)

---

## 📦 การติดตั้งและการใช้งานเครื่องพัฒนา (Local Development)

### 1. ติดตั้ง Dependencies
```bash
npm install
```

### 2. ตั้งค่า Environment Variables
สร้างไฟล์ `.env` ที่โฟลเดอร์ Root ของโปรเจกต์ และระบุค่าเชื่อมต่อ Supabase และ Telegram:
```env
VITE_SUPABASE_URL=https://your-supabase-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_TELEGRAM_BOT_TOKEN=your-telegram-bot-token
```

### 3. รันโปรเจกต์ในเครื่อง
```bash
npm run dev
```
ระบบจะรันบน Local Development Server (ปกติจะเป็น http://localhost:5173/)
