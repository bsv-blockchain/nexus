import Constants from 'expo-constants'

/**
 * Where the chrome (the real Next.js DOM UI, or the harness) is served from.
 *
 * A physical device cannot reach `localhost` on the dev machine, so a real
 * device run needs `expoConfig.extra.chromeUrl` set to the LAN IP that
 * `npm run serve` prints on listen (see tools/serve.mjs).
 */
export const CHROME_URL: string = (Constants.expoConfig?.extra?.chromeUrl as string | undefined) ?? 'http://localhost:8099'
