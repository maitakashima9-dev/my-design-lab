/* =======================================================
   MY+DESIGN LAB. フロントエンド
   Cloudflare Pages Functions（/api/...）と通信して動作する本番版です。
======================================================= */

const PALETTE = ['#c53654', '#e6d068', '#36a2c5'];
const PALETTE_DARK = ['#7a2338', '#7a6a20', '#1e5b70'];
const CATEGORIES = ["LPデザイン", "写真・補正", "AI活用", "案件獲得・SNS運用", "マーケティング", "LPライティング", "クライアントワーク", "事務・法務・その他"];

// 通販LP分析課題の設問（固定のカリキュラム内容）
const QUESTION_SECTIONS = [
  {title:"① 商品を理解する", questions:[
    "この商品で得られる「未来」は何か",
    "この商品のUSP（独自の強み）は何か",
    "「機能」「ベネフィット」「情緒」「ライフスタイル」「未来の変化」のうち、どれを一番強く訴求しているか",
    "この商品の「売りにくそうなところ」はどこだと思うか",
    "他社と比べて勝てそうな要素はあるか",
  ]},
  {title:"② ターゲットを考える", questions:[
    "誰に向けたLPだと思うか",
    "年齢・性別だけでなく、どんな価値観・生活をしている人か",
    "その人は購入前、どんな悩みや欲求を持っているか",
    "商品についてどのくらい知識がある層向けか（無関心／興味あり／比較検討中）",
    "このLPが、あえてターゲットから外していそうな人は誰か",
  ]},
  {title:"③ FV・キービジュアル", questions:[
    "なぜこのキービジュアル（商品カット／モデルカットなど）を選んだと思うか",
    "FVを見た瞬間、ユーザーに何を伝え、どう興味を持たせたいと思うか",
  ]},
  {title:"④ コピー・言葉", questions:[
    "キャッチコピーは、何を伝えたくてこの言葉を選んだと思うか",
    "そのコピーは「機能訴求」「悩み訴求」「ベネフィット」「情緒」のどれに当たるか",
    "コピーとビジュアルは同じことを言っているか、それとも役割を分担しているか",
  ]},
  {title:"⑤ 配色・トンマナ", questions:[
    "なぜこの配色にしていると思うか",
    "その配色からどんな印象を受けるか",
    "写真・背景・文字・ボタンで、色の役割はどう分かれているか",
  ]},
  {title:"⑥ レイアウト・視線誘導", questions:[
    "最初にどこへ目がいくか",
    "情報量が多い／少ない箇所には、それぞれどんな意図があると思うか",
  ]},
  {title:"⑦ 情報設計・LPの構成", questions:[
    "なぜこの順番で情報を出していると思うか",
    "FVの直後にこの情報が来るのはなぜだと思うか",
    "ユーザーのどんな不安・疑問を、どの順番で解消しているか",
    "どこで「欲しい」と思わせようとしているか",
    "どこで「信用できそう」と思わせているか",
    "どこで購入を後押ししているか",
    "削っても問題なさそうな情報はどこか",
  ]},
  {title:"⑧ デザイン表現の意図", questions:[
    "なぜこのフォントを使っていると思うか",
    "文字サイズ・太さ・字間・行間は、なぜこの設定だと思うか",
    "装飾は何のために使われているか",
    "写真・イラスト・アイコン・図解は、それぞれ何の役割を担っているか",
  ]},
  {title:"⑨ 自分ならどうする？", questions:[
    "このLPで一番優れていると思う点はどこか",
    "改善するとしたらどこか。追加すべきコンテンツはあるか",
    "このLPから、自分の制作に取り入れたいことを3つ挙げる",
  ]},
];

// 「ギャラリー部屋」「通販デザイン図鑑」は cache.gallery / cache.zukan としてDBから読み込みます

/* =======================================================
   API通信ヘルパー
======================================================= */
const api = {
  async request(method, path, body, isForm) {
    const opts = { method, credentials: 'same-origin' };
    if (isForm) {
      opts.body = body;
    } else if (body !== undefined) {
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(path, opts);
    let data = null;
    try { data = await res.json(); } catch (e) { /* 空レスポンス */ }
    if (!res.ok) {
      throw new Error((data && data.error) || ('通信エラーが発生しました（' + res.status + '）'));
    }
    return data;
  },
  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body === undefined ? {} : body); },
  put(path, body) { return this.request('PUT', path, body === undefined ? {} : body); },
  del(path) { return this.request('DELETE', path); },
  postForm(path, form) { return this.request('POST', path, form, true); },
};

async function uploadFile(file, prefix) {
  const form = new FormData();
  form.append('file', file);
  form.append('prefix', prefix);
  return api.postForm('/api/upload', form); // -> {key, name, size, url}
}

function showToast(message) {
  const root = document.getElementById('toastRoot');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

/* =======================================================
   状態管理
======================================================= */
let currentUser = null; // {id,email,role,name,initial,color,joinedAt}
const cache = {
  articles: [], videos: [], filesList: [], announcements: [], checklist: [],
  assignments: [], photoTasks: [], students: [], gallery: [], zukan: [],
  assignmentStatus: {}, photoTaskStatus: {},
  chatMessages: [], reports: [], reportsSummary: null, adminStats: null,
  currentAnswers: {}, currentSubmitted: false,
  currentPhotoSubmission: null,
};

const state = {
  view: 'dashboard',
  category: 'all',
  reportDraftTitle: '',
  reportDraftBody: '',
  chatStudentId: null,       // 管理者が選んでいるチャット相手
  analysisAdminStudent: null,
  photoAdminStudent: null,
  adminReportStudent: null,
  selectedArticleId: null,
  selectedAssignmentId: null,
  selectedPhotoTaskId: null,
};

function me() { return currentUser; }
let stagedThumb = null;
let stagedPsdFile = null;
let stagedSubmissionFile = null;
let stagedMaterialFile = null;
let savedArtRange = null;

/* =======================================================
   装飾（スパークル・紙吹雪）
======================================================= */
function sparkleSVG(size, color) {
  size = size || 16; color = color || '#fff';
  return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="'+color+'"><path d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z"/></svg>';
}
function fireConfetti(originEl) {
  const colors = [PALETTE[0], PALETTE[1], PALETTE[2], '#ff8a63', '#6fcf97'];
  let cx = window.innerWidth / 2, cy = window.innerHeight / 3;
  if (originEl && originEl.getBoundingClientRect) {
    const r = originEl.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top;
  }
  for (let i = 0; i < 26; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    const angle = (Math.random() * Math.PI) - Math.PI / 2;
    const dist = 60 + Math.random() * 90;
    const dx = Math.cos(angle) * dist;
    el.style.left = (cx + (Math.random() * 80 - 40)) + 'px';
    el.style.top = cy + 'px';
    el.style.background = colors[i % colors.length];
    el.style.transform = 'translateX(' + dx + 'px)';
    el.style.animationDelay = (Math.random() * 0.15) + 's';
    el.style.borderRadius = (Math.random() > .5 ? '50%' : '2px');
    document.body.appendChild(el);
    setTimeout(() => { el.remove(); }, 1400);
  }
}

/* =======================================================
   ICONS
======================================================= */
function icon(name, size) {
  size = size || 16;
  const icons = {
    close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
    play: '',
    check: '<polyline points="20 6 9 17 4 12"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    back: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    paperclip: '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
    x: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  };
  if (name === 'play') {
    return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
  }
  return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+icons[name]+'</svg>';
}

/* =======================================================
   認証・起動
======================================================= */
async function boot() {
  try {
    const { user } = await api.get('/api/auth/me');
    if (!user) { showLoginScreen(); return; }
    await afterLogin(user);
  } catch (e) {
    showLoginScreen(e.message);
  }
}

function showLoginScreen(errorMessage) {
  document.getElementById('app').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  const errBox = document.getElementById('loginError');
  if (errorMessage) { errBox.style.display = 'block'; errBox.textContent = errorMessage; }
  else { errBox.style.display = 'none'; }
}

async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errBox = document.getElementById('loginError');
  if (!email || !password) {
    errBox.style.display = 'block'; errBox.textContent = 'メールアドレスとパスワードを入力してください';
    return;
  }
  const btn = document.getElementById('loginBtn');
  btn.disabled = true; btn.textContent = 'ログイン中...';
  try {
    const { user } = await api.post('/api/auth/login', { email, password });
    await afterLogin(user);
  } catch (e) {
    errBox.style.display = 'block'; errBox.textContent = e.message;
  } finally {
    btn.disabled = false; btn.textContent = 'ログイン';
  }
}

async function handleLogout() {
  if (!confirm('ログアウトしますか？')) return;
  try { await api.post('/api/auth/logout'); } catch (e) { /* ignore */ }
  location.reload();
}

async function afterLogin(user) {
  currentUser = user;
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('viewRoot').innerHTML = '<div class="loading-row">読み込み中...</div>';
  // loadCoreData()内の個別データ取得が失敗しても、ここで例外を投げて画面が
  // 「読み込み中」のまま固まらないようにする（失敗した分は空データのまま表示する）。
  const failed = await loadCoreData();
  render();
  if (failed.length) {
    showToast('一部のデータの読み込みに失敗しました（' + failed.join('、') + '）。時間を置いてページを再読み込みしてください。');
  }
}

async function loadCoreData() {
  const jobs = [
    ['記事', () => api.get('/api/articles').then(d => cache.articles = d.articles)],
    ['動画', () => api.get('/api/videos').then(d => cache.videos = d.videos)],
    ['資料', () => api.get('/api/files-list').then(d => cache.filesList = d.files)],
    ['お知らせ', () => api.get('/api/announcements').then(d => cache.announcements = d.announcements)],
    ['チェックリスト', () => api.get('/api/checklist').then(d => cache.checklist = d.checklist)],
    ['LP分析課題', () => api.get('/api/assignments').then(d => cache.assignments = d.assignments)],
    ['写真補正課題', () => api.get('/api/photo-tasks').then(d => cache.photoTasks = d.tasks)],
    ['ギャラリー', () => api.get('/api/gallery').then(d => cache.gallery = d.items)],
    ['通販図鑑', () => api.get('/api/zukan').then(d => cache.zukan = d.items)],
  ];
  if (currentUser.role === 'admin') {
    jobs.push(['受講生一覧', () => api.get('/api/students').then(d => {
      cache.students = d.students;
      if (cache.students.length) {
        state.chatStudentId = state.chatStudentId || cache.students[0].id;
        state.analysisAdminStudent = state.analysisAdminStudent || cache.students[0].id;
        state.photoAdminStudent = state.photoAdminStudent || cache.students[0].id;
        state.adminReportStudent = state.adminReportStudent || cache.students[0].id;
      }
    })]);
  }
  const results = await Promise.allSettled(jobs.map(([, fn]) => fn()));
  const failed = [];
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      failed.push(jobs[i][0]);
      console.error('loadCoreData failed:', jobs[i][0], r.reason);
    }
  });
  return failed;
}

/* =======================================================
   NAV DEFINITION
======================================================= */
function navSections() {
  const student = [
    {group: 'メイン', items: [
      {id: 'dashboard', label: 'ホーム'},
      {id: 'report', label: '日報'},
      {id: 'chat', label: 'チャット'},
    ]},
    {group: '学習コンテンツ', items: [
      {id: 'articles', label: '記事コンテンツ'},
      {id: 'videos', label: '動画コンテンツ'},
      {id: 'files', label: '資料ダウンロード'},
    ]},
    {group: '実践課題', items: [
      {id: 'analysis', label: 'LP分析課題'},
      {id: 'photoTask', label: '写真・補正課題'},
    ]},
    {group: 'デザインを見る', items: [
      {id: 'gallery', label: 'ギャラリー部屋'},
      {id: 'zukan', label: '通販デザイン図鑑'},
    ]},
    {group: 'その他', items: [
      {id: 'announce', label: 'お知らせ'},
      {id: 'mypage', label: 'マイページ'},
    ]},
  ];
  if (currentUser.role === 'admin') {
    student[0].items.splice(1, 0, {id: 'admin', label: '管理画面'});
  }
  return student;
}

/* =======================================================
   RENDER: SHELL
======================================================= */
function renderShell() {
  const rs = document.getElementById('roleSwitch');
  rs.className = 'role-switch' + (currentUser.role === 'admin' ? ' admin' : '');
  rs.innerHTML = (currentUser.role === 'admin' ? '管理者としてログイン中' : '受講生としてログイン中') + '<span class="rs-sub">（ログアウト）</span>';

  const ab = document.getElementById('avatarBlock');
  ab.innerHTML = '<div class="avatar" style="background:'+currentUser.color+';color:#fff;">'+currentUser.initial+'</div><div><div class="avatar-name">'+currentUser.name+'</div><div class="avatar-role">'+(currentUser.role==='admin'?'管理者':'受講生')+'</div></div>';

  const sb = document.getElementById('sidebar');
  let html = '';
  navSections().forEach(sec => {
    html += '<div class="nav-label">'+sec.group+'</div>';
    sec.items.forEach(it => {
      const isActive = state.view === it.id || (it.id === 'articles' && state.view === 'articleDetail') || (it.id === 'analysis' && state.view === 'analysisDetail') || (it.id === 'photoTask' && state.view === 'photoTaskDetail');
      html += '<div class="nav-item'+(isActive?' active':'')+'" onclick="appNav(\''+it.id+'\')"><span class="dot-icon"></span>'+it.label+'</div>';
    });
  });
  sb.innerHTML = html;
}

async function appNav(view) {
  state.view = view;
  document.getElementById('searchResults').style.display = 'none';
  closeSidebar();
  window.scrollTo(0, 0);
  render();
  try {
    await loadDataForView(view);
  } catch (e) {
    showToast('読み込みに失敗しました: ' + e.message);
  }
  render();
}
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

