
import { Invitation, User, Tenant } from './db';

async function diagnose() {
    const invites = await Invitation.findAll({
        include: [{ model: Tenant, as: 'tenant' }]
    });
    console.log('--- ALL PENDING INVITATIONS ---');
    invites.forEach(i => {
        console.log(`To: ${i.email}, Tenant: ${(i as any).tenant?.name}, Status: ${i.status}`);
    });

    const users = await User.findAll();
    console.log('\n--- ALL USERS ---');
    users.forEach(u => console.log(`Email: ${u.email}, ID: ${u.id}`));
}

diagnose().catch(console.error);
