declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    CLAN_INITIAL_EDITOR_PIN?: string;
  }
}
