import { Sequelize, DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, ForeignKey } from 'sequelize';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

// Ensure DATABASE_URL is set or default to dev.db
const dbPath = process.env.DATABASE_URL?.replace('file:', '') || 'dev.db';

export const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: false, // Set to console.log to see SQL queries
});

// User Model
export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
    declare id: CreationOptional<string>;
    declare email: string;
    declare password: string;
    declare readonly createdAt: CreationOptional<Date>;
    declare readonly updatedAt: CreationOptional<Date>;
}

User.init({
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: () => Math.random().toString(36).substring(2, 11),
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true }
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
}, {
    sequelize,
    modelName: 'User',
    tableName: 'users',
});

// Settings Model
export class Settings extends Model<InferAttributes<Settings>, InferCreationAttributes<Settings>> {
    declare id: CreationOptional<number>;
    declare userId: ForeignKey<User['id']> | null;
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
    declare targetAudiences: string | null; // Comma separated list
    declare linkedinProfile: string | null; // JSON string for "Self" profile
    declare linkedinOrganizations: string | null; // JSON string
    declare readonly createdAt: CreationOptional<Date>;
    declare readonly updatedAt: CreationOptional<Date>;
}

Settings.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    userId: {
        type: DataTypes.STRING,
        allowNull: true, // Initially allow null for migration
        unique: true,
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
    targetAudiences: DataTypes.TEXT,
    linkedinProfile: {
        type: DataTypes.TEXT,
        defaultValue: '{}',
    },
    linkedinOrganizations: {
        type: DataTypes.TEXT,
        defaultValue: '[]',
    },
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
    declare userId: ForeignKey<User['id']> | null;
    declare content: string;
    declare mediaUrls: string | null; // JSON string
    declare scheduledTime: Date;
    declare status: string; // DRAFT, SCHEDULED, PUBLISHED, FAILED
    declare platforms: string; // JSON string: ["LINKEDIN", "TWITTER"]
    declare linkedinPostId: string | null;
    declare twitterPostId: string | null;
    declare error: string | null;
    declare authorUrn: string | null;
    declare authorName: string | null;
    declare readonly createdAt: CreationOptional<Date>;
    declare readonly updatedAt: CreationOptional<Date>;
}

Post.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    userId: {
        type: DataTypes.STRING,
        allowNull: true,
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
    authorUrn: DataTypes.STRING,
    authorName: DataTypes.STRING,
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
    declare userId: ForeignKey<User['id']> | null;
    declare title: string;
    declare description: string | null;
    declare tags: string; // JSON string
    declare status: string; // NEW, DRAFTED, ARCHIVED
    declare source: string | null;
    declare contentHash: string | null;
    declare isRecurring: boolean;
    declare frequency: string | null;
    declare lastGeneratedAt: Date | null;
    declare authorUrn: string | null;
    declare authorName: string | null;
    declare targetAudience: string | null;
    declare generatedSummaries: string; // JSON string array of last 5 summaries
    declare sourceLinks: string; // JSON string array of reference links
    declare scheduleTime: string | null;
    declare scheduleDayOfWeek: number | null;
    declare scheduleDayOfMonth: number | null;
    declare readonly createdAt: CreationOptional<Date>;
    declare readonly updatedAt: CreationOptional<Date>;
}

Idea.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    userId: {
        type: DataTypes.STRING,
        allowNull: true,
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
    authorUrn: DataTypes.STRING,
    authorName: DataTypes.STRING,
    targetAudience: DataTypes.STRING,
    generatedSummaries: {
        type: DataTypes.TEXT,
        defaultValue: '[]',
    },
    sourceLinks: {
        type: DataTypes.TEXT,
        defaultValue: '[]',
    },
    scheduleTime: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    scheduleDayOfWeek: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    scheduleDayOfMonth: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
}, {
    sequelize,
    modelName: 'Idea',
    tableName: 'ideas',
});

// Associations
User.hasMany(Settings, { foreignKey: 'userId' });
Settings.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Post, { foreignKey: 'userId' });
Post.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Idea, { foreignKey: 'userId' });
Idea.belongsTo(User, { foreignKey: 'userId' });

// Sync database
export const initDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');
        await sequelize.sync(); // Removed alter: true
        console.log('Database synced successfully.');

        // 1. Create Default User if not exists
        const email = 'dhaval.b.nagar@gmail.com';
        let defaultUser = await User.findOne({ where: { email } });
        if (!defaultUser) {
            const hashedPassword = await bcrypt.hash('Test@1234', 10);
            defaultUser = await User.create({
                email,
                password: hashedPassword,
            });
            console.log('Default User created:', email, 'ID:', defaultUser.id);
        }

        // 2. Data Migration: Assign orphaned records to Default User
        const orphanedSettings = await Settings.update({ userId: defaultUser.id }, { where: { userId: null } });
        const orphanedPosts = await Post.update({ userId: defaultUser.id }, { where: { userId: null } });
        const orphanedIdeas = await Idea.update({ userId: defaultUser.id }, { where: { userId: null } });

        if (orphanedSettings[0] > 0 || orphanedPosts[0] > 0 || orphanedIdeas[0] > 0) {
            console.log(`Migrated: ${orphanedSettings[0]} settings, ${orphanedPosts[0]} posts, ${orphanedIdeas[0]} ideas to ${email}`);
        }

        // 3. Ensure Settings exists for the user (double check / seeding)
        const userSettings = await Settings.findOne({ where: { userId: defaultUser.id } });
        if (!userSettings) {
            await Settings.create({
                userId: defaultUser.id,
                linkedinOrganizations: '[]',
            });
            console.log('Default settings created for the user.');
        }

    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
};
