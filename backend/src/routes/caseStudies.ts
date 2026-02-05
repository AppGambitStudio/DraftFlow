import express, { Response } from 'express';
import { CaseStudy } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = express.Router();

// Get all case studies
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { status, industry } = req.query;

        const where: any = { tenantId };
        if (status) where.status = status;
        if (industry) where.industry = industry;

        const caseStudies = await CaseStudy.findAll({
            where,
            order: [['createdAt', 'DESC']]
        });

        res.json(caseStudies.map(cs => ({
            id: cs.id,
            title: cs.title,
            clientName: cs.clientName,
            industry: cs.industry,
            challenge: cs.challenge,
            solution: cs.solution,
            results: cs.results,
            testimonial: cs.testimonial,
            tags: JSON.parse(cs.tags || '[]'),
            status: cs.status,
            createdAt: cs.createdAt,
            updatedAt: cs.updatedAt
        })));
    } catch (error) {
        console.error('Failed to fetch case studies:', error);
        res.status(500).json({ error: 'Failed to fetch case studies' });
    }
});

// Get single case study
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { id } = req.params;

        const caseStudy = await CaseStudy.findOne({
            where: { id, tenantId }
        });

        if (!caseStudy) {
            return res.status(404).json({ error: 'Case study not found' });
        }

        res.json({
            id: caseStudy.id,
            title: caseStudy.title,
            clientName: caseStudy.clientName,
            industry: caseStudy.industry,
            challenge: caseStudy.challenge,
            solution: caseStudy.solution,
            results: caseStudy.results,
            testimonial: caseStudy.testimonial,
            tags: JSON.parse(caseStudy.tags || '[]'),
            status: caseStudy.status,
            createdAt: caseStudy.createdAt,
            updatedAt: caseStudy.updatedAt
        });
    } catch (error) {
        console.error('Failed to fetch case study:', error);
        res.status(500).json({ error: 'Failed to fetch case study' });
    }
});

// Create new case study
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { title, clientName, industry, challenge, solution, results, testimonial, tags, status } = req.body;

        if (!title || !clientName || !challenge || !solution || !results) {
            return res.status(400).json({ error: 'Missing required fields: title, clientName, challenge, solution, results' });
        }

        const caseStudy = await CaseStudy.create({
            tenantId,
            title,
            clientName,
            industry: industry || null,
            challenge,
            solution,
            results,
            testimonial: testimonial || null,
            tags: JSON.stringify(tags || []),
            status: status || 'draft'
        });

        res.status(201).json({
            id: caseStudy.id,
            title: caseStudy.title,
            clientName: caseStudy.clientName,
            industry: caseStudy.industry,
            challenge: caseStudy.challenge,
            solution: caseStudy.solution,
            results: caseStudy.results,
            testimonial: caseStudy.testimonial,
            tags: JSON.parse(caseStudy.tags || '[]'),
            status: caseStudy.status,
            createdAt: caseStudy.createdAt,
            updatedAt: caseStudy.updatedAt
        });
    } catch (error) {
        console.error('Failed to create case study:', error);
        res.status(500).json({ error: 'Failed to create case study' });
    }
});

// Update case study
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { id } = req.params;
        const { title, clientName, industry, challenge, solution, results, testimonial, tags, status } = req.body;

        const caseStudy = await CaseStudy.findOne({
            where: { id, tenantId }
        });

        if (!caseStudy) {
            return res.status(404).json({ error: 'Case study not found' });
        }

        await caseStudy.update({
            title: title !== undefined ? title : caseStudy.title,
            clientName: clientName !== undefined ? clientName : caseStudy.clientName,
            industry: industry !== undefined ? industry : caseStudy.industry,
            challenge: challenge !== undefined ? challenge : caseStudy.challenge,
            solution: solution !== undefined ? solution : caseStudy.solution,
            results: results !== undefined ? results : caseStudy.results,
            testimonial: testimonial !== undefined ? testimonial : caseStudy.testimonial,
            tags: tags !== undefined ? JSON.stringify(tags) : caseStudy.tags,
            status: status !== undefined ? status : caseStudy.status
        });

        res.json({
            id: caseStudy.id,
            title: caseStudy.title,
            clientName: caseStudy.clientName,
            industry: caseStudy.industry,
            challenge: caseStudy.challenge,
            solution: caseStudy.solution,
            results: caseStudy.results,
            testimonial: caseStudy.testimonial,
            tags: JSON.parse(caseStudy.tags || '[]'),
            status: caseStudy.status,
            createdAt: caseStudy.createdAt,
            updatedAt: caseStudy.updatedAt
        });
    } catch (error) {
        console.error('Failed to update case study:', error);
        res.status(500).json({ error: 'Failed to update case study' });
    }
});

// Delete case study
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { id } = req.params;

        const caseStudy = await CaseStudy.findOne({
            where: { id, tenantId }
        });

        if (!caseStudy) {
            return res.status(404).json({ error: 'Case study not found' });
        }

        await caseStudy.destroy();
        res.json({ message: 'Case study deleted' });
    } catch (error) {
        console.error('Failed to delete case study:', error);
        res.status(500).json({ error: 'Failed to delete case study' });
    }
});

export default router;
