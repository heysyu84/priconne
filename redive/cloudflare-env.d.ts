declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    CLAN_ADMIN_BOOTSTRAP_EMAIL?: string;
  }
}
