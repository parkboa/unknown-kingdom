// Repair only the known 32768/4096 SCRAM incompatibility; preserve password and environment file.
import { createHash, createHmac, pbkdf2Sync, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import pg from 'pg';

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


let admin;
let login;
let stage = '환경 파일 확인';
try {
  const env = parseEnv(await readFile(new URL('../server/.env', import.meta.url), 'utf8'));
  const url = new URL(env.DATABASE_URL);
  const host = 'aws-0-us-west-2.pooler.supabase.com';
  const project = 'ajmrlhfhrcsstauqgnip';
  if (url.hostname !== host || url.username !== `daeguk_login.${project}` || url.port !== '5432' || url.pathname !== '/postgres' || url.searchParams.get('sslmode') !== 'verify-full') {
    throw Object.assign(new Error(), {code:'UNEXPECTED_CONFIGURATION'});
  }
  const password = decodeURIComponent(url.password);
  if (!/^[A-Za-z0-9]{20,128}$/.test(password)) throw Object.assign(new Error(), {code:'UNEXPECTED_PASSWORD_FORMAT'});
  const ca = await readFile(new URL('../server/certs/prod-ca-2021.crt', import.meta.url), 'utf8');
  const connection = {host, port:5432, database:'postgres', ssl:{ca,rejectUnauthorized:true}, connectionTimeoutMillis:10000, statement_timeout:5000};
  console.log('기존 전용 비밀번호를 유지하고 SCRAM 반복 횟수를 4096으로 맞춥니다. 환경 파일은 변경하지 않습니다.');
  stage = '관리자 로그인';
  const adminPassword = await hiddenInput('프로젝트 생성 때 설정한 기존 postgres DB 비밀번호: ');
  admin = new pg.Client({...connection,user:`postgres.${project}`,password:adminPassword});
  await admin.connect();
  stage = '비밀번호 일치 검사';
  const result = await admin.query("SELECT rolpassword FROM pg_authid WHERE rolname='daeguk_login'");
  const parts = /^SCRAM-SHA-256\$(\d+):([^$]+)\$([^:]+):(.+)$/.exec(result.rows[0]?.rolpassword || '');
  if (!parts || +parts[1] < 1 || +parts[1] > 1000000) throw Object.assign(new Error(), {code:'INVALID_VERIFIER_FORMAT'});
  const salted = pbkdf2Sync(password, Buffer.from(parts[2], 'base64'), +parts[1], 32, 'sha256');
  const clientKey = createHmac('sha256', salted).update('Client Key').digest();
  const storedKey = createHash('sha256').update(clientKey).digest();
  const serverKey = createHmac('sha256', salted).update('Server Key').digest();
  const same = (actual, encoded) => {const expected=Buffer.from(encoded,'base64');return actual.length===expected.length && timingSafeEqual(actual,expected);};
  const matches = same(storedKey, parts[3]) && same(serverKey, parts[4]);
  console.log('PASSWORD_MATCH=' + matches);
  console.log('SCRAM_ITERATIONS=' + parts[1]);
  if (matches) {
    if (!['32768', '4096'].includes(parts[1])) throw Object.assign(new Error(), {code:'UNEXPECTED_ITERATIONS'});
    if (parts[1] === '32768') {
      stage = 'SCRAM 호환성 수정';
      // Reuse the existing random salt and the verified local password.
      const correctedSalted = pbkdf2Sync(password, Buffer.from(parts[2], 'base64'), 4096, 32, 'sha256');
      const correctedClient = createHmac('sha256', correctedSalted).update('Client Key').digest();
      const correctedStored = createHash('sha256').update(correctedClient).digest('base64');
      const correctedServer = createHmac('sha256', correctedSalted).update('Server Key').digest('base64');
      const salt64 = Buffer.from(parts[2], 'base64').toString('base64');
      const corrected = `SCRAM-SHA-256$4096:${salt64}$${correctedStored}:${correctedServer}`;
      // Only base64/numeric verifier fields enter SQL; plaintext password never does.
      await admin.query(`ALTER ROLE daeguk_login PASSWORD '${corrected}'`);
      const verified = await admin.query("SELECT rolpassword=$1 AS ready FROM pg_authid WHERE rolname='daeguk_login'", [corrected]);
      if (!verified.rows[0]?.ready) throw Object.assign(new Error(), {code:'REPAIR_VERIFICATION_FAILED'});
      parts[1] = '4096'; parts[2] = salt64; parts[3] = correctedStored; parts[4] = correctedServer;
      console.log('SCRAM_REPAIRED=true');
    } else console.log('SCRAM_ALREADY_COMPATIBLE=true');
  }
  await admin.end(); admin = null;
  if (!matches) {
    console.log('진단: DB와 로컬에 저장된 비밀번호가 일치하지 않습니다.');
    process.exitCode=1;
  } else {
    stage = '전용 계정 로그인';
    login = new pg.Client({...connection,user:`daeguk_login.${project}`,password});
    // Only compare non-secret challenge parameters, never log the challenge itself.
    login.connection.on('authenticationSASLContinue', message => {
      const salt = /(?:^|,)s=([^,]+)/.exec(message.data)?.[1];
      const rounds = /(?:^|,)i=(\d+)/.exec(message.data)?.[1];
      console.log('POOLER_ITERATIONS=' + rounds);
      console.log('POOLER_SALT_MATCH=' + (salt === parts[2]));
      console.log('POOLER_CHALLENGE_MATCH=' + (salt === parts[2] && rounds === parts[1]));
    });
    await login.connect();
    const check = await login.query("SELECT current_user='daeguk_login' AND has_table_privilege(current_user,'daeguk_private.players','SELECT') AND has_table_privilege(current_user,'daeguk_private.players','INSERT') AND NOT has_table_privilege(current_user,'daeguk_private.players','DELETE') AND NOT daeguk_private.session_is_active('00000000-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000000') AS ready");
    console.log('LOGIN_OK=' + (check.rows[0]?.ready === true));
  }
} catch (error) {
  console.error('실패 단계: ' + stage);
  console.error('오류 코드: ' + (/^[A-Z0-9_]+$/.test(error.code || '') ? error.code : 'UNKNOWN'));
  process.exitCode=1;
} finally {
  await login?.end().catch(()=>{});
  await admin?.end().catch(()=>{});
}
