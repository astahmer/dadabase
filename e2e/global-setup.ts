import { prepareE2eFixtures } from "./prepare-fixtures.mjs";

/**
 * Ensure fixtures exist even when reusing an already-running webServer.
 * When webServer starts via start-web-server.mjs, fixtures are already prepared;
 * this is a no-op-ish refresh of the sample DB for scenario isolation.
 */
async function globalSetup() {
  // Refresh sample data only — do not wipe app DB while the webServer may be using it
  await prepareE2eFixtures({ forceAppDb: false });
}

export default globalSetup;
