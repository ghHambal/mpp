import pg from 'pg';

const connectionString = 'postgresql://postgres.mnywfxnrftmxkxkmnelv:spbHambal1308%2F@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function main() {
    const client = new pg.Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected successfully!');
        
        // Let's check how many members exist in database
        const membersRes = await client.query('SELECT count(*) FROM council_members');
        console.log('Total members in DB:', membersRes.rows[0].count);

        // Let's test inserting a record that failed
        // member_id: 2, date: 2025-12-11, activity_id: 1, status: 'present'
        try {
            await client.query(`
                INSERT INTO council_attendance (member_id, date, activity_id, status, remark) 
                VALUES ($1, $2, $3, $4, $5)
            `, [2, '2025-12-11', 1, 'present', '']);
            console.log('Insert succeeded!');
        } catch (e) {
            console.error('Insert failed with error:', e.message);
            console.error('Full Error:', e);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

main();
