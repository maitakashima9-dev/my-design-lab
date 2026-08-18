// API tests for: reports edit/delete (student own-only + admin), files-list edit + password protection.
// Run against a local `wrangler pages dev` server (see run-local.sh).

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8788';
let passCount = 0, failCount = 0;
const failures = [];

function check(label, cond, extra) {
  if (cond) { passCount++; }
  else { failCount++; failures.push(label + (extra ? ' :: ' + JSON.stringify(extra) : '')); console.log('FAIL:', label, extra || ''); }
}

function jar() {
  let cookie = '';
  return {
    get: () => cookie,
    set: (setCookieHeader) => {
      if (!setCookieHeader) return;
      const first = setCookieHeader.split(',').map(s => s.trim()).find(s => s.includes('='));
      if (first) cookie = first.split(';')[0];
    },
  };
}

async function req(jarObj, method, path, body, isForm) {
  const headers = {};
  if (jarObj.get()) headers['Cookie'] = jarObj.get();
  let fetchBody;
  if (isForm) {
    fetchBody = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    fetchBody = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, { method, headers, body: fetchBody, redirect: 'manual' });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) jarObj.set(setCookie);
  let data = null;
  const text = await res.text();
  try { data = JSON.parse(text); } catch (e) { data = text; }
  return { status: res.status, data };
}

async function login(jarObj, email, password) {
  const r = await req(jarObj, 'POST', '/api/auth/login', { email, password });
  return r;
}

