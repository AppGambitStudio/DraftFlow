
import express, { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Invitation, TenantMember, User, Tenant } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = express.Router();

// List invitations (Admin/Owner only?)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        // Optional: specific role check
        // if (req.membership?.role !== 'OWNER' && req.membership?.role !== 'ADMIN') ...

        const invitations = await Invitation.findAll({
            where: { tenantId, status: 'PENDING' },
            order: [['createdAt', 'DESC']]
        });
        res.json(invitations);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch invitations' });
    }
});

// Create invitation
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { email, role } = req.body; // Role: 'ADMIN', 'EDITOR'

        if (!email) return res.status(400).json({ error: 'Email is required' });

        // Check if user is already a member
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            const existingMember = await TenantMember.findOne({
                where: { userId: existingUser.id, tenantId }
            });
            if (existingMember) {
                return res.status(400).json({ error: 'User is already a member of this workspace' });
            }
        }

        // Check if pending invitation exists
        const existingInvite = await Invitation.findOne({
            where: { email, tenantId, status: 'PENDING' }
        });

        if (existingInvite) {
            // Resend logic or just return existing
            return res.json({ message: 'Invitation already pending', token: existingInvite.token });
        }

        const token = uuidv4();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

        const invitation = await Invitation.create({
            email,
            tenantId,
            token,
            role: role || 'ADMIN',
            status: 'PENDING',
            expiresAt
        });

        // In a real app, send email here.
        console.log(`[INVITE LINK] http://localhost:3000/accept-invite?token=${token}`);

        res.json({ message: 'Invitation created', invitation, link: `http://localhost:3000/accept-invite?token=${token}` });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to create invitation' });
    }
});

// Accept invitation
router.post('/accept', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { token } = req.body;
        const userId = req.user!.id;

        if (!token) return res.status(400).json({ error: 'Token is required' });

        const invitation = await Invitation.findOne({ where: { token, status: 'PENDING' } });
        if (!invitation) {
            return res.status(404).json({ error: 'Invalid or expired invitation' });
        }

        if (new Date() > invitation.expiresAt) {
            return res.status(400).json({ error: 'Invitation expired' });
        }

        // Check if already a member
        const existingMember = await TenantMember.findOne({
            where: { userId, tenantId: invitation.tenantId }
        });

        if (existingMember) {
            return res.status(400).json({ error: 'You are already a member of this workspace' });
        }

        // Create Membership
        await TenantMember.create({
            userId,
            tenantId: invitation.tenantId,
            role: invitation.role
        });

        // Update Invitation
        invitation.status = 'ACCEPTED';
        await invitation.save();

        res.json({ message: 'Invitation accepted', tenantId: invitation.tenantId });
    } catch (error: any) {
        console.error('Accept invite error:', error);
        res.status(500).json({ error: 'Failed to accept invitation' });
    }
});

// Cancell invitation
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { id } = req.params;

        const invite = await Invitation.findOne({ where: { id, tenantId } });
        if (invite) {
            await invite.destroy();
        }
        res.json({ message: 'Invitation revoked' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to revoke invitation' });
    }
});

export default router;
