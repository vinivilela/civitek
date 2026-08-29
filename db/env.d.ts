declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FILES: R2Bucket;
    /**
     * Set to `off` in production so a new customer is provisioned a clean
     * company instead of adopting the seeded demo tenant.
     */
    CIVITEK_DEMO_TENANT?: string;
  }
}
