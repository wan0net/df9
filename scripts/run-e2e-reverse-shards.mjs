import { spawnSync } from 'node:child_process';

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

for (const shard of ['2/2', '1/2']) {
  const result = spawnSync(npx, ['playwright', 'test', `--shard=${shard}`], {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
