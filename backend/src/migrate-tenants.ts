
import { sequelize, User, Tenant, TenantMember, Post, Idea, Settings } from './db';

const runMigration = async () => {
    try {
        console.log('Starting Migration...');

        // 1. Sync DB to create NEW tables (Tenants, TenantMembers, Invitations)
        await sequelize.sync();
        console.log('Tables synced.');

        // 2. Add Columns manually if they don't exist (SQLite doesn't support IF NOT EXISTS for ADD COLUMN)
        const queries = [
            `ALTER TABLE posts ADD COLUMN tenantId TEXT`,
            `ALTER TABLE ideas ADD COLUMN tenantId TEXT`,
            `ALTER TABLE settings ADD COLUMN tenantId TEXT`,
            `CREATE INDEX IF NOT EXISTS idx_posts_tenantId ON posts(tenantId)`,
            `CREATE INDEX IF NOT EXISTS idx_ideas_tenantId ON ideas(tenantId)`,
            `CREATE INDEX IF NOT EXISTS idx_settings_tenantId ON settings(tenantId)`
        ];

        for (const q of queries) {
            try {
                await sequelize.query(q);
                console.log('Executed:', q);
            } catch (e: any) {
                if (e.message.includes('duplicate column name')) {
                    console.log('Column already exists:', q);
                } else {
                    console.error('Error executing query:', q, e.message);
                }
            }
        }

        // 3. Backfill Data
        const users = await User.findAll();
        console.log(`Found ${users.length} users to migrate.`);

        for (const user of users) {
            // Check if user already has a tenant member record
            const existingMember = await TenantMember.findOne({ where: { userId: user.id } });
            if (existingMember) {
                console.log(`User ${user.email} already has a tenant. Skipping.`);
                continue;
            }

            console.log(`Migrating User: ${user.email}`);

            // Create Tenant
            const tenant = await Tenant.create({
                name: `${user.email}'s Workspace`
            });

            // Link User to Tenant
            await TenantMember.create({
                userId: user.id,
                tenantId: tenant.id,
                role: 'OWNER'
            });

            // Update Data
            await Post.update({ tenantId: tenant.id }, { where: { userId: user.id } });
            await Idea.update({ tenantId: tenant.id }, { where: { userId: user.id } });
            await Settings.update({ tenantId: tenant.id }, { where: { userId: user.id } });

            console.log(`Migrated data for ${user.email} to Tenant ${tenant.id}`);
        }

        console.log('Migration Complete.');

    } catch (error) {
        console.error('Migration Failed:', error);
    }
};

runMigration();
