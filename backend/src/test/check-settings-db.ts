import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import { Settings } from '../db';

dotenv.config();

const dbPath = process.env.DATABASE_URL?.replace('file:', '') || 'dev.db';

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: false,
});

const checkSettings = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connected to database.');

        // We need to initialize the model if we are running this standalone without importing initDB
        // But importing Settings from ./db should have initialized it if we also import sequelize there.
        // However, ./db initializes it attached to the exported sequelize instance.
        // Let's just query raw to be safe and independent of app logic quirks.

        const [results, metadata] = await sequelize.query("SELECT * FROM settings");
        console.log('Settings table count:', results.length);
        console.log('Settings data:', JSON.stringify(results, null, 2));

    } catch (error) {
        console.error('Error checking settings:', error);
    } finally {
        await sequelize.close();
    }
};

checkSettings();
