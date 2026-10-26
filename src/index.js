import { MoneyPlugHubEngine } from './engine/MoneyPlugHubEngine.js';
const engine = new MoneyPlugHubEngine();
async function bootstrap() {
    console.log('[PrimordiaOS] MoneyPlugHub Sovereign Loop Subsystem Online.');
    const sampleTask = {
        target: 'PrimordiaOS',
        action: 'sync_state',
        data: { node: 'edge-alpha', status: 'active' }
    };
    const result = await engine.executeTask(sampleTask);
    console.log('[Execution Result]:', JSON.stringify(result, null, 2));
}
bootstrap().catch(console.error);