// ビューごとに必要な最新データを取得する
async function loadDataForView(view) {
  if (view === 'dashboard') {
    if (currentUser.role === 'admin') {
      cache.reportsSummary = await api.get('/api/reports/summary');
      if (state.chatStudentId) cache.chatMessages = (await api.get('/api/chat?studentId=' + state.chatStudentId)).messages;
    } else {
      cache.reports = (await api.get('/api/reports')).reports;
      cache.chatMessages = (await api.get('/api/chat')).messages;
    }
  } else if (view === 'report') {
    if (currentUser.role === 'admin') {
      const target = state.adminReportStudent || (cache.students[0] && cache.students[0].id);
      if (target) cache.reports = (await api.get('/api/reports?studentId=' + target)).reports;
    } else {
      cache.reports = (await api.get('/api/reports')).reports;
    }
  } else if (view === 'chat') {
    const q = currentUser.role === 'admin' ? ('?studentId=' + state.chatStudentId) : '';
    cache.chatMessages = (await api.get('/api/chat' + q)).messages;
  } else if (view === 'announce') {
    cache.announcements = (await api.get('/api/announcements')).announcements;
  } else if (view === 'articles') {
    cache.articles = (await api.get('/api/articles')).articles;
  } else if (view === 'videos') {
    cache.videos = (await api.get('/api/videos')).videos;
  } else if (view === 'files') {
    cache.filesList = (await api.get('/api/files-list')).files;
  } else if (view === 'gallery') {
    cache.gallery = (await api.get('/api/gallery')).items;
  } else if (view === 'zukan') {
    cache.zukan = (await api.get('/api/zukan')).items;
  } else if (view === 'analysis') {
    cache.assignments = (await api.get('/api/assignments')).assignments;
    if (currentUser.role === 'admin') {
      const results = await Promise.all(cache.assignments.map(a => api.get('/api/assignments/' + a.id + '/status')));
      cache.assignments.forEach((a, i) => { cache.assignmentStatus[a.id] = results[i]; });
    }
  } else if (view === 'analysisDetail') {
    const targetStudentId = currentUser.role === 'admin' ? state.analysisAdminStudent : currentUser.id;
    const res = await api.get('/api/assignments/' + state.selectedAssignmentId + '/answers?studentId=' + targetStudentId);
    cache.currentAnswers = res.answers;
    cache.currentSubmitted = res.submitted;
  } else if (view === 'photoTask') {
    cache.photoTasks = (await api.get('/api/photo-tasks')).tasks;
    if (currentUser.role === 'admin') {
      const results = await Promise.all(cache.photoTasks.map(t => api.get('/api/photo-tasks/' + t.id + '/status')));
      cache.photoTasks.forEach((t, i) => { cache.photoTaskStatus[t.id] = results[i]; });
    }
  } else if (view === 'photoTaskDetail') {
    const targetStudentId = currentUser.role === 'admin' ? state.photoAdminStudent : currentUser.id;
    const res = await api.get('/api/photo-tasks/' + state.selectedPhotoTaskId + '/submission?studentId=' + targetStudentId);
    cache.currentPhotoSubmission = res.submission;
  } else if (view === 'admin') {
    cache.adminStats = await api.get('/api/admin/stats');
    cache.reportsSummary = await api.get('/api/reports/summary');
  } else if (view === 'mypage') {
    cache.checklist = (await api.get('/api/checklist')).checklist;
  }
}

/* =======================================================
   MOCK LP GENERATOR（デザインプレースホルダー）
======================================================= */
function mockLP(seed, tall) {
  const c1 = PALETTE[seed % 3], c2 = PALETTE[(seed + 1) % 3];
  const heroH = tall ? 150 : 88;
  return '<div class="mocklp">'
    + '<div class="bar" style="background:linear-gradient(90deg,'+c1+','+c2+');"></div>'
    + '<div class="hero" style="background:linear-gradient(135deg,'+c1+','+c2+'),repeating-linear-gradient(45deg,rgba(255,255,255,.12) 0 8px,transparent 8px 16px);height:'+heroH+'px;"><div class="hero-badge"></div><div class="htxt"></div></div>'
    + '<div class="lines"><div class="line" style="width:90%;"></div><div class="line" style="width:75%;"></div><div class="line" style="width:60%;"></div></div>'
    + '<div class="cta" style="background:linear-gradient(100deg,'+PALETTE[0]+',#e0667f);"><div class="ctxt"></div></div>'
    + '</div>';
}
function mockPhotoThumb(seed) {
  const c1 = PALETTE[seed % 3], c2 = PALETTE[(seed + 1) % 3];
  return '<div style="width:100%;aspect-ratio:1280/670;border-radius:9px 9px 0 0;background:linear-gradient(135deg,'+c1+','+c2+'),repeating-linear-gradient(45deg,rgba(255,255,255,.12) 0 8px,transparent 8px 16px);display:flex;align-items:center;justify-content:center;color:#fff;position:relative;overflow:hidden;">'
    + '<div style="opacity:.9;">'+icon('pen',30)+'</div>'
    + '<span style="position:absolute;top:8px;right:10px;background:rgba(0,0,0,.35);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;letter-spacing:.03em;">PSD</span>'
    + '</div>';
}

