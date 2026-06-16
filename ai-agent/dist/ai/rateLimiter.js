class Semaphore {
    maxConcurrent;
    running = 0;
    queue = [];
    constructor(maxConcurrent) {
        this.maxConcurrent = maxConcurrent;
    }
    async schedule(fn) {
        await this.acquire();
        try {
            return await fn();
        }
        finally {
            this.release();
        }
    }
    acquire() {
        if (this.running < this.maxConcurrent) {
            this.running++;
            return Promise.resolve();
        }
        return new Promise((resolve) => this.queue.push(resolve));
    }
    release() {
        this.running--;
        const next = this.queue.shift();
        if (next) {
            this.running++;
            next();
        }
    }
}
// Global limiter shared across all agent sessions. Caps concurrent Anthropic API
// calls to prevent hitting RPM/TPM rate limits when multiple sessions fire simultaneously.
export const claudeLimiter = new Semaphore(2);
