import raw from "../config.json";

// Every tunable lives in config.json (versioned with the code). Bump
// "version" when a change should show up in build reports.
export type Config = typeof raw;
export const config: Config = raw;