/* =======================================================
   VIEW: DASHBOARD
======================================================= */
function viewDashboard() {
  const s = me();
  let html = '<div class="hero-banner"><span class="hb-eyebrow">MY+DESIGN LAB.</span>'
    + '<h1>'+(currentUser.role === 'admin' ? 'おかえりなさい、' + s.name + 'さん' : 'おかえりなさい、' + s.name + 'さん')+'</h1>'
    + '<p>'+(currentUser.role === 'admin' ? '今日も受講生のがんばりをチェックしていきましょう。新着の日報やチャットのやり取りがひと目でわかります。' : '通販デザインが上手くなる一歩を、今日も積み重ねていきましょう。日報・チャットでいつでもまいさんとつながれます。')+'</p>'
    + '<span class="hb-sparkle" style="top:18px;right:150px;animation-delay:.2s;">'+sparkleSVG(16)+'</span>'
    + '<span class="hb-sparkle" style="top:56px;right:260px;animation-delay:1.1s;">'+sparkleSVG(11)+'</span>'
    + '<span class="hb-sparkle" style="bottom:70px;right:200px;animation-delay:.6s;">'+sparkleSVG(13)+'</span>'
    + '</div>';

  html += '<div class="announce">' + cache.announcements.slice(0, 3).map(a => '<div class="a-item"><span class="a-date">'+a.date+'</span><span>'+linkifyHtml(a.text)+'</span></div>').join('') + '</div>';

  html += '<div class="two-col">';
  html += '<div>';

  html += '<div class="card mb14"><div class="section-title">日報<span class="more" onclick="appNav(\'report\')">開く</span></div>';
  html += renderDashboardReportCard();
  html += '</div>';

  html += '<div class="card mb14"><div class="section-title">最近のチャット<span class="more" onclick="appNav(\'chat\')">開く</span></div>';
  const recentChat = (cache.chatMessages || []).slice(-2);
  if (recentChat.length === 0) html += '<div class="page-sub">まだやり取りがありません。</div>';
  recentChat.forEach(c => {
    const label = c.from === 'me' ? 'まい' : s.name;
    html += '<div style="font-size:12.5px;padding:8px 0;border-bottom:1px solid var(--gray);"><b>'+label+'：</b>'+(c.text ? escapeHtml(c.text) : '（ファイル）')+'</div>';
  });
  html += '</div>';

  html += '<div class="card"><div class="section-title">学習の進み具合<span class="more" onclick="appNav(\'mypage\')">マイページへ</span></div>';
  html += renderProgressRing() + renderChecklistHTML(2);
  html += '</div>';
  html += '</div>';

  html += '<div class="card"><div class="section-title">おすすめコンテンツ</div>';
  cache.articles.slice(0, 3).forEach(a => {
    html += '<div style="padding:9px 0;border-bottom:1px solid var(--gray);cursor:pointer;" onclick="openArticle('+a.id+')"><span class="tag blue" style="margin-right:6px;">'+a.cat+'</span><span style="font-size:12.8px;">'+a.title+'</span></div>';
  });
  html += '</div></div>';

  return html;
}
function renderDashboardReportCard() {
  if (currentUser.role === 'admin') {
    const summary = cache.reportsSummary;
    if (!summary) return '<div class="page-sub">読み込み中...</div>';
    let html = '<div style="font-size:13px;margin-bottom:10px;"><b>'+summary.submittedCount+' / '+summary.total+'人</b> が本日の日報を提出済みです</div>';
    if (summary.notSubmitted.length) {
      html += '<div class="page-sub" style="margin-bottom:6px;">未提出：</div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">' + summary.notSubmitted.map(p => '<span class="tag">'+p.name+'</span>').join('') + '</div>';
    } else {
      html += '<div class="page-sub">全員が本日分を提出しています。</div>';
    }
    return html;
  }
  const todayStr = new Date().toISOString().slice(0, 10);
  const today = (cache.reports || []).find(r => r.date === todayStr);
  if (today) {
    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span class="tag blue">提出済み</span><span class="page-sub">本日分は提出済みです</span></div>'
      + '<div class="r-title" style="font-size:13.5px;font-weight:700;margin-bottom:4px;">'+escapeHtml(today.title)+'</div>'
      + '<div class="r-content" style="font-size:12.5px;color:#444;line-height:1.7;">'+escapeHtml(today.content)+'</div>';
  }
  return '<div class="page-sub" style="margin-bottom:12px;">今日の日報はまだ提出されていません。今日取り組んだことを書いてみましょう。</div>'
    + '<button class="btn sm" onclick="appNav(\'report\')">日報を書く</button>';
}
function statCard(num, lbl, color, iconName) {
  const iconSvgs = {
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    percent: '<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  };
  const svg = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+iconSvgs[iconName]+'</svg>';
  return '<div class="stat-card" style="--accent:'+color+';"><div class="stat-icon">'+svg+'</div><div class="num">'+num+'</div><div class="lbl">'+lbl+'</div></div>';
}
function renderProgressRing() {
  const total = cache.checklist.length || 1;
  const done = cache.checklist.filter(c => c.done).length;
  const pct = Math.round(done / total * 100);
  const r = 26, c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return '<div class="progress-ring-wrap mb14"><svg width="68" height="68" viewBox="0 0 68 68">'
    + '<circle cx="34" cy="34" r="'+r+'" fill="none" stroke="#f0eeee" stroke-width="8"/>'
    + '<circle cx="34" cy="34" r="'+r+'" fill="none" stroke="url(#gradRing)" stroke-width="8" stroke-linecap="round" stroke-dasharray="'+c+'" stroke-dashoffset="'+offset+'" transform="rotate(-90 34 34)"/>'
    + '<defs><linearGradient id="gradRing" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="'+PALETTE[0]+'"/><stop offset="100%" stop-color="'+PALETTE[1]+'"/></linearGradient></defs>'
    + '<text x="34" y="39" text-anchor="middle" class="pr-num">'+pct+'%</text></svg>'
    + '<div><div style="font-weight:700;font-size:13px;">'+done+' / '+cache.checklist.length+' 完了</div><div class="pr-label">この調子でカリキュラムを進めましょう</div></div></div>';
}

/* =======================================================
   VIEW: REPORT（日報）
======================================================= */
function viewReport() {
  if (currentUser.role === 'admin') {
    let html = '<div class="page-head"><div class="page-title">日報 管理</div><div class="page-sub">受講生ごとの日報を確認できます。</div></div>';
    const summary = cache.reportsSummary;
    const notSubmittedIds = new Set((summary ? summary.notSubmitted : []).map(s => s.id));
    html += '<div class="card mb14"><table><thead><tr><th>受講生</th><th>本日の提出</th><th>入会日</th><th></th></tr></thead><tbody>';
    cache.students.forEach(st => {
      const todayDone = summary ? !notSubmittedIds.has(st.id) : false;
      html += '<tr><td>'+st.name+'</td><td><span class="status-dot '+(todayDone?'done':'pending')+'"></span>'+(todayDone?'提出済み':'未提出')+'</td><td>'+st.joined_at+'</td><td><span class="tag blue" style="cursor:pointer;" onclick="viewStudentReports('+st.id+')">日報を見る</span></td></tr>';
    });
    html += '</tbody></table></div>';

    const target = state.adminReportStudent || (cache.students[0] && cache.students[0].id);
    const tst = cache.students.find(s => s.id === target);
    html += '<div class="card"><div class="section-title">'+(tst?tst.name:'')+' さんの日報一覧</div>';
    html += (cache.reports || []).map(r => reportItemHTML(r, { deletable: true })).join('') || '<div class="page-sub">まだ日報がありません。</div>';
    html += '</div>';
    return html;
  }

  let html = '<div class="page-head"><div class="page-title">日報</div><div class="page-sub">今日取り組んだことを書いて提出しましょう。まいさんが確認します。</div></div>';
  html += '<div class="card report-form mb14">'
    + '<input type="text" id="reportTitle" placeholder="今日のタイトル（例：LP模写を1本提出）" value="'+escapeHtml(state.reportDraftTitle)+'" oninput="state.reportDraftTitle=this.value">'
    + '<textarea id="reportBody" placeholder="今日やったこと、つまずいたこと、質問したいことなど自由に書いてください">'+escapeHtml(state.reportDraftBody)+'</textarea>'
    + '<div style="margin-top:12px;"><button class="btn" onclick="submitReport()">日報を提出する</button></div>'
    + '</div>';

  html += '<div class="card"><div class="section-title">これまでの日報</div>';
  html += (cache.reports || []).map(r => reportItemHTML(r, { editable: true, deletable: true })).join('') || '<div class="page-sub">まだ日報がありません。</div>';
  html += '</div>';
  return html;
}
function reportItemHTML(r, opts) {
  opts = opts || {};
  let actions = '';
  if (opts.editable || opts.deletable) {
    actions = '<div class="admin-card-actions" style="display:flex;gap:6px;margin-top:8px;">'
      + (opts.editable ? '<button class="btn secondary sm" onclick="openReportEditModal('+r.id+')">'+icon('pen',12)+' 編集</button>' : '')
      + (opts.deletable ? '<button class="btn secondary sm" onclick="deleteReport('+r.id+')">'+icon('trash',12)+' 削除</button>' : '')
      + '</div>';
  }
  return '<div class="report-item"><div class="r-date">'+r.date+'</div><div class="r-title">'+escapeHtml(r.title)+'</div><div class="r-content">'+linkifyHtml(r.content)+'</div>'+actions+'</div>';
}
function openReportEditModal(id) {
  const r = cache.reports.find(x => x.id === id);
  if (!r) return;
  showModal('<h2>日報を編集</h2>'
    + '<div class="form-group"><label>タイトル</label><input type="text" id="editReportTitle" value="'+escapeHtml(r.title)+'"></div>'
    + '<div class="form-group"><label>内容</label><textarea id="editReportBody">'+escapeHtml(r.content)+'</textarea></div>'
    + '<button class="btn" id="submitEditReportBtn" onclick="submitReportEdit('+id+')">保存する</button>');
}
async function submitReportEdit(id) {
  const title = document.getElementById('editReportTitle').value.trim();
  const content = document.getElementById('editReportBody').value.trim();
  if (!title || !content) { alert('タイトルと内容を入力してください。'); return; }
  const btn = document.getElementById('submitEditReportBtn');
  btn.disabled = true; btn.textContent = '保存中...';
  try {
    await api.put('/api/reports/' + id, { title, content });
    closeModal();
    cache.reports = (await api.get('/api/reports')).reports;
    render();
    showToast('日報を更新しました');
  } catch (e) {
    alert('更新に失敗しました: ' + e.message);
    btn.disabled = false; btn.textContent = '保存する';
  }
}
async function deleteReport(id) {
  if (!confirm('この日報を削除します。よろしいですか？')) return;
  try {
    await api.del('/api/reports/' + id);
    if (currentUser.role === 'admin') {
      const target = state.adminReportStudent || (cache.students[0] && cache.students[0].id);
      cache.reports = (await api.get('/api/reports?studentId=' + target)).reports;
    } else {
      cache.reports = (await api.get('/api/reports')).reports;
    }
    render();
    showToast('日報を削除しました');
  } catch (e) { showToast('削除に失敗しました: ' + e.message); }
}
async function submitReport() {
  const titleEl = document.getElementById('reportTitle');
  const bodyEl = document.getElementById('reportBody');
  const title = titleEl.value.trim();
  const body = bodyEl.value.trim();
  if (!title || !body) { alert('タイトルと内容を入力してください。'); return; }
  try {
    await api.post('/api/reports', { title, content: body });
    state.reportDraftTitle = ''; state.reportDraftBody = '';
    fireConfetti(titleEl);
    cache.reports = (await api.get('/api/reports')).reports;
    render();
  } catch (e) { alert('提出に失敗しました: ' + e.message); }
}
async function viewStudentReports(id) {
  state.adminReportStudent = id;
  render();
  cache.reports = (await api.get('/api/reports?studentId=' + id)).reports;
  render();
}

/* =======================================================
   VIEW: CHAT
======================================================= */
function viewChat() {
  let html = '<div class="page-head"><div class="page-title">受講生専用チャット</div><div class="page-sub">まいさんと直接やり取りできます。デザインデータもそのまま送受信できます。</div></div>';

  if (currentUser.role === 'admin') {
    html += '<div class="chip-row">' + cache.students.map(s => '<div class="chip'+(state.chatStudentId===s.id?' active':'')+'" onclick="switchChatStudent('+s.id+')">'+s.name+'</div>').join('') + '</div>';
  }
  const partner = currentUser.role === 'admin'
    ? cache.students.find(s => s.id === state.chatStudentId)
    : { name: 'まい', initial: 'ま', color: PALETTE[0] };
  if (!partner) return '<div class="page-sub">受講生を選択してください。</div>';

  const log = cache.chatMessages || [];

  html += '<div class="chat-wrap"><div class="chat-head"><div class="avatar" style="width:28px;height:28px;font-size:11px;background:'+partner.color+';color:#fff;">'+partner.initial+'</div>'+(currentUser.role==='admin'?partner.name:'まい')+'</div>';
  html += '<div class="chat-log" id="chatLog">';
  if (log.length === 0) html += '<div class="page-sub" style="padding:20px 0;text-align:center;">まだやり取りがありません。</div>';
  log.forEach(m => {
    const mine = (currentUser.role === 'admin' && m.from === 'me') || (currentUser.role === 'student' && m.from === 'them');
    const fileHtml = m.file ? '<div class="msg-file"><a href="'+m.file.url+'" target="_blank" rel="noopener" style="color:inherit;text-decoration:none;display:flex;align-items:center;gap:6px;">'+icon('paperclip',14)+'<span>'+escapeHtml(m.file.name)+'（'+m.file.size+'）</span></a></div>' : '';
    html += '<div class="msg-wrap '+(mine?'me':'them')+'">'
      + '<div class="msg '+(mine?'me':'them')+'">'+(m.text?linkifyHtml(m.text):'')+fileHtml+'<span class="time">'+formatChatTime(m.time)+'</span></div>'
      + (mine ? '<div class="msg-actions"><button onclick="deleteChatMessage('+m.id+')">取り消す</button></div>' : '')
      + '</div>';
  });
  html += '</div>';
  html += '<div class="chat-input">'
    + '<input type="file" id="chatFileInput" style="display:none" onchange="handleChatFileSelected(this)">'
    + '<button class="attach-btn" title="ファイルを添付" onclick="document.getElementById(\'chatFileInput\').click()">'+icon('paperclip',18)+'</button>'
    + '<input id="chatInputBox" type="text" placeholder="メッセージを入力..." onkeydown="if(event.key===\'Enter\')sendChatMessage()">'
    + '<button class="btn" onclick="sendChatMessage()">'+icon('send',15)+'</button></div>';
  html += '</div>';
  return html;
}
function formatChatTime(iso) {
  // D1のCURRENT_TIMESTAMPは "YYYY-MM-DD HH:MM:SS"（UTC）形式なので、そのまま月/日 時:分だけ表示する
  if (!iso) return '';
  const m = iso.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return iso;
  return m[2] + '/' + m[3] + ' ' + m[4] + ':' + m[5];
}
async function switchChatStudent(id) {
  state.chatStudentId = id;
  render();
  cache.chatMessages = (await api.get('/api/chat?studentId=' + id)).messages;
  render();
}
function currentChatContext() {
  if (currentUser.role === 'admin') return { studentId: state.chatStudentId };
  return {};
}
async function sendChatMessage() {
  const box = document.getElementById('chatInputBox');
  const text = box.value.trim();
  if (!text) return;
  box.value = '';
  try {
    await api.post('/api/chat', Object.assign({ text }, currentChatContext()));
    await refreshChat();
  } catch (e) { alert('送信に失敗しました: ' + e.message); }
}
async function handleChatFileSelected(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';
  try {
    showToast('アップロード中...');
    const uploaded = await uploadFile(file, 'chat');
    await api.post('/api/chat', Object.assign({ fileKey: uploaded.key, fileName: uploaded.name, fileSize: uploaded.size }, currentChatContext()));
    await refreshChat();
  } catch (e) { alert('送信に失敗しました: ' + e.message); }
}
async function refreshChat() {
  const q = currentUser.role === 'admin' ? ('?studentId=' + state.chatStudentId) : '';
  cache.chatMessages = (await api.get('/api/chat' + q)).messages;
  render();
  const logEl = document.getElementById('chatLog');
  if (logEl) logEl.scrollTop = logEl.scrollHeight;
}
async function deleteChatMessage(id) {
  if (!confirm('このメッセージを取り消しますか？')) return;
  try {
    await api.post('/api/chat/' + id + '/delete');
    await refreshChat();
  } catch (e) { alert('取り消しに失敗しました: ' + e.message); }
}

/* =======================================================
   VIEW: ARTICLES
======================================================= */
function articleThumbHTML(a, i) {
  if (a.thumb) {
    return '<div class="a-thumb" style="padding:0;"><img src="'+a.thumb+'" style="width:100%;height:100%;object-fit:cover;display:block;"></div>';
  }
  return '<div class="a-thumb" style="background:'+PALETTE[i%3]+';">'
    + '<div class="at-eyebrow">MY<span>+</span>DESIGN LAB.</div>'
    + '<div class="at-title">'+escapeHtml(a.title)+'</div>'
    + '<div class="at-cat">'+escapeHtml(a.cat)+'</div>'
    + '</div>';
}
function viewArticles() {
  let html = '<div class="page-head"><div class="page-title">記事コンテンツ</div><div class="page-sub">Note感覚で読める学習記事です。カテゴリで絞り込めます。</div></div>';
  if (currentUser.role === 'admin') {
    html += '<div style="margin-bottom:16px;"><button class="btn" onclick="openAddArticleModal()">'+icon('pen',13)+' 記事を追加</button></div>';
  }
  html += '<div class="chip-row"><div class="chip'+(state.category==='all'?' active':'')+'" onclick="setCategory(\'all\')">すべて</div>'
    + CATEGORIES.map(c => '<div class="chip'+(state.category===c?' active':'')+'" onclick="setCategory(\''+c+'\')">'+c+'</div>').join('') + '</div>';

  const list = cache.articles.filter(a => state.category === 'all' || a.cat === state.category);
  html += '<div class="grid cols-2">';
  list.forEach((a, i) => {
    const adminBtns = currentUser.role === 'admin'
      ? '<button class="btn secondary sm" onclick="event.stopPropagation();openArticleModal('+a.id+')">'+icon('pen',12)+' 編集</button>'
        + '<button class="btn secondary sm" onclick="event.stopPropagation();deleteArticle('+a.id+')">'+icon('trash',12)+' 削除</button>'
      : '';
    html += '<div class="article-card" style="--accent:'+rgba(PALETTE[i%3],.4)+';" onclick="openArticle('+a.id+')">'
      + articleThumbHTML(a, i)
      + '<div class="a-body"><span class="tag blue">'+a.cat+'</span>'+(a.read?'<span class="tag" style="margin-left:6px;color:'+PALETTE[2]+';border-color:'+PALETTE[2]+';">'+icon('check',10)+' 既読</span>':'')+'<h4>'+escapeHtml(a.title)+'</h4><p>'+linkifyHtml(a.excerpt)+'</p>'
      + '<div class="article-meta"><button class="bookmark-btn'+(a.bookmarked?' active':'')+'" onclick="event.stopPropagation();toggleBookmark('+a.id+')">'+icon('star',15)+'</button><span class="date">'+a.date+'</span></div>'
      + (adminBtns ? '<div class="admin-card-actions" style="display:flex;gap:6px;margin-top:8px;">'+adminBtns+'</div>' : '')
      + '</div></div>';
  });
  html += '</div>';
  if (list.length === 0) html += '<div class="page-sub" style="margin-top:20px;">該当する記事がありません。</div>';
  return html;
}
function setCategory(c) { state.category = c; render(); }
async function toggleBookmark(id) {
  const a = cache.articles.find(x => x.id === id);
  if (!a) return;
  a.bookmarked = !a.bookmarked; render();
  try { await api.post('/api/articles/' + id + '/bookmark'); }
  catch (e) { a.bookmarked = !a.bookmarked; render(); showToast('通信エラー: ' + e.message); }
}
async function toggleReadArticle(id) {
  const a = cache.articles.find(x => x.id === id);
  if (!a) return;
  a.read = !a.read; render();
  try { await api.post('/api/articles/' + id + '/read'); }
  catch (e) { a.read = !a.read; render(); showToast('通信エラー: ' + e.message); }
}
function openAddArticleModal() { openArticleModal(null); }
function openArticleModal(editId) {
  stagedThumb = null;
  savedArtRange = null;
  const editing = editId ? cache.articles.find(a => a.id === editId) : null;
  showModal('<h2>' + (editing ? '記事を編集' : '記事を追加') + '</h2>'
    + '<div class="form-group"><label>タイトル</label><input type="text" id="newArtTitle" placeholder="記事タイトル" value="'+(editing?escapeHtml(editing.title):'')+'"></div>'
    + '<div class="form-group"><label>カテゴリ</label><select id="newArtCat">' + CATEGORIES.map(c => '<option value="'+c+'"'+(editing&&editing.cat===c?' selected':'')+'>'+c+'</option>').join('') + '</select></div>'
    + '<div class="form-group"><label>抜粋（一覧に表示される概要）</label><textarea id="newArtExcerpt" placeholder="記事の概要を1〜2行で">'+(editing?escapeHtml(editing.excerpt):'')+'</textarea></div>'
    + '<div class="form-group"><label>本文</label>'
    + '<div class="rich-editor-toolbar"><button type="button" class="btn secondary sm" onmousedown="event.preventDefault();saveArtSelection();" onclick="document.getElementById(\'newArtImgInsertInput\').click()">'+icon('paperclip',13)+' 画像を挿入</button>'
    + '<button type="button" class="btn secondary sm" style="margin-left:6px;" onmousedown="event.preventDefault();saveArtSelection();" onclick="insertArtLink()">'+icon('link',13)+' リンクを挿入</button>'
    + '<input type="file" id="newArtImgInsertInput" accept="image/*" multiple style="display:none" onchange="handleArtImgInsertChange(this)">'
    + '<span class="rt-hint">画像は本文中にドラッグ＆ドロップでも差し込めます。URLをそのまま貼り付けただけではリンクになりません。リンクにしたい文字を選んでから「リンクを挿入」を押してください</span></div>'
    + '<div id="newArtBody" class="rich-editor" contenteditable="true" data-placeholder="記事本文（画像はここに直接ドラッグ＆ドロップできます）"'
    + ' ondragover="event.preventDefault();this.classList.add(\'drag-over\')"'
    + ' ondragleave="this.classList.remove(\'drag-over\')"'
    + ' ondrop="handleArticleBodyDrop(event)"'
    + ' onmouseup="saveArtSelection()" onkeyup="saveArtSelection()">'+(editing?editing.body:'')+'</div></div>'
    + thumbUploadFieldHTML('newArtThumbFile', 'artThumbPreview')
    + '<button class="btn" id="submitArtBtn" onclick="submitArticleForm('+(editId||'null')+')">'+(editing?'保存する':'記事を追加する')+'</button>');
}
async function deleteArticle(id) {
  if (!confirm('この記事を削除します。よろしいですか？')) return;
  try {
    await api.del('/api/articles/' + id);
    cache.articles = (await api.get('/api/articles')).articles;
    render();
    showToast('記事を削除しました');
  } catch (e) { showToast('削除に失敗しました: ' + e.message); }
}
function saveArtSelection() {
  const editor = document.getElementById('newArtBody');
  const sel = window.getSelection();
  if (editor && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
    savedArtRange = sel.getRangeAt(0).cloneRange();
  }
}
function insertHtmlIntoArtBody(html) {
  const editor = document.getElementById('newArtBody');
  if (!editor) return;
  editor.focus();
  const sel = window.getSelection();
  if (savedArtRange && editor.contains(savedArtRange.startContainer)) {
    sel.removeAllRanges(); sel.addRange(savedArtRange);
  } else {
    const range = document.createRange();
    range.selectNodeContents(editor); range.collapse(false);
    sel.removeAllRanges(); sel.addRange(range);
  }
  document.execCommand('insertHTML', false, html);
  saveArtSelection();
}
let artImgCounter = 0;
function insertArtImage(file) {
  const reader = new FileReader();
  reader.onload = function (ev) {
    const placeholderId = 'artimg_' + (++artImgCounter);
    insertHtmlIntoArtBody('<img id="'+placeholderId+'" src="'+ev.target.result+'" data-uploading="1">');
    uploadFile(file, 'article-images').then(res => {
      const img = document.getElementById(placeholderId);
      if (img) { img.src = res.url; img.removeAttribute('data-uploading'); img.removeAttribute('id'); }
    }).catch(() => { showToast('画像のアップロードに失敗しました'); });
  };
  reader.readAsDataURL(file);
}
function insertArtLink() {
  const editor = document.getElementById('newArtBody');
  if (!editor) return;
  const url = prompt('リンク先のURLを入力してください（例：https://example.com/lp/xxxxx）');
  if (!url || !url.trim()) return;
  const safeUrl = url.trim();
  editor.focus();
  const sel = window.getSelection();
  let selectedText = '';
  if (savedArtRange && editor.contains(savedArtRange.startContainer)) {
    sel.removeAllRanges(); sel.addRange(savedArtRange);
    selectedText = sel.toString();
  }
  const linkText = selectedText || safeUrl;
  insertHtmlIntoArtBody('<a href="'+escapeHtml(safeUrl)+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(linkText)+'</a>');
}
function handleArtImgInsertChange(input) {
  const files = Array.from(input.files || []).filter(f => f.type.startsWith('image/'));
  files.forEach(insertArtImage);
  input.value = '';
}
function handleArticleBodyDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const editor = e.currentTarget;
  const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
  if (!files.length) return;
  let range = null;
  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(e.clientX, e.clientY);
  } else if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
    if (pos) { range = document.createRange(); range.setStart(pos.offsetNode, pos.offset); }
  }
  if (range && editor.contains(range.startContainer)) savedArtRange = range;
  files.forEach(insertArtImage);
}
async function submitArticleForm(editId) {
  const title = document.getElementById('newArtTitle').value.trim();
  const cat = document.getElementById('newArtCat').value;
  const excerpt = document.getElementById('newArtExcerpt').value.trim();
  const bodyEditor = document.getElementById('newArtBody');
  const body = bodyEditor ? bodyEditor.innerHTML.trim() : '';
  const bodyText = bodyEditor ? bodyEditor.textContent.trim() : '';
  if (!title || !excerpt || (!bodyText && !/<img/.test(body))) { alert('タイトル・抜粋・本文を入力してください。'); return; }
  if (bodyEditor.querySelector('[data-uploading]')) { alert('画像をアップロード中です。少し待ってからもう一度お試しください。'); return; }

  const btn = document.getElementById('submitArtBtn');
  btn.disabled = true; btn.textContent = editId ? '保存中...' : '追加中...';
  try {
    let thumbKey = null;
    if (stagedThumb) {
      const uploaded = await uploadFile(stagedThumb.file, 'thumbs');
      thumbKey = uploaded.key;
    }
    if (editId) {
      await api.put('/api/articles/' + editId, { cat, title, excerpt, articleBody: body, richBody: true, thumbKey });
    } else {
      await api.post('/api/articles', { cat, title, excerpt, articleBody: body, richBody: true, thumbKey });
    }
    closeModal();
    cache.articles = (await api.get('/api/articles')).articles;
    render();
    showToast(editId ? '記事を更新しました' : '記事を追加しました');
  } catch (e) {
    alert((editId ? '記事の更新' : '記事の追加') + 'に失敗しました: ' + e.message);
    btn.disabled = false; btn.textContent = editId ? '保存する' : '記事を追加する';
  }
}
function openArticle(id) {
  state.selectedArticleId = id;
  appNav('articleDetail');
}
function viewArticleDetail() {
  const a = cache.articles.find(x => x.id === state.selectedArticleId);
  if (!a) return '<div class="page-sub">記事が見つかりません。</div>';
  const related = cache.articles.filter(x => x.cat === a.cat && x.id !== a.id).slice(0, 3);
  let html = '<div class="back-link" onclick="appNav(\'articles\')">'+icon('back',15)+' 記事一覧にもどる</div>';
  html += '<article class="article-detail">';
  html += '<div class="ad-meta"><span class="tag blue">'+a.cat+'</span><span class="tag">'+a.date+'</span></div>';
  html += '<h1>'+escapeHtml(a.title)+'</h1>';
  html += a.richBody ? ('<div class="ad-body">'+a.body+'</div>') : ('<div class="ad-body"><p>'+escapeHtml(a.body)+'</p></div>');
  html += '<div class="ad-actions"><label style="display:inline-flex;align-items:center;gap:6px;font-size:13.5px;cursor:pointer;padding:0 14px;user-select:none;"><input type="checkbox" style="width:16px;height:16px;accent-color:'+PALETTE[2]+';cursor:pointer;" '+(a.read?'checked':'')+' onchange="toggleReadArticle('+a.id+')"> 読み終えた</label><button class="btn secondary" onclick="toggleBookmark('+a.id+')">'+(a.bookmarked?'★ ブックマーク済み':'☆ ブックマークする')+'</button></div>';
  html += '</article>';
  if (related.length) {
    html += '<div class="card mt24"><div class="section-title">同じカテゴリの記事</div>';
    related.forEach(r => { html += '<div style="padding:9px 0;border-bottom:1px solid var(--gray);cursor:pointer;" onclick="openArticle('+r.id+')"><span class="tag blue" style="margin-right:6px;">'+r.cat+'</span>'+escapeHtml(r.title)+'</div>'; });
    html += '</div>';
  }
  return html;
}

