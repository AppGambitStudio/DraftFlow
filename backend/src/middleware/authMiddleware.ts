import { Request, Response, NextFunction } from 'express';
import jwt, { Secret } from 'jsonwebtoken';
import { User, TenantMember } from '../db';

const JWT_SECRET: Secret = (process.env.JWT_SECRET || 'your-default-secret-change-this') as Secret;

export interface AuthRequest extends Request {
    user?: User;
    tenantId?: string;
    membership?: TenantMember;
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    let token: string | undefined;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.query.token) {
        token = req.query.token as string;
    }

    if (!token) {
        res.status(401).json({ error: 'No token provided' });
        return;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET as any) as unknown as { id: string };
        const user = await User.findByPk(decoded.id);

        if (!user) {
            res.status(401).json({ error: 'User not found' });
            return;
        }

        req.user = user;

        // Resolve Tenant
        const headerTenantId = req.headers['x-tenant-id'] || req.query.tenantId;
        let member: TenantMember | null = null;

        if (headerTenantId) {
            member = await TenantMember.findOne({
                where: { userId: user.id, tenantId: headerTenantId as string }
            });
        } else {
            // Default to first found tenant
            member = await TenantMember.findOne({
                where: { userId: user.id }
            });
        }

        if (member) {
            req.tenantId = member.tenantId;
            req.membership = member;
        } else {
            // Edge case: User has no tenant (created before migration and missed? or newly created?)
            // Ideally we auto-create one here to self-heal
            console.warn(`User ${user.id} has no tenant. Auto-creating...`);
            const { Tenant } = require('../db'); // Lazy load to avoid circular dep issues if any
            const newTenant = await Tenant.create({ name: 'My Workspace' });
            member = await TenantMember.create({
                userId: user.id,
                tenantId: newTenant.id,
                role: 'OWNER'
            });
            req.tenantId = newTenant.id;
            req.membership = member;
        }

        next();
    } catch (error) {
        console.error('Auth Middleware Error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
};
