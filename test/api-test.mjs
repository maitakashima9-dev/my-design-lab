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

  // ===== gallery: multi-image =====
  const galCreate = await req(adminJar, 'POST', '/api/gallery', { title: 'マルチ画像テスト', tag: 'テスト', imageKeys: ['gallery/a.png', 'gallery/b.png', 'gallery/c.png'] });
  check('admin create gallery item with 3 images -> 201', galCreate.status === 201, galCreate);
  const galId = galCreate.data && galCreate.data.id;

  const galNoImages = await req(adminJar, 'POST', '/api/gallery', { title: '画像なし', tag: 'テスト', imageKeys: [] });
  check('gallery create without images -> 400', galNoImages.status === 400, galNoImages);

  const tooManyKeys = Array.from({ length: 11 }, (_, i) => 'gallery/x' + i + '.png');
  const galTooMany = await req(adminJar, 'POST', '/api/gallery', { title: '画像多すぎ', tag: 'テスト', imageKeys: tooManyKeys });
  check('gallery create with 11 images -> 400 (max 10)', galTooMany.status === 400, galTooMany);

  const galList = await req(studentJar, 'GET', '/api/gallery');
  const galItem = galList.data.items.find(g => g.id === galId);
  check('gallery item has 3 images in order', galItem && galItem.images.length === 3 && galItem.images[0].includes('a.png'), galItem);
  check('gallery item thumb is first image', galItem && galItem.thumb === galItem.images[0], galItem);

  const studentGalCreate = await req(studentJar, 'POST', '/api/gallery', { title: 'x', tag: 'x', imageKeys: ['gallery/z.png'] });
  check('student cannot create gallery item -> 403', studentGalCreate.status === 403, studentGalCreate);

  // edit: replace images with a smaller set
  const galEdit = await req(adminJar, 'PUT', '/api/gallery/' + galId, { title: 'マルチ画像テスト（編集済み）', tag: 'テスト', imageKeys: ['gallery/new1.png'] });
  check('admin edit gallery replaces images -> ok', galEdit.status === 200, galEdit);
  const galList2 = await req(studentJar, 'GET', '/api/gallery');
  const galItem2 = galList2.data.items.find(g => g.id === galId);
  check('gallery item now has 1 image after edit', galItem2 && galItem2.images.length === 1 && galItem2.images[0].includes('new1.png'), galItem2);

  // edit without imageKeys -> images untouched
  const galEditNoImg = await req(adminJar, 'PUT', '/api/gallery/' + galId, { title: 'タイトルだけ変更', tag: 'テスト' });
  check('admin edit gallery without imageKeys -> ok', galEditNoImg.status === 200, galEditNoImg);
  const galList3 = await req(studentJar, 'GET', '/api/gallery');
  const galItem3 = galList3.data.items.find(g => g.id === galId);
  check('gallery images untouched when imageKeys omitted', galItem3 && galItem3.images.length === 1, galItem3);

  const galDelete = await req(adminJar, 'DELETE', '/api/gallery/' + galId);
  check('admin delete gallery item -> ok', galDelete.status === 200, galDelete);
  const galList4 = await req(studentJar, 'GET', '/api/gallery');
  check('deleted gallery item no longer listed', !galList4.data.items.find(g => g.id === galId));

  // legacy seeded gallery item (no gallery_images rows, no thumb_key) falls back to no-thumb placeholder cleanly
  const legacyGalItem = galList.data.items.find(g => g.title === 'テストギャラリー1');
  check('legacy gallery item with no images returns null thumb (no crash)', legacyGalItem && legacyGalItem.thumb === null && Array.isArray(legacyGalItem.images) && legacyGalItem.images.length === 0, legacyGalItem);

  // ===== zukan: multi-image + link =====
  const zukCreate = await req(adminJar, 'POST', '/api/zukan', { title: 'マルチ画像図鑑テスト', comment: 'コメント', imageKeys: ['gallery/z1.png', 'gallery/z2.png'], linkUrl: 'https://example.com/lp/zukan-test' });
  check('admin create zukan item with images+link -> 201', zukCreate.status === 201, zukCreate);
  const zukId = zukCreate.data && zukCreate.data.id;

  const zukList = await req(studentJar, 'GET', '/api/zukan');
  const zukItem = zukList.data.items.find(z => z.id === zukId);
  check('zukan item has 2 images', zukItem && zukItem.images.length === 2, zukItem);
  check('zukan item has linkUrl', zukItem && zukItem.linkUrl === 'https://example.com/lp/zukan-test', zukItem);

  const zukNoImages = await req(adminJar, 'POST', '/api/zukan', { title: '画像なし', comment: 'x', imageKeys: [] });
  check('zukan create without images -> 400', zukNoImages.status === 400, zukNoImages);

  const zukDelete = await req(adminJar, 'DELETE', '/api/zukan/' + zukId);
  check('admin delete zukan item -> ok', zukDelete.status === 200, zukDelete);

  // ===== announcements: auto-create on article/video post + manual add/delete =====
  const annBefore = await req(studentJar, 'GET', '/api/announcements');
  const annCountBefore = annBefore.data.announcements.length;

  const newArticle = await req(adminJar, 'POST', '/api/articles', { cat: 'LPデザイン', title: 'お知らせ連動テスト記事', excerpt: '抜粋', articleBody: '本文', richBody: true, thumbKey: null });
  check('create article -> 201', newArticle.status === 201, newArticle);

  const annAfterArticle = await req(studentJar, 'GET', '/api/announcements');
  check('announcement auto-added after article create', annAfterArticle.data.announcements.length === annCountBefore + 1, annAfterArticle);
  check('new announcement mentions the article title', annAfterArticle.data.announcements[0].text.includes('お知らせ連動テスト記事'), annAfterArticle.data.announcements[0]);

  const newArticleId = newArticle.data.id;
  const editArticle = await req(adminJar, 'PUT', '/api/articles/' + newArticleId, { cat: 'LPデザイン', title: 'お知らせ連動テスト記事（更新）', excerpt: '抜粋', articleBody: '本文', richBody: true });
  check('edit article -> ok', editArticle.status === 200, editArticle);
  const annAfterEdit = await req(studentJar, 'GET', '/api/announcements');
  check('announcement auto-added after article edit', annAfterEdit.data.announcements.length === annCountBefore + 2, annAfterEdit);

  const studentAddAnnounce = await req(studentJar, 'POST', '/api/announcements', { text: 'ハック' });
  check('student cannot manually add announcement -> 403', studentAddAnnounce.status === 403, studentAddAnnounce);

  const adminAddAnnounce = await req(adminJar, 'POST', '/api/announcements', { text: '手動お知らせテスト' });
  check('admin manually add announcement -> 201', adminAddAnnounce.status === 201, adminAddAnnounce);
  const manualAnnounceId = adminAddAnnounce.data.id;

  const studentDeleteAnnounce = await req(studentJar, 'DELETE', '/api/announcements/' + manualAnnounceId);
  check('student cannot delete announcement -> 403', studentDeleteAnnounce.status === 403, studentDeleteAnnounce);

  const adminDeleteAnnounce = await req(adminJar, 'DELETE', '/api/announcements/' + manualAnnounceId);
  check('admin delete announcement -> ok', adminDeleteAnnounce.status === 200, adminDeleteAnnounce);

  // ===== LP分析課題: confirm students CAN save answers via the API (rules out a backend bug) =====
  const assignList = await req(studentJar, 'GET', '/api/assignments');
  const firstAssignment = assignList.data.assignments[0];
  check('assignments list has at least one item', !!firstAssignment, assignList);
  if (firstAssignment) {
    const saveAnswer = await req(studentJar, 'POST', '/api/assignments/' + firstAssignment.id + '/answers', { qKey: 's0q0', value: 'テスト回答です' });
    check('student can save an LP分析課題 answer -> ok', saveAnswer.status === 200, saveAnswer);
  }

  console.log(`\napi-test.mjs: ${passCount} passed, ${failCount} failed`);
  if (failCount > 0) {
    console.log('Failures:', failures);
    process.exit(1);
  }
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
