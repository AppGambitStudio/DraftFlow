
import { Invitation, User, Tenant } from './db';

async function diagnose() {
    console.log('--- DB INSPECTION ---');
    const invites = await Invitation.findAll();
    console.log('INVITATIONS (raw):');
    invites.forEach(i => {
        console.log(`- ID: ${i.id}, Email: "${i.email}", Status: "${i.status}", Token: "${i.token}"`);
    });

    const users = await User.findAll();
    console.log('\nUSERS (raw):');
    users.forEach(u => {
        console.log(`- ID: ${u.id}, Email: "${u.email}"`);
    });
}

diagnose().catch(console.error);
