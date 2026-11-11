/**
 * Public Nostr relays (free and open) that help two Walk SRM players' browsers find each other for multiplayer; the
 * game itself then runs browser to browser. Every player must use the same ones, so they're fixed here, and the
 * site's Content-Security-Policy (next.config.ts) allows exactly these.
 */
export const WALK_RELAYS = ["wss://nos.lol", "wss://relay.primal.net", "wss://nostr.mom", "wss://relay.nostr.net", "wss://nostr.oxtr.dev"];
