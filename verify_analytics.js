const AnalyticsEngine = require('./money_plug_analytics');
const engine = new AnalyticsEngine();
const yieldResult = engine.calculateYield(1000, 1.15);
console.log('🔮 [Analytics Blueprint Test] Yield calculated successfully:', yieldResult);