/* =======================================================
   VIEW: VIDEOS
======================================================= */
function viewVideos() {
  let html = '<div class="page-head"><div class="page-title">動画コンテンツ</div><div class="page-sub">まいさんが更新すると、こちらに自動で反映されます（YouTube/Vimeo限定公開）。</div></div>';
  if (currentUser.role === 'admin') {
    html += '<div style="margin-bottom:16px;"><button class="btn" onclick="openAddVideoModal()">'+icon('pen',13)+' 動画を追加</button></div>';
  }
  html += '<div class="grid cols-3">';
  cache.videos.forEach((v, i) => {
    const thumbStyle = v.thumb ? '' : 'background:linear-gradient(135deg,#1c1f24,'+PALETTE_DARK[i%3]+');';
    const adminBtns = currentUser.role === 'admin'
      ? '<div class="admin-card-actions" style="display:flex;gap:6px;margin-top:8px;">'
        + '<button class="btn secondary sm" onclick="event.stopPropagation();openVideoEditModal('+v.id+')">'+icon('pen',12)+' 編集</button>'
        + '<button class="btn secondary sm" onclick="event.stopPropagation();deleteVideo('+v.id+')">'+icon('trash',12)+' 削除</button></div>'
      : '';
    html += '<div class="video-card" style="--accent:'+rgba(PALETTE[i%3],.4)+';" onclick="openVideoModal('+v.id+')">'
      + '<div class="video-thumb" style="'+thumbStyle+'">'+(v.thumb?'<img src="'+v.thumb+'">':'')+'<span class="play-circle">'+icon('play',22)+'</span><span class="dur">'+v.dur+'</span></div>'
      + '<div class="v-body"><div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;"><span class="tag blue">'+v.cat+'</span>'+(v.isNew?'<span class="badge-new">NEW</span>':'')+'</div><h4>'+escapeHtml(v.title)+'</h4><div class="page-sub">'+v.date+'</div>'+adminBtns+'</div></div>';
  });
  html += '</div>';
  if (cache.videos.length === 0) html += '<div class="page-sub" style="margin-top:20px;">動画がまだありません。</div>';
  return html;
}
function openVideoModal(id) {
  const v = cache.videos.find(x => x.id === id);
  const embedHtml = v.videoUrl
    ? '<div style="background:#20242a;border-radius:10px;overflow:hidden;"><iframe src="'+escapeHtml(v.videoUrl)+'" style="width:100%;aspect-ratio:16/9;border:0;display:block;" allowfullscreen></iframe></div>'
    : '<div style="background:#20242a;border-radius:10px;height:280px;display:flex;align-items:center;justify-content:center;color:#fff;flex-direction:column;gap:10px;">'+icon('play',40)+'<div style="font-size:12px;opacity:.75;">動画URLが未設定です</div></div>';
  showModal('<h2>'+escapeHtml(v.title)+'</h2><div class="modal-meta"><span class="tag blue">'+v.cat+'</span><span class="tag">'+v.date+'</span><span class="tag">'+v.dur+'</span></div>'
    + embedHtml
    + '<div class="hint-box">動画はまいさんがYouTube／Vimeoにアップロードして限定公開URLを登録すると、このページに反映されます。</div>');
}
function openAddVideoModal() { openVideoFormModal(null); }
function openVideoEditModal(id) { openVideoFormModal(id); }
function openVideoFormModal(editId) {
  stagedThumb = null;
  const editing = editId ? cache.videos.find(v => v.id === editId) : null;
  showModal('<h2>' + (editing ? '動画を編集' : '動画を追加') + '</h2>'
    + '<div class="form-group"><label>タイトル</label><input type="text" id="newVidTitle" placeholder="動画タイトル" value="'+(editing?escapeHtml(editing.title):'')+'"></div>'
    + '<div class="form-group"><label>カテゴリ</label><select id="newVidCat">' + CATEGORIES.map(c => '<option value="'+c+'"'+(editing&&editing.cat===c?' selected':'')+'>'+c+'</option>').join('') + '</select></div>'
    + '<div class="form-group"><label>再生時間</label><input type="text" id="newVidDur" placeholder="例：24:30" value="'+(editing?escapeHtml(editing.dur):'')+'"></div>'
    + '<div class="form-group"><label>YouTube／Vimeoの限定公開URL（埋め込み用）</label><input type="url" id="newVidUrl" placeholder="https://..." value="'+(editing&&editing.videoUrl?escapeHtml(editing.videoUrl):'')+'"></div>'
    + thumbUploadFieldHTML('newVidThumbFile', 'vidThumbPreview')
    + '<button class="btn" id="submitVidBtn" onclick="submitVideoForm('+(editId||'null')+')">'+(editing?'保存する':'動画を追加する')+'</button>');
}
async function submitVideoForm(editId) {
  const title = document.getElementById('newVidTitle').value.trim();
  const cat = document.getElementById('newVidCat').value;
  const dur = document.getElementById('newVidDur').value.trim() || '--:--';
  const videoUrl = document.getElementById('newVidUrl').value.trim();
  if (!title) { alert('タイトルを入力してください。'); return; }

  const btn = document.getElementById('submitVidBtn');
  btn.disabled = true; btn.textContent = editId ? '保存中...' : '追加中...';
  try {
    let thumbKey = null;
    if (stagedThumb) { thumbKey = (await uploadFile(stagedThumb.file, 'thumbs')).key; }
    if (editId) { await api.put('/api/videos/' + editId, { cat, title, dur, videoUrl, thumbKey }); }
    else { await api.post('/api/videos', { cat, title, dur, videoUrl, thumbKey }); }
    closeModal();
    cache.videos = (await api.get('/api/videos')).videos;
    render();
    showToast(editId ? '動画を更新しました' : '動画を追加しました');
  } catch (e) {
    alert((editId?'動画の更新':'動画の追加') + 'に失敗しました: ' + e.message);
    btn.disabled = false; btn.textContent = editId ? '保存する' : '動画を追加する';
  }
}
async function deleteVideo(id) {
  if (!confirm('この動画を削除します。よろしいですか？')) return;
  try {
    await api.del('/api/videos/' + id);
    cache.videos = (await api.get('/api/videos')).videos;
    render();
    showToast('動画を削除しました');
  } catch (e) { showToast('削除に失敗しました: ' + e.message); }
}

