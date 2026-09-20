// Interactive, fixed-project setup. Never pass credentials as command-line arguments.
import { createHash, createHmac, pbkdf2Sync, randomBytes } from 'node:crypto';
import { open, readFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const host = 'aws-0-us-west-2.pooler.supabase.com';
const project = 'ajmrlhfhrcsstauqgnip';
const caPath = fileURLToPath(new URL('../server/certs/prod-ca-2021.crt', import.meta.url));
const target = fileURLToPath(new URL('../server/.env', import.meta.url));

function hiddenInput(prompt) {
  if (!process.stdin.isTTY) throw new Error('Run this tool in an interactive terminal');
  process.stdout.write(prompt);
  return new Promise((resolve, reject) => {
    let value = '';
    const done = (error) => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      error ? reject(error) : resolve(value);
    };
    const onData = chunk => {
      for (const char of chunk.toString()) {
        if (char === '\u0003') { done(new Error('Cancelled')); return; }
        if (char === '\r' || char === '\n') { done(); return; }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (char >= ' ') value += char;
      }
    };
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

// PostgreSQL SCRAM verifier: plaintext password never appears in SQL or query history.
function verifier(password) {
  const salt = randomBytes(16);
  // Supavisor currently advertises 4096 in its SCRAM challenge.
  const rounds = 4096;
  const salted = pbkdf2Sync(password, salt, rounds, 32, 'sha256');
  const clientKey = createHmac('sha256', salted).update('Client Key').digest();
  const storedKey = createHash('sha256').update(clientKey).digest('base64');
  const serverKey = createHmac('sha256', salted).update('Server Key').digest('base64');
  return `SCRAM-SHA-256$${rounds}:${salt.toString('base64')}$${storedKey}:${serverKey}`;
}

let admin;
let login;
let file;
let passwordChanged = false;
try {
  const ca = await readFile(caPath, 'utf8');
  console.log('daeguk-dev 전용 DB 계정 설정 — 입력한 비밀번호는 화면에 표시되지 않습니다.');
  console.log('1번은 Supabase 프로젝트 생성 때 저장한 DB 비밀번호입니다.');
  const adminPassword = await hiddenInput('기존 postgres DB 비밀번호: ');
  console.log('2번은 daeguk_login 전용으로 새로 생성하여 비밀번호 관리자에 보관한 비밀번호입니다.');
  const password = await hiddenInput('새 전용 비밀번호 (20자 이상 영문/숫자): ');
  if (!/^[A-Za-z0-9]{20,128}$/.test(password)) throw new Error('새 비밀번호는 20~128자의 영문/숫자여야 합니다.');
  if (password !== await hiddenInput('새 비밀번호 다시 입력: ')) throw new Error('비밀번호가 일치하지 않습니다.');
  if (password === adminPassword) throw new Error('관리자와 전용 비밀번호는 달라야 합니다.');
  // Do not overwrite an existing environment file or follow a symlink.
  file = await open(target, 'wx', 0o600);
  const connection = {host, port:5432, database:'postgres', ssl:{ca,rejectUnauthorized:true}, connectionTimeoutMillis:10000};
  admin = new pg.Client({...connection,user:`postgres.${project}`,password:adminPassword});
  await admin.connect();
  const check = await admin.query("SELECT pg_has_role('daeguk_login','daeguk_server','USAGE') AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls AND rolcanlogin AS ready FROM pg_roles WHERE rolname='daeguk_login'");
  if (!check.rows[0]?.ready) throw new Error('DB 계정 권한을 먼저 확인해야 합니다.');
  await admin.query(`ALTER ROLE daeguk_login PASSWORD '${verifier(password)}'`);
  passwordChanged = true;
  // Persist only the dedicated account; the administrator credential is never written to disk.
  const databaseUrl = `postgresql://daeguk_login.${project}:${password}@${host}:5432/postgres?sslmode=verify-full&sslrootcert=${encodeURIComponent(caPath)}`;
  await file.writeFile(`AUTH_MODE=required\nSUPABASE_URL=https://${project}.supabase.co\nSUPABASE_PUBLISHABLE_KEY=sb_publishable_ngbYh6vsOHOOpYyDSWT2KA_uiQSbsPa\nSUPABASE_SECRET_KEY=\nDATABASE_URL=${databaseUrl}\nAUTH_ALLOWED_ORIGINS=http://127.0.0.1:4185,capacitor://localhost\nAUTH_INSECURE_LOCALHOST=true\n`);
  await file.sync();
  await file.close(); file = null;
  await admin.end(); admin = null;
  login = new pg.Client({...connection,user:`daeguk_login.${project}`,password});
  await login.connect();
  const validated = await login.query("SELECT current_user='daeguk_login' AND has_table_privilege(current_user,'daeguk_private.players','SELECT') AND has_table_privilege(current_user,'daeguk_private.players','INSERT') AND NOT has_table_privilege(current_user,'daeguk_private.players','DELETE') AND NOT daeguk_private.session_is_active('00000000-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000000') AS ready");
  if (!validated.rows[0]?.ready) throw new Error('전용 계정 연결 검증에 실패했습니다.');
  console.log('완료: 전용 계정 비밀번호 설정, TLS 접속·권한 검증, server/.env 저장(권한 600).');
  console.log('이 파일은 로컬 개발용입니다. Render 배포 설정은 별도로 진행합니다.');
} catch (error) {
  // Driver messages can contain connection details; emit only controlled errors/codes.
  console.error(passwordChanged ? '비밀번호는 설정되었습니다. 로컬 환경 파일과 접속 상태를 확인해야 합니다.' : '설정을 완료하지 못했습니다.');
  const code = typeof error.code === 'string' ? error.code : '';
  if (code) console.error(`오류 코드: ${code}`);
  else if (error.message?.startsWith('새 ') || error.message?.includes('비밀번호가 일치') || error.message === 'Cancelled') console.error(error.message);
  if (file) { await file.close(); if (!passwordChanged) await unlink(target); }
  process.exitCode = 1;
} finally {
  await login?.end().catch(()=>{});
  await admin?.end().catch(()=>{});
}
