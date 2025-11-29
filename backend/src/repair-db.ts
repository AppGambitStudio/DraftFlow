import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const dbPath = process.env.DATABASE_URL?.replace('file:', '') || 'dev.db';

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: console.log,
});

const repairDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connected to database.');

        // Drop settings_backup table if it exists
        await sequelize.query('DROP TABLE IF EXISTS settings_backup');
        console.log('Dropped settings_backup table.');

        // Also check for other backup tables just in case
        await sequelize.query('DROP TABLE IF EXISTS posts_backup');
        await sequelize.query('DROP TABLE IF EXISTS ideas_backup');
        console.log('Dropped other backup tables if they existed.');

        console.log('Database repair complete.');
    } catch (error) {
        console.error('Error repairing database:', error);
    } finally {
        await sequelize.close();
    }
};

repairDB();
