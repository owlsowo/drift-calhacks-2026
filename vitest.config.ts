import { defineConfig } from 'vitest/config';
import { spacetimedbModuleTestPlugin } from 'spacetimedb/server/test-utils/vitest';
const plugin = spacetimedbModuleTestPlugin();
const load = plugin.load as (id: string) => string | null;
plugin.load = function (id) {
  const code = load.call(this, id);
  return typeof code === 'string'
    ? code.replace(
        "export const env_get = unsupported('env_get');",
        'export const env_get = key => globalThis.__driftTestEnv?.[key] ?? null;',
      )
    : code;
};
export default defineConfig({
  plugins: [plugin],
  test: {
    include: ['spacetimedb/tests/**/*.test.ts'],
    server: { deps: { inline: ['spacetimedb'] } },
    fileParallelism: false,
  },
});
