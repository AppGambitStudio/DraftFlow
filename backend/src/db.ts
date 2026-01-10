import { Sequelize, DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, ForeignKey } from 'sequelize';
import * as crypto from 'crypto';
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

// Tenant Model
export class Tenant extends Model<InferAttributes<Tenant>, InferCreationAttributes<Tenant>> {
    declare id: CreationOptional<string>;
    declare name: string;
    declare readonly createdAt: CreationOptional<Date>;
    declare readonly updatedAt: CreationOptional<Date>;
}

Tenant.init({
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'My Workspace',
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
}, {
    sequelize,
    modelName: 'Tenant',
    tableName: 'tenants',
});

// TenantMember Model
export class TenantMember extends Model<InferAttributes<TenantMember>, InferCreationAttributes<TenantMember>> {
    declare id: CreationOptional<number>;
    declare userId: ForeignKey<User['id']>;
    declare tenantId: ForeignKey<Tenant['id']>;
    declare role: string; // OWNER, ADMIN, EDITOR
    declare readonly createdAt: CreationOptional<Date>;
    declare readonly updatedAt: CreationOptional<Date>;
}

TenantMember.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    userId: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    tenantId: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    role: {
        type: DataTypes.STRING,
        defaultValue: 'OWNER',
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
}, {
    sequelize,
    modelName: 'TenantMember',
    tableName: 'tenant_members',
    indexes: [
        { fields: ['userId'] },
        { fields: ['tenantId'] }
    ]
});

// Invitation Model
export class Invitation extends Model<InferAttributes<Invitation>, InferCreationAttributes<Invitation>> {
    declare id: CreationOptional<number>;
    declare email: string;
    declare tenantId: ForeignKey<Tenant['id']>;
    declare token: string;
    declare role: string;
    declare status: string; // PENDING, ACCEPTED
    declare expiresAt: Date;
    declare readonly createdAt: CreationOptional<Date>;
    declare readonly updatedAt: CreationOptional<Date>;
}

Invitation.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    tenantId: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    token: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    role: {
        type: DataTypes.STRING,
        defaultValue: 'ADMIN',
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'PENDING',
    },
    expiresAt: DataTypes.DATE,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
}, {
    sequelize,
    modelName: 'Invitation',
    tableName: 'invitations',
});

// Settings Model
export class Settings extends Model<InferAttributes<Settings>, InferCreationAttributes<Settings>> {
    declare id: CreationOptional<number>;
    declare userId: ForeignKey<User['id']> | null;
    declare tenantId: ForeignKey<Tenant['id']> | null; // Added
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
    declare maxHistoryItems: CreationOptional<number>;
    declare globalTone: string | null;
    declare accountTones: string | null; // JSON string mapping urn -> instructions
    declare aiPersona: string | null; // Added
    declare webhookSecret: CreationOptional<string | null>; // Added
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
    tenantId: { // Added
        type: DataTypes.STRING,
        allowNull: true,
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
    maxHistoryItems: {
        type: DataTypes.INTEGER,
        defaultValue: 5,
    },
    globalTone: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    accountTones: {
        type: DataTypes.TEXT,
        defaultValue: '{}',
    },
    aiPersona: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    webhookSecret: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
}, {
    sequelize,
    modelName: 'Settings',
    tableName: 'settings',
    indexes: [
        { fields: ['userId'] }
    ]
});

// Post Model
export class Post extends Model<InferAttributes<Post>, InferCreationAttributes<Post>> {
    declare id: CreationOptional<number>;
    declare userId: ForeignKey<User['id']> | null;
    declare tenantId: ForeignKey<Tenant['id']> | null; // Added
    declare content: string;
    declare mediaUrls: string | null; // JSON string
    declare scheduledTime: Date | null;
    declare status: string; // DRAFT, SCHEDULED, PUBLISHED, FAILED
    declare platforms: string; // JSON string: ["LINKEDIN", "TWITTER"]
    declare linkedinPostId: string | null;
    declare twitterPostId: string | null;
    declare error: string | null;
    declare authorUrn: string | null;
    declare authorName: string | null;
    declare likesCount: CreationOptional<number>;
    declare commentsCount: CreationOptional<number>;
    declare repostsCount: CreationOptional<number>;
    declare impressionsCount: CreationOptional<number>;
    declare lastStatsSyncedAt: CreationOptional<Date | null>;
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
    tenantId: { // Added
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
        allowNull: true,
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
    likesCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    commentsCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    repostsCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    impressionsCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    lastStatsSyncedAt: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
}, {
    sequelize,
    modelName: 'Post',
    tableName: 'posts',
    indexes: [
        { fields: ['userId'] },
        { fields: ['status', 'scheduledTime'] },
        { fields: ['createdAt'] }
    ]
});

