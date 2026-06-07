import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const xlsxPath = '/Users/admin/Azizsatn-Projects/DEPAZ/old_database.xlsx';
const outputDir = '/Users/admin/Azizsatn-Projects/DEPAZ';

function main() {
    console.log(`Loading Excel file: ${xlsxPath}`);
    const workbook = XLSX.readFile(xlsxPath);

    const relevantSheets = [
        'council_members',
        'attendance_logs',
        'evaluations',
        'settings',
        'departments',
        'Applications'
    ];

    relevantSheets.forEach(sheetName => {
        if (workbook.Sheets[sheetName]) {
            console.log(`Extracting sheet: ${sheetName}...`);
            const worksheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(worksheet);
            const outputPath = path.join(outputDir, `${sheetName}_rows.csv`);
            fs.writeFileSync(outputPath, csv, 'utf8');
            console.log(`- Saved as ${sheetName}_rows.csv`);
        } else {
            console.warn(`⚠️ Sheet ${sheetName} not found in workbook.`);
        }
    });

    console.log('✅ Extraction complete!');
}

main();
