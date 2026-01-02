
import { AIService } from '../services/ai';
import dotenv from 'dotenv';
dotenv.config();

async function reproduce() {
    const tenantId = '991c16c0-cda3-40fe-bb05-9d8f922f5aab';
    const ideaTitle = 'The Power of Atomic Habits in Coding';
    const ideaDescription = 'Discuss how small daily improvements in coding habits (like reading one technical article or clean refactoring one function) lead to massive long-term growth. Mention the 1% better every day rule.';

    console.log('--- Testing "⚡ Quick" Post Generation ---');
    const quickResult = await AIService.generate(
        tenantId,
        `Title: ${ideaTitle}\nDescription: ${ideaDescription}`,
        'Software Engineers',
        [],
        undefined,
        'Professional yet punchy',
        'Breakdown (step-by-step)',
        '⚡ Quick',
        'Small habits win big games',
        'No corporate jargon'
    );

    console.log('Quick Post Content:');
    console.log(quickResult.content);
    console.log('Word Count:', quickResult.content.split(/\s+/).length);
    console.log('--- End of Quick Test ---');

    console.log('\n--- Testing "🧠 Medium" Post Generation ---');
    const mediumResult = await AIService.generate(
        tenantId,
        `Title: ${ideaTitle}\nDescription: ${ideaDescription}`,
        'Software Engineers',
        [],
        undefined,
        'Professional yet punchy',
        'Breakdown (step-by-step)',
        '🧠 Medium',
        'Small habits win big games',
        'No corporate jargon'
    );

    console.log('Medium Post Content:');
    console.log(mediumResult.content);
    console.log('Word Count:', mediumResult.content.split(/\s+/).length);
    console.log('--- End of Medium Test ---');
}

reproduce().catch(console.error);