/* =======================================================
   VIEW: FILES（資料ダウンロード）
======================================================= */
function viewFiles() {
  let html = '<div class="page-head"><div class="page-title">資料ダウンロード</div><div class="page-sub">PDF・Excel・Googleスプレッドシート・PSDデータをダウンロードできます。</div></div>';
  if (currentUser.role === 'admin') {
    html += '<div style="margin-bottom:16px;"><button class="btn" onclick="openAddFileModal()">'+icon('pen',13)+' 資料を追加</button></div>';
  }
  html += '<div>';
  const colorMap = { PDF: PALETTE[0], Excel: '#2e8b57', Sheet: PALETTE[2], PSD: '#5b4fc9' };
  cache.filesList.forEach(f => {
    const color = colorMap[f.type] || PALETTE[0];
    const heavy = f.type === 'PSD';
    const adminBtns = currentUser.role === 'admin'
      ? '<button class="btn secondary sm" style="margin-left:8px;" onclick="openFileEditModal('+f.id+')">'+icon('pen',14)+'</button>'
        + '<button class="btn secondary sm" style="margin-left:6px;" onclick="deleteMaterialFile('+f.id+')">'+icon('trash',14)+'</button>' : '';
    html += '<div class="file-row"><div class="file-icon" style="background:'+color+';">'+f.type+'</div>'
      + '<div style="flex:1;"><div class="f-name">'+escapeHtml(f.name)+(heavy?' <span class="tag" style="margin-left:6px;">大容量</span>':'')+(f.hasPassword?' <span class="tag" style="margin-left:6px;">'+icon('paperclip',10)+' パスワード付き</span>':'')+'</div><div class="f-meta">'+f.size+' ・ '+f.date+'</div></div>'
      + '<button class="btn secondary sm" onclick="downloadMaterialFile('+f.id+',\''+escapeHtml(f.name)+'\','+(f.hasPassword?'true':'false')+')">'+icon('download',14)+' ダウンロード</button>'+adminBtns+'</div>';
  });
  html += '</div>';
  if (cache.filesList.length === 0) html += '<div class="page-sub" style="margin-top:12px;">資料がまだありません。</div>';
  html += '<div class="hint-box">PSDなど容量の大きいデータもここから直接アップロード・ダウンロードできます（Cloudflare R2に保存されます）。パスワードを設定した資料は、入力しないとダウンロードできません。</div>';
  return html;
}
function downloadMaterialFile(id, name, hasPassword) {
  const f = cache.filesList.find(x => x.id === id);
  if (!f) return;
  if (hasPassword) {
    const pw = prompt('この資料はパスワードで保護されています。パスワードを入力してください。');
    if (pw === null) return;
    window.location.href = f.downloadUrl + '?password=' + encodeURIComponent(pw);
  } else {
    window.location.href = f.downloadUrl;
  }
}
function openAddFileModal() { openFileFormModal(null); }
function openFileEditModal(id) { openFileFormModal(id); }
function openFileFormModal(editId) {
  stagedMaterialFile = null;
  const editing = editId ? cache.filesList.find(f => f.id === editId) : null;
  showModal('<h2>' + (editing ? '資料を編集' : '資料を追加') + '</h2>'
    + '<div class="form-group"><label>ファイル名（一覧に表示される名前）</label><input type="text" id="newFileName" placeholder="例：競合分析シート.xlsx" value="'+(editing?escapeHtml(editing.name):'')+'"></div>'
    + '<div class="form-group"><label>種類</label><select id="newFileType">'
      + ['PDF','Excel','Sheet','PSD'].map(t => '<option value="'+t+'"'+(editing&&editing.type===t?' selected':'')+'>'+(t==='Sheet'?'Googleスプレッドシート（リンク）':t)+'</option>').join('')
      + '</select></div>'
    + (editing ? '' : ('<div class="form-group"><label>ファイル</label>'
      + '<input type="file" id="newFileInput" style="display:none" onchange="handleMaterialFileUpload(this)">'
      + '<button class="btn secondary sm" type="button" onclick="document.getElementById(\'newFileInput\').click()">'+icon('paperclip',13)+' ファイルを選択</button>'
      + '<div id="fileMaterialPreview" class="thumb-preview"></div></div>'))
    + '<div class="form-group"><label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" id="fileUsePassword" '+(editing&&editing.hasPassword?'checked':'')+' onchange="document.getElementById(\'fileWrap\').style.display=this.checked?\'block\':\'none\'" style="width:15px;height:15px;"> パスワードを設定する</label>'
      + '<div id="fileWrap" style="display:'+(editing&&editing.hasPassword?'block':'none')+';margin-top:6px;"><input type="text" id="newFilePassword" placeholder="'+(editing?'変更する場合のみ入力（未入力なら現在のまま）':'ダウンロード時に必要なパスワード')+'"></div></div>'
    + '<button class="btn" id="submitFileBtn" onclick="submitFileForm('+(editId||'null')+')">'+(editing?'保存する':'資料を追加する')+'</button>');
}
function handleMaterialFileUpload(input) {
  const file = input.files[0];
  if (!file) return;
  stagedMaterialFile = { file };
  const preview = document.getElementById('fileMaterialPreview');
  if (preview) preview.innerHTML = '<div class="file-row" style="margin-top:8px;"><div class="file-icon" style="background:'+PALETTE[2]+';">FILE</div><div style="flex:1;"><div class="f-name">'+escapeHtml(file.name)+'</div></div></div>';
  if (!document.getElementById('newFileName').value.trim()) document.getElementById('newFileName').value = file.name;
}
async function submitFileForm(editId) {
  const name = document.getElementById('newFileName').value.trim();
  const type = document.getElementById('newFileType').value;
  if (!name) { alert('ファイル名を入力してください。'); return; }
  if (!editId && !stagedMaterialFile) { alert('ファイルを選択してください。'); return; }
  const usePassword = document.getElementById('fileUsePassword').checked;
  const pwInput = document.getElementById('newFilePassword').value;
  if (!editId && usePassword && !pwInput) { alert('パスワードを入力してください。'); return; }
  const btn = document.getElementById('submitFileBtn');
  btn.disabled = true; btn.textContent = editId ? '保存中...' : '追加中...';
  try {
    if (editId) {
      const payload = { name, type };
      if (!usePassword) { payload.password = ''; }
      else if (pwInput) { payload.password = pwInput; }
      await api.put('/api/files-list/' + editId, payload);
    } else {
      const uploaded = await uploadFile(stagedMaterialFile.file, 'materials');
      await api.post('/api/files-list', { name, type, size: uploaded.size, storageKey: uploaded.key, password: usePassword ? pwInput : '' });
    }
    closeModal();
    cache.filesList = (await api.get('/api/files-list')).files;
    render();
    showToast(editId ? '資料を更新しました' : '資料を追加しました');
  } catch (e) {
    alert((editId?'資料の更新':'資料の追加') + 'に失敗しました: ' + e.message);
    btn.disabled = false; btn.textContent = editId ? '保存する' : '資料を追加する';
  }
}
async function deleteMaterialFile(id) {
  if (!confirm('この資料を削除します。よろしいですか？')) return;
  try {
    await api.del('/api/files-list/' + id);
    cache.filesList = (await api.get('/api/files-list')).files;
    render();
    showToast('資料を削除しました');
  } catch (e) { showToast('削除に失敗しました: ' + e.message); }
}

/* =======================================================
   VIEW: LP分析課題
======================================================= */
function statusLabel(s) { return s === 'submitted' ? '提出済み' : s === 'in_progress' ? '回答中' : '未着手'; }

