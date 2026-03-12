import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Tenant, TenantMember } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET!;

// Login
router.post('/login', async (req: Request, res: Response) => {
    const { email, password } = req.body;
    console.log(`[LOGIN_ATTEMPT] Email: "${email}"`);

    try {
        const user = await User.findOne({ where: { email } });
        if (!user) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }

        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Signup (Optional: and restricted if needed, but let's implement for completeness)
router.post('/signup', async (req: Request, res: Response) => {
    const { email, password } = req.body;

    try {
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            res.status(400).json({ error: 'User already exists' });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            email,
            password: hashedPassword,
        });

        // Create Default Tenant
        const tenant = await Tenant.create({
            name: `${email.split('@')[0]}'s Workspace`
        });

        await TenantMember.create({
            userId: user.id,
            tenantId: tenant.id,
            role: 'OWNER'
        });

        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Me (Get current user)
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
    if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    // Fetch Tenants
    const members = await TenantMember.findAll({
        where: { userId: req.user.id },
        include: [Tenant]
    });

    const tenants = members.map((m: any) => ({
        id: m.Tenant.id,
        name: m.Tenant.name,
        role: m.role
    }));

    res.json({
        id: req.user.id,
        email: req.user.email,
        tenantId: req.tenantId,
        role: req.membership?.role,
        tenants
    });
});

export default router;
