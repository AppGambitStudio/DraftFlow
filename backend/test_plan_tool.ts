import { createPlanTool } from './src/services/mastraAgent';

async function testTool() {
    try {
        const result = await createPlanTool.execute({
            tenantId: '991c16c0-cda3-40fe-bb05-9d8f922f5aab',
            topic: 'Why writing is important for founders',
            contentPillars: ['Thought Leadership'],
            recentPostTopics: ['Multi-tenant SaaS architecture'],
            targetAudience: 'CTOs',
            platform: 'LINKEDIN'
        });
        console.log('Result:', result);
    } catch (e) {
        console.error('Inner Tool Error:', e);
    } finally {
        process.exit(0);
    }
}

testTool().catch(e => {
    console.error(e);
    process.exit(1);
});
