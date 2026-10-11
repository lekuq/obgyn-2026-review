import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const appDir = resolve(root, 'app')
const args = process.argv.slice(2)
const bankIndex = args.indexOf('--bank')
const bankId = bankIndex >= 0 ? args[bankIndex + 1] : 'sz-clinical-2026'
const prepare = spawnSync(process.execPath, [resolve(root, 'scripts/prepare-bank.mjs'), '--bank', bankId], {
  cwd: root,
  stdio: 'inherit',
})
if (prepare.status !== 0) process.exit(prepare.status ?? 1)

const build = spawnSync('npm', ['run', 'build'], {
  cwd: appDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
if (build.error) {
  console.error(build.error)
  process.exit(1)
}
process.exit(build.status ?? 1)
