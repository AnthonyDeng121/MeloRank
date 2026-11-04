const { spawnSync, spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const directory = path.resolve(__dirname, '../backend/netease-go');
const portable = [
  path.join(os.tmpdir(), 'melorank-go-toolchain/go/bin/go.exe'),
  path.join(os.tmpdir(), 'melorank-go-toolchain/golang.org/toolchain@v0.0.1-go1.26.0.windows-amd64/bin/go.exe'),
].find(file => fs.existsSync(file));
const go = process.env.MELORANK_GO_BIN || (process.platform === 'win32' && portable ? portable : 'go');
const check = spawnSync(go, ['version'], { encoding: 'utf8', windowsHide: true });
if (check.status !== 0) { console.error('需要 Go 1.26+。请从 https://go.dev/dl/ 安装，或设置 MELORANK_GO_BIN。'); process.exit(1); }
const buildDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'melorank-go-build-'));
const binary = path.join(buildDirectory, process.platform === 'win32' ? 'netease-go.exe' : 'netease-go');
const cleanup = () => { try { fs.rmSync(binary, { force: true }); fs.rmdirSync(buildDirectory); } catch {} };
const build = spawnSync(go, ['build', '-p', '2', '-o', binary, '.'], { cwd: directory, stdio: 'inherit', windowsHide: true, env: { ...process.env, GOMAXPROCS: process.env.GOMAXPROCS || '2' } });
if (build.status !== 0) { cleanup(); process.exit(build.status || 1); }
// Spawn the binary directly so stopping this launcher does not orphan go run's child.
const child = spawn(binary, [], { cwd: directory, stdio: 'inherit', windowsHide: true });
child.on('error', () => { console.error('Go 扫码服务启动失败'); process.exitCode = 1; });
child.on('close', code => { cleanup(); process.exitCode = code ?? 1; });
process.on('SIGINT', () => child.kill('SIGINT'));
