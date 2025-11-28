
import { initDB, Settings } from './db';

const run = async () => {
    await initDB();

    console.log('--- Debugging Settings Model ID ---');

    // 1. Create or Update Settings
    const testModelId = 'openai/gpt-4o-test';
    console.log(`Setting openRouterModelId to: ${testModelId}`);

    const [setting] = await Settings.findOrCreate({ where: {} });
    await setting.update({ openRouterModelId: testModelId });

    // 2. Fetch Settings
    const updatedSetting = await Settings.findOne();
    console.log('Fetched Settings:', {
        id: updatedSetting?.id,
        openRouterModelId: updatedSetting?.openRouterModelId
    });

    if (updatedSetting?.openRouterModelId === testModelId) {
        console.log('SUCCESS: Model ID saved and retrieved correctly.');
    } else {
        console.error('FAILURE: Model ID mismatch.');
    }
};

run().catch(console.error);
