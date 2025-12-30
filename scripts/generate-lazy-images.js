
const fs = require('fs');
const path = require('path');

const outputPath = path.join(__dirname, '../src/data/triviaImages.ts');

let content = `// REF: Optimized Image Mapping
// Converted to Lazy Loading switch statement to prevent startup crashes on Android 12
// This ensures images are only required() when actually needed needed by the View.

export const getTriviaImage = (imageKey?: string): any | null => {
    if (!imageKey) return null;
    switch (imageKey) {
`;

// Helper
const addCases = (prefix, count, comment) => {
    content += `        // ${comment}\n`;
    for (let i = 1; i <= count; i++) {
        content += `        case '${prefix}${i}': return require('../../assets/trivia/${prefix}${i}.png');\n`;
    }
};

addCases('e', 56, 'Easy (e1-e56)');
addCases('m', 70, 'Medium (m1-m70)');
addCases('h', 52, 'Hard (h1-h52)');

content += `        default: return null;
    }
};
`;

fs.writeFileSync(outputPath, content);
console.log(`Generated triviaImages.ts at ${outputPath}`);