function viewAnalysisList() {
  let html = '<div class="page-head"><div class="page-title">LP分析課題</div><div class="page-sub">実際の通販LPを読み解き、なぜそのデザインなのかを言語化する練習です。</div></div>';
  if (currentUser.role === 'admin') {
    html += '<div style="margin-bottom:16px;"><button class="btn" onclick="openAddAssignmentModal()">'+icon('pen',13)+' LP分析課題を追加</button></div>';
  }
  html += '<div class="grid cols-3 assignment-grid">';
  cache.assignments.forEach(a => {
    html += '<div class="assignment-card" style="--accent:'+rgba(PALETTE[a.seed%3],.4)+';" onclick="openAnalysis('+a.id+')">'+(a.thumb?'<img src="'+a.thumb+'" style="width:100%;aspect-ratio:1280/670;object-fit:cover;display:block;">':mockLP(a.seed,false));
    html += '<div class="asg-body"><h4 style="font-size:14px;margin-bottom:4px;">'+escapeHtml(a.title)+'　'+escapeHtml(a.label)+'</h4><p style="font-size:11.5px;color:var(--sub);line-height:1.6;">'+linkifyHtml(a.desc)+'</p>';
    if (currentUser.role === 'admin') {
      const st = cache.assignmentStatus[a.id];
      html += '<div class="asg-status-row"><span class="tag blue">'+(st?st.submittedCount:'-')+' / '+(st?st.total:'-')+'人 提出済み</span></div>';
      html += '<div class="admin-card-actions" style="display:flex;gap:6px;margin-top:8px;">'
        + '<button class="btn secondary sm" onclick="event.stopPropagation();openAssignmentEditModal('+a.id+')">'+icon('pen',12)+' 編集</button>'
        + '<button class="btn secondary sm" onclick="event.stopPropagation();deleteAssignment('+a.id+')">'+icon('trash',12)+' 削除</button></div>';
    } else {
      html += '<div class="asg-status-row"><span class="tag'+(a.submitted?' blue':'')+'">'+(a.submitted?'提出済み':'未提出')+'</span></div>';
    }
    html += '</div></div>';
  });
  html += '</div>';
  if (cache.assignments.length === 0) html += '<div class="page-sub" style="margin-top:20px;">課題がまだありません。</div>';
  return html;
}
function openAnalysis(id) { state.selectedAssignmentId = id; appNav('analysisDetail'); }
function openAddAssignmentModal() { openAssignmentFormModal(null); }
function openAssignmentEditModal(id) { openAssignmentFormModal(id); }
function openAssignmentFormModal(editId) {
  stagedThumb = null;
  const editing = editId ? cache.assignments.find(a => a.id === editId) : null;
  const nextNum = cache.assignments.length + 1;
  showModal('<h2>' + (editing ? 'LP分析課題を編集' : 'LP分析課題を追加') + '</h2>'
    + '<div class="form-group"><label>課題名</label><input type="text" id="newAsgTitle" placeholder="課題'+nextNum+'（未入力の場合は自動で採番されます）" value="'+(editing?escapeHtml(editing.title):'')+'"></div>'
    + '<div class="form-group"><label>LP名（ラベル）</label><input type="text" id="newAsgLabel" placeholder="例：化粧品LP" value="'+(editing?escapeHtml(editing.label):'')+'"></div>'
    + '<div class="form-group"><label>分析してもらいたいLPのURL</label><input type="url" id="newAsgUrl" placeholder="https://..." value="'+(editing?escapeHtml(editing.url||''):'')+'"></div>'
    + '<div class="form-group"><label>説明文</label><textarea id="newAsgDesc" placeholder="どんな観点で見てほしいか、補足があれば書いてください">'+(editing?escapeHtml(editing.desc):'')+'</textarea></div>'
    + thumbUploadFieldHTML('newAsgThumbFile', 'asgThumbPreview')
    + '<button class="btn" id="submitAsgBtn" onclick="submitAssignmentForm('+(editId||'null')+')">'+(editing?'保存する':'課題を追加する')+'</button>');
}
async function submitAssignmentForm(editId) {
  const label = document.getElementById('newAsgLabel').value.trim();
  const url = document.getElementById('newAsgUrl').value.trim();
  const desc = document.getElementById('newAsgDesc').value.trim();
  const title = document.getElementById('newAsgTitle').value.trim();
  if (!label || !url) { alert('LP名とURLを入力してください。'); return; }
  const btn = document.getElementById('submitAsgBtn');
  btn.disabled = true; btn.textContent = editId ? '保存中...' : '追加中...';
  try {
    let thumbKey = null;
    if (stagedThumb) { thumbKey = (await uploadFile(stagedThumb.file, 'thumbs')).key; }
    if (editId) { await api.put('/api/assignments/' + editId, { title, label, desc, url, thumbKey }); }
    else { await api.post('/api/assignments', { title, label, desc, url, thumbKey }); }
    closeModal();
    cache.assignments = (await api.get('/api/assignments')).assignments;
    render();
    showToast(editId ? '課題を更新しました' : '課題を追加しました');
  } catch (e) {
    alert((editId?'課題の更新':'課題の追加') + 'に失敗しました: ' + e.message);
    btn.disabled = false; btn.textContent = editId ? '保存する' : '課題を追加する';
  }
}
async function deleteAssignment(id) {
  if (!confirm('この課題を削除します。よろしいですか？（受講生の回答も削除されます）')) return;
  try {
    await api.del('/api/assignments/' + id);
    cache.assignments = (await api.get('/api/assignments')).assignments;
    render();
    showToast('課題を削除しました');
  } catch (e) { showToast('削除に失敗しました: ' + e.message); }
}
function viewAnalysisDetail() {
  const a = cache.assignments.find(x => x.id === state.selectedAssignmentId);
  if (!a) return '<div class="page-sub">課題が見つかりません。</div>';
  let html = '<div class="back-link" onclick="appNav(\'analysis\')">'+icon('back',15)+' 課題一覧にもどる</div>';

  html += '<div class="card mb14"><div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;">';
  html += '<div style="width:220px;flex-shrink:0;">'+(a.thumb?'<img src="'+a.thumb+'" style="width:100%;aspect-ratio:1280/670;object-fit:cover;border-radius:9px;display:block;">':mockLP(a.seed,true))+'</div>';
  html += '<div style="flex:1;min-width:220px;"><div class="page-title" style="margin-bottom:8px;">'+escapeHtml(a.title)+'　'+escapeHtml(a.label)+'</div><div class="page-sub" style="margin-bottom:14px;">'+linkifyHtml(a.desc)+'</div>';
  if (a.url) {
    html += '<a href="'+escapeHtml(a.url)+'" target="_blank" rel="noopener" class="btn secondary sm" style="margin-bottom:14px;" onclick="event.stopPropagation()">'+icon('paperclip',13)+' 分析するLPを見る</a><br>';
  }

  const readonly = currentUser.role === 'admin';
  if (readonly) {
    const targetId = state.analysisAdminStudent || (cache.students[0] && cache.students[0].id);
    html += '<div class="chip-row" style="margin-bottom:10px;">' + cache.students.map(s => '<div class="chip'+(targetId===s.id?' active':'')+'" onclick="switchAnalysisStudent('+s.id+')">'+s.name+'</div>').join('') + '</div>';
    html += '<span class="tag'+(cache.currentSubmitted?' blue':'')+'">'+(cache.currentSubmitted?'提出済み':'未提出')+'</span>';
  } else {
    html += '<span class="tag'+(cache.currentSubmitted?' blue':'')+'">'+(cache.currentSubmitted?'提出済み':'未提出')+'</span>';
  }
  html += '</div></div></div>';

  html += renderAnalysisSections(a.id, readonly);

  if (!readonly) {
    html += '<div style="display:flex;gap:10px;margin-top:6px;">'
      + '<button class="btn secondary" id="saveDraftBtn" onclick="saveAnalysisDraft('+a.id+')">下書きを保存</button>'
      + '<button class="btn" onclick="submitAnalysis('+a.id+')">提出する</button>'
      + '</div>';
  }
  return html;
}
function renderAnalysisSections(assignmentId, readonly) {
  const answers = cache.currentAnswers || {};
  let html = '';
  QUESTION_SECTIONS.forEach((sec, si) => {
    html += '<details class="qsection"'+(si===0?' open':'')+'><summary>'+sec.title+'</summary><div class="q-body">';
    sec.questions.forEach((q, qi) => {
      const qKey = 's' + si + 'q' + qi;
      const val = answers[qKey] || '';
      html += '<div class="q-item"><div class="q-text">'+q+'</div>';
      if (readonly) {
        html += val.trim() ? '<div class="q-answer">'+linkifyHtml(val)+'</div>' : '<div class="q-answer empty">未回答</div>';
      } else {
        html += '<textarea id="ans_'+assignmentId+'_'+qKey+'" oninput="updateAnswerDraft('+assignmentId+',\''+qKey+'\',this.value)" placeholder="考えたことを書いてみましょう">'+escapeHtml(val)+'</textarea>';
      }
      html += '</div>';
    });
    html += '</div></details>';
  });
  return html;
}
const answerSaveTimers = {};
function updateAnswerDraft(assignmentId, qKey, value) {
  cache.currentAnswers[qKey] = value;
  const timerKey = assignmentId + '_' + qKey;
  clearTimeout(answerSaveTimers[timerKey]);
  answerSaveTimers[timerKey] = setTimeout(() => {
    api.post('/api/assignments/' + assignmentId + '/answers', { qKey, value }).catch(() => {
      showToast('回答の保存に失敗しました。通信状態をご確認ください。');
    });
  }, 700);
}
async function saveAnalysisDraft(assignmentId) {
  const btn = document.getElementById('saveDraftBtn');
  if (btn) { btn.disabled = true; btn.textContent = '保存中...'; }
  try {
    const entries = Object.entries(cache.currentAnswers || {});
    await Promise.all(entries.map(([qKey, value]) => api.post('/api/assignments/' + assignmentId + '/answers', { qKey, value })));
    showToast('下書きを保存しました');
  } catch (e) {
    showToast('保存に失敗しました: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '下書きを保存'; }
  }
}
async function submitAnalysis(assignmentId) {
  try {
    await api.post('/api/assignments/' + assignmentId + '/submit');
    cache.currentSubmitted = true;
    const a = cache.assignments.find(x => x.id === assignmentId);
    if (a) a.submitted = true;
    fireConfetti();
    alert('提出しました。まいさんに通知されます。');
    render();
  } catch (e) { alert('提出に失敗しました: ' + e.message); }
}
async function switchAnalysisStudent(id) {
  state.analysisAdminStudent = id;
  render();
  const res = await api.get('/api/assignments/' + state.selectedAssignmentId + '/answers?studentId=' + id);
  cache.currentAnswers = res.answers; cache.currentSubmitted = res.submitted;
  render();
}

/* =======================================================
   VIEW: 写真・補正課題
======================================================= */
function viewPhotoTaskList() {
  let html = '<div class="page-head"><div class="page-title">写真・補正課題</div><div class="page-sub">配布されたPSDデータをダウンロードして補正・合成し、完成データを提出する課題です。</div></div>';
  if (currentUser.role === 'admin') {
    html += '<div style="margin-bottom:16px;"><button class="btn" onclick="openAddPhotoTaskModal()">'+icon('pen',13)+' 写真・補正課題を追加</button></div>';
  }
  html += '<div class="grid cols-3 assignment-grid">';
  cache.photoTasks.forEach(t => {
    html += '<div class="assignment-card" style="--accent:'+rgba(PALETTE[t.seed%3],.4)+';" onclick="openPhotoTask('+t.id+')">'+(t.thumb?'<img src="'+t.thumb+'" style="width:100%;aspect-ratio:1280/670;object-fit:cover;display:block;">':mockPhotoThumb(t.seed));
    html += '<div class="asg-body"><h4 style="font-size:14px;margin-bottom:4px;">'+escapeHtml(t.title)+'　'+escapeHtml(t.label)+'</h4><p style="font-size:11.5px;color:var(--sub);line-height:1.6;">'+linkifyHtml(t.desc)+'</p>';
    if (currentUser.role === 'admin') {
      const st = cache.photoTaskStatus[t.id];
      html += '<div class="asg-status-row"><span class="tag blue">'+(st?st.submittedCount:'-')+' / '+(st?st.total:'-')+'人 提出済み</span></div>';
      html += '<div class="admin-card-actions" style="display:flex;gap:6px;margin-top:8px;">'
        + '<button class="btn secondary sm" onclick="event.stopPropagation();openPhotoTaskEditModal('+t.id+')">'+icon('pen',12)+' 編集</button>'
        + '<button class="btn secondary sm" onclick="event.stopPropagation();deletePhotoTask('+t.id+')">'+icon('trash',12)+' 削除</button></div>';
    } else {
      html += '<div class="asg-status-row"><span class="tag'+(t.submitted?' blue':'')+'">'+(t.submitted?'提出済み':'未提出')+'</span></div>';
    }
    html += '</div></div>';
  });
  html += '</div>';
  if (cache.photoTasks.length === 0) html += '<div class="page-sub" style="margin-top:20px;">課題がまだありません。</div>';
  return html;
}
function openPhotoTask(id) { state.selectedPhotoTaskId = id; appNav('photoTaskDetail'); }

function handlePsdFileUpload(input) {
  const file = input.files[0];
  if (!file) return;
  stagedPsdFile = { file };
  const preview = document.getElementById('photoFilePreview');
  if (preview) preview.innerHTML = '<div class="file-row" style="margin-top:8px;"><div class="file-icon" style="background:#5b4fc9;">PSD</div><div style="flex:1;"><div class="f-name">'+escapeHtml(file.name)+'</div></div></div>';
}
function openAddPhotoTaskModal() { openPhotoTaskFormModal(null); }
function openPhotoTaskEditModal(id) { openPhotoTaskFormModal(id); }
function openPhotoTaskFormModal(editId) {
  stagedThumb = null; stagedPsdFile = null;
  const editing = editId ? cache.photoTasks.find(t => t.id === editId) : null;
  const nextNum = cache.photoTasks.length + 1;
  showModal('<h2>' + (editing ? '写真・補正課題を編集' : '写真・補正課題を追加') + '</h2>'
    + '<div class="form-group"><label>課題名</label><input type="text" id="newPhotoTitle" placeholder="補正課題'+nextNum+'（未入力の場合は自動で採番されます）" value="'+(editing?escapeHtml(editing.title):'')+'"></div>'
    + '<div class="form-group"><label>課題ラベル</label><input type="text" id="newPhotoLabel" placeholder="例：商品写真の色補正" value="'+(editing?escapeHtml(editing.label):'')+'"></div>'
    + '<div class="form-group"><label>説明文</label><textarea id="newPhotoDesc" placeholder="どんな補正・作業をしてほしいか説明してください">'+(editing?escapeHtml(editing.desc):'')+'</textarea></div>'
    + '<div class="form-group"><label>課題データ（PSDファイルなど）'+(editing?'　<span style="font-size:11px;color:var(--sub);">現在: '+escapeHtml(editing.fileName||'未設定')+'（変更する場合のみ選択）</span>':'')+'</label>'
    + '<input type="file" id="newPhotoFile" style="display:none" onchange="handlePsdFileUpload(this)">'
    + '<button class="btn secondary sm" type="button" onclick="document.getElementById(\'newPhotoFile\').click()">'+icon('paperclip',13)+' ファイルを選択</button>'
    + '<div id="photoFilePreview" class="thumb-preview"></div></div>'
    + thumbUploadFieldHTML('newPhotoThumbFile', 'photoThumbPreview')
    + '<button class="btn" id="submitPhotoTaskBtn" onclick="submitPhotoTaskForm('+(editId||'null')+')">'+(editing?'保存する':'課題を追加する')+'</button>');
}
async function submitPhotoTaskForm(editId) {
  const label = document.getElementById('newPhotoLabel').value.trim();
  const desc = document.getElementById('newPhotoDesc').value.trim();
  const title = document.getElementById('newPhotoTitle').value.trim();
  if (!label || !desc) { alert('課題ラベルと説明文を入力してください。'); return; }
  const btn = document.getElementById('submitPhotoTaskBtn');
  btn.disabled = true; btn.textContent = editId ? '保存中...' : '追加中...';
  try {
    let fileKey = null, fileName = null, fileSize = null;
    if (stagedPsdFile) {
      const uploaded = await uploadFile(stagedPsdFile.file, 'psd');
      fileKey = uploaded.key; fileName = uploaded.name; fileSize = uploaded.size;
    }
    let thumbKey = null;
    if (stagedThumb) { thumbKey = (await uploadFile(stagedThumb.file, 'thumbs')).key; }
    if (editId) { await api.put('/api/photo-tasks/' + editId, { title, label, desc, fileKey, fileName, fileSize, thumbKey }); }
    else { await api.post('/api/photo-tasks', { title, label, desc, fileKey, fileName, fileSize, thumbKey }); }
    closeModal();
    cache.photoTasks = (await api.get('/api/photo-tasks')).tasks;
    render();
    showToast(editId ? '課題を更新しました' : '課題を追加しました');
  } catch (e) {
    alert((editId?'課題の更新':'課題の追加') + 'に失敗しました: ' + e.message);
    btn.disabled = false; btn.textContent = editId ? '保存する' : '課題を追加する';
  }
}
async function deletePhotoTask(id) {
  if (!confirm('この課題を削除します。よろしいですか？（受講生の提出物も削除されます）')) return;
  try {
    await api.del('/api/photo-tasks/' + id);
    cache.photoTasks = (await api.get('/api/photo-tasks')).tasks;
    render();
    showToast('課題を削除しました');
  } catch (e) { showToast('削除に失敗しました: ' + e.message); }
}

function handleSubmissionFileUpload(input) {
  const file = input.files[0];
  if (!file) return;
  stagedSubmissionFile = { file };
  const preview = document.getElementById('subFilePreview');
  if (preview) preview.innerHTML = '<div class="file-row" style="margin-top:8px;"><div class="file-icon" style="background:'+PALETTE[2]+';">FILE</div><div style="flex:1;"><div class="f-name">'+escapeHtml(file.name)+'</div></div></div>';
}
async function submitPhotoWork(taskId) {
  if (!stagedSubmissionFile) { alert('提出するファイルを選択してください。'); return; }
  const commentEl = document.getElementById('submitPhotoComment');
  const btn = document.getElementById('submitPhotoWorkBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'アップロード中...'; }
  try {
    const uploaded = await uploadFile(stagedSubmissionFile.file, 'submissions');
    await api.post('/api/photo-tasks/' + taskId + '/submission', {
      fileKey: uploaded.key, fileName: uploaded.name, size: uploaded.size,
      comment: commentEl ? commentEl.value.trim() : '',
    });
    stagedSubmissionFile = null;
    fireConfetti();
    alert('提出しました。まいさんに通知されます。');
    cache.currentPhotoSubmission = (await api.get('/api/photo-tasks/' + taskId + '/submission')).submission;
    const t = cache.photoTasks.find(x => x.id === taskId);
    if (t) t.submitted = true;
    render();
  } catch (e) {
    alert('提出に失敗しました: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = '提出する'; }
  }
}
async function switchPhotoStudent(id) {
  state.photoAdminStudent = id;
  render();
  const res = await api.get('/api/photo-tasks/' + state.selectedPhotoTaskId + '/submission?studentId=' + id);
  cache.currentPhotoSubmission = res.submission;
  render();
}
function viewPhotoTaskDetail() {
  const t = cache.photoTasks.find(x => x.id === state.selectedPhotoTaskId);
  if (!t) return '<div class="page-sub">課題が見つかりません。</div>';
  let html = '<div class="back-link" onclick="appNav(\'photoTask\')">'+icon('back',15)+' 課題一覧にもどる</div>';

  html += '<div class="card mb14"><div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;">';
  html += '<div style="width:220px;flex-shrink:0;">'+(t.thumb?'<img src="'+t.thumb+'" style="width:100%;aspect-ratio:1280/670;object-fit:cover;border-radius:9px;display:block;">':mockPhotoThumb(t.seed))+'</div>';
  html += '<div style="flex:1;min-width:220px;"><div class="page-title" style="margin-bottom:8px;">'+escapeHtml(t.title)+'　'+escapeHtml(t.label)+'</div><div class="page-sub" style="margin-bottom:14px;">'+linkifyHtml(t.desc)+'</div>';
  html += '<div class="file-row" style="margin-bottom:6px;"><div class="file-icon" style="background:#5b4fc9;">PSD</div><div style="flex:1;"><div class="f-name">'+escapeHtml(t.fileName)+'</div><div class="f-meta">'+t.fileSize+'</div></div>'
    + (t.fileUrl ? '<a class="btn secondary sm" href="'+t.fileUrl+'" download="'+escapeHtml(t.fileName)+'" onclick="event.stopPropagation()">'+icon('download',14)+' ダウンロード</a>' : '')
    + '</div>';

  const readonly = currentUser.role === 'admin';
  if (readonly) {
    const targetId = state.photoAdminStudent || (cache.students[0] && cache.students[0].id);
    html += '<div class="chip-row" style="margin:10px 0;">' + cache.students.map(s => '<div class="chip'+(targetId===s.id?' active':'')+'" onclick="switchPhotoStudent('+s.id+')">'+s.name+'</div>').join('') + '</div>';
  }
  const submitted = readonly ? !!cache.currentPhotoSubmission : t.submitted;
  html += '<span class="tag'+(submitted?' blue':'')+'">'+(submitted?'提出済み':'未提出')+'</span>';
  html += '</div></div></div>';

  if (readonly) {
    const sub = cache.currentPhotoSubmission;
    html += '<div class="card"><div class="section-title">提出物の確認</div>';
    if (sub) {
      html += '<div class="file-row"><div class="file-icon" style="background:'+PALETTE[2]+';">FILE</div><div style="flex:1;"><div class="f-name">'+escapeHtml(sub.fileName)+'</div><div class="f-meta">'+sub.size+' ・ '+sub.submittedAt+'提出</div></div>'
        + '<a class="btn secondary sm" href="'+sub.fileUrl+'" download="'+escapeHtml(sub.fileName)+'">'+icon('download',14)+' ダウンロード</a></div>';
      if (sub.comment) html += '<div class="page-sub" style="margin-top:8px;">コメント：'+escapeHtml(sub.comment)+'</div>';
    } else {
      html += '<div class="page-sub">まだ提出がありません。</div>';
    }
    html += '</div>';
  } else {
    const sub = cache.currentPhotoSubmission;
    html += '<div class="card"><div class="section-title">完成データを提出する</div>';
    if (sub) {
      html += '<div class="file-row"><div class="file-icon" style="background:'+PALETTE[2]+';">FILE</div><div style="flex:1;"><div class="f-name">'+escapeHtml(sub.fileName)+'</div><div class="f-meta">'+sub.size+' ・ '+sub.submittedAt+'提出</div></div></div>';
      if (sub.comment) html += '<div class="page-sub" style="margin-top:8px;">コメント：'+escapeHtml(sub.comment)+'</div>';
      html += '<div class="hint-box" style="margin-top:10px;">提出済みです。再提出すると上書きされます。</div>';
    }
    html += '<div class="form-group" style="margin-top:12px;"><label>完成データをアップロード</label>'
      + '<input type="file" id="submitPhotoFile" style="display:none" onchange="handleSubmissionFileUpload(this)">'
      + '<button class="btn secondary sm" type="button" onclick="document.getElementById(\'submitPhotoFile\').click()">'+icon('paperclip',13)+' ファイルを選択</button>'
      + '<div id="subFilePreview" class="thumb-preview"></div></div>'
      + '<div class="form-group"><label>コメント（任意）</label><textarea id="submitPhotoComment" placeholder="工夫した点や悩んだ点など"></textarea></div>'
      + '<button class="btn" id="submitPhotoWorkBtn" onclick="submitPhotoWork('+t.id+')">提出する</button>';
    html += '</div>';
  }
  return html;
}

/* =======================================================
   VIEW: GALLERY / ZUKAN（管理画面から追加・編集・削除できます）
======================================================= */
function viewGallery() {
  let html = '<div class="page-head"><div class="page-title">ギャラリー部屋</div><div class="page-sub">まいさんが手がけたデザインを自由に見られる部屋です。</div></div>';
  if (currentUser.role === 'admin') {
    html += '<div style="margin-bottom:16px;"><button class="btn" onclick="openGalleryFormModal(null)">'+icon('pen',13)+' 作品を追加</button></div>';
  }
  html += '<div class="grid cols-3">';
  cache.gallery.forEach((g, i) => {
    const adminBtns = currentUser.role === 'admin'
      ? '<div class="admin-card-actions" style="display:flex;gap:6px;margin-top:8px;">'
        + '<button class="btn secondary sm" onclick="event.stopPropagation();openGalleryFormModal('+g.id+')">'+icon('pen',12)+' 編集</button>'
        + '<button class="btn secondary sm" onclick="event.stopPropagation();deleteGalleryItem('+g.id+')">'+icon('trash',12)+' 削除</button></div>'
      : '';
    html += '<div class="gallery-card" onclick="openGalleryDetail('+g.id+')" style="--accent:'+rgba(PALETTE[i%3],.4)+';">'+(g.thumb?'<div class="thumb-box"><img src="'+g.thumb+'"></div>':mockLP(i,false))+'<div class="g-body"><span class="tag">'+escapeHtml(g.tag)+'</span><h4 style="font-size:13px;margin-top:8px;">'+escapeHtml(g.title)+'</h4>'+(g.images&&g.images.length>1?'<div class="page-sub" style="margin-top:4px;">画像'+g.images.length+'枚</div>':'')+adminBtns+'</div></div>';
  });
  html += '</div>';
  if (cache.gallery.length === 0) html += '<div class="page-sub" style="margin-top:20px;">作品がまだありません。</div>';
  return html;
}
function openGalleryDetail(id) {
  const g = cache.gallery.find(x => x.id === id);
  if (!g) return;
  const imgs = (g.images && g.images.length) ? g.images : (g.thumb ? [g.thumb] : []);
  showModal('<h2>'+escapeHtml(g.title)+'</h2><div class="modal-meta"><span class="tag">'+escapeHtml(g.tag)+'</span></div>'
    + '<div class="lightbox-stack">' + imgs.map(u => '<img src="'+u+'">').join('') + '</div>');
}
function openGalleryFormModal(editId) {
  stagedMultiImages = [];
  const editing = editId ? cache.gallery.find(g => g.id === editId) : null;
  if (editing) {
    const imgs = (editing.images && editing.images.length) ? editing.images : (editing.thumb ? [editing.thumb] : []);
    stagedMultiImages = imgs.map(url => ({ existingKey: keyFromFileUrl(url), url }));
  }
  showModal('<h2>' + (editing ? '作品を編集' : '作品を追加') + '</h2>'
    + '<div class="form-group"><label>タイトル</label><input type="text" id="newGalTitle" placeholder="例：化粧品LP／美容液" value="'+(editing?escapeHtml(editing.title):'')+'"></div>'
    + '<div class="form-group"><label>タグ（業種など）</label><input type="text" id="newGalTag" placeholder="例：化粧品" value="'+(editing?escapeHtml(editing.tag):'')+'"></div>'
    + multiImageUploadFieldHTML('newGalImgFile', 'galImgPreview', 10)
    + '<button class="btn" id="submitGalBtn" onclick="submitGalleryForm('+(editId||'null')+')">'+(editing?'保存する':'作品を追加する')+'</button>');
  renderMultiImagePreview('galImgPreview', 10);
}
async function submitGalleryForm(editId) {
  const title = document.getElementById('newGalTitle').value.trim();
  const tag = document.getElementById('newGalTag').value.trim();
  if (!title || !tag) { alert('タイトルとタグを入力してください。'); return; }
  if (!stagedMultiImages.length) { alert('画像を1枚以上選んでください。'); return; }
  const btn = document.getElementById('submitGalBtn');
  btn.disabled = true; btn.textContent = editId ? '保存中...' : '追加中...';
  try {
    const imageKeys = await resolveStagedImageKeys();
    if (editId) { await api.put('/api/gallery/' + editId, { title, tag, imageKeys }); }
    else { await api.post('/api/gallery', { title, tag, imageKeys }); }
    closeModal();
    cache.gallery = (await api.get('/api/gallery')).items;
    render();
    showToast(editId ? '作品を更新しました' : '作品を追加しました');
  } catch (e) {
    alert((editId?'更新':'追加') + 'に失敗しました: ' + e.message);
    btn.disabled = false; btn.textContent = editId ? '保存する' : '作品を追加する';
  }
}
async function deleteGalleryItem(id) {
  if (!confirm('この作品を削除します。よろしいですか？')) return;
  try {
    await api.del('/api/gallery/' + id);
    cache.gallery = (await api.get('/api/gallery')).items;
    render();
    showToast('作品を削除しました');
  } catch (e) { showToast('削除に失敗しました: ' + e.message); }
}
function viewZukan() {
  let html = '<div class="page-head"><div class="page-title">通販デザイン図鑑</div><div class="page-sub">まいさんが良いと思ったデザインを集めて解説しています。</div></div>';
  if (currentUser.role === 'admin') {
    html += '<div style="margin-bottom:16px;"><button class="btn" onclick="openZukanFormModal(null)">'+icon('pen',13)+' 事例を追加</button></div>';
  }
  html += '<div class="grid cols-2">';
  cache.zukan.forEach((z, i) => {
    const adminBtns = currentUser.role === 'admin'
      ? '<div class="admin-card-actions" style="display:flex;gap:6px;margin-top:8px;">'
        + '<button class="btn secondary sm" onclick="event.stopPropagation();openZukanFormModal('+z.id+')">'+icon('pen',12)+' 編集</button>'
        + '<button class="btn secondary sm" onclick="event.stopPropagation();deleteZukanItem('+z.id+')">'+icon('trash',12)+' 削除</button></div>'
      : '';
    html += '<div class="zukan-card" onclick="openZukanDetail('+z.id+')" style="--accent:'+rgba(PALETTE[(i+1)%3],.4)+';"><div style="padding:14px;">'+(z.thumb?'<div class="thumb-box" style="border-radius:9px;"><img src="'+z.thumb+'"></div>':mockLP(i+1,true))+'<div class="z-body" style="padding:0;"><h4 style="font-size:14px;margin-top:12px;">'+escapeHtml(z.title)+'</h4><div class="z-comment">'+linkifyHtml(z.comment)+'</div>'+(z.images&&z.images.length>1?'<div class="page-sub" style="margin-top:4px;">画像'+z.images.length+'枚</div>':'')+adminBtns+'</div></div></div>';
  });
  html += '</div>';
  if (cache.zukan.length === 0) html += '<div class="page-sub" style="margin-top:20px;">事例がまだありません。</div>';
  return html;
}
function openZukanDetail(id) {
  const z = cache.zukan.find(x => x.id === id);
  if (!z) return;
  const imgs = (z.images && z.images.length) ? z.images : (z.thumb ? [z.thumb] : []);
  const linkHtml = z.linkUrl ? '<a href="'+escapeHtml(z.linkUrl)+'" target="_blank" rel="noopener" class="btn secondary sm" style="margin-bottom:14px;" onclick="event.stopPropagation()">'+icon('paperclip',13)+' LPを見る</a><br>' : '';
  showModal('<h2>'+escapeHtml(z.title)+'</h2>' + linkHtml
    + '<div class="z-comment" style="margin-bottom:14px;">'+linkifyHtml(z.comment)+'</div>'
    + '<div class="lightbox-stack">' + imgs.map(u => '<img src="'+u+'">').join('') + '</div>');
}
function openZukanFormModal(editId) {
  stagedMultiImages = [];
  const editing = editId ? cache.zukan.find(z => z.id === editId) : null;
  if (editing) {
    const imgs = (editing.images && editing.images.length) ? editing.images : (editing.thumb ? [editing.thumb] : []);
    stagedMultiImages = imgs.map(url => ({ existingKey: keyFromFileUrl(url), url }));
  }
  showModal('<h2>' + (editing ? '事例を編集' : '事例を追加') + '</h2>'
    + '<div class="form-group"><label>タイトル</label><input type="text" id="newZukTitle" placeholder="例：化粧品LP" value="'+(editing?escapeHtml(editing.title):'')+'"></div>'
    + '<div class="form-group"><label>解説コメント</label><textarea id="newZukComment" placeholder="デザインの良い点を解説してください">'+(editing?escapeHtml(editing.comment):'')+'</textarea></div>'
    + '<div class="form-group"><label>参考LPのURL（任意）</label><input type="text" id="newZukUrl" placeholder="https://..." value="'+(editing&&editing.linkUrl?escapeHtml(editing.linkUrl):'')+'"></div>'
    + multiImageUploadFieldHTML('newZukImgFile', 'zukImgPreview', 10)
    + '<button class="btn" id="submitZukBtn" onclick="submitZukanForm('+(editId||'null')+')">'+(editing?'保存する':'事例を追加する')+'</button>');
  renderMultiImagePreview('zukImgPreview', 10);
}
async function submitZukanForm(editId) {
  const title = document.getElementById('newZukTitle').value.trim();
  const comment = document.getElementById('newZukComment').value.trim();
  const linkUrl = document.getElementById('newZukUrl').value.trim();
  if (!title || !comment) { alert('タイトルと解説コメントを入力してください。'); return; }
  if (!stagedMultiImages.length) { alert('画像を1枚以上選んでください。'); return; }
  const btn = document.getElementById('submitZukBtn');
  btn.disabled = true; btn.textContent = editId ? '保存中...' : '追加中...';
  try {
    const imageKeys = await resolveStagedImageKeys();
    if (editId) { await api.put('/api/zukan/' + editId, { title, comment, imageKeys, linkUrl }); }
    else { await api.post('/api/zukan', { title, comment, imageKeys, linkUrl }); }
    closeModal();
    cache.zukan = (await api.get('/api/zukan')).items;
    render();
    showToast(editId ? '事例を更新しました' : '事例を追加しました');
  } catch (e) {
    alert((editId?'更新':'追加') + 'に失敗しました: ' + e.message);
    btn.disabled = false; btn.textContent = editId ? '保存する' : '事例を追加する';
  }
}
async function deleteZukanItem(id) {
  if (!confirm('この事例を削除します。よろしいですか？')) return;
  try {
    await api.del('/api/zukan/' + id);
    cache.zukan = (await api.get('/api/zukan')).items;
    render();
    showToast('事例を削除しました');
  } catch (e) { showToast('削除に失敗しました: ' + e.message); }
}

/* =======================================================
   VIEW: ADMIN DASHBOARD
======================================================= */
function viewAdmin() {
  const stats = cache.adminStats;
  let html = '<div class="page-head"><div class="page-title">管理画面</div><div class="page-sub">受講生の状況をまとめて確認できます。</div></div>';
  html += '<div class="grid cols-4 stat-row">'
    + statCard(stats ? stats.studentCount : '-', '受講生数', PALETTE[2], 'user')
    + statCard(stats ? stats.todaySubmitRate + '%' : '-', '本日の日報提出率', PALETTE[0], 'percent')
    + statCard(stats ? stats.fileCount : '-', '公開中の資料数', PALETTE[1], 'download')
    + statCard(stats ? stats.articleThisMonth : '-', '今月公開した記事数', PALETTE[2], 'book')
    + '</div>';

  const summary = cache.reportsSummary;
  const notSubmittedIds = new Set((summary ? summary.notSubmitted : []).map(s => s.id));
  html += '<div class="card mb14"><div class="section-title">本日の日報提出状況<span class="more" onclick="appNav(\'report\')">日報管理を開く</span></div>';
  html += '<table><thead><tr><th>受講生</th><th>状況</th><th>入会日</th></tr></thead><tbody>';
  cache.students.forEach(st => {
    const done = summary ? !notSubmittedIds.has(st.id) : false;
    html += '<tr><td>'+st.name+'</td><td><span class="status-dot '+(done?'done':'pending')+'"></span>'+(done?'提出済み':'未提出')+'</td><td>'+st.joined_at+'</td></tr>';
  });
  html += '</tbody></table></div>';

  html += '<div class="card mb14"><div class="section-title">受講生アカウント<span class="more" onclick="openAddStudentModal()">＋ 受講生を招待</span></div>';
  html += '<table><thead><tr><th>氏名</th><th>メールアドレス</th><th>入会日</th><th></th></tr></thead><tbody>';
  cache.students.forEach(st => {
    html += '<tr><td>'+st.name+'</td><td>'+st.email+'</td><td>'+st.joined_at+'</td><td><button class="btn secondary sm" onclick="deleteStudent('+st.id+',\''+escapeHtml(st.name)+'\')">'+icon('trash',12)+' 削除</button></td></tr>';
  });
  html += '</tbody></table>'
    + '<div class="hint-box">「＋ 受講生を招待」で発行される仮パスワードは、まいさんがチャットやメールで本人へ直接お伝えください（一度しか表示されません）。</div></div>';

  html += '<div class="card"><div class="section-title">コンテンツ管理（簡易）</div><div class="grid cols-4">'
    + '<button class="btn secondary" onclick="openAddArticleModal()">＋ 記事を追加</button>'
    + '<button class="btn secondary" onclick="openAddVideoModal()">＋ 動画を追加</button>'
    + '<button class="btn secondary" onclick="openAddFileModal()">＋ 資料を追加</button>'
    + '<button class="btn secondary" onclick="openAddAssignmentModal()">＋ LP分析課題を追加</button>'
    + '<button class="btn secondary" onclick="openAddPhotoTaskModal()">＋ 写真・補正課題を追加</button>'
    + '<button class="btn secondary" onclick="openGalleryFormModal(null)">＋ ギャラリー作品を追加</button>'
    + '<button class="btn secondary" onclick="openZukanFormModal(null)">＋ 図鑑事例を追加</button>'
    + '</div></div>';
  return html;
}
async function deleteStudent(id, name) {
  if (!confirm((name||'この受講生')+'さんを削除します。日報・チャット・提出物もすべて削除されます。よろしいですか？')) return;
  try {
    await api.del('/api/students/' + id);
    cache.students = (await api.get('/api/students')).students;
    render();
    showToast('受講生を削除しました');
  } catch (e) { showToast('削除に失敗しました: ' + e.message); }
}
function openAddStudentModal() {
  showModal('<h2>受講生を招待</h2>'
    + '<div class="form-group"><label>氏名</label><input type="text" id="newStudentName" placeholder="例：田中 太郎"></div>'
    + '<div class="form-group"><label>メールアドレス</label><input type="email" id="newStudentEmail" placeholder="student@example.com"></div>'
    + '<button class="btn" id="submitStudentBtn" onclick="submitNewStudent()">アカウントを発行する</button>');
}
async function submitNewStudent() {
  const name = document.getElementById('newStudentName').value.trim();
  const email = document.getElementById('newStudentEmail').value.trim();
  if (!name || !email) { alert('氏名とメールアドレスを入力してください。'); return; }
  const btn = document.getElementById('submitStudentBtn');
  btn.disabled = true; btn.textContent = '発行中...';
  try {
    const res = await api.post('/api/students', { name, email });
    cache.students = (await api.get('/api/students')).students;
    showModal('<h2>アカウントを発行しました</h2>'
      + '<div class="page-sub" style="margin-bottom:6px;">'+escapeHtml(name)+'さん（'+escapeHtml(email)+'）の仮パスワードです。このパスワードは今だけ表示されるので、必ずコピーして本人へ伝えてください。</div>'
      + '<div class="temp-password-box">'+escapeHtml(res.tempPassword)+'</div>'
      + '<button class="btn" onclick="closeModal();appNav(\'admin\')">閉じる</button>');
  } catch (e) {
    alert('アカウントの発行に失敗しました: ' + e.message);
    btn.disabled = false; btn.textContent = 'アカウントを発行する';
  }
}

/* =======================================================
   VIEW: ANNOUNCE
======================================================= */
function viewAnnounce() {
  let html = '<div class="page-head"><div class="page-title">お知らせ</div><div class="page-sub">運営からのお知らせ一覧です。記事や動画を公開すると自動で追加されます。</div></div>';
  if (currentUser.role === 'admin') {
    html += '<div class="card mb14"><div class="form-group" style="margin-bottom:8px;"><label>お知らせを手動で追加</label><input type="text" id="newAnnounceText" placeholder="例：夏季休業のお知らせ"></div><button class="btn secondary sm" onclick="submitAnnouncement()">'+icon('pen',13)+' 追加する</button></div>';
  }
  html += '<div class="card">';
  cache.announcements.forEach(a => {
    const delBtn = currentUser.role === 'admin' ? '<button class="btn secondary sm" style="margin-left:10px;" onclick="deleteAnnouncement('+a.id+')">'+icon('trash',12)+'</button>' : '';
    html += '<div class="a-item" style="border-bottom:1px solid var(--gray);padding:12px 0;display:flex;align-items:center;"><span class="a-date">'+a.date+'</span><span style="flex:1;">'+linkifyHtml(a.text)+'</span>'+delBtn+'</div>';
  });
  if (cache.announcements.length === 0) html += '<div class="page-sub">お知らせはまだありません。</div>';
  html += '</div>';
  return html;
}
async function submitAnnouncement() {
  const input = document.getElementById('newAnnounceText');
  const text = input.value.trim();
  if (!text) { alert('お知らせの内容を入力してください。'); return; }
  try {
    await api.post('/api/announcements', { text });
    input.value = '';
    cache.announcements = (await api.get('/api/announcements')).announcements;
    render();
    showToast('お知らせを追加しました');
  } catch (e) { alert('追加に失敗しました: ' + e.message); }
}
async function deleteAnnouncement(id) {
  if (!confirm('このお知らせを削除します。よろしいですか？')) return;
  try {
    await api.del('/api/announcements/' + id);
    cache.announcements = (await api.get('/api/announcements')).announcements;
    render();
    showToast('お知らせを削除しました');
  } catch (e) { showToast('削除に失敗しました: ' + e.message); }
}

/* =======================================================
   VIEW: MYPAGE
======================================================= */
function viewMypage() {
  const s = me();
  let html = '<div class="page-head"><div class="page-title">マイページ</div><div class="page-sub">プロフィールと学習の進み具合を確認できます。</div></div>';
  html += '<div class="two-col">';
  html += '<div class="card mb14"><div class="section-title">学習の進み具合</div>' + renderProgressRing() + renderChecklistHTML() + '</div>';

  html += '<div class="card"><div class="section-title">プロフィール</div>';
  html += '<div style="font-size:13px;line-height:2;">氏名：'+s.name+'<br>メールアドレス：'+s.email+'<br>役割：'+(currentUser.role==='admin'?'管理者（講師）':'受講生')+'<br>入会日：'+s.joinedAt+'</div>';
  html += '<button class="btn secondary sm mt24" onclick="openChangePasswordModal()">パスワードを変更</button>';
  html += '</div></div>';

  if (currentUser.role === 'student') {
    html += '<div class="card mt24"><div class="section-title">ブックマークした記事</div>';
    const bm = cache.articles.filter(a => a.bookmarked);
    if (bm.length === 0) { html += '<div class="page-sub">まだブックマークがありません。記事ページの★アイコンから追加できます。</div>'; }
    else { bm.forEach(a => { html += '<div style="padding:9px 0;border-bottom:1px solid var(--gray);cursor:pointer;" onclick="openArticle('+a.id+')"><span class="tag blue" style="margin-right:6px;">'+a.cat+'</span>'+escapeHtml(a.title)+'</div>'; }); }
    html += '</div>';
  }
  return html;
}
function renderChecklistHTML(limit) {
  const items = limit ? cache.checklist.slice(0, limit) : cache.checklist;
  let html = '';
  items.forEach(c => {
    html += '<div class="checklist-item'+(c.done?' checked':'')+'"><div class="checkbox'+(c.done?' checked':'')+'" onclick="toggleChecklist('+c.id+')">'+(c.done?icon('check',12):'')+'</div><div class="cl-text">'+escapeHtml(c.text)+'</div></div>';
  });
  return html;
}
async function toggleChecklist(id) {
  const item = cache.checklist.find(c => c.id === id);
  if (!item) return;
  item.done = !item.done; render();
  try { await api.post('/api/checklist/' + id + '/toggle'); }
  catch (e) { item.done = !item.done; render(); showToast('通信エラー: ' + e.message); }
}
function openChangePasswordModal() {
  showModal('<h2>パスワードを変更</h2>'
    + '<div class="form-group"><label>現在のパスワード</label><input type="password" id="curPassword"></div>'
    + '<div class="form-group"><label>新しいパスワード（8文字以上）</label><input type="password" id="newPassword"></div>'
    + '<div id="pwError" class="login-error" style="display:none;"></div>'
    + '<button class="btn" id="submitPwBtn" onclick="submitChangePassword()">変更する</button>');
}
async function submitChangePassword() {
  const cur = document.getElementById('curPassword').value;
  const next = document.getElementById('newPassword').value;
  const errBox = document.getElementById('pwError');
  const btn = document.getElementById('submitPwBtn');
  btn.disabled = true; btn.textContent = '変更中...';
  try {
    await api.post('/api/auth/change-password', { currentPassword: cur, newPassword: next });
    closeModal();
    showToast('パスワードを変更しました');
  } catch (e) {
    errBox.style.display = 'block'; errBox.textContent = e.message;
    btn.disabled = false; btn.textContent = '変更する';
  }
}

/* =======================================================
   SEARCH
======================================================= */
function handleSearch(q) {
  const box = document.getElementById('searchResults');
  if (!q) { box.style.display = 'none'; return; }
  const ql = q.toLowerCase();
  const results = [];
  cache.articles.forEach(a => { if (a.title.toLowerCase().includes(ql)) results.push({ type: '記事', label: a.title, fn: 'openArticle(' + a.id + ')' }); });
  cache.videos.forEach(v => { if (v.title.toLowerCase().includes(ql)) results.push({ type: '動画', label: v.title, fn: 'openVideoModal(' + v.id + ')' }); });
  cache.filesList.forEach(f => { if (f.name.toLowerCase().includes(ql)) results.push({ type: '資料', label: f.name, fn: "appNav('files')" }); });
  box.style.display = 'block';
  if (results.length === 0) { box.innerHTML = '<div class="sr-empty">一致するコンテンツが見つかりません</div>'; return; }
  box.innerHTML = results.slice(0, 8).map(r => '<div class="sr-item" onclick="'+r.fn+';document.getElementById(\'searchResults\').style.display=\'none\';document.getElementById(\'searchInput\').value=\'\';"><span class="tag blue">'+r.type+'</span>'+escapeHtml(r.label)+'</div>').join('');
}
document.addEventListener('click', function (e) {
  if (!e.target.closest('.search-wrap')) { const box = document.getElementById('searchResults'); if (box) box.style.display = 'none'; }
});

/* =======================================================
   MODAL・アップロード共通処理
======================================================= */
function showModal(innerHtml) {
  document.getElementById('modalRoot').innerHTML = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal"><button class="close-btn" onclick="closeModal()">'+icon('close',18)+'</button>'+innerHtml+'</div></div>';
}
function closeModal() {
  document.getElementById('modalRoot').innerHTML = '';
  stagedThumb = null; stagedPsdFile = null; stagedSubmissionFile = null; stagedMaterialFile = null;
}
function handleThumbUpload(input, previewId) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    stagedThumb = { file, dataUrl: e.target.result };
    const preview = document.getElementById(previewId);
    if (preview) preview.innerHTML = '<img src="' + e.target.result + '">';
  };
  reader.readAsDataURL(file);
}
let stagedMultiImages = []; // {file, dataUrl}（新規） or {existingKey, url}（編集時の既存画像）
function multiImageUploadFieldHTML(inputId, previewId, max) {
  max = max || 10;
  return '<div class="form-group"><label>画像（1〜'+max+'枚・1枚目が自動的にサムネイルになります）</label>'
    + '<input type="file" accept="image/*" multiple id="'+inputId+'" style="display:none" onchange="handleMultiImageUpload(this,\''+previewId+'\','+max+')">'
    + '<button class="btn secondary sm" type="button" onclick="document.getElementById(\''+inputId+'\').click()">'+icon('paperclip',13)+' 画像を選択（複数選択可）</button>'
    + '<div id="'+previewId+'" class="multi-thumb-preview"></div>'
    + '<div class="page-sub" style="margin-top:6px;">選んだ順番の1枚目が自動的にサムネイルになります。画像は変形せずそのままの縦横比で表示されます。</div></div>';
}
function handleMultiImageUpload(input, previewId, max) {
  const files = Array.from(input.files || []);
  if (!files.length) return;
  if (stagedMultiImages.length + files.length > max) {
    alert('画像は最大'+max+'枚までです。');
    input.value = '';
    return;
  }
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      stagedMultiImages.push({ file, dataUrl: e.target.result });
      renderMultiImagePreview(previewId, max);
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}
function renderMultiImagePreview(previewId, max) {
  const preview = document.getElementById(previewId);
  if (!preview) return;
  preview.innerHTML = stagedMultiImages.map((img, i) =>
    '<div class="multi-thumb-item">'+(i===0?'<span class="multi-thumb-badge">サムネイル</span>':'')
    + '<img src="'+(img.dataUrl || img.url)+'">'
    + '<button type="button" class="multi-thumb-remove" onclick="removeMultiImage('+i+',\''+previewId+'\','+max+')">'+icon('x',12)+'</button></div>'
  ).join('');
}
function removeMultiImage(index, previewId, max) {
  stagedMultiImages.splice(index, 1);
  renderMultiImagePreview(previewId, max);
}
// stagedMultiImagesを実際のR2キー配列に変換する（新規ファイルはここでアップロードする）
async function resolveStagedImageKeys() {
  const keys = [];
  for (const img of stagedMultiImages) {
    if (img.existingKey) { keys.push(img.existingKey); }
    else if (img.file) { const uploaded = await uploadFile(img.file, 'gallery'); keys.push(uploaded.key); }
  }
  return keys;
}
// 表示URL（/api/files/xxx）からR2キー（xxx）を取り出す
function keyFromFileUrl(url) {
  return (url || '').replace(/^\/api\/files\//, '');
}
function thumbUploadFieldHTML(inputId, previewId) {
  return '<div class="form-group"><label>サムネイル画像（任意・1280×670推奨）</label>'
    + '<input type="file" accept="image/*" id="'+inputId+'" style="display:none" onchange="handleThumbUpload(this,\''+previewId+'\')">'
    + '<button class="btn secondary sm" type="button" onclick="document.getElementById(\''+inputId+'\').click()">'+icon('paperclip',13)+' 画像を選択</button>'
    + '<div id="'+previewId+'" class="thumb-preview"></div>'
    + '<div class="page-sub" style="margin-top:6px;">画像を選ばない場合は、自動生成のデザインが使われます。</div></div>';
}

/* =======================================================
   UTIL
======================================================= */
function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
// 表示用: プレーンテキストをエスケープしたうえで、http(s)のURLだけを自動的にクリック可能なリンクに変換する。
// フォームの value 属性など、編集用の入力欄には絶対に使わないこと（escapeHtmlのみを使う）。
function linkifyHtml(str) {
  const escaped = escapeHtml(str);
  return escaped.replace(/https?:\/\/[^\s<]+/g, m => {
    const trailingMatch = m.match(/[)\]}»,.!?、。」』]+$/);
    const trailing = trailingMatch ? trailingMatch[0] : '';
    const core = trailing ? m.slice(0, -trailing.length) : m;
    if (!core) return m;
    return '<a href="'+core+'" target="_blank" rel="noopener noreferrer">'+core+'</a>'+trailing;
  });
}
function rgba(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

/* =======================================================
   MAIN RENDER
======================================================= */
const VIEWS = {
  dashboard: viewDashboard,
  report: viewReport,
  chat: viewChat,
  articles: viewArticles,
  articleDetail: viewArticleDetail,
  videos: viewVideos,
  files: viewFiles,
  analysis: viewAnalysisList,
  analysisDetail: viewAnalysisDetail,
  photoTask: viewPhotoTaskList,
  photoTaskDetail: viewPhotoTaskDetail,
  gallery: viewGallery,
  zukan: viewZukan,
  admin: viewAdmin,
  announce: viewAnnounce,
  mypage: viewMypage,
};

function render() {
  if (!currentUser) return;
  renderShell();
  const fn = VIEWS[state.view] || viewDashboard;
  const root = document.getElementById('viewRoot');
  root.classList.remove('view-anim');
  root.innerHTML = fn();
  void root.offsetWidth;
  root.classList.add('view-anim');
}

boot();