async function main() {
  const adminJar = jar();
  const studentJar = jar(); // yamada
  const student2Jar = jar(); // sato

  const adminLogin = await login(adminJar, 'mai@example.com', 'mailab-admin-2026');
  check('admin login ok', adminLogin.status === 200, adminLogin);

  const studentLogin = await login(studentJar, 'yamada@example.com', 'student-2026');
  check('student(yamada) login ok', studentLogin.status === 200, studentLogin);

  const student2Login = await login(student2Jar, 'sato@example.com', 'student-2026');
  check('student2(sato) login ok', student2Login.status === 200, student2Login);

  // ===== reports =====
  // yamada creates a new report
  const createRep = await req(studentJar, 'POST', '/api/reports', { title: '新規日報', content: '内容テスト' });
  check('student create report -> 201', createRep.status === 201, createRep);
  const newReportId = createRep.data && createRep.data.id;

  // yamada edits own new report
  const editOwn = await req(studentJar, 'PUT', '/api/reports/' + newReportId, { title: '編集済みタイトル', content: '編集済み内容' });
  check('student edit own report -> ok', editOwn.status === 200, editOwn);

  // verify edit applied
  const listOwn = await req(studentJar, 'GET', '/api/reports');
  const editedReport = listOwn.data.reports.find(r => r.id === newReportId);
  check('edited report reflects new title', editedReport && editedReport.title === '編集済みタイトル', editedReport);

  // sato (different student) tries to edit yamada's report -> should fail 403
  const editOther = await req(student2Jar, 'PUT', '/api/reports/' + newReportId, { title: 'ハッキング', content: 'x' });
  check('other student cannot edit report -> 403', editOther.status === 403, editOther);

  // sato tries to delete yamada's report -> should fail 403
  const deleteOtherAttempt = await req(student2Jar, 'DELETE', '/api/reports/' + newReportId);
  check('other student cannot delete report -> 403', deleteOtherAttempt.status === 403, deleteOtherAttempt);

  // yamada deletes own report
  const deleteOwn = await req(studentJar, 'DELETE', '/api/reports/' + newReportId);
  check('student delete own report -> ok', deleteOwn.status === 200, deleteOwn);

  const listAfterDelete = await req(studentJar, 'GET', '/api/reports');
  check('deleted report no longer present', !listAfterDelete.data.reports.find(r => r.id === newReportId));

  // admin can delete a student's report (use the seeded report id=1, belongs to yamada/user 2)
  const adminDelete = await req(adminJar, 'DELETE', '/api/reports/1?studentId=2');
  check('admin delete student report -> ok', adminDelete.status === 200, adminDelete);

  // ===== files-list =====
  const filesList = await req(studentJar, 'GET', '/api/files-list');
  check('files-list get -> ok', filesList.status === 200, filesList);
  const noPwFile = filesList.data.files.find(f => f.name === 'パスワードなし資料.pdf');
  const pwFile = filesList.data.files.find(f => f.name === 'パスワードあり資料.pdf');
  check('no-password file has hasPassword=false', noPwFile && noPwFile.hasPassword === false, noPwFile);
  check('password file has hasPassword=true', pwFile && pwFile.hasPassword === true, pwFile);
  check('files-list response does NOT leak storage_key', noPwFile && !('storage_key' in noPwFile) && !('storageKey' in noPwFile), noPwFile);

  // download without password on protected file -> should be 403 (using student session)
  const dlNoPw = await fetch(BASE + pwFile.downloadUrl, { headers: { Cookie: studentJar.get() } });
  check('download protected file w/o password -> 403', dlNoPw.status === 403, { status: dlNoPw.status });

  // download with wrong password -> 403
  const dlWrongPw = await fetch(BASE + pwFile.downloadUrl + '?password=wrongpass', { headers: { Cookie: studentJar.get() } });
  check('download protected file w/ wrong password -> 403', dlWrongPw.status === 403, { status: dlWrongPw.status });

  // download with correct password -> 200 (seeded password is 'himitsu123', object likely missing in R2 -> still verifies password gate passes, not 403)
  const dlCorrectPw = await fetch(BASE + pwFile.downloadUrl + '?password=himitsu123', { headers: { Cookie: studentJar.get() } });
  check('download protected file w/ correct password -> not 403 (password check passed)', dlCorrectPw.status !== 403, { status: dlCorrectPw.status });

  // download unprotected file -> not 403
  const dlNoPwFile = await fetch(BASE + noPwFile.downloadUrl, { headers: { Cookie: studentJar.get() } });
  check('download unprotected file -> not 403', dlNoPwFile.status !== 403, { status: dlNoPwFile.status });

  // student cannot edit files-list (admin only)
  const studentEditFile = await req(studentJar, 'PUT', '/api/files-list/' + noPwFile.id, { name: 'ハック', type: 'PDF' });
  check('student cannot edit files-list -> 403', studentEditFile.status === 403, studentEditFile);

  // admin edits file to ADD a password
  const addPw = await req(adminJar, 'PUT', '/api/files-list/' + noPwFile.id, { name: noPwFile.name, type: noPwFile.type, password: 'newsecret' });
  check('admin add password to file -> ok', addPw.status === 200, addPw);

  const filesList2 = await req(adminJar, 'GET', '/api/files-list');
  const nowProtected = filesList2.data.files.find(f => f.id === noPwFile.id);
  check('file now shows hasPassword=true after admin set it', nowProtected && nowProtected.hasPassword === true, nowProtected);

  // admin edits file WITHOUT password field -> should NOT clear existing password on pwFile
  const editNoPwField = await req(adminJar, 'PUT', '/api/files-list/' + pwFile.id, { name: pwFile.name, type: pwFile.type });
  check('admin edit without password field -> ok', editNoPwField.status === 200, editNoPwField);
  const filesList3 = await req(adminJar, 'GET', '/api/files-list');
  const stillProtected = filesList3.data.files.find(f => f.id === pwFile.id);
  check('password preserved when password field omitted on edit', stillProtected && stillProtected.hasPassword === true, stillProtected);

  // admin explicitly clears password with empty string
  const clearPw = await req(adminJar, 'PUT', '/api/files-list/' + pwFile.id, { name: pwFile.name, type: pwFile.type, password: '' });
  check('admin clear password with empty string -> ok', clearPw.status === 200, clearPw);
  const filesList4 = await req(adminJar, 'GET', '/api/files-list');
  const clearedFile = filesList4.data.files.find(f => f.id === pwFile.id);
  check('password cleared', clearedFile && clearedFile.hasPassword === false, clearedFile);

  // after clearing, download should now succeed without password (not 403)
  const dlAfterClear = await fetch(BASE + clearedFile.downloadUrl, { headers: { Cookie: studentJar.get() } });
  check('download succeeds (not 403) after password cleared', dlAfterClear.status !== 403, { status: dlAfterClear.status });

  // student cannot delete files-list entries
  const studentDeleteFile = await req(studentJar, 'DELETE', '/api/files-list/' + noPwFile.id);
  check('student cannot delete files-list -> 403', studentDeleteFile.status === 403, studentDeleteFile);

  // admin deletes a file
  const adminDeleteFile = await req(adminJar, 'DELETE', '/api/files-list/' + noPwFile.id);
  check('admin delete files-list -> ok', adminDeleteFile.status === 200, adminDeleteFile);
  const filesList5 = await req(adminJar, 'GET', '/api/files-list');
  check('deleted file no longer listed', !filesList5.data.files.find(f => f.id === noPwFile.id));

  console.log(`\napi-test.mjs: ${passCount} passed, ${failCount} failed`);
  if (failCount > 0) {
    console.log('Failures:', failures);
    process.exit(1);
  }
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
