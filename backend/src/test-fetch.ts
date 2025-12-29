
import { Invitation, User, Tenant, sequelize } from './db';
import { Op } from 'sequelize';

async function testFetchMine(userEmail: string) {
    userEmail = userEmail.toLowerCase();
    console.log(`Testing lookup for: "${userEmail}"`);

    const invitations = await Invitation.findAll({
        where: {
            [Op.and]: [
                sequelize.where(sequelize.fn('LOWER', sequelize.col('email')), userEmail),
                { status: 'PENDING' }
            ]
        } as any,
        include: [{ model: Tenant, attributes: ['name'] }]
    });

    console.log(`Found: ${invitations.length}`);
    invitations.forEach(inv => {
        const data = (inv as any).toJSON();
        console.log('Invite Data:', JSON.stringify(data, null, 2));
    });
}

testFetchMine('vishal.kodi@appgambit.com').catch(console.error);
