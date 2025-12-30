
const fs = require('fs');
const path = require('path');

// --- Mock require for React Native image assets ---
// Since we can't actually require() images in Node without a bundler,
// we'll read the file content manually to extract the paths.
const projectRoot = path.join(__dirname, '..');

// 1. Parse triviaImages.ts to get the map of key -> filepath
const triviaImagesPath = path.join(projectRoot, 'src/data/triviaImages.ts');
const triviaImagesContent = fs.readFileSync(triviaImagesPath, 'utf8');

const imageMap = {};
// Regex to capture:  key: require('../../assets/trivia/filename.png')
const imageMapRegex = /^\s*(\w+):\s*require\(['"]\.\.\/\.\.\/assets\/trivia\/([^'"]+)['"]\)/gm;

let match;
while ((match = imageMapRegex.exec(triviaImagesContent)) !== null) {
    const key = match[1];
    const filename = match[2];
    imageMap[key] = filename;
}

// 2. Parse triviaQuestions.ts to get the list of questions with imageKey
const triviaQuestionsPath = path.join(projectRoot, 'src/data/triviaQuestions.ts');
const triviaQuestionsContent = fs.readFileSync(triviaQuestionsPath, 'utf8');

// Regex to capture objects with id and imageKey
// simplified matching approach
const totalQuestionsRegex = /{[\s\S]*?id:\s*['"](\w+)['"]/g;
let totalCount = 0;
while ((match = totalQuestionsRegex.exec(triviaQuestionsContent)) !== null) {
    totalCount++;
}
console.log(`\nFound ${totalCount} TOTAL questions in the file (by regex id match).`);

const questionRegex = /{[\s\S]*?id:\s*['"](\w+)['"][\s\S]*?imageKey:\s*['"](\w+)['"][\s\S]*?}/g;

const questionsWithImages = [];
while ((match = questionRegex.exec(triviaQuestionsContent)) !== null) {
    questionsWithImages.push({
        id: match[1],
        imageKey: match[2]
    });
}

// 3. Verification Report
const report = [];
let errors = 0;
const assetsDir = path.join(projectRoot, 'assets/trivia');

console.log('--- STARTING VERIFICATION ---');
console.log(`Found ${Object.keys(imageMap).length} entries in triviaImages.ts`);
console.log(`Found ${questionsWithImages.length} questions with imageKey in triviaQuestions.ts`);

// Check 1: Do all question imageKeys existing in triviaImages map?
questionsWithImages.forEach(q => {
    if (!imageMap[q.imageKey]) {
        console.error(`[ERROR] Question ${q.id} points to imageKey '${q.imageKey}' which is MISSING in triviaImages.ts`);
        errors++;
    }
});

// Check 2: Do all mapped files exist on disk?
Object.keys(imageMap).forEach(key => {
    const filename = imageMap[key];
    const fullPath = path.join(assetsDir, filename);
    if (!fs.existsSync(fullPath)) {
        console.error(`[ERROR] Image key '${key}' points to file '${filename}' which DOES NOT EXIST at ${fullPath}`);
        errors++;
    }
});

// Check 3: Is there a mismatch between Question ID and Image Key? (e.g. Question e1 pointing to e2 image)
questionsWithImages.forEach(q => {
    if (q.id !== q.imageKey) {
        console.warn(`[WARNING] Question ID '${q.id}' uses Image Key '${q.imageKey}'. Verify if this is intentional.`);
        // Note: It's technically okay, but usually 1:1 in this project.
    }
});

// Check 4: Specific batch ranges count
const counts = { e: 0, m: 0, h: 0 };
questionsWithImages.forEach(q => {
    if (q.id.startsWith('e')) counts.e++;
    if (q.id.startsWith('m')) counts.m++;
    if (q.id.startsWith('h')) counts.h++;
});

console.log(`\n--- COUNTS ---`);
console.log(`Easy: ${counts.e} (Expected: 56)`);
console.log(`Medium: ${counts.m} (Expected: 70)`);
console.log(`Hard: ${counts.h} (Expected: 52)`);
console.log(`Total: ${counts.e + counts.m + counts.h}`);

if (errors === 0) {
    console.log('\n✅ VERIFICATION SUCCESSFUL: No missing keys or files.');
} else {
    console.log(`\n❌ VERIFICATION FAILED with ${errors} errors.`);
    process.exit(1);
}
