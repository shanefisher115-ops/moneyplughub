class AnalyticsEngine {
  constructor() {
    this.sessionActive = true;
  }
  calculateYield(base, rate) {
    return base * rate;
  }
}
module.exports = AnalyticsEngine;
