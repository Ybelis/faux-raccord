import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, readFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as nodeUtil from 'node:util';

export const projectRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const normalizedRoot = process.platform === 'win32' ? projectRoot.toLowerCase() : projectRoot;
export const rootId = createHash('sha256').update(normalizedRoot).digest('hex').slice(0, 24);
export const identityPath = '/.well-known/faux-raccord';

export function serverIdentity(port, mode = 'development') {
  return { app: 'faux-raccord', rootId, pid: process.pid, port, mode };
}

export function configuredPort(environment, dotenv = {}) {
  const value = environment.PORT || dotenv.PORT || '4173';
  if (!/^\d+$/.test(String(value))) throw new Error('PORT doit être un entier entre 1 et 65535.');
  const port = Number(value);
  if (port < 1 || port > 65535) throw new Error('PORT doit être un entier entre 1 et 65535.');
  return port;
}

// Le nom de l'application seul ne suffit pas : deux copies peuvent tourner
// sur cette machine. Un redémarrage ne vise que le même dossier et le PID
// annoncé par son serveur local, jamais tous les processus Node.
export function isOwnServer(identity, port) {
  return Boolean(
    identity &&
      identity.app === 'faux-raccord' &&
      identity.rootId === rootId &&
      identity.port === port &&
      Number.isInteger(identity.pid) &&
      identity.pid > 0,
  );
}

async function inspectServer(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}${identityPath}`, {
      signal: AbortSignal.timeout(1000),
    });
    const identity = await response.json();
    return isOwnServer(identity, port) ? identity : null;
  } catch {
    return null;
  }
}

async function portAvailable(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)));
  });
}

async function missingDependencies() {
  const manifest = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
  const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
  const missing = [];
  for (const [name, expectedVersion] of Object.entries(dependencies)) {
    try {
      const installed = JSON.parse(
        await readFile(path.join(projectRoot, 'node_modules', name, 'package.json'), 'utf8'),
      );
      if (/^\d+\.\d+\.\d+$/.test(expectedVersion) && installed.version !== expectedVersion)
        missing.push(name);
    } catch {
      missing.push(name);
    }
  }
  return missing;
}

async function installDependencies() {
  console.log('Première installation ou dépendances manquantes : npm ci…');
  // npm.cmd doit être lancé par cmd.exe sous Windows. La commande est fixe :
  // aucun nom de fichier, argument utilisateur ou secret n'entre dans le shell.
  const command = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'npm';
  const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm ci'] : ['ci'];
  const exit = await run(command, args);
  if (exit !== 0) throw new Error('Installation interrompue. Vérifiez la connexion puis relancez.');
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: projectRoot, stdio: 'inherit', windowsHide: true });
    const forward = () => {
      if (!child.killed) child.kill('SIGTERM');
    };
    process.once('SIGINT', forward);
    process.once('SIGTERM', forward);
    child.once('error', reject);
    child.once('exit', (code) => {
      process.removeListener('SIGINT', forward);
      process.removeListener('SIGTERM', forward);
      resolve(code ?? 1);
    });
  });
}

async function restartOwnServer(identity, port) {
  // Vérifier encore l'identité immédiatement avant d'envoyer le signal.
  const current = await inspectServer(port);
  if (!isOwnServer(current, port) || current.pid !== identity.pid)
    throw new Error('L’identité du serveur a changé. Aucun processus n’a été arrêté.');
  process.kill(current.pid, 'SIGTERM');
  for (let attempt = 0; attempt < 50; attempt++) {
    if (await portAvailable(port)) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Le serveur termine encore une requête. Attendez puis relancez.');
}

async function launch() {
  const args = process.argv.slice(2);
  if (args.some((arg) => !['--check', '--restart', '--help'].includes(arg)))
    throw new Error('Options disponibles : --check, --restart, --help.');
  if (args.includes('--help')) {
    console.log('Faux Raccord : start.bat (Windows) ou sh start.sh (macOS/Linux).');
    console.log('--check : vérifier l’installation ; --restart : redémarrer ce projet seulement.');
    return;
  }
  if (Number(process.versions.node.split('.')[0]) < 24)
    throw new Error(
      `Node.js 24 ou plus récent est nécessaire (version actuelle : ${process.versions.node}).`,
    );

  let dotenv = {};
  try {
    dotenv = nodeUtil.parseEnv(await readFile(path.join(projectRoot, '.env'), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT')
      throw new Error('Le fichier .env est illisible. Vérifiez son format.');
  }
  const port = configuredPort(process.env, dotenv);
  const url = `http://127.0.0.1:${port}`;
  const missing = await missingDependencies();
  const running = await inspectServer(port);
  if (args.includes('--check')) {
    console.log(
      JSON.stringify(
        {
          node: process.versions.node,
          project: projectRoot,
          url,
          missingDependencies: missing,
          running: Boolean(running),
        },
        null,
        2,
      ),
    );
    return;
  }
  if (running && !args.includes('--restart')) {
    console.log(`Faux Raccord est déjà ouvert : ${url}`);
    console.log('Pour le redémarrer : start.bat --restart ou sh start.sh --restart.');
    return;
  }
  if (running) await restartOwnServer(running, port);
  else if (!(await portAvailable(port)))
    throw new Error(
      `Le port ${port} est utilisé par un autre programme. Aucun processus n’a été arrêté. Modifiez PORT dans .env.`,
    );

  if (missing.length) await installDependencies();
  try {
    // COPYFILE_EXCL garantit qu'une configuration existante n'est jamais écrasée.
    await copyFile(
      path.join(projectRoot, '.env.example'),
      path.join(projectRoot, '.env'),
      constants.COPYFILE_EXCL,
    );
    console.log('.env créé depuis l’exemple. Les scénarios enregistrés sont utilisables sans clé.');
    console.log('Pour une nouvelle analyse, configurez Groq ou démarrez Ollama.');
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  console.log(`Ouverture de Faux Raccord : ${url}`);
  console.log('Laissez ce terminal ouvert. Ctrl+C arrête uniquement ce serveur.');
  process.exitCode = await run(process.execPath, [
    '--env-file-if-exists=.env',
    path.join(projectRoot, 'scripts/dev.mjs'),
  ]);
}

const invokedPath = process.argv[1] && path.resolve(process.argv[1]);
const modulePath = fileURLToPath(import.meta.url);
const invokedDirectly =
  process.platform === 'win32'
    ? invokedPath?.toLowerCase() === modulePath.toLowerCase()
    : invokedPath === modulePath;
if (invokedDirectly) {
  launch().catch((error) => {
    console.error(`Faux Raccord : ${error.message}`);
    process.exitCode = 1;
  });
}
