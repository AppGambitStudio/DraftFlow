import { getMastraAgentService } from './src/services/mastraAgent';
import { Settings } from './src/db';

async function testAgentPipeline() {
    console.log('Testing Multi-Agent Pipeline (Phase 4)...');

    // We need a valid tenant ID to test this. 
    // Let's get the first available tenant that has an OpenRouter API configured.
    const settings = await Settings.findOne();
    if (!settings || !settings.tenantId) {
        throw new Error('No tenant settings found in DB to test with.');
    }

    const tenantId = settings.tenantId;
    console.log(`Using Tenant ID: ${tenantId}`);

    const service = getMastraAgentService();

    console.log('\\n--- STARTING PIPELINE ---');
    const result = await service.chat({
        tenantId,
        userMessage: 'Write a quick post about why writing is important for founders. Keep it short and use my voice.'
    });

    console.log('\\n--- PIPELINE RESULT ---');
    console.log('--- REFINED RAW RESPONSE ---');
    console.log(result.response);

    console.log('\\n--- EXTRACTED TOOLS USED ---');
    console.log(result.toolsUsed);

    console.log('\\n--- EXTRACTED JSON OBJECT ---');
    console.log(JSON.stringify(result.generatedContent, null, 2));
}

testAgentPipeline().catch(console.error);
