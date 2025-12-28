
import fs from 'fs';
import path from 'path';
import { sequelize } from './db';

const migrate = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connected to DB.');

        const sqlPath = path.join(__dirname, '../migrations/20251228_223000_create_tenant_tables.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Split by semicolon to run individually (SQLite limitation on some drivers)
        // But Sequelize .query might accept multiple? 
        // Safer to split, but removing newlines/comments is tricky.
        // Let's try running as one block first, if logic permits.
        // Actually, SQLite executemany is not standard.
        // Simple regex split:
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const statement of statements) {
            try {
                await sequelize.query(statement);
                console.log('Executed:', statement.substring(0, 50) + '...');
            } catch (err: any) {
                // Ignore "duplicate column name" errors
                if (err.message.includes('duplicate column name')) {
                    console.log('Skipping duplicate column add.');
                } else if (err.message.includes('already exists')) {
                    console.log('Skipping existing table.', err.message);
                } else {
                    console.error('Error executing statement:', statement, err);
                }
            }
        }

        console.log('Migration complete.');
    } catch (err) {
        console.error('Migration failed:', err);
    }
};

migrate();
