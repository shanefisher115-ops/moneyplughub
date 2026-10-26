const fs = require('fs');
const path = require('path');

const QUEUE_FILE = path.join(__dirname, 'primordia_queue.json');

const args = process.argv.slice(2);
const taskName = args[0] || 'Ad-Hoc Autonomous Routine';
const taskComplexity = parseFloat(args[1]) || 15.0;

let queue = [];
if (fs.existsSync(QUEUE_FILE)) {
    try {
        queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    } catch (e) {
        queue = [];
    }
}

queue.push({ task: taskName, complexity: taskComplexity });
fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));

console.log(`\n📥 [PrimordiaOS Injector] Successfully injected task into queue.`);
console.log(`📋 Task: "${taskName}" | Complexity: ${taskComplexity}\n`);