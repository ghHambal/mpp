import pg from 'pg';
import fs from 'fs';
import path from 'path';

const connectionString = 'postgresql://postgres.mnywfxnrftmxkxkmnelv:spbHambal1308%2F@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
const baseDir = '/Users/admin/Azizsatn-Projects/DEPAZ';

async function main() {
    console.log('Connecting to Supabase PostgreSQL...');
    const client = new pg.Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected successfully!');

        // 1. TRUNCATE CURRENT COUNCIL TABLES FOR FRESH SYNC
        console.log('Truncating tables for a clean sync...');
        await client.query('TRUNCATE council_attendance, council_evaluation, council_members, council_activities, council_departments, council_settings CASCADE;');

        // 2. SEED SETTINGS
        console.log('Seeding settings...');
        const settingsPath = path.join(baseDir, 'settings_rows.csv');
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf8');
            const lines = data.split('\n');
            if (lines.length > 1) {
                const parts = lines[1].split(',');
                const siteName = parts[0]?.trim() || 'ระบบจัดการสภานักเรียน';
                const logoUrl = parts[1]?.trim() || 'https://lh3.googleusercontent.com/d/1xoQkESfAcZS_Q1Ab-NLlRHVJku-5jSm7';
                const footerText = parts[2]?.trim() || '© MajlisPerwakilanPelajarAzizstan';
                
                await client.query(`
                    INSERT INTO council_settings (key, value) VALUES
                    ('siteName', $1),
                    ('logoUrl', $2),
                    ('footerText', $3)
                `, [siteName, logoUrl, footerText]);
                console.log(`- Settings seeded: ${siteName}`);
            }
        }

        // 3. SEED DEPARTMENTS (13 departments)
        console.log('Seeding departments...');
        const deptsPath = path.join(baseDir, 'departments_rows.csv');
        if (fs.existsSync(deptsPath)) {
            const data = fs.readFileSync(deptsPath, 'utf8');
            const lines = data.split('\n');
            let count = 0;
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const parts = line.split(',');
                const id = parseInt(parts[0]?.trim(), 10);
                const name_th = parts[1]?.trim();
                const is_active = parts[2]?.trim() === '1';

                if (id && name_th) {
                    await client.query('INSERT INTO council_departments (id, name_th, is_active) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name_th = EXCLUDED.name_th, is_active = EXCLUDED.is_active', [id, name_th, is_active]);
                    count++;
                }
            }
            console.log(`- Seeded ${count} departments.`);
        }

        // 4. SEED ACTIVITIES (9 activities)
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

        // 5. SEED MEMBERS (98 members)
        console.log('Seeding council members...');
        const membersPath = path.join(baseDir, 'council_members_rows.csv');
        if (fs.existsSync(membersPath)) {
            const data = fs.readFileSync(membersPath, 'utf8');
            const lines = data.split('\n');
            let count = 0;
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const parts = line.split(',');
                if (parts.length < 5) continue;

                const id = parseInt(parts[0]?.trim(), 10);
                const student_code = parts[1]?.trim();
                const fullname = parts[2]?.trim();
                const class_name = parts[3]?.trim() || 'ไม่ระบุ';
                const department_id = parts[4]?.trim() ? parseInt(parts[4]?.trim(), 10) : null;
                const image_url = student_code ? `https://azizstan.net/student_image/${student_code}.jpg` : '';

                if (id && student_code && fullname) {
                    await client.query(`
                        INSERT INTO council_members (id, student_code, fullname, class_name, department_id, image_url) 
                        VALUES ($1, $2, $3, $4, $5, $6) 
                        ON CONFLICT (id) DO UPDATE SET student_code = EXCLUDED.student_code, fullname = EXCLUDED.fullname, class_name = EXCLUDED.class_name, department_id = EXCLUDED.department_id, image_url = EXCLUDED.image_url
                    `, [id, student_code, fullname, class_name, department_id, image_url]);
                    count++;
                }
            }
            console.log(`- Seeded ${count} members.`);
        }

        // 6. SEED ATTENDANCE LOGS (2109 records)
        console.log('Seeding attendance logs (historical)...');
        const attendancePath = path.join(baseDir, 'attendance_logs_rows.csv');
        if (fs.existsSync(attendancePath)) {
            const data = fs.readFileSync(attendancePath, 'utf8');
            const lines = data.split('\n');
            let count = 0;
            let skipped = 0;
            
            // Map activity text to its seeded ID
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

            console.log(`Processing ${lines.length - 1} records...`);
            
            // We use batch insert or parallel insert for performance
            // For pg, we can do multiple queries or transactions
            await client.query('BEGIN');
            
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const parts = line.split(',');
                if (parts.length < 5) continue;

                const member_id = parseInt(parts[1]?.trim(), 10);
                const dateVal = parts[2]?.trim();
                const activityText = parts[3]?.trim();
                const status = parts[4]?.trim() || 'absent';
                const remark = parts[5]?.trim() || '';

                const activity_id = activityMap[activityText?.toLowerCase()] || 2; // default to 'กิจกรรมพิเศษ'

                if (member_id && dateVal && status) {
                    try {
                        await client.query(`
                            INSERT INTO council_attendance (member_id, date, activity_id, status, remark) 
                            VALUES ($1, $2, $3, $4, $5)
                            ON CONFLICT (member_id, date, activity_id) DO UPDATE SET status = EXCLUDED.status, remark = EXCLUDED.remark
                        `, [member_id, dateVal, activity_id, status, remark]);
                        count++;
                    } catch (e) {
                        skipped++;
                    }
                }
            }
            
            await client.query('COMMIT');
            console.log(`- Seeded ${count} attendance records successfully.`);
            if (skipped > 0) {
                console.log(`- Skipped ${skipped} conflicting/invalid records.`);
            }
        }

        console.log('✅ Legacy Database sync complete!');
    } catch (err) {
        console.error('✕ Sync failed:', err);
    } finally {
        await client.end();
    }
}

main();
