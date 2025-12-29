
import { Invitation, User, Tenant } from './db';

async function diagnose() {
    console.log('--- RE-DIAGNOSING WITHOUT ALIAS ---');
    const invites = await Invitation.findAll({
        include: [Tenant]
    });
    invites.forEach(i => {
        console.log(`To: ${i.email}, Tenant Key: ${Object.keys((i as any).toJSON()).find(k => k.toLowerCase() === 'tenant')}, Tenant Name: ${(i as any).Tenant?.name || (i as any).tenant?.name || 'UNKNOWN'}`);
        console.log('Available keys:', Object.keys((i as any).toJSON()));
    });
}

diagnose().catch(console.error);
