import { expect, test as base } from "@playwright/test";
import {
  assertDisposableLocalEnvironment,
  installLocalSupabaseFirewall,
} from "../helpers/localEnvironment";

type LocalOnlyFixtures = {
  localEnvironmentVerified: true;
};

/**
 * A fail-closed Playwright fixture for tests that must never reach a remote
 * application or Supabase project.
 */
export const test = base.extend<LocalOnlyFixtures>({
  localEnvironmentVerified: [
    async ({ page }, use) => {
      assertDisposableLocalEnvironment();
      const firewall = await installLocalSupabaseFirewall(page);

      try {
        await use(true);
        firewall.assertClean();
      } finally {
        await firewall.dispose();
      }
    },
    { auto: true },
  ],
});

export { expect };
