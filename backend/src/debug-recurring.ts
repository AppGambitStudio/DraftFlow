
import { Idea, Post, initDB } from './db';
import { AIService } from './services/ai';
import { Op } from 'sequelize';

// Mock AIService to avoid API costs/latency during test
AIService.improvise = async () => "Generated Recurring Content";

// We need to access the function, but it's not exported. 
// For this test, I'll copy the logic or we can export it.
// Let's copy the logic for a standalone test script to verify the ALGORITHM.

async function debugRecurring() {
    await initDB();

    console.log('--- Debugging Recurring Ideas ---');

    // 1. Create a test recurring idea
    const title = "Recurring Test Idea " + Date.now();
    const idea = await Idea.create({
        title,
        description: "Test Description",
        tags: '["test"]',
        status: 'NEW',
        isRecurring: true,
        frequency: 'DAILY',
        lastGeneratedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
    });

    console.log(`Created Idea: ${idea.id} (Last Run: ${idea.lastGeneratedAt})`);

    // 2. Run Logic
    const now = new Date();
    let shouldGenerate = false;
    const lastRun = idea.lastGeneratedAt ? new Date(idea.lastGeneratedAt) : null;

    if (!lastRun) {
        shouldGenerate = true;
    } else {
        const diffMs = now.getTime() - lastRun.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        console.log(`Diff Days: ${diffDays}`);

        if (idea.frequency === 'DAILY' && diffDays >= 1) shouldGenerate = true;
    }

    if (shouldGenerate) {
        console.log('Generating post...');
        const content = await AIService.improvise("prompt");

        const scheduledTime = new Date();
        scheduledTime.setDate(scheduledTime.getDate() + 1);
        scheduledTime.setHours(9, 0, 0, 0);

        const post = await Post.create({
            content,
            scheduledTime,
            status: 'DRAFT',
            platforms: JSON.stringify(['LINKEDIN'])
        });

        idea.lastGeneratedAt = now;
        await idea.save();

        console.log(`Success! Post created: ${post.id}`);
        console.log(`Idea updated lastGeneratedAt: ${idea.lastGeneratedAt}`);
    } else {
        console.error('FAILED: Should have generated but did not.');
    }
}

debugRecurring();
