import pg from 'pg';
import fs from 'fs';
import path from 'path';

const connectionString = 'postgresql://postgres.mnywfxnrftmxkxkmnelv:spbHambal1308%2F@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
const baseDir = '/Users/admin/Azizsatn-Projects/DEPAZ';

async function main() {
    const client = new pg.Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected successfully!');

        const attendancePath = path.join(baseDir, 'attendance_logs_rows.csv');
        if (fs.existsSync(attendancePath)) {
            const data = fs.readFileSync(attendancePath, 'utf8');
            const lines = data.split('\n');
            let count = 0;
            let skipped = 0;
            let errorsLogged = 0;
            
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

                const activity_id = activityMap[activityText?.toLowerCase()] || activityMap[activityText] || 2; 

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
                        if (errorsLogged < 10) {
                            console.error(`Error at line ${i + 1} (member_id: ${member_id}, date: ${dateVal}, activity: ${activityText}):`, e.message);
                            errorsLogged++;
                        }
                    }
                } else {
                    skipped++;
                    if (errorsLogged < 10) {
                        console.error(`Invalid record at line ${i + 1}:`, line);
                        errorsLogged++;
                    }
                }
            }
            
            console.log(`Seeded: ${count}, Skipped: ${skipped}`);
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

main();
