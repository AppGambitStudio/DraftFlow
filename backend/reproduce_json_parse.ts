
function extractAndParseJson(response: string): any {
    let cleanText = response.trim();

    // Remove markdown code blocks if present
    cleanText = cleanText.replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/g, '$1').trim();

    // LLM sometimes prepends text before the JSON or appends after it
    // We look for the first '{' and the last '}'
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanText = cleanText.substring(firstBrace, lastBrace + 1);
    }

    try {
        // Attempt 1: Direct parse
        return JSON.parse(cleanText);
    } catch (e) {
        try {
            // Attempt 2: Heuristic newline escaping for poorly formatted LLM output
            // Many LLMs fail to escape \n and instead produce literal newlines inside strings
            const lines = cleanText.split('\n');
            let reconstructed = '';
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i]?.trim() ?? '';
                // If line doesn't look like the start of a new key-value pair or a bracket, it's likely a continuation
                if (i > 0 && !line.startsWith('"') && !line.startsWith('}') && !line.startsWith(']')) {
                    reconstructed += '\\n' + lines[i];
                } else {
                    reconstructed += (i > 0 ? '\n' : '') + lines[i];
                }
            }
            return JSON.parse(reconstructed);
        } catch (innerE) {
            // Attempt 3: Aggressive cleanup of control characters and common JSON syntax errors
            try {
                let extraClean = cleanText
                    .replace(/\n/g, '\\n') // Escape actual newlines
                    .replace(/\r/g, '\\r')
                    .replace(/\t/g, '\\t');

                // Fix single quotes to double quotes for keys and values if it looks like invalid JSON
                // This is heuristic and might break content with apostrophes, but it's a fallback
                if (extraClean.includes("'")) {
                    // Replace 'key': with "key":
                    extraClean = extraClean.replace(/'([^']+?)'\s*:/g, '"$1":');
                    // Replace : 'value' with : "value"
                    extraClean = extraClean.replace(/:\s*'([^']+?)'/g, ': "$1"');
                    // Replace array elements 'value',
                    extraClean = extraClean.replace(/['"]?topics['"]?\s*:\s*\[([\s\S]*?)\]/g, (match, arrayContent) => {
                        const fixedArray = arrayContent.replace(/'([^']+?)'/g, '"$1"');
                        return `"topics": [${fixedArray}]`;
                    });
                }

                extraClean = extraClean
                    .replace(/\\"/g, '"') // Unescape all quotes (start fresh)
                    .replace(/"/g, '\\"') // Escape all quotes
                    .replace(/^\\"/, '"') // Unescape first quote
                    // .replace(/\\"$/, '"') // Unescape last quote - removed because it might be wrong if last char is }
                    .replace(/\\":\\"/g, '":"') // Fix key-value separator
                    .replace(/\\",\\"/g, '","') // Fix comma separator
                    .replace(/{\\"/g, '{"') // Fix start
                    .replace(/\\"}/g, '"}') // Fix end
                    .replace(/\\":\[/g, '":[') // Fix array start
                    .replace(/],\\"/g, '],"'); // Fix array end comma

                return JSON.parse(extraClean);
            } catch (lastE) {
                console.warn("[AIService] JSON.parse failed all attempts, falling back to regex extraction.");
                return null;
            }
        }
    }
}

// Test cases
const testCases = [
    {
        name: "Valid JSON",
        input: '{"topics": [{"topic": "Valid"}]}',
        shouldPass: true
    },
    {
        name: "Markdown Code Block",
        input: '```json\n{"topics": [{"topic": "Markdown"}]}\n```',
        shouldPass: true
    },
    {
        name: "Text before and after",
        input: 'Here is the JSON:\n{"topics": [{"topic": "Embedded"}]}\nHope this helps.',
        shouldPass: true
    },
    {
        name: "Double Braces (Nested JSON)",
        input: '{"topics": [{"topic": "Nested {Object}"}]}',
        shouldPass: true
    },
    {
        name: "Unescaped Newlines in string",
        input: '{"topics": [{"topic": "Line 1\nLine 2"}]}',
        shouldPass: true
    },
    {
        name: "Single Quotes (Malform)",
        input: "{'topics': [{'topic': 'Single Quoted'}]}",
        shouldPass: true // We want this to pass if we fix it, but currently it fails? Or maybe logic handles it?
    }
];

testCases.forEach((test, index) => {
    const result = extractAndParseJson(test.input);
    if (result) {
        console.log(`[PASS] ${test.name}`);
    } else {
        console.log(`[FAIL] ${test.name}`);
    }
});
