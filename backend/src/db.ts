import { Sequelize, DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

// Ensure DATABASE_URL is set or default to dev.db
const dbPath = process.env.DATABASE_URL?.replace('file:', '') || 'dev.db';

export const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: false, // Set to console.log to see SQL queries
});

// Settings Model
export class Settings extends Model<InferAttributes<Settings>, InferCreationAttributes<Settings>> {
    declare id: CreationOptional<number>;
    declare linkedinClientId: string | null;
    declare linkedinClientSecret: string | null;
    declare linkedinAccessToken: string | null;
    declare linkedinRefreshToken: string | null;
    declare linkedinExpiresAt: Date | null;
    declare twitterClientId: string | null;
    declare twitterClientSecret: string | null;
    declare twitterAccessToken: string | null;
    declare twitterRefreshToken: string | null;
    declare twitterExpiresAt: Date | null;
    declare openRouterApiKey: string | null;
    declare openRouterModelId: string | null;
    declare readonly createdAt: CreationOptional<Date>;
    declare readonly updatedAt: CreationOptional<Date>;
}

Settings.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    linkedinClientId: DataTypes.STRING,
    linkedinClientSecret: DataTypes.STRING,
    linkedinAccessToken: DataTypes.STRING,
    linkedinRefreshToken: DataTypes.STRING,
    linkedinExpiresAt: DataTypes.DATE,
    twitterClientId: DataTypes.STRING,
    twitterClientSecret: DataTypes.STRING,
    twitterAccessToken: DataTypes.STRING,
    twitterRefreshToken: DataTypes.STRING,
    twitterExpiresAt: DataTypes.DATE,
    openRouterApiKey: DataTypes.STRING,
    openRouterModelId: DataTypes.STRING,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
}, {
    sequelize,
    modelName: 'Settings',
    tableName: 'settings',
});

// Post Model
export class Post extends Model<InferAttributes<Post>, InferCreationAttributes<Post>> {
    declare id: CreationOptional<number>;
    declare content: string;
    declare mediaUrls: string | null; // JSON string
    declare scheduledTime: Date;
    declare status: string; // DRAFT, SCHEDULED, PUBLISHED, FAILED
    declare platforms: string; // JSON string: ["LINKEDIN", "TWITTER"]
    declare linkedinPostId: string | null;
    declare twitterPostId: string | null;
    declare error: string | null;
    declare readonly createdAt: CreationOptional<Date>;
    declare readonly updatedAt: CreationOptional<Date>;
}

Post.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    mediaUrls: {
        type: DataTypes.TEXT, // SQLite doesn't have JSON type, so we store as text
        allowNull: true,
    },
    scheduledTime: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'DRAFT',
    },
    platforms: {
        type: DataTypes.TEXT,
        defaultValue: '["LINKEDIN"]', // Default to LinkedIn for backward compatibility
    },
    linkedinPostId: DataTypes.STRING,
    twitterPostId: DataTypes.STRING,
    error: DataTypes.TEXT,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
}, {
    sequelize,
    modelName: 'Post',
    tableName: 'posts',
});

// Idea Model
export class Idea extends Model<InferAttributes<Idea>, InferCreationAttributes<Idea>> {
    declare id: CreationOptional<number>;
    declare title: string;
    declare description: string | null;
    declare tags: string; // JSON string
    declare status: string; // NEW, DRAFTED, ARCHIVED
    declare source: string | null;
    declare contentHash: string | null;
    declare isRecurring: boolean;
    declare frequency: string | null;
    declare lastGeneratedAt: Date | null;
    declare readonly createdAt: CreationOptional<Date>;
    declare readonly updatedAt: CreationOptional<Date>;
}

Idea.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    tags: {
        type: DataTypes.TEXT,
        defaultValue: '[]',
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'NEW',
    },
    source: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    contentHash: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
    },
    isRecurring: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    frequency: {
        type: DataTypes.STRING, // DAILY, WEEKLY, MONTHLY
        allowNull: true,
    },
    lastGeneratedAt: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
}, {
    sequelize,
    modelName: 'Idea',
    tableName: 'ideas',
});

// Sync database
export const initDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');
        await sequelize.sync({ alter: true }); // Automatically updates schema
        console.log('Database synced successfully.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
};
