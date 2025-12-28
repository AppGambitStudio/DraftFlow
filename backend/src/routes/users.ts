
import express, { Response } from 'express';
import { TenantMember, User } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = express.Router();

// Get tenant members
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const members = await TenantMember.findAll({
            where: { tenantId },
            include: [{ model: User, attributes: ['id', 'email'] }]
        });

        const result = members.map((m: any) => ({
            userId: m.userId,
            email: m.User.email,
            role: m.role,
            joinedAt: m.createdAt,
            // isCurrentUser: m.userId === req.user!.id
        }));

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch members' });
    }
});

// Remove member (Only Owner/Admin)
router.delete('/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { userId } = req.params;
        const currentUserId = req.user!.id;

        // Check permission
        if (req.membership?.role !== 'OWNER' && req.membership?.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        // Cannot remove self (use leave endpoint instead if implemented)
        if (userId === currentUserId) {
            return res.status(400).json({ error: 'Cannot remove yourself' });
        }

        const memberToRemove = await TenantMember.findOne({
            where: { userId, tenantId }
        });

        if (!memberToRemove) {
            return res.status(404).json({ error: 'Member not found' });
        }

        // Owners cannot be removed by Admins, only by other Owners (if multiple owners allowed)
        if (memberToRemove.role === 'OWNER' && req.membership.role !== 'OWNER') {
            return res.status(403).json({ error: 'Cannot remove an Owner' });
        }

        await memberToRemove.destroy();
        res.json({ message: 'Member removed' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove member' });
    }
});

export default router;
