const { collectAndWriteReport } = require('../helpers/reportCollector');

class QaReporter {
  constructor() {
    this.startedAt = new Date().toISOString();
    this.startedMs = Date.now();
  }

  onEnd() {
    collectAndWriteReport({
      startedAt: this.startedAt,
      durationMs: Date.now() - this.startedMs,
    });
  }
}

module.exports = QaReporter;