// Idea Model
export class Idea extends Model<InferAttributes<Idea>, InferCreationAttributes<Idea>> {
    declare id: CreationOptional<number>;
    declare userId: ForeignKey<User['id']> | null;
    declare tenantId: ForeignKey<Tenant['id']> | null; // Added
    declare title: string;
    declare description: string | null;
    declare tags: CreationOptional<string>; // JSON string
    declare status: CreationOptional<string>; // NEW, DRAFTED, ARCHIVED
    declare source: string | null;
    declare contentHash: string | null;
    declare isRecurring: CreationOptional<boolean>;
    declare frequency: string | null;
    declare lastGeneratedAt: Date | null;
    declare authorUrn: string | null;
    declare authorName: string | null;
    declare targetAudience: string | null;
    declare generatedSummaries: CreationOptional<string>; // JSON string array of last 5 summaries
    declare sourceLinks: CreationOptional<string>; // JSON string array of reference links
    declare scheduleTime: string | null;
    declare scheduleDayOfWeek: number | null;
    declare scheduleDayOfMonth: number | null;
    declare postShape: string | null;
    declare effortLevel: string | null;
    declare keyTakeaway: string | null;
    declare antiGoals: string | null;
    declare attachments: CreationOptional<string>; // JSON string array of { name, url, size }
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
    tenantId: { // Added
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
    attachments: {
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
    postShape: DataTypes.TEXT,
    effortLevel: DataTypes.TEXT,
    keyTakeaway: DataTypes.TEXT,
    antiGoals: DataTypes.TEXT,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
}, {
    sequelize,
    modelName: 'Idea',
    tableName: 'ideas',
    indexes: [
        { fields: ['userId'] },
        { fields: ['isRecurring'] },
        { fields: ['createdAt'] }
    ]
});

// Associations
User.hasMany(Settings, { foreignKey: 'userId' });
Settings.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Post, { foreignKey: 'userId' });
Post.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Idea, { foreignKey: 'userId' });
Idea.belongsTo(User, { foreignKey: 'userId' });

// Tenant Associations
User.hasMany(TenantMember, { foreignKey: 'userId' });
TenantMember.belongsTo(User, { foreignKey: 'userId' });

Tenant.hasMany(TenantMember, { foreignKey: 'tenantId' });
TenantMember.belongsTo(Tenant, { foreignKey: 'tenantId' });

Tenant.hasMany(Post, { foreignKey: 'tenantId' });
Post.belongsTo(Tenant, { foreignKey: 'tenantId' });

Tenant.hasMany(Idea, { foreignKey: 'tenantId' });
Idea.belongsTo(Tenant, { foreignKey: 'tenantId' });

Tenant.hasMany(Settings, { foreignKey: 'tenantId' });
Settings.belongsTo(Tenant, { foreignKey: 'tenantId' });

Tenant.hasMany(Invitation, { foreignKey: 'tenantId' });
Invitation.belongsTo(Tenant, { foreignKey: 'tenantId' });

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
                webhookSecret: crypto.randomBytes(16).toString('hex'),
            });
            console.log('Default settings created for the user.');
        }

        // 4. Ensure all settings have a webhookSecret (self-healing)
        const allSettings = await Settings.findAll({ where: { webhookSecret: null } });
        for (const s of allSettings) {
            await s.update({ webhookSecret: crypto.randomBytes(16).toString('hex') });
        }
        if (allSettings.length > 0) {
            console.log(`Generated webhook secrets for ${allSettings.length} settings records.`);
        }

    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
};
