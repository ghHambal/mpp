import fs from 'fs';
import path from 'path';

const baseDir = '/Users/admin/Azizsatn-Projects/DEPAZ';
const missingIds = [32, 69, 72, 85, 92, 95, 96, 98, 99, 110, 115, 117, 127];

function main() {
    const files = ['council_members_rows.csv', 'Applications_rows.csv', 'evaluations_rows.csv'];
    
    missingIds.forEach(id => {
        console.log(`\n=== Looking up ID ${id} ===`);
        files.forEach(fileName => {
            const filePath = path.join(baseDir, fileName);
            if (fs.existsSync(filePath)) {
                const data = fs.readFileSync(filePath, 'utf8');
                const lines = data.split('\n');
                lines.forEach((line, idx) => {
                    if (idx === 0) return;
                    const parts = line.split(',');
                    const partId = parseInt(parts[0]?.trim(), 10);
                    const partMemberId = parseInt(parts[1]?.trim(), 10); // for evaluations_rows
                    
                    if (partId === id || partMemberId === id) {
                        console.log(`Found in ${fileName} (line ${idx + 1}):`, line.trim());
                    }
                });
            }
        });
    });
}

main();
