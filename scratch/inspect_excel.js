import XLSX from 'xlsx';

const xlsxPath = '/Users/admin/Azizsatn-Projects/DEPAZ/old_database.xlsx';

function main() {
    const workbook = XLSX.readFile(xlsxPath);
    console.log('Sheets in workbook:', workbook.SheetNames);
    
    workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
        const numRows = range.e.r - range.s.r + 1;
        const numCols = range.e.c - range.s.c + 1;
        console.log(`\n--- Sheet "${sheetName}" (${numRows} rows, ${numCols} cols) ---`);
        
        // Print first 3 rows as JSON
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }).slice(0, 3);
        console.log('First 3 rows:');
        rows.forEach((row, idx) => {
            console.log(` Row ${idx + 1}:`, row.slice(0, 10));
        });
    });
}

main();
