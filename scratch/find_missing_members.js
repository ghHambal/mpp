import fs from 'fs';
import path from 'path';

const baseDir = '/Users/admin/Azizsatn-Projects/DEPAZ';

function main() {
    const membersPath = path.join(baseDir, 'council_members_rows.csv');
    const attendancePath = path.join(baseDir, 'attendance_logs_rows.csv');

    const memberIds = new Set();
    const memberLines = fs.readFileSync(membersPath, 'utf8').split('\n');
    for (let i = 1; i < memberLines.length; i++) {
        const line = memberLines[i].trim();
        if (!line) continue;
        const parts = line.split(',');
        const id = parseInt(parts[0]?.trim(), 10);
        if (id) memberIds.add(id);
    }

    const missingIds = new Set();
    const attLines = fs.readFileSync(attendancePath, 'utf8').split('\n');
    for (let i = 1; i < attLines.length; i++) {
        const line = attLines[i].trim();
        if (!line) continue;
        const parts = line.split(',');
        const memberId = parseInt(parts[1]?.trim(), 10);
        if (memberId && !memberIds.has(memberId)) {
            missingIds.add(memberId);
        }
    }

    console.log('Missing member IDs in attendance logs:', Array.from(missingIds).sort((a,b)=>a-b));
}

main();
