import pg from 'pg';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const connectionString = 'postgresql://postgres.mnywfxnrftmxkxkmnelv:spbHambal1308%2F@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
const xlsxPath = '/Users/admin/Azizsatn-Projects/DEPAZ/old_database.xlsx';

async function main() {
    console.log('Connecting to Supabase PostgreSQL...');
    const client = new pg.Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected successfully!');

        // 1. CREATE school_students TABLE AND UPDATE SCHEMA
        console.log('Setting up school_students table and RLS policies...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS school_students (
                student_code text PRIMARY KEY,
                fullname text NOT NULL,
                class_name text,
                image_url text
            );
        `);
        
        // Enable RLS and add policies if they don't exist
        await client.query(`
            ALTER TABLE school_students ENABLE ROW LEVEL SECURITY;
        `).catch(() => {});
        
        await client.query(`
            DROP POLICY IF EXISTS "Allow public read school_students" ON school_students;
            CREATE POLICY "Allow public read school_students" ON school_students FOR SELECT USING (true);
            
            DROP POLICY IF EXISTS "Allow public insert school_students" ON school_students;
            CREATE POLICY "Allow public insert school_students" ON school_students FOR INSERT WITH CHECK (true);
            
            DROP POLICY IF EXISTS "Allow public update school_students" ON school_students;
            CREATE POLICY "Allow public update school_students" ON school_students FOR UPDATE USING (true);
            
            DROP POLICY IF EXISTS "Allow public delete school_students" ON school_students;
            CREATE POLICY "Allow public delete school_students" ON school_students FOR DELETE USING (true);
        `);

        // 2. READ EXCEL WORKBOOK DIRECTLY
        console.log('Loading old_database.xlsx...');
        const workbook = XLSX.readFile(xlsxPath);

        // 3. TRUNCATE CURRENT COUNCIL TABLES FOR FRESH SYNC
        console.log('Truncating tables for clean sync...');
        await client.query('TRUNCATE council_attendance, council_evaluation, council_members, council_activities, council_departments, council_settings CASCADE;');

        // 4. SEED SETTINGS
        console.log('Seeding settings...');
        const settingsSheet = workbook.Sheets['settings'];
        if (settingsSheet) {
            const settingsData = XLSX.utils.sheet_to_json(settingsSheet);
            if (settingsData.length > 0) {
                const row = settingsData[0];
                const siteName = row.site_name || 'ระบบจัดการสภานักเรียน';
                const logoUrl = row.logo_url || 'https://lh3.googleusercontent.com/d/1xoQkESfAcZS_Q1Ab-NLlRHVJku-5jSm7';
                const footerText = row.footer_text || '© MajlisPerwakilanPelajarAzizstan';
                
                await client.query(`
                    INSERT INTO council_settings (key, value) VALUES
                    ('siteName', $1),
                    ('logoUrl', $2),
                    ('footerText', $3)
                `, [siteName, logoUrl, footerText]);
                console.log(`- Settings seeded: ${siteName}`);
            }
        }

        // 5. SEED DEPARTMENTS
        console.log('Seeding departments...');
        const deptSheet = workbook.Sheets['departments'];
        if (deptSheet) {
            const deptData = XLSX.utils.sheet_to_json(deptSheet);
            let count = 0;
            for (const row of deptData) {
                const id = parseInt(row.id, 10);
                const name_th = row.name_th;
                const is_active = String(row.is_active) === '1' || String(row.is_active).toLowerCase() === 'true';
                if (id && name_th) {
                    await client.query('INSERT INTO council_departments (id, name_th, is_active) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name_th = EXCLUDED.name_th, is_active = EXCLUDED.is_active', [id, name_th, is_active]);
                    count++;
                }
            }
            console.log(`- Seeded ${count} departments.`);
        }

        // 6. SEED ACTIVITIES
        console.log('Seeding activities...');
        const activities = [
            'ประชุมสภานักเรียน',
            'กิจกรรมพิเศษ',
            'กิจกรรมแถว',
            'กิจกรรมควบคุมละหมาด',
            'กิจกรรมวันครู',
            'กิจกรรมYLA(การเขียนใบโครงการ)',
            'iktikaf perdana ikram sungai patani',
            'ค่ายปรับพื้นฐานม.4',
            'จิตอาสาแปะป้ายห้องเรียน'
        ];
        for (let i = 0; i < activities.length; i++) {
            await client.query('INSERT INTO council_activities (id, activity_name, is_active) VALUES ($1, $2, true) ON CONFLICT (id) DO NOTHING', [i + 1, activities[i]]);
        }
        console.log(`- Seeded ${activities.length} default activities.`);

        // 7. PREPARE ROSTER MEMBERS AND IDENTIFY MISSING ONES FROM ATTENDANCE & EVALUATIONS
        console.log('Preparing council members...');
        const membersSheet = workbook.Sheets['council_members'];
        const attendanceSheet = workbook.Sheets['attendance_logs'];
        const evalSheet = workbook.Sheets['evaluations'];

        const memberMap = new Map();
        const memberIds = new Set();

        if (membersSheet) {
            const membersData = XLSX.utils.sheet_to_json(membersSheet);
            membersData.forEach(row => {
                const id = parseInt(row.id, 10);
                const student_code = String(row.student_code || '').trim();
                const fullname = String(row.fullname || '').trim();
                const class_name = String(row.class_name || 'ไม่ระบุ').trim();
                const department_id = row.department_id ? parseInt(row.department_id, 10) : null;
                const image_url = student_code ? `https://azizstan.net/student_image/${student_code}.jpg` : '';

                if (id && student_code && fullname) {
                    memberMap.set(id, { id, student_code, fullname, class_name, department_id, image_url });
                    memberIds.add(id);
                }
            });
        }

        // Find missing member IDs in attendance logs
        const missingIds = new Set();
        if (attendanceSheet) {
            const attData = XLSX.utils.sheet_to_json(attendanceSheet);
            attData.forEach(row => {
                const memberId = parseInt(row.member_id, 10);
                if (memberId && !memberIds.has(memberId)) {
                    missingIds.add(memberId);
                }
            });
        }

        // Find missing member IDs in evaluations
        if (evalSheet) {
            const evalData = XLSX.utils.sheet_to_json(evalSheet);
            evalData.forEach(row => {
                const memberId = parseInt(row.member_id, 10);
                if (memberId && !memberIds.has(memberId)) {
                    missingIds.add(memberId);
                }
            });
        }

        console.log(`- Found ${missingIds.size} missing member IDs in logs:`, Array.from(missingIds));

        // Create placeholder records for missing members to preserve relational integrity
        missingIds.forEach(id => {
            memberMap.set(id, {
                id,
                student_code: `OLD_${id}`,
                fullname: `สมาชิกเก่า (รหัส ${id})`,
                class_name: 'ไม่ระบุ',
                department_id: null,
                image_url: ''
            });
        });

        // Insert all members into council_members
        let memberCount = 0;
        for (const m of memberMap.values()) {
            await client.query(`
                INSERT INTO council_members (id, student_code, fullname, class_name, department_id, image_url) 
                VALUES ($1, $2, $3, $4, $5, $6) 
                ON CONFLICT (id) DO UPDATE SET student_code = EXCLUDED.student_code, fullname = EXCLUDED.fullname, class_name = EXCLUDED.class_name, department_id = EXCLUDED.department_id, image_url = EXCLUDED.image_url
            `, [m.id, m.student_code, m.fullname, m.class_name, m.department_id, m.image_url]);
            memberCount++;
        }
        console.log(`- Seeded ${memberCount} council members (including placeholders).`);

        // 8. SEED ATTENDANCE LOGS
        console.log('Seeding attendance logs...');
        if (attendanceSheet) {
            const attData = XLSX.utils.sheet_to_json(attendanceSheet);
            const activityMap = {
                'ประชุมสภานักเรียน': 1,
                'กิจกรรมพิเศษ': 2,
                'กิจกรรมแถว': 3,
                'กิจกรรมควบคุมละหมาด': 4,
                'กิจกรรมวันครู': 5,
                'กิจกรรมyla(การเขียนใบโครงการ)': 6,
                'กิจกรรมyla': 6,
                'iktikaf perdana ikram sungai patani': 7,
                'ค่ายปรับพื้นฐานม.4': 8,
                'จิตอาสาแปะป้ายห้องเรียน': 9
            };

            await client.query('BEGIN');
            let attCount = 0;
            let attSkipped = 0;

            for (const row of attData) {
                const member_id = parseInt(row.member_id, 10);
                const dateVal = row.date;
                const activityText = row.activity;
                const status = row.status || 'absent';
                const remark = row.remark || '';
                const activity_id = activityMap[activityText?.toLowerCase()] || activityMap[activityText] || 2;

                if (member_id && dateVal && status) {
                    try {
                        await client.query(`
                            INSERT INTO council_attendance (member_id, date, activity_id, status, remark) 
                            VALUES ($1, $2, $3, $4, $5)
                            ON CONFLICT (member_id, date, activity_id) DO UPDATE SET status = EXCLUDED.status, remark = EXCLUDED.remark
                        `, [member_id, dateVal, activity_id, status, remark]);
                        attCount++;
                    } catch (e) {
                        attSkipped++;
                    }
                }
            }
            await client.query('COMMIT');
            console.log(`- Seeded ${attCount} attendance logs. Skipped: ${attSkipped}`);
        }

        // 9. SEED PERFORMANCE EVALUATIONS
        console.log('Seeding performance evaluations...');
        if (evalSheet) {
            const evalData = XLSX.utils.sheet_to_json(evalSheet);
            
            const criteriaNames = [
                'การตรงต่อเวลา',
                'การรักษาเวลาในการทำกิจกรรม',
                'การให้ความร่วมมือในกิจกรรมกลุ่ม',
                'การมีส่วนร่วมและการแสดงความคิดเห็น',
                'ภาวะความเป็นผู้นำ',
                'ความรับผิดชอบต่อหน้าที่ที่ได้รับมอบหมาย',
                'การประสานงานและการสื่อสาร'
            ];

            await client.query('BEGIN');
            let evalCount = 0;
            let evalSkipped = 0;

            for (const row of evalData) {
                const member_id = parseInt(row.member_id, 10);
                const criteriaJsonStr = row.criteria_json;
                const remark = row.remark || '';
                const dateVal = row.date;
                
                if (member_id && criteriaJsonStr) {
                    try {
                        const critObj = JSON.parse(criteriaJsonStr);
                        for (const [key, level] of Object.entries(critObj)) {
                            const criteriaIdx = parseInt(key, 10);
                            const criteriaName = criteriaNames[criteriaIdx] || `เกณฑ์ข้อที่ ${criteriaIdx + 1}`;
                            
                            if (criteriaName && level) {
                                await client.query(`
                                    INSERT INTO council_evaluation (member_id, criteria, level, remark, timestamp)
                                    VALUES ($1, $2, $3, $4, $5)
                                    ON CONFLICT (member_id, criteria) DO UPDATE SET level = EXCLUDED.level, remark = EXCLUDED.remark, timestamp = EXCLUDED.timestamp
                                `, [member_id, criteriaName, level, remark, `${dateVal} 00:00:00`]);
                                evalCount++;
                            }
                        }
                    } catch (e) {
                        evalSkipped++;
                    }
                }
            }
            await client.query('COMMIT');
            console.log(`- Seeded ${evalCount} evaluation items. Skipped: ${evalSkipped}`);
        }

        // 10. SEED SCHOOL STUDENTS registry (from sheet std68)
        console.log('Seeding school students directory (std68)...');
        const studentsSheet = workbook.Sheets['std68'];
        if (studentsSheet) {
            const studentsData = XLSX.utils.sheet_to_json(studentsSheet);
            console.log(`- Found ${studentsData.length} student records in Excel.`);
            
            // Clean table first
            await client.query('TRUNCATE school_students CASCADE;');
            
            // Prepare batches to speed up inserts (Postgres multi-row inserts)
            const batchSize = 500;
            let currentBatch = [];
            let totalSeeded = 0;
            
            for (let i = 0; i < studentsData.length; i++) {
                const row = studentsData[i];
                // Map columns: 'Student ID', 'Name', 'Class General', 'Class Religion', 'Photo URL'
                const student_code = String(row['Student ID'] || '').trim();
                const fullname = String(row['Name'] || '').trim();
                const classGen = String(row['Class General'] || '').trim();
                const classRel = String(row['Class Religion'] || '').trim();
                let photoUrl = String(row['Photo URL'] || '').trim();
                
                // Combine general and religion classes
                let className = '';
                if (classGen && classRel) {
                    className = `${classGen} / ${classRel}`;
                } else {
                    className = classGen || classRel || 'ไม่ระบุ';
                }
                
                if (student_code && fullname) {
                    if (!photoUrl || photoUrl.includes('drive.google.com') || photoUrl.includes('lh3.googleusercontent.com')) {
                        // Default to standard photo endpoint for consistent UI
                        photoUrl = `https://azizstan.net/student_image/${student_code}.jpg`;
                    }
                    
                    currentBatch.push({ student_code, fullname, class_name: className, image_url: photoUrl });
                }
                
                if (currentBatch.length >= batchSize || i === studentsData.length - 1) {
                    if (currentBatch.length > 0) {
                        // Perform batch insert
                        const placeholders = [];
                        const values = [];
                        let valIdx = 1;
                        
                        currentBatch.forEach(s => {
                            placeholders.push(`($${valIdx}, $${valIdx + 1}, $${valIdx + 2}, $${valIdx + 3})`);
                            values.push(s.student_code, s.fullname, s.class_name, s.image_url);
                            valIdx += 4;
                        });
                        
                        const query = `
                            INSERT INTO school_students (student_code, fullname, class_name, image_url)
                            VALUES ${placeholders.join(',')}
                            ON CONFLICT (student_code) DO UPDATE SET fullname = EXCLUDED.fullname, class_name = EXCLUDED.class_name, image_url = EXCLUDED.image_url
                        `;
                        
                        await client.query(query, values);
                        totalSeeded += currentBatch.length;
                        currentBatch = [];
                    }
                }
            }
            console.log(`- Seeded ${totalSeeded} school students registry successfully.`);
        }

        console.log('✅ DATABASE SEEDING AND MIGRATION COMPLETED!');
    } catch (err) {
        console.error('✕ Migration failed:', err);
    } finally {
        await client.end();
    }
}

main();
