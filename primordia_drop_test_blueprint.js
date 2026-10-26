const fs = require('fs');
const path = require('path');

const ROADMAPS_DIR = path.join(__dirname, 'roadmaps');

const testBlueprint = {
    projectName: "Primordia Greeting Module",
    version: "2.1.0",
    steps: [
        {
            action: "WRITE_FILE",
            payload: {
                filename: "greeting_module.js",
                content: "module.exports = { greet: (name) => `🔮 [Cosmic Link] Greetings, ${name}. System synchronized.` };\n"
            }
        },
        {
            action: "WRITE_FILE",
            payload: {
                filename: "test_greeting.js",
                content: "const greeter = require('./greeting_module');\nconsole.log(greeter.greet('Operator Shane'));\n"
            }
        },
        {
            action: "EXECUTE_SCRIPT",
            payload: {
                command: "node test_greeting.js"
            }
        }
    ]
};

const targetPath = path.join(ROADMAPS_DIR, 'feature_greeting.json');
fs.writeFileSync(targetPath, JSON.stringify(testBlueprint, null, 2), 'utf8');
console.log(`✨ [Dropper] Successfully dropped test blueprint into: roadmaps/feature_greeting.json`);
