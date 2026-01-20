import { AIService } from '../services/ai';
import { Idea } from '../db';

async function testRealRadicalDeduplication() {
    const tenantId = '991c16c0-cda3-40fe-bb05-9d8f922f5aab';

    try {
        const idea = await Idea.findByPk(3);
        if (!idea) {
            console.error('Idea 3 not found in database.');
            return;
        }

        console.log('--- Testing Radical Deduplication (Real Idea 3) ---');
        console.log('Existing Summaries count:', JSON.parse(idea.generatedSummaries || '[]').length);

        const result = await AIService.generateForIdea(tenantId, idea);

        console.log('\n--- AI Generation Result ---');
        console.log('Summary:', result.summary);
        console.log('Content Hook:', result.content.substring(0, 150) + '...');

        // Fetch again to verify saving
        const updatedIdea = await Idea.findByPk(3);
        const newSummaries = JSON.parse(updatedIdea?.generatedSummaries || '[]');
        console.log('\n--- Database Verification ---');
        console.log('New Summaries count:', newSummaries.length);
        console.log('Latest summary in DB:', newSummaries[newSummaries.length - 1]);

        if (newSummaries.length > 0 && newSummaries[newSummaries.length - 1] === result.summary) {
            console.log('✅ End-to-end success: Summary saved correctly.');
        } else {
            console.log('❌ Failure: Summary not saved correctly in database.');
        }

    } catch (error: any) {
        console.error('Test Failed:', error.message);
    }
}

testRealRadicalDeduplication();
