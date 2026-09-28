const SUPABASE_URL = "https://pdhraphbbdjsabhiokgo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkaHJhcGhiYmRqc2FiaGlva2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyODMxODUsImV4cCI6MjEwNDg1OTE4NX0.FesFprS6pIbuz1x2YDOw1rKdvjgirWRBt3sPrR5EhpY";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
try {
    currentUser = JSON.parse(localStorage.getItem('user_session')) || null;
} catch (e) {
    localStorage.removeItem('user_session');
}
let records = [];
let usersList = [];
let violationCategories = [];
let myChart = null;
let followUpMap = {};
try { followUpMap = JSON.parse(localStorage.getItem('smpgelora_tindak_lanjut') || '{}') || {}; } catch(e) { followUpMap = {}; }
let followUpCloudReady = false;
let appDataLoaded = false;

function showAppLoading(message = 'Sedang memuat data...'){
    const loader = document.getElementById('app-loading');
    const text = loader ? loader.querySelector('.app-loading-text') : null;
    if(text) text.textContent = message;
    if(loader){
        loader.classList.remove('hidden');
        loader.setAttribute('aria-busy','true');
    }
}

function hideAppLoading(){
    const loader = document.getElementById('app-loading');
    if(!loader) return;
    loader.setAttribute('aria-busy','false');
    loader.classList.add('hidden');
    window.setTimeout(() => {
        if(loader.classList.contains('hidden')) loader.style.display = 'none';
    }, 260);
}

// Variabel Pagination
let currentPage = 1;
const rowsPerPage = 10;
let filteredRecordsCache = [];

document.getElementById('tanggal').value = getLocalDateISO();

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    document.getElementById('theme-toggle').textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    if(myChart) updateChart(records);
}

if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    document.getElementById('theme-toggle').textContent = '☀️';
}

function openMenu() {
    document.getElementById('drawer-auth-text').textContent = currentUser ? 'Logout' : 'Login';
    document.getElementById('drawer-auth-icon').textContent = currentUser ? '🔒' : '🔑';
    document.getElementById('side-menu').classList.add('show');
}
function closeMenu() {
    document.getElementById('side-menu').classList.remove('show');
}
function showAbout() {
    Swal.fire({
        title: 'SMP Gelora Bekasi',
        html: '<p>Sistem Rekapitulasi Pelanggaran Siswa v2.0</p>' +
              '<p style="margin-top: 10px; font-weight: bold; color: #f97316;">Licensed By: Restu Putra Perdana</p>',
        icon: 'info',
        confirmButtonColor: '#f97316'
    });
}

function showPage(page){
    localStorage.setItem('smpgelora_current_page', page);
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + page);
    if(target) target.classList.add('active');

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === page);
    });

    window.scrollTo({top:0,behavior:'smooth'});

    if(page === 'chart') updateChart(records);
    if(page === 'data') filterData();
    if(page === 'report') renderThreeStrikeReport();
}

function openForm(){
    if(!currentUser){
        Swal.fire({
            icon: 'warning',
            title: 'Akses Terbatas',
            text: 'Fitur tambah data hanya dapat digunakan oleh Admin.',
            confirmButtonColor: '#f97316'
        }).then(() => openLogin());
        return;
    }
    showPage('form');
}

function openLogin(){
    document.getElementById('login-modal').classList.add('show');
    setTimeout(()=>document.getElementById('login-username').focus(),100);
}
function closeLogin(){
    document.getElementById('login-modal').classList.remove('show');
    document.getElementById('login-username').value='';
    document.getElementById('login-password').value='';
}
function togglePassword(inputId){
    const el=document.getElementById(inputId);
    el.type=el.type==='password'?'text':'password';
}

async function loginUser(){
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value.trim();

    if(!u || !p){
        return Swal.fire({
            icon: 'warning',
            title: 'Perhatian',
            text: 'Username dan Password wajib diisi!',
            confirmButtonColor: '#f97316'
        });
    }

    const { data, error } = await _supabase
        .from('users')
        .select('*')
        .eq('username', u)
        .eq('password', p)
        .single();

    if(error || !data){
        Swal.fire({
            icon: 'error',
            title: 'Gagal Login',
            text: 'Username atau Kata Sandi salah!',
            confirmButtonColor: '#e53935'
        });
    } else {
        currentUser = {
            id: data.id,
            username: data.username,
            nama: data.nama,
            role: data.role
        };
        localStorage.setItem('user_session', JSON.stringify(currentUser));
        closeLogin();
        updateAdminUI();
        Swal.fire({
            icon: 'success',
            title: 'Berhasil Login!',
            text: `Selamat datang, ${currentUser.nama}`,
            timer: 1500,
            showConfirmButton: false
        });
    }
}

function toggleAdminAuth(){
    if(currentUser){
        Swal.fire({
            title: 'Konfirmasi Logout',
            text: 'Apakah Anda yakin ingin keluar dari sistem?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#e53935',
            confirmButtonText: 'Ya, Logout',
            cancelButtonText: 'Batal'
        }).then((result) => {
            if (result.isConfirmed) {
                currentUser = null;
                localStorage.removeItem('user_session');
                updateAdminUI();
                Swal.fire({
                    icon: 'info',
                    title: 'Logout',
                    text: 'Anda telah keluar dari sistem.',
                    timer: 1500,
                    showConfirmButton: false
                });
            }
        });
    } else openLogin();
}

function updateAdminUI(){
    const badge = document.getElementById('status-badge');
    const authBtn = document.getElementById('btn-auth-home');
    const manageUserBtn = document.getElementById('drawer-manage-user');
    const auditLogBtn = document.getElementById('drawer-audit-log');
    const manageCategoryBtn = document.getElementById('drawer-manage-category');
    const userInfoText = document.getElementById('user-info-text');
    const loggedUsername = document.getElementById('logged-username');

    const inputs = document.querySelectorAll('#page-form input, #page-form select');
    const save = document.getElementById('btn-save');
    const notice = document.getElementById('guest-notice');

    const guestLabel = document.getElementById('guest-label');

    if(currentUser){
        if(userInfoText) userInfoText.style.display = 'block';
        if(guestLabel) guestLabel.style.display = 'none';
        if(loggedUsername) loggedUsername.textContent = `${currentUser.nama}`;
        if(authBtn) authBtn.textContent = 'Keluar';
        inputs.forEach(x => x.disabled = false);
        if(save) save.disabled = false;
        if(notice) notice.style.display = 'none';

        // Admin & Super Admin boleh kelola klasifikasi
        if(manageCategoryBtn) manageCategoryBtn.style.display = 'flex';

        if(currentUser.role === 'superadmin'){
            if(badge){ badge.textContent = 'Super Admin'; badge.className = 'badge superadmin'; }
            if(manageUserBtn) manageUserBtn.style.display = 'flex';
            if(auditLogBtn) auditLogBtn.style.display = 'flex';
        } else {
            if(badge){ badge.textContent = 'Admin'; badge.className = 'badge admin'; }
            if(manageUserBtn) manageUserBtn.style.display = 'none';
            if(auditLogBtn) auditLogBtn.style.display = 'none';
        }
    } else {
        if(userInfoText) userInfoText.style.display = 'none';
        if(guestLabel) guestLabel.style.display = 'block';
        if(badge){ badge.textContent = 'Tamu'; badge.className = 'badge guest'; }
        if(authBtn) authBtn.textContent = 'Login';
        inputs.forEach(x => x.disabled = true);
        if(save) save.disabled = true;
        if(notice) notice.style.display = 'block';
        if(manageUserBtn) manageUserBtn.style.display = 'none';
        if(auditLogBtn) auditLogBtn.style.display = 'none';
        if(manageCategoryBtn) manageCategoryBtn.style.display = 'none';
        batalEdit();
    }

    filterData();
    renderRecent();
    updateStats();
}

async function openManageUserModal(){
    if(!currentUser || currentUser.role !== 'superadmin'){
        return Swal.fire({
            icon: 'error',
            title: 'Akses Ditolak',
            text: 'Hanya Super Admin yang dapat mengakses menu ini.',
            confirmButtonColor: '#e53935'
        });
    }
    document.getElementById('user-modal').classList.add('show');
    await loadUsers();
}
function closeManageUserModal(){
    document.getElementById('user-modal').classList.remove('show');
}

/* FUNGSI LOG AKTIVITAS (AUDIT LOG) */
async function catatLog(aksi, keterangan) {
    if (!currentUser) return;
    try {
        await _supabase.from('audit_logs').insert([{
            username: currentUser.username,
            nama_user: currentUser.nama,
            aksi: aksi,
            keterangan: keterangan
        }]);
    } catch (err) {
        console.error("Gagal mencatat log:", err);
    }
}

async function openLogModal() {
    if (!currentUser || currentUser.role !== 'superadmin') {
        return Swal.fire({
            icon: 'error',
            title: 'Akses Ditolak',
            text: 'Hanya Super Admin yang dapat melihat log.',
            confirmButtonColor: '#e53935'
        });
    }
    document.getElementById('log-modal').classList.add('show');
    await loadAuditLogs();
}

function closeLogModal() {
    document.getElementById('log-modal').classList.remove('show');
}

async function loadAuditLogs() {
    const tbody = document.getElementById('log-table-body');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Memuat data...</td></tr>';

    const { data, error } = await _supabase
        .from('audit_logs')
        .select('*')
        .order('id', { ascending: false })
        .limit(50);

    if (error) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Gagal memuat log.</td></tr>';
        return;
    }

    if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Belum ada catatan aktivitas.</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(l => {
        const tgl = new Date(l.created_at).toLocaleString('id-ID', {
            dateStyle: 'short', timeStyle: 'short'
        });
        
        let color = '#f97316';
        if (l.aksi === 'TAMBAH') color = '#21a366';
        if (l.aksi === 'EDIT') color = '#f5b400';
        if (l.aksi === 'HAPUS') color = '#e53935';

        return `
            <tr>
                <td style="font-size: 11px; white-space: nowrap;">${tgl}</td>
                <td><strong>${escapeHtml(l.nama_user)}</strong><br><small style="color:var(--muted)">@${escapeHtml(l.username)}</small></td>
                <td><span class="badge" style="background:${color}">${l.aksi}</span></td>
                <td style="font-size: 11px;">${escapeHtml(l.keterangan)}</td>
            </tr>
        `;
    }).join('');
}

async function loadUsers(){
    const { data, error } = await _supabase.from('users').select('*').order('id', {ascending: true});
    if(error) {
        Swal.fire('Error', 'Gagal memuat daftar user: ' + error.message, 'error');
        return;
    }
    usersList = data || [];
    const tbody = document.getElementById('user-table-body');
    tbody.innerHTML = usersList.map(u => `
        <tr>
            <td>${escapeHtml(u.nama)}</td>
            <td>@${escapeHtml(u.username)}</td>
            <td><span class="badge ${u.role === 'superadmin' ? 'superadmin' : 'admin'}">${u.role}</span></td>
            <td>
                ${u.username !== currentUser.username ? `<button class="delete-btn" style="padding:4px 8px" onclick="hapusUser(${u.id}, '${escapeAttr(u.nama)}')">Hapus</button>` : '-'}
            </td>
        </tr>
    `).join('');
}

async function tambahUserBaru(){
    const nama = document.getElementById('new-nama').value.trim();
    const username = document.getElementById('new-username').value.trim().toLowerCase();
    const password = document.getElementById('new-password').value.trim();
    const role = document.getElementById('new-role').value;

    if(!nama || !username || !password){
        return Swal.fire({
            icon: 'warning',
            title: 'Gagal',
            text: 'Semua field user baru wajib diisi!',
            confirmButtonColor: '#f97316'
        });
    }

    const { error } = await _supabase.from('users').insert([{ nama, username, password, role }]);
    if(error){
        Swal.fire({
            icon: 'error',
            title: 'Gagal Menyimpan',
            text: 'Gagal menambahkan user: ' + error.message,
            confirmButtonColor: '#e53935'
        });
    } else {
        await catatLog('TAMBAH', `Menambahkan user baru: ${nama} (@${username}) sebagai ${role}`);
        Swal.fire({
            icon: 'success',
            title: 'Berhasil',
            text: 'User baru berhasil ditambahkan!',
            confirmButtonColor: '#21a366'
        });
        document.getElementById('new-nama').value = '';
        document.getElementById('new-username').value = '';
        document.getElementById('new-password').value = '';
        await loadUsers();
    }
}

async function hapusUser(id, namaUser){
    const confirm = await Swal.fire({
        title: 'Hapus User?',
        text: `User ${namaUser} tidak akan bisa login lagi.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e53935',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal'
    });
    if(confirm.isConfirmed){
        const { error } = await _supabase.from('users').delete().eq('id', id);
        if(!error){
            await catatLog('HAPUS', `Menghapus user: ${namaUser}`);
            Swal.fire('Terhapus', 'User berhasil dihapus.', 'success');
            await loadUsers();
        } else {
            Swal.fire('Gagal', 'Gagal menghapus user: ' + error.message, 'error');
        }
    }
}

/* ========== KELOLA KLASIFIKASI PELANGGARAN ========== */

async function loadViolationCategories(){
    try{
        const { data, error } = await _supabase
            .from('violation_categories')
            .select('*')
            .order('name', { ascending: true });

        if(error){
            console.warn('Gagal memuat klasifikasi:', error.message);
            violationCategories = [];
            return;
        }
        violationCategories = data || [];
    }catch(err){
        console.warn('Error loadViolationCategories:', err);
        violationCategories = [];
    }
}

async function openCategoryModal(){
    if(!currentUser){
        return Swal.fire({
            icon: 'warning',
            title: 'Akses Admin',
            text: 'Login terlebih dahulu untuk mengelola klasifikasi.',
            confirmButtonColor: '#f97316'
        });
    }
    document.getElementById('category-modal').classList.add('show');
    batalEditKategori();
    await renderCategoryTable();
}

function closeCategoryModal(){
    document.getElementById('category-modal').classList.remove('show');
    batalEditKategori();
}

async function renderCategoryTable(){
    const tbody = document.getElementById('category-table-body');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Memuat...</td></tr>';

    await loadViolationCategories();
    renderLainnyaSuggest();

    if(!violationCategories.length){
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Belum ada kategori. Silakan tambah.</td></tr>';
        return;
    }

    tbody.innerHTML = violationCategories.map(c => {
        const kws = Array.isArray(c.keywords) ? c.keywords.join(', ') : '';
        return `<tr>
            <td><strong>${escapeHtml(c.name)}</strong></td>
            <td style="font-size:11px; max-width:220px; white-space:normal;">${escapeHtml(kws)}</td>
            <td style="white-space:nowrap;">
                <button class="edit-btn" style="padding:4px 8px; margin-right:4px;" onclick="editKategori(${c.id})">Edit</button>
                <button class="delete-btn" style="padding:4px 8px;" onclick="hapusKategori(${c.id}, '${escapeAttr(c.name)}')">Hapus</button>
            </td>
        </tr>`;
    }).join('');
}

/** Ambil teks pelanggaran yang saat ini masuk "Lainnya", diurutkan dari paling sering */
function getLainnyaSuggestions(limit = 12){
    const counts = {};
    (records || []).forEach(item => {
        const raw = String(item.pelanggaran || '').trim();
        if(!raw) return;
        const cats = detectViolationCategories(raw);
        // Hanya yang murni "Lainnya" (tidak cocok kategori manapun)
        if(cats.length === 1 && cats[0] === 'Lainnya'){
            counts[raw] = (counts[raw] || 0) + 1;
        }
    });
    return Object.entries(counts)
        .sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0], 'id'))
        .slice(0, limit);
}

function renderLainnyaSuggest(){
    const box = document.getElementById('lainnya-suggest-list');
    if(!box) return;
    const list = getLainnyaSuggestions(12);
    if(!list.length){
        box.innerHTML = '<span style="font-size:11px; color:var(--muted);">Tidak ada data "Lainnya". Semua pelanggaran sudah terklasifikasi 👍</span>';
        return;
    }
    box.innerHTML = list.map(([text, count]) => {
        const short = text.length > 40 ? text.slice(0, 38) + '…' : text;
        return `<button type="button" onclick="quickAddFromSuggest('${escapeAttr(text)}')"
            style="border:1px solid var(--border); background:var(--card); color:var(--text); border-radius:999px; padding:6px 11px; font-size:11px; font-weight:700; cursor:pointer;">
            ${escapeHtml(short)} <span style="color:var(--primary);">(${count}x)</span>
        </button>`;
    }).join('');
}

function quickAddFromSuggest(text){
    // Isi form tambah kategori otomatis
    document.getElementById('cat-edit-id').value = '';
    document.getElementById('cat-name').value = text;
    // Keyword default = teks itu sendiri (lowercase) + kata-kata penting
    const words = text.toLowerCase().replace(/[.,;:\/\\|+&]/g, ' ').split(/\s+/).filter(w => w.length > 2);
    const keywords = [...new Set([text.toLowerCase(), ...words])].join(', ');
    document.getElementById('cat-keywords').value = keywords;
    document.getElementById('btn-batal-kategori').style.display = 'block';
    document.getElementById('cat-name').focus();
    Swal.fire({
        icon: 'info',
        title: 'Siap ditambahkan',
        text: 'Form sudah terisi. Edit nama/keyword jika perlu, lalu klik Simpan Kategori.',
        timer: 1800,
        showConfirmButton: false
    });
}

function editKategori(id){
    const cat = violationCategories.find(c => c.id === id);
    if(!cat) return;
    document.getElementById('cat-edit-id').value = cat.id;
    document.getElementById('cat-name').value = cat.name || '';
    document.getElementById('cat-keywords').value = Array.isArray(cat.keywords) ? cat.keywords.join(', ') : '';
    document.getElementById('btn-batal-kategori').style.display = 'block';
}

function batalEditKategori(){
    document.getElementById('cat-edit-id').value = '';
    document.getElementById('cat-name').value = '';
    document.getElementById('cat-keywords').value = '';
    document.getElementById('btn-batal-kategori').style.display = 'none';
}

async function simpanKategori(){
    if(!currentUser) return;

    const editId = document.getElementById('cat-edit-id').value;
    const name = document.getElementById('cat-name').value.trim();
    const rawKeywords = document.getElementById('cat-keywords').value.trim();

    if(!name){
        return Swal.fire({ icon:'warning', title:'Perhatian', text:'Nama kategori wajib diisi.', confirmButtonColor:'#f97316' });
    }

    // Pecah keyword by koma, bersihkan, unique
    const keywords = [...new Set(
        rawKeywords.split(',')
            .map(k => k.trim().toLowerCase())
            .filter(Boolean)
    )];

    if(!keywords.length){
        return Swal.fire({ icon:'warning', title:'Perhatian', text:'Minimal satu keyword wajib diisi.', confirmButtonColor:'#f97316' });
    }

    try{
        if(editId){
            const { error } = await _supabase
                .from('violation_categories')
                .update({ name, keywords, updated_at: new Date().toISOString() })
                .eq('id', editId);
            if(error) throw error;
            await catatLog('EDIT', `Mengubah klasifikasi: ${name}`);
            Swal.fire({ icon:'success', title:'Berhasil', text:'Kategori diperbarui.', timer:1200, showConfirmButton:false });
        } else {
            const { error } = await _supabase
                .from('violation_categories')
                .insert([{ name, keywords }]);
            if(error) throw error;
            await catatLog('TAMBAH', `Menambah klasifikasi: ${name}`);
            Swal.fire({ icon:'success', title:'Berhasil', text:'Kategori baru ditambahkan.', timer:1200, showConfirmButton:false });
        }
        batalEditKategori();
        await renderCategoryTable();
        // Refresh grafik kalau sedang di halaman chart
        if(document.getElementById('page-chart')?.classList.contains('active')){
            updateChart(records);
        }
    }catch(err){
        Swal.fire({ icon:'error', title:'Gagal', text: err.message || String(err), confirmButtonColor:'#e53935' });
    }
}

async function hapusKategori(id, nama){
    if(!currentUser) return;
    const confirm = await Swal.fire({
        title: 'Hapus Kategori?',
        text: `Kategori "${nama}" akan dihapus permanen.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e53935',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal'
    });
    if(!confirm.isConfirmed) return;

    try{
        const { error } = await _supabase.from('violation_categories').delete().eq('id', id);
        if(error) throw error;
        await catatLog('HAPUS', `Menghapus klasifikasi: ${nama}`);
        Swal.fire({ icon:'success', title:'Terhapus', text:'Kategori berhasil dihapus.', timer:1200, showConfirmButton:false });
        await renderCategoryTable();
        if(document.getElementById('page-chart')?.classList.contains('active')){
            updateChart(records);
        }
    }catch(err){
        Swal.fire({ icon:'error', title:'Gagal', text: err.message || String(err), confirmButtonColor:'#e53935' });
    }
}

function updateStats(){
    document.getElementById('stat-total').textContent = records.length;

    // Hitung jumlah kategori unik (sama logika dengan grafik Jenis Pelanggaran)
    // Bukan lagi hitung teks mentah yang ditulis guru.
    const categorySet = new Set();
    (records || []).forEach(item => {
        const raw = String(item.pelanggaran || '').trim();
        if(!raw) return;
        detectViolationCategories(raw).forEach(cat => categorySet.add(cat));
    });
    document.getElementById('stat-types').textContent = categorySet.size;

    // Hitung siswa yang sudah ditindak berdasarkan status tindak lanjut
    // pada Report 3x. Hanya status selain "Belum Ditindak" yang dihitung.
    const actedStudents = getThreeStrikeStudents().filter(g => {
        const follow = getThreeStrikeFollowUp(g).follow;
        return follow.status && follow.status !== 'Belum Ditindak';
    });
    document.getElementById('stat-acted').textContent = actedStudents.length;
}

/** Deteksi kategori pelanggaran berdasarkan keyword dinamis dari Supabase */
function detectViolationCategories(text){
    // Normalisasi agresif: hapus tanda baca, kurung, angka jam, spasi dobel
    const t = String(text || '')
        .toLowerCase()
        .replace(/[.,;:\/\\|+&()[\]{}'"`~!@#$%^*=?<>]/g, ' ')
        .replace(/\d{1,2}\s*[:.]\s*\d{2}/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const matched = [];

    (violationCategories || []).forEach(cat => {
        const keywords = Array.isArray(cat.keywords) ? cat.keywords : [];
        let hit = keywords.some(kw => {
            const k = String(kw || '').toLowerCase().trim();
            if(!k) return false;
            if(k.includes(' ')) return t.includes(k);
            const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if(k.length <= 4){
                return new RegExp('\\b' + escaped + '\\b').test(t);
            }
            return new RegExp('\\b' + escaped + '\\b').test(t) || t.includes(k);
        });

        // Fallback: kategori yang namanya soal keterlambatan
        if(!hit && /terlambat|telat/i.test(String(cat.name || ''))){
            hit = /terlambat|keterlambatan|\btelat\b|ter\s*lambat/i.test(t);
        }

        if(hit) matched.push(cat.name);
    });

    if(matched.length === 0) matched.push('Lainnya');
    return matched;
}

/** Debug di console: ketik debugKategoriJenis('2026-09-22','2026-09-28') */
function debugKategoriJenis(fromDate, toDate){
    let data = records || [];
    if(fromDate || toDate){
        data = data.filter(item => {
            const tgl = item.tanggal ? String(item.tanggal).substring(0, 10) : '';
            if(!tgl) return false;
            if(fromDate && tgl < fromDate) return false;
            if(toDate && tgl > toDate) return false;
            return true;
        });
    }
    console.log('=== DEBUG KATEGORI JENIS ===');
    console.log('Total data difilter:', data.length);
    data.forEach((item, i) => {
        const cats = detectViolationCategories(item.pelanggaran || '');
        console.log(`${i+1}. [${item.tanggal}] ${item.nama} | "${item.pelanggaran}" →`, cats);
    });
    return data.length;
}

function showCategoryDebug(){
    const fromDate = document.getElementById('chart-from')?.value || '';
    const toDate = document.getElementById('chart-to')?.value || '';

    let data = records || [];
    if(fromDate || toDate){
        data = data.filter(item => {
            const tgl = item.tanggal ? String(item.tanggal).substring(0, 10) : '';
            if(!tgl) return false;
            if(fromDate && tgl < fromDate) return false;
            if(toDate && tgl > toDate) return false;
            return true;
        });
    }

    if(!data.length){
        return Swal.fire({
            icon: 'info',
            title: 'Tidak ada data',
            text: 'Tidak ada pelanggaran di rentang tanggal ini.',
            confirmButtonColor: '#f97316'
        });
    }

    // Hitung ringkasan kategori
    const summary = {};
    const rows = data.map((item, i) => {
        const cats = detectViolationCategories(item.pelanggaran || '');
        cats.forEach(c => { summary[c] = (summary[c] || 0) + 1; });
        const catLabel = cats.join(', ');
        const isLainnya = cats.length === 1 && cats[0] === 'Lainnya';
        const noTerlambat = !cats.some(c => /terlambat|telat/i.test(c));
        const flag = isLainnya ? '⚠️ ' : (noTerlambat && /lambat|telat/i.test(item.pelanggaran || '') ? '❓ ' : '');
        return `<div style="text-align:left; padding:8px 0; border-bottom:1px solid #eee; font-size:12px; line-height:1.45;">
            <strong>${i+1}. ${escapeHtml(item.nama || '-')}</strong>
            <span style="color:#64748b;"> · ${escapeHtml(formatTanggalIndonesia(item.tanggal) || '-')}</span><br>
            <span style="color:#334155;">"${escapeHtml(item.pelanggaran || '-')}"</span><br>
            <span style="color:${isLainnya ? '#ef4444' : '#f97316'}; font-weight:700;">${flag}→ ${escapeHtml(catLabel)}</span>
        </div>`;
    }).join('');

    const summaryHtml = Object.entries(summary)
        .sort((a,b) => b[1] - a[1])
        .map(([k,v]) => `<span style="display:inline-block; margin:3px 4px; padding:4px 8px; border-radius:999px; background:#fff7ed; color:#c2410c; font-size:11px; font-weight:700;">${escapeHtml(k)}: ${v}</span>`)
        .join('');

    Swal.fire({
        title: `Cek Kategori (${data.length} data)`,
        html: `<div style="margin-bottom:10px;">${summaryHtml}</div>
               <div style="max-height:55vh; overflow-y:auto; text-align:left;">${rows}</div>
               <p style="font-size:11px; color:#64748b; margin-top:10px; text-align:left;">
               ⚠️ = masuk Lainnya &nbsp;|&nbsp; ❓ = teks seperti terlambat tapi kategori tidak Terlambat
               </p>`,
        width: Math.min(480, window.innerWidth - 24),
        confirmButtonText: 'Tutup',
        confirmButtonColor: '#f97316'
    });
}

function getGroups(data, filterType){
    const groups = {};

    // ==========================================
    // BERDASARKAN KELAS
    // ==========================================
    if(filterType === 'kelas'){
        data.forEach(item => {
            const k = (item.kelas || 'Tanpa Kelas')
                .toUpperCase()
                .trim();

            groups[k] = (groups[k] || 0) + 1;
        });

        return Object.entries(groups)
            .sort((a,b) => a[0].localeCompare(b[0]));
    }

    // ==========================================
    // BERDASARKAN TINGKAT
    // ==========================================
    if(filterType === 'tingkat'){
        groups['Kelas 7'] = 0;
        groups['Kelas 8'] = 0;
        groups['Kelas 9'] = 0;
        groups['Lainnya'] = 0;

        data.forEach(item => {
            const k = (item.kelas || '')
                .toString()
                .toUpperCase()
                .trim();

            let matched = false;

            if(k.includes('8') || k.includes('VIII')){
                groups['Kelas 8']++;
                matched = true;
            }
            else if(k.includes('7') || k.includes('VII')){
                groups['Kelas 7']++;
                matched = true;
            }
            else if(k.includes('9') || k.includes('IX')){
                groups['Kelas 9']++;
                matched = true;
            }

            if(!matched){
                groups['Lainnya']++;
            }
        });

        Object.keys(groups).forEach(key => {
            if(groups[key] === 0){
                delete groups[key];
            }
        });

        return Object.entries(groups);
    }

    // ==========================================
    // BERDASARKAN MINGGU
    // ==========================================
    if(filterType === 'minggu'){
        const weeklyData = {};
        const monthNames = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agt","Sep","Okt","Nov","Des"];

        // Kalau filter tanggal aktif → label minggu dalam bulan (M1 Sep, M2 Sep)
        // Kalau tidak → minggu ISO tahun (M37 '26)
        const fromDate = document.getElementById('chart-from')?.value || '';
        const toDate = document.getElementById('chart-to')?.value || '';
        const useMonthWeek = !!(fromDate || toDate);

        data.forEach(item => {
            if(!item.tanggal) return;

            const d = parseDateOnly(item.tanggal);
            if (!d || isNaN(d)) return;

            let weekKey;
            let sortKey;

            if(useMonthWeek){
                // Minggu ke-1..5 dalam bulan tersebut
                const weekOfMonth = Math.ceil(d.getDate() / 7);
                const mon = monthNames[d.getMonth()];
                weekKey = `M${weekOfMonth} ${mon}`;
                // sort: tahun-bulan-minggu
                sortKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-W${weekOfMonth}`;
            } else {
                // ISO week of year
                const target = new Date(d.valueOf());
                const dayNr = (d.getDay() + 6) % 7;
                target.setDate(target.getDate() - dayNr + 3);
                const firstThursday = new Date(target.getFullYear(), 0, 4);
                const firstDayNr = (firstThursday.getDay() + 6) % 7;
                firstThursday.setDate(firstThursday.getDate() - firstDayNr + 3);
                const weekNum = Math.floor((target - firstThursday) / (7 * 86400000)) + 1;
                weekKey = `M${weekNum} '${String(d.getFullYear()).slice(2)}`;
                sortKey = `${d.getFullYear()}-W${String(weekNum).padStart(2,'0')}`;
            }

            if(!weeklyData[weekKey]){
                weeklyData[weekKey] = { count: 0, sortKey };
            }
            weeklyData[weekKey].count += 1;
        });

        return Object.entries(weeklyData)
            .sort((a, b) => a[1].sortKey.localeCompare(b[1].sortKey))
            .map(([label, obj]) => [label, obj.count]);
    }

    // ==========================================
    // BERDASARKAN BULAN
    // ==========================================
    if(filterType === 'bulan'){
        const monthNames = [
            "Jan", "Feb", "Mar", "Apr",
            "Mei", "Jun", "Jul", "Agt",
            "Sep", "Okt", "Nov", "Des"
        ];

        const monthlyData = {};

        data.forEach(item => {
            if(!formatTanggalIndonesia(item.tanggal)) return;

            const parts = item.tanggal.substring(0, 10).split('-');

if(parts.length === 3){
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;

    if(monthIndex >= 0 && monthIndex < 12){
        const key = `${monthNames[monthIndex]} ${year}`;
        monthlyData[key] = (monthlyData[key] || 0) + 1;
    }
}
        });

        return Object.entries(monthlyData);
    }

    // ==========================================
    // PROSES SEMUA DATA PELANGGARAN (jenis)
    // ==========================================

    data.forEach(item => {

        const raw =
            (item.pelanggaran || '').trim();

        if(!raw) return;

        const detected = detectViolationCategories(raw);

        detected.forEach(category => {
            groups[category] = (groups[category] || 0) + 1;
        });
    });

    // ==========================================
    // URUTKAN DARI TERBANYAK
    // ==========================================
    return Object.entries(groups)
        .sort((a,b) => b[1] - a[1]);
}

function updateChart(data = records) {
    const canvas = document.getElementById('pelanggaranChart');
    const filterEl = document.getElementById('chart-filter');

    if (!canvas || typeof Chart === 'undefined') return;

    const filterType = filterEl ? filterEl.value : 'jenis';

    // Filter rentang tanggal (opsional)
    const fromEl = document.getElementById('chart-from');
    const toEl = document.getElementById('chart-to');
    const fromDate = fromEl?.value || '';
    const toDate = toEl?.value || '';
    let filtered = data || [];
    if(fromDate || toDate){
        filtered = filtered.filter(item => {
            const tgl = item.tanggal ? String(item.tanggal).substring(0, 10) : '';
            if(!tgl) return false;
            if(fromDate && tgl < fromDate) return false;
            if(toDate && tgl > toDate) return false;
            return true;
        });
    }

    // Hapus chart sebelumnya
    if (myChart) {
        myChart.destroy();
        myChart = null;
    }

    const grouped = getGroups(filtered, filterType);

    const labels = grouped.map(item => item[0]);
    const values = grouped.map(item => item[1]);

    const ctx = canvas.getContext('2d');

    // ==========================================
    // WARNA GRAFIK
    // ==========================================

    const colors = [
        '#3B82F6',
        '#EF4444',
        '#10B981',
        '#F59E0B',
        '#8B5CF6',
        '#EC4899',
        '#06B6D4',
        '#F97316',
        '#84CC16',
        '#6366F1',
        '#14B8A6',
        '#E11D48'
    ];

    const borderColors = [
        '#2563EB',
        '#DC2626',
        '#059669',
        '#D97706',
        '#7C3AED',
        '#DB2777',
        '#0891B2',
        '#EA580C',
        '#65A30D',
        '#4F46E5',
        '#0D9488',
        '#BE123C'
    ];

    // ==========================================
    // KHUSUS PER TINGKAT → PIE CHART
    // ==========================================

    if (filterType === 'tingkat') {

        myChart = new Chart(ctx, {
            type: 'pie',

            data: {
                labels: labels,

                datasets: [{
                    data: values,

                    backgroundColor: colors.slice(
                        0,
                        labels.length
                    ),

                    borderColor: '#ffffff',

                    borderWidth: 3,

                    hoverOffset: 12
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                plugins: {

                    legend: {
                        position: 'bottom',

                        labels: {
                            padding: 18,
                            usePointStyle: true,
                            font: {
                                size: 13,
                                weight: 'bold'
                            }
                        }
                    },

                    tooltip: {
                        callbacks: {

                            label: function(context) {

                                const total =
                                    context.dataset.data
                                    .reduce(
                                        (sum, value) =>
                                            sum + value,
                                        0
                                    );

                                const value = context.raw;

                                const percentage =
                                    total > 0
                                    ? ((value / total) * 100)
                                        .toFixed(1)
                                    : 0;

                                return ` ${context.label}: ${value} kasus (${percentage}%)`;
                            }

                        }
                    }
                }
            }
        });

        return;
    }

    // ==========================================
    // JENIS / KELAS → BAR
    // MINGGU / BULAN → LINE
    // ==========================================

    const isTrend =
        filterType === 'minggu' ||
        filterType === 'bulan';

    myChart = new Chart(ctx, {

        type: isTrend ? 'line' : 'bar',

        data: {
            labels: labels,

            datasets: [{
                label:
                    filterType === 'jenis'
                        ? 'Jumlah Pelanggaran'
                        : filterType === 'kelas'
                        ? 'Pelanggaran per Kelas'
                        : filterType === 'minggu'
                        ? 'Pelanggaran per Minggu'
                        : 'Pelanggaran per Bulan',

                data: values,

                backgroundColor: colors.slice(
                    0,
                    labels.length
                ),

                borderColor: isTrend
                    ? '#3B82F6'
                    : borderColors.slice(
                        0,
                        labels.length
                    ),

                borderWidth: 2,

                borderRadius: isTrend ? 0 : 7,

                tension: isTrend ? 0.35 : 0,

                fill: false
            }]
        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            plugins: {

                legend: {
                    display: isTrend,

                    position: 'bottom'
                },

                tooltip: {
                    callbacks: {

                        label: function(context) {

                            return ` ${context.raw} kasus`;

                        }

                    }
                }

            },

            scales: {

                x: {
                    ticks: {
                        // Bar kategori: tampilkan SEMUA label (jangan di-skip)
                        autoSkip: isTrend,
                        maxTicksLimit: isTrend ? 8 : 20,
                        maxRotation: isTrend ? 0 : 40,
                        minRotation: 0,
                        font: { size: 10 },
                        padding: 4,
                        callback: function(value) {
                            const label = this.getLabelForValue(value);
                            if(!label) return '';
                            // Potong label terlalu panjang biar tetap kebaca
                            const s = String(label);
                            return s.length > 14 ? s.slice(0, 12) + '…' : s;
                        }
                    },
                    grid: {
                        display: true,
                        drawBorder: false
                    }
                },

                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0,
                        stepSize: 1,
                        font: { size: 11 }
                    },
                    grid: {
                        drawBorder: false
                    }
                }

            },

            layout: {
                padding: { left: 4, right: 8, top: 8, bottom: isTrend ? 4 : 12 }
            }

        }

    });
}
function getStudentKey(nama, kelas){
    return `${normalizeName(nama)}__${normalizeName(kelas)}`;
}

function getThreeStrikeStudents(){
    const groups = {};

    records.forEach(item => {
        const nama = String(item.nama || '').trim();
        const kelas = String(item.kelas || '').trim();
        if(!nama) return;

        // Report 3x dikelompokkan berdasarkan NAMA siswa.
        // Perbedaan penulisan kelas tidak lagi memecah hitungan pelanggaran.
        const key = normalizeName(nama);

        if(!groups[key]){
            groups[key] = {
                nama,
                kelas: kelas || '-',
                kelasList: [],
                records: []
            };
        }

        groups[key].records.push(item);
        if(kelas && !groups[key].kelasList.some(k => normalizeName(k) === normalizeName(kelas))){
            groups[key].kelasList.push(kelas);
        }
    });

    return Object.values(groups)
        .map(g => {
            // Tampilkan kelas dari pelanggaran terbaru.
            const latest = [...g.records].sort((a,b) =>
                String(b.tanggal||'').localeCompare(String(a.tanggal||'')) ||
                Number(b.id||0) - Number(a.id||0)
            )[0];
            g.kelas = String(latest?.kelas || g.kelas || '-').trim() || '-';
            return g;
        })
        .filter(g => g.records.length >= 3)
        .sort((a,b) =>
            b.records.length - a.records.length ||
            a.nama.localeCompare(b.nama, 'id')
        );
}

function getThreeStrikeFollowUp(g){
    // Cari tindak lanjut lama pada kombinasi nama+kelas yang pernah tersimpan.
    const candidates = [];
    const kelasCandidates = [...new Set([
        g.kelas,
        ...(g.kelasList || []),
        ...g.records.map(r => String(r.kelas || '').trim()).filter(Boolean)
    ])];

    for(const kelas of kelasCandidates){
        const key = getStudentKey(g.nama, kelas);
        const value = followUpMap[key];
        if(value && typeof value === 'object'){
            candidates.push({key, value});
        }
    }

    candidates.sort((a,b) =>
        String(b.value.updated_at || '').localeCompare(String(a.value.updated_at || ''))
    );

    const key = candidates[0]?.key || getStudentKey(g.nama, g.kelas);
    return {key, follow:getFollowUp(key)};
}

function getFollowUp(key){
    const value = followUpMap[key];
    if(!value || typeof value !== 'object') {
        return {status:'Belum Ditindak', tanggal:'', oleh:'', catatan:'', updated_at:''};
    }
    return {
        status: value.status || 'Belum Ditindak',
        tanggal: value.tanggal || '',
        oleh: value.oleh || '',
        catatan: value.catatan || '',
        updated_at: value.updated_at || ''
    };
}

async function loadFollowUpsFromSupabase(){
    try{
        const { data, error } = await _supabase.from('tindak_lanjut').select('*');
        if(error){
            followUpCloudReady = false;
            console.warn('Tabel tindak_lanjut belum siap / tidak dapat diakses:', error.message);
            return;
        }

        followUpCloudReady = true;
        const cloudMap = {};
        (data || []).forEach(row => {
            if(row.student_key){
                cloudMap[row.student_key] = {
                    status: row.status || 'Belum Ditindak',
                    tanggal: row.tanggal || '',
                    oleh: row.oleh || '',
                    catatan: row.catatan || '',
                    updated_at: row.updated_at || ''
                };
            }
        });

        // Hardening P1:
        // - Jangan menimpa data lokal secara buta.
        // - Jika kedua sisi punya data, pilih versi dengan updated_at terbaru.
        // - Data lokal lama tanpa timestamp tetap dipertahankan dan dimigrasikan.
        const merged = {...followUpMap};
        const localOnly = [];

        Object.entries(followUpMap).forEach(([key, localValue]) => {
            if(!cloudMap[key]){
                localOnly.push([key, localValue]);
                return;
            }

            const localTime = Date.parse(localValue?.updated_at || '') || 0;
            const cloudTime = Date.parse(cloudMap[key]?.updated_at || '') || 0;

            if(cloudTime > localTime){
                merged[key] = cloudMap[key];
            }else{
                // Lokal sama/lebih baru: pertahankan lokal.
                merged[key] = localValue;
            }
        });

        Object.entries(cloudMap).forEach(([key, cloudValue]) => {
            if(!merged[key]) merged[key] = cloudValue;
        });

        followUpMap = merged;
        localStorage.setItem('smpgelora_tindak_lanjut', JSON.stringify(followUpMap));

        // Sinkronkan data lokal yang belum ada atau lebih baru ke Supabase.
        const syncPayloads = [];

        localOnly.forEach(([key, value]) => {
            syncPayloads.push({
                student_key:key,
                nama:key.split('__')[0] || '-',
                kelas:key.split('__')[1] || '-',
                status:value.status || 'Belum Ditindak',
                tanggal:value.tanggal || null,
                oleh:value.oleh || null,
                catatan:value.catatan || null,
                updated_at:value.updated_at || new Date().toISOString()
            });
        });

        Object.entries(followUpMap).forEach(([key, value]) => {
            const cloud = cloudMap[key];
            const localTime = Date.parse(value?.updated_at || '') || 0;
            const cloudTime = Date.parse(cloud?.updated_at || '') || 0;
            if(cloud && localTime > cloudTime){
                syncPayloads.push({
                    student_key:key,
                    nama:key.split('__')[0] || '-',
                    kelas:key.split('__')[1] || '-',
                    status:value.status || 'Belum Ditindak',
                    tanggal:value.tanggal || null,
                    oleh:value.oleh || null,
                    catatan:value.catatan || null,
                    updated_at:value.updated_at || new Date().toISOString()
                });
            }
        });

        if(syncPayloads.length){
            const {error: syncError} = await _supabase
                .from('tindak_lanjut')
                .upsert(syncPayloads, {onConflict:'student_key'});
            if(syncError){
                console.warn('Sinkronisasi tindak lanjut gagal:', syncError.message);
            }
        }
    }catch(err){
        followUpCloudReady = false;
        console.warn('Gagal memuat tindak lanjut dari Supabase:', err);
    }
}

async function saveFollowUp(key, data, nama='', kelas=''){
    // Hardening P1: setiap perubahan mendapat timestamp agar konflik lokal/cloud
    // dapat diselesaikan deterministik.
    const normalized = {
        status: data.status || 'Belum Ditindak',
        tanggal: data.tanggal || '',
        oleh: data.oleh || '',
        catatan: data.catatan || '',
        updated_at: new Date().toISOString()
    };

    followUpMap[key] = normalized;
    localStorage.setItem('smpgelora_tindak_lanjut', JSON.stringify(followUpMap));

    try{
        const payload = {
            student_key: key,
            nama: nama || key.split('__')[0] || '-',
            kelas: kelas || key.split('__')[1] || '-',
            status: normalized.status,
            tanggal: normalized.tanggal || null,
            oleh: normalized.oleh || null,
            catatan: normalized.catatan || null,
            updated_at: normalized.updated_at
        };
        const { error } = await _supabase.from('tindak_lanjut').upsert([payload], {onConflict:'student_key'});
        if(error) throw error;
        followUpCloudReady = true;
        return true;
    }catch(err){
        followUpCloudReady = false;
        console.warn('Status tersimpan lokal, tetapi gagal disinkronkan ke Supabase:', err.message || err);
        return false;
    }
}

function statusBadgeHtml(status){
    const map = {
        'Belum Ditindak': ['#e53935','🔴'],
        'Sudah Ditindak Wali Kelas': ['#f59e0b','🟠'],
        'Sudah Ditindak BK': ['#7c3aed','🟣'],
        'Dilaporkan ke Tim Inti 1': ['#2563eb','🔵'],
        'Selesai / Sudah Ditangani': ['#21a366','🟢']
    };
    const [bg, icon] = map[status] || map['Belum Ditindak'];
    return `<span class="badge" style="background:${bg};display:inline-block">${icon} ${escapeHtml(status)}</span>`;
}

async function updateFollowUp(nama, kelas){
    if(!currentUser){
        return Swal.fire({ icon:'warning', title:'Akses Admin', text:'Login terlebih dahulu untuk memperbarui status tindak lanjut.', confirmButtonColor:'#f97316' });
    }
    const key = getStudentKey(nama, kelas);
    const current = getFollowUp(key);
    const { value: formValues } = await Swal.fire({
        title: `Tindak Lanjut — ${escapeHtml(nama)}`,
        html: `
            <div style="text-align:left">\n                <label style="font-weight:700;font-size:12px;display:block;margin-bottom:5px">Status</label>\n                <select id="swal-follow-status" class="swal2-input" style="width:100%;margin:0 0 10px">\n                    <option ${current.status==='Belum Ditindak'?'selected':''}>Belum Ditindak</option>\n                    <option ${current.status==='Sudah Ditindak Wali Kelas'?'selected':''}>Sudah Ditindak Wali Kelas</option>\n                    <option ${current.status==='Sudah Ditindak BK'?'selected':''}>Sudah Ditindak BK</option>\n                    <option ${current.status==='Dilaporkan ke Tim Inti 1'?'selected':''}>Dilaporkan ke Tim Inti 1</option>\n                    <option ${current.status==='Selesai / Sudah Ditangani'?'selected':''}>Selesai / Sudah Ditangani</option>\n                </select>\n                <label style="font-weight:700;font-size:12px;display:block;margin-bottom:5px">Tanggal Tindakan</label>\n                <input id="swal-follow-date" type="date" class="swal2-input" value="${escapeAttr(current.tanggal || getLocalDateISO())}" style="width:100%;margin:0 0 10px">\n                <label style="font-weight:700;font-size:12px;display:block;margin-bottom:5px">Ditindak oleh</label>\n                <input id="swal-follow-by" class="swal2-input" value="${escapeAttr(current.oleh || currentUser.nama || '')}" placeholder="Nama guru/petugas" style="width:100%;margin:0 0 10px">\n                <label style="font-weight:700;font-size:12px;display:block;margin-bottom:5px">Catatan</label>\n                <textarea id="swal-follow-note" class="swal2-textarea" placeholder="Catatan tindak lanjut" style="width:100%;margin:0">${escapeHtml(current.catatan || '')}</textarea>\n            </div>`,
        showCancelButton:true,
        confirmButtonText:'💾 Simpan Status',
        cancelButtonText:'Batal',
        confirmButtonColor:'#21a366',
        preConfirm:() => ({
            status: document.getElementById('swal-follow-status').value,
            tanggal: document.getElementById('swal-follow-date').value,
            oleh: document.getElementById('swal-follow-by').value.trim(),
            catatan: document.getElementById('swal-follow-note').value.trim()
        })
    });
    if(formValues){
        const synced = await saveFollowUp(key, formValues, nama, kelas);
        await catatLog('TINDAK_LANJUT', `Memperbarui tindak lanjut ${nama} (${kelas}): ${formValues.status}${formValues.catatan ? ' - ' + formValues.catatan : ''}`);
        renderThreeStrikeReport();
        Swal.fire({icon:'success', title:'Status tersimpan', text:`Status ${nama} diperbarui.${synced ? ' Tersimpan di Supabase.' : ' Tersimpan di perangkat; Supabase belum siap.'}`, timer:1400, showConfirmButton:false});
    }
}

function renderThreeStrikeReport(){
    const box = document.getElementById('report-3x-list');
    if(!box) return;
    const keyword = (document.getElementById('report-search')?.value || '').toLowerCase().trim();
    const students = getThreeStrikeStudents().filter(g =>
        !keyword || g.nama.toLowerCase().includes(keyword) || g.kelas.toLowerCase().includes(keyword)
    );
    if(!students.length){
        box.innerHTML = '<div class="empty">Belum ada siswa dengan 3x pelanggaran.</div>';
        return;
    }
    box.innerHTML = students.map(g => {
        const {key, follow} = getThreeStrikeFollowUp(g);
        const latest = [...g.records].sort((a,b)=>String(b.tanggal||'').localeCompare(String(a.tanggal||''))).slice(0,3);
        const riwayat = latest.map((r,i)=>`${i+1}. ${escapeHtml(r.pelanggaran||'-')} — ${escapeHtml(formatTanggalIndonesia(r.tanggal)||'-')}`).join('<br>');
        return `<div class="record" style="grid-template-columns:1fr;">
            <div class="record-main">
                <div class="record-name">${escapeHtml(g.nama)}</div>
                <div class="record-meta">🏫 Kelas ${escapeHtml(g.kelas)} · <strong>${g.records.length}x pelanggaran</strong></div>
                <div style="margin-top:9px">${statusBadgeHtml(follow.status)}</div>
                <div style="font-size:11px;color:var(--muted);margin-top:8px;line-height:1.55">${riwayat}</div>
                ${follow.tanggal || follow.oleh || follow.catatan ? `<div style="margin-top:9px;padding:9px;border-radius:10px;background:var(--bg);font-size:11px;line-height:1.5"><strong>Tindak lanjut:</strong> ${follow.tanggal ? escapeHtml(formatTanggalIndonesia(follow.tanggal)) : '-'}${follow.oleh ? ` · ${escapeHtml(follow.oleh)}` : ''}${follow.catatan ? `<br>${escapeHtml(follow.catatan)}` : ''}</div>` : ''}
            </div>
            <div class="actions">
                <button class="edit-btn" onclick="updateFollowUp('${escapeAttr(g.nama)}','${escapeAttr(g.kelas)}')">📝 Tindak Lanjut</button>
                <button class="print-btn" onclick="cetakSuratPanggilan('${escapeAttr(g.nama)}','${escapeAttr(g.kelas)}')">🖨️ Cetak</button>
                <button class="notify-btn" onclick="kirimWhatsAppManual('${escapeAttr(g.nama)}','${escapeAttr(g.kelas)}')">💬 WA Wali</button>
            </div>
        </div>`;
    }).join('');
}

function renderRecent(){
    const box = document.getElementById('recent-list');
    if(!box)return;
    const latest = [...records].sort((a, b) => {
        const da = String(a.tanggal || '').substring(0, 10);
        const db = String(b.tanggal || '').substring(0, 10);
        return db.localeCompare(da) || Number(b.id || 0) - Number(a.id || 0);
    }).slice(0, 6);
    if(!latest.length){
        box.innerHTML = '<div class="empty">Belum ada data pelanggaran.</div>';
        return;
    }
    box.innerHTML = latest.map(item => recordCard(item)).join('');
}

function recordCard(item){
    const photo = item.foto_url
        ? `<img class="record-photo" src="${escapeAttr(item.foto_url)}" alt="Foto bukti" onclick="openPhotoLightbox('${escapeAttr(item.foto_url)}')">`
        : `<div class="record-photo" style="display:flex;align-items:center;justify-content:center;background:var(--border)">📷</div>`;

    const actions = currentUser ? `
        <div class="actions">
            <button class="notify-btn" onclick="kirimWhatsAppManual('${escapeAttr(item.nama)}', '${escapeAttr(item.kelas)}')">💬 Beritahu Wali</button>
            <button class="print-btn" onclick="cetakSuratPanggilan('${escapeAttr(item.nama)}', '${escapeAttr(item.kelas)}')">🖨️ Cetak</button>
            <button class="edit-btn" onclick="editData(${item.id})">✏️ Edit</button>
            <button class="delete-btn" onclick="hapusData(${item.id})">🗑 Hapus</button>
        </div>` : '';

    return `<div class="record">
        <div class="record-main">
            <div class="record-date">📅 ${escapeHtml(formatTanggalIndonesia(item.tanggal)||'-')}</div>
            <div class="record-name">${escapeHtml(item.nama||'-')}</div>
            <div class="record-meta">🏫 Kelas ${escapeHtml(item.kelas||'-')}</div>
            <div class="record-violation">⚠️ ${escapeHtml(item.pelanggaran||'-')}</div>
        </div>
        ${photo}
        ${actions}
    </div>`;
}

function renderTable(){
    const mobile = document.getElementById('record-list');
    const tbody = document.getElementById('table-body');
    const pageInfo = document.getElementById('page-info');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');

    const totalPages = Math.ceil(filteredRecordsCache.length / rowsPerPage) || 1;
    if(currentPage > totalPages) currentPage = totalPages;
    if(currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * rowsPerPage;
    const paginatedItems = filteredRecordsCache.slice(start, start + rowsPerPage);

    if(mobile){
        mobile.innerHTML = paginatedItems.length ? paginatedItems.map(recordCard).join('') : '<div class="empty">Data tidak ditemukan.</div>';
    }

    if(tbody){
        tbody.innerHTML = '';
        if(!paginatedItems.length){
            tbody.innerHTML = '<tr><td colspan="7">Data tidak ditemukan</td></tr>';
        } else {
            paginatedItems.forEach((item, index) => {
                const tr = document.createElement('tr');
                const absoluteNo = start + index + 1;
                tr.innerHTML = `
                    <td>${absoluteNo}</td>
                    <td>${escapeHtml(formatTanggalIndonesia(item.tanggal)||'-')}</td>
                    <td>${escapeHtml(item.nama||'-')}</td>
                    <td>${escapeHtml(item.kelas||'-')}</td>
                    <td>${escapeHtml(item.pelanggaran||'-')}</td>
                    <td>${item.foto_url ? `<img src="${escapeAttr(item.foto_url)}" alt="Foto bukti" onclick="openPhotoLightbox('${escapeAttr(item.foto_url)}')">` : '-'}</td>
                    <td>${currentUser ? `
                        <button class="notify-btn" onclick="kirimWhatsAppManual('${escapeAttr(item.nama)}', '${escapeAttr(item.kelas)}')">💬 WA Wali</button>
                        <button class="print-btn" onclick="cetakSuratPanggilan('${escapeAttr(item.nama)}', '${escapeAttr(item.kelas)}')">Cetak</button>
                        <button class="edit-btn" onclick="editData(${item.id})">Edit</button>
                        <button class="delete-btn" onclick="hapusData(${item.id})">Hapus</button>
                    ` : '-'}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    }

    if(pageInfo) pageInfo.textContent = `Halaman ${currentPage} dari ${totalPages}`;
    if(prevBtn) prevBtn.disabled = currentPage === 1;
    if(nextBtn) nextBtn.disabled = currentPage === totalPages || totalPages === 0;
}

function changePage(direction){
    currentPage += direction;
    renderTable();
}

function filterData(){
    const keyword = document.getElementById('search-input').value.toLowerCase().trim();
    filteredRecordsCache = records.filter(item =>
        (item.nama||'').toLowerCase().includes(keyword) ||
        (item.kelas||'').toLowerCase().includes(keyword) ||
        (item.pelanggaran||'').toLowerCase().includes(keyword)
    );
    currentPage = 1;
    renderTable();
}

function escapeHtml(value){
    return String(value).replace(/[&<>"']/g, m => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    }[m]));
}
function escapeAttr(value){ return escapeHtml(value); }

function compressImage(file, maxWidth=800, quality=.7){
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = e => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                let width = img.width, height = img.height;
                if(width > maxWidth){
                    height = Math.round(height * maxWidth / width);
                    width = maxWidth;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                canvas.toBlob(blob => {
                    if(!blob) return reject(new Error('Gagal mengompres gambar'));
                    resolve(new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.jpg', {
                        type: 'image/jpeg', lastModified: Date.now()
                    }));
                }, 'image/jpeg', quality);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

async function loadData(){
    showAppLoading('Sedang memuat data pelanggaran...');
    try {
        const { data, error } = await _supabase
            .from('pelanggaran')
            .select('*')
            .order('id', {ascending: true});

        if(error) throw error;

        records = data || [];
        filteredRecordsCache = [...records];
        await Promise.all([
            loadFollowUpsFromSupabase(),
            loadViolationCategories()
        ]);
        updateAdminUI();
        updateChart(records);
        renderThreeStrikeReport();
        appDataLoaded = true;
    } catch(error){
        console.error('Supabase error:', error);
        appDataLoaded = false;
        Swal.fire({
            icon: 'error',
            title: 'Koneksi Gagal',
            text: 'Gagal mengambil data dari Supabase: ' + (error?.message || error),
            confirmButtonColor: '#e53935'
        });
    } finally {
        hideAppLoading();
    }
}

/** Ambil semua pelanggaran siswa berdasarkan NAMA LENGKAP saja (konsisten dengan Report 3x) */
function getRecordsByStudentName(namaSiswa){
    const cleanName = normalizeName(namaSiswa);
    return records
        .filter(r => normalizeName(r.nama) === cleanName)
        .sort((a,b) =>
            String(a.tanggal||'').localeCompare(String(b.tanggal||'')) ||
            Number(a.id||0) - Number(b.id||0)
        );
}

/** Kelas terbaru dari riwayat siswa (nama saja) */
function getLatestClassByName(namaSiswa, fallbackKelas){
    const list = getRecordsByStudentName(namaSiswa);
    if(!list.length) return fallbackKelas || '-';
    const latest = [...list].sort((a,b) =>
        String(b.tanggal||'').localeCompare(String(a.tanggal||'')) ||
        Number(b.id||0) - Number(a.id||0)
    )[0];
    return String(latest?.kelas || fallbackKelas || '-').trim() || '-';
}

async function kirimWhatsAppManual(namaSiswa, kelasSiswa) {
    const listSiswa = getRecordsByStudentName(namaSiswa);
    const totalCount = listSiswa.length;
    const kelasTampil = getLatestClassByName(namaSiswa, kelasSiswa);

    const result = await Swal.fire({
        title: '📱 Beritahu Wali Kelas/Murid',
        html: `<p>Kirim pemberitahuan catatan pelanggaran siswa <strong>${escapeHtml(namaSiswa)}</strong> (${escapeHtml(kelasTampil)}) ke WhatsApp.</p>`,
        icon: 'question',
        input: 'text',
        inputLabel: 'Masukkan Nomor WA Tujuan:',
        inputPlaceholder: 'Contoh: 081234567890',
        showCancelButton: true,
        confirmButtonText: '📲 Kirim via WhatsApp',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#25d366',
        inputValidator: (value) => { if (!value) return 'Nomor WhatsApp wajib diisi!'; }
    });

    if (result.isConfirmed && result.value) {
        let phone = result.value.trim().replace(/[^0-9]/g, '');
        if (phone.startsWith('0')) phone = '62' + phone.slice(1);

        const daftarPelanggaran = listSiswa.map((item, idx) => `${idx + 1}. ${item.pelanggaran} (${formatTanggalIndonesia(item.tanggal)})`).join('\n');
        const message = `Yth. Bapak/Ibu Wali Murid / Wali Kelas dari *${namaSiswa}* (${kelasTampil}).\n\nBerikut menginformasikan catatan pelanggaran siswa di SMP Gelora Bekasi:\n*Total Pelanggaran:* ${totalCount} kali\n\nRiwayat Pelanggaran:\n${daftarPelanggaran}\n\nMohon untuk dilakukan pembinaan bersama.\n\nTerima kasih.\n*SMP Gelora Bekasi*`;

        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    }
}

async function checkPelanggaranCountAndPrompt(namaSiswa, kelasSiswa) {
    const listSiswa = getRecordsByStudentName(namaSiswa);
    const totalCount = listSiswa.length;
    const kelasTampil = getLatestClassByName(namaSiswa, kelasSiswa);

    if (totalCount >= 3) {
        const result = await Swal.fire({
            title: '⚠️ PERINGATAN PELANGGARAN 3X',
            html: `<p>Siswa <strong>${escapeHtml(namaSiswa)}</strong> (${escapeHtml(kelasTampil)}) telah mencapai <strong>${totalCount}x pelanggaran</strong>!</p>`,
            icon: 'warning',
            input: 'text',
            inputLabel: 'Masukkan Nomor WhatsApp Ortu/Wali:',
            inputPlaceholder: 'Contoh: 081234567890',
            showCancelButton: true,
            confirmButtonText: '📲 Kirim Surat Panggilan via WA',
            cancelButtonText: 'Tutup',
            confirmButtonColor: '#25d366',
            inputValidator: (value) => { if (!value) return 'Nomor WA wajib diisi!'; }
        });

        if (result.isConfirmed && result.value) {
            let phone = result.value.trim().replace(/[^0-9]/g, '');
            if (phone.startsWith('0')) phone = '62' + phone.slice(1);

            const daftarPelanggaran = listSiswa.map((item, idx) => `${idx + 1}. ${item.pelanggaran} (${formatTanggalIndonesia(item.tanggal)})`).join('\n');
            const message = `Yth. Bapak/Ibu Orang Tua/Wali dari *${namaSiswa}* (${kelasTampil}).\n\nBermaksud menginformasikan bahwa siswa tersebut telah mencapai *${totalCount} kali pelanggaran* di SMP Gelora Bekasi.\n\nRiwayat Pelanggaran:\n${daftarPelanggaran}\n\nSehubungan dengan hal tersebut, kami mengundang Bapak/Ibu hadir ke sekolah untuk bimbingan konseling.\n\nTerima kasih.\n*SMP Gelora Bekasi*`;

            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
        }
    }
}

async function simpanData(){
    if(!currentUser) return Swal.fire({
        icon: 'error',
        title: 'Akses Ditolak',
        text: 'Hanya Admin yang dapat menyimpan data.',
        confirmButtonColor: '#e53935'
    });

    const editId = document.getElementById('edit-id')?.value || '';
    const tanggal = document.getElementById('tanggal').value;
    const nama = document.getElementById('nama').value.trim();
    const kelas = document.getElementById('kelas').value.trim();
    const pelanggaran = document.getElementById('pelanggaran').value.trim();
    const fotoInput = document.getElementById('foto').files[0];
    const btn = document.getElementById('btn-save');

    if(!nama || !kelas || !pelanggaran){
        return Swal.fire({
            icon: 'warning',
            title: 'Form Inkomplit',
            text: 'Nama, Kelas, dan Pelanggaran wajib diisi!',
            confirmButtonColor: '#f97316'
        });
    }

    btn.disabled = true;
    btn.textContent = 'Mengolah...';
    let fotoUrl = null;
    let uploadedFotoPath = null;
    let oldFotoUrl = null;
    if (editId) {
        const oldItem = records.find(r => String(r.id) === String(editId));
        oldFotoUrl = oldItem?.foto_url || null;
    }

    try{
        if(fotoInput){
            btn.textContent = 'Mengompres & Mengunggah Foto...';
            const compressed = await compressImage(fotoInput, 800, .7);
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

            const {error: uploadError} = await _supabase.storage
                .from('foto-pelanggaran')
                .upload(fileName, compressed);

            if(uploadError) throw uploadError;

            const {data: publicUrlData} = _supabase.storage
                .from('foto-pelanggaran').getPublicUrl(fileName);

            fotoUrl = publicUrlData.publicUrl;
            uploadedFotoPath = fileName;
        }

        if(editId){
            const payload = {tanggal, nama, kelas, pelanggaran};
            if(fotoUrl) payload.foto_url = fotoUrl;

            const {error} = await _supabase.from('pelanggaran').update(payload).eq('id', editId);
            if(error) throw error;

            if (fotoUrl && oldFotoUrl && oldFotoUrl !== fotoUrl) {
                const marker = '/storage/v1/object/public/foto-pelanggaran/';
                const idx = oldFotoUrl.indexOf(marker);
                const oldPath = idx >= 0 ? decodeURIComponent(oldFotoUrl.slice(idx + marker.length)) : null;
                if (oldPath) await _supabase.storage.from('foto-pelanggaran').remove([oldPath]);
            }
            
            await catatLog('EDIT', `Mengubah pelanggaran siswa: ${nama} (${kelas})`);
            Swal.fire({
                icon: 'success',
                title: 'Tersimpan',
                text: 'Data berhasil diperbarui!',
                confirmButtonColor: '#21a366'
            });
        } else {
            const {error} = await _supabase.from('pelanggaran').insert([{
                tanggal, nama, kelas, pelanggaran, foto_url: fotoUrl
            }]);
            if(error) throw error;
            
            await catatLog('TAMBAH', `Menambahkan pelanggaran '${pelanggaran}' untuk ${nama} (${kelas})`);
            Swal.fire({
                icon: 'success',
                title: 'Tersimpan',
                text: 'Data berhasil disimpan!',
                confirmButtonColor: '#21a366'
            });
        }

        batalEdit();
        await loadData();
        showPage('data');
        await checkPelanggaranCountAndPrompt(nama, kelas);

    } catch(err){
        if (uploadedFotoPath) {
            try { await _supabase.storage.from('foto-pelanggaran').remove([uploadedFotoPath]); } catch (cleanupErr) { console.warn('Gagal membersihkan foto upload:', cleanupErr); }
        }
        console.error(err);
        Swal.fire({
            icon: 'error',
            title: 'Gagal Menyimpan',
            text: 'Gagal menyimpan data: '+err.message,
            confirmButtonColor: '#e53935'
        });
    } finally {
        btn.disabled = !currentUser;
        btn.textContent = '💾 Simpan Data';
    }
}

function cetakSuratPanggilan(namaSiswa, kelasSiswa) {
    // Group by nama lengkap saja (sama dengan Report 3x)
    const listSiswa = getRecordsByStudentName(namaSiswa);
    const totalCount = listSiswa.length;
    const kelasTampil = getLatestClassByName(namaSiswa, kelasSiswa);
    const tgl = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    let tabelPelanggaranHtml = listSiswa.map((item, idx) => `
        <tr>
            <td style="border:1px solid #000; padding:5px 6px; text-align:center;">${idx + 1}</td>
            <td style="border:1px solid #000; padding:5px 6px; text-align:center;">${formatTanggalIndonesia(item.tanggal) || '-'}</td>
            <td style="border:1px solid #000; padding:5px 6px;">${item.pelanggaran || '-'}</td>
        </tr>
    `).join('');

    const windowCetak = window.open('', '', 'width=900,height=800');
    windowCetak.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Surat Panggilan Orang Tua - ${escapeHtml(namaSiswa)}</title>
            <style>
                @page { 
                    size: A4 portrait; 
                    margin: 10mm 15mm; 
                }
                body { 
                    font-family: Arial, Helvetica, sans-serif; 
                    font-size: 11pt; 
                    line-height: 1.35; 
                    color: #000; 
                    margin: 0; 
                    padding: 0; 
                }
                .kop-surat { 
                    text-align: center; 
                    border-bottom: 3px double #000; 
                    padding-bottom: 6px; 
                    margin-bottom: 12px; 
                }
                .kop-surat h2 { margin: 0; font-size: 15pt; font-weight: bold; text-transform: uppercase; }
                .kop-surat p { margin: 2px 0; font-size: 9.5pt; }
                .judul-surat { text-align: center; margin: 10px 0 10px; }
                .judul-surat h4 { margin: 0; font-size: 12pt; text-decoration: underline; text-transform: uppercase; }
                .judul-surat p { margin: 2px 0 0 0; font-size: 10pt; }
                .content p { margin: 4px 0; }
                .table-data { width: 100%; border-collapse: collapse; margin: 4px 0; }
                .table-data td { padding: 2px 0; vertical-align: top; font-size: 11pt; }
                .table-info { width: 100%; border-collapse: collapse; margin: 6px 0; }
                .table-info th, .table-info td { border: 1px solid #000; font-size: 10.5pt; }
                .table-info th { background-color: #f2f2f2; padding: 5px; text-align: center; }
                .table-info td { padding: 5px 6px; }
                .ttd-wrapper { margin-top: 15px; float: right; width: 220px; text-align: center; font-size: 11pt; }
                .ttd-wrapper p { margin: 2px 0; }
                .space-ttd { height: 45px; }
                .clear { clear: both; }
            </style>
        </head>
        <body>
            <div class="kop-surat">
                <h2>SMP GELORA BEKASI</h2>
                <p>Jl. Raya Kp. Irian, RT.005/RW.003, Telk. Pucang, Kec. Bekasi Utara, Kota Bekasi, Jawa Barat 17121</p>
                <p>Telp: (021) 88985463</p>
            </div>
            <div class="judul-surat">
                <h4>Surat Panggilan Orang Tua / Wali Siswa</h4>
                <p>Nomor: 421.3 / BP-BK / ${new Date().getFullYear()}</p>
            </div>
            <div class="content">
                <p>Kepada Yth.<br><strong>Bapak / Ibu / Wali Murid dari ${escapeHtml(namaSiswa)}</strong><br>Di Tempat</p>
                <p>Dengan hormat,</p>
                <p>Sehubungan dengan catatan tata tertib sekolah, kami menginformasikan bahwa siswa tersebut di bawah ini telah mencapai <strong>${totalCount} kali pelanggaran</strong>:</p>
                
                <table class="table-data" style="margin-top: 6px;">
                    <tr><td width="130"><strong>Nama Siswa</strong></td><td width="10">:</td><td><strong>${escapeHtml(namaSiswa)}</strong></td></tr>
                    <tr><td><strong>Kelas</strong></td><td>:</td><td>${escapeHtml(kelasTampil)}</td></tr>
                </table>

                <p style="margin-top: 6px;"><strong>Rincian Riwayat Pelanggaran (${totalCount}x):</strong></p>
                <table class="table-info">
                    <thead><tr><th width="35">No</th><th width="110">Tanggal</th><th>Jenis Pelanggaran</th></tr></thead>
                    <tbody>${tabelPelanggaranHtml}</tbody>
                </table>

                <p style="margin-top: 6px;">Maka dari itu, kami mengharapkan kehadiran Bapak/Ibu/Wali Siswa ke sekolah pada:</p>
                <table class="table-data" style="margin-left: 15px;">
                    <tr><td width="120">Hari / Tanggal</td><td width="10">:</td><td>.......................................................</td></tr>
                    <tr><td>Waktu</td><td>:</td><td>08.00 WIB – Selesai</td></tr>
                    <tr><td>Tempat</td><td>:</td><td>Ruang Bimbingan Konseling (BK) SMP Gelora Bekasi</td></tr>
                    <tr><td>Bertemu</td><td>:</td><td>Guru BK / Kesiswaan</td></tr>
                </table>

                <p style="margin-top: 6px;">Mengingat pentingnya bimbingan bersama demi kebaikan siswa, kami sangat mengharapkan kehadiran Bapak/Ibu tepat pada waktunya.</p>
                <p style="margin-top: 4px;">Demikian surat panggilan ini kami sampaikan. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.</p>
            </div>
            <div class="ttd-wrapper">
                <p>Bekasi, ${tgl}</p>
                <p>Mengetahui,</p>
                <p>Guru BK / Kesiswaan</p>
                <div class="space-ttd"></div>
                <p><strong>( ________________________ )</strong></p>
            </div>
            <div class="clear"></div>
        </body>
        </html>
    `);
    windowCetak.document.close();
    windowCetak.focus();
    setTimeout(() => { windowCetak.print(); }, 500);
}

function editData(id){
    if(!currentUser) return Swal.fire({
        icon: 'error',
        title: 'Akses Ditolak',
        text: 'Hanya Admin yang dapat mengubah data.',
        confirmButtonColor: '#e53935'
    });
    const item = records.find(r => r.id === id);
    if(!item)return;

    document.getElementById('edit-id').value = item.id;
    document.getElementById('tanggal').value = item.tanggal
    ? item.tanggal.substring(0, 10)
    : '';
    document.getElementById('nama').value = item.nama||'';
    document.getElementById('kelas').value = item.kelas||'';
    document.getElementById('pelanggaran').value = item.pelanggaran||'';
    document.getElementById('foto').value = '';
    document.getElementById('form-title').textContent = '✏️ Edit Pelanggaran';
    document.getElementById('btn-save').textContent = '🔄 Update Data';
    document.getElementById('btn-cancel').style.display = 'block';
    showPage('form');
}

function batalEdit(){
    const edit = document.getElementById('edit-id');
    if(edit) edit.value = '';
    document.getElementById('tanggal').value = getLocalDateISO();
    document.getElementById('nama').value = '';
    document.getElementById('kelas').value = '';
    document.getElementById('pelanggaran').value = '';
    document.getElementById('foto').value = '';
    document.getElementById('form-title').textContent = '➕ Tambah Pelanggaran';
    document.getElementById('btn-save').textContent = '💾 Simpan Data';
    document.getElementById('btn-cancel').style.display = 'none';
}

async function hapusData(id){
    if(!currentUser) return Swal.fire({
        icon: 'error',
        title: 'Akses Ditolak',
        text: 'Hanya Admin yang dapat menghapus data.',
        confirmButtonColor: '#e53935'
    });

    const result = await Swal.fire({
        title: 'Konfirmasi Hapus',
        text: 'Apakah Anda yakin ingin menghapus data ini?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e53935',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Ya, Hapus!',
        cancelButtonText: 'Batal'
    });

    if(!result.isConfirmed) return;
    const item = records.find(r => r.id === id);

    try{
        if(item?.foto_url){
            const marker = '/storage/v1/object/public/foto-pelanggaran/';
            const idx = item.foto_url.indexOf(marker);
            const path = idx >= 0 ? decodeURIComponent(item.foto_url.slice(idx + marker.length)) : null;
            if(path) await _supabase.storage.from('foto-pelanggaran').remove([path]);
        }
        const {error} = await _supabase.from('pelanggaran').delete().eq('id', id);
        if(error) throw error;
        
        await catatLog('HAPUS', `Menghapus pelanggaran siswa: ${item.nama} (${item.kelas})`);
        Swal.fire({
            icon: 'success',
            title: 'Terhapus!',
            text: 'Data berhasil dihapus.',
            confirmButtonColor: '#21a366'
        });
        await loadData();
    }catch(err){
        console.error(err);
        Swal.fire({
            icon: 'error',
            title: 'Gagal Hapus',
            text: 'Gagal menghapus data: '+err.message,
            confirmButtonColor: '#e53935'
        });
    }
}

/* EXPORT KHUSUS SISWA YANG SUDAH 3X+ PELANGGARAN */
async function imageUrlToDataUri(url){
    if(!url) return null;
    try{
        const response = await fetch(url, {mode:'cors'});
        if(!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        return await new Promise((resolve,reject)=>{
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }catch(err){
        console.warn('Foto tidak dapat dimasukkan ke Excel:', url, err);
        return null;
    }
}

async function exportThreeStrikeReport(){
    const students = getThreeStrikeStudents();

    if(!students.length){
        return Swal.fire({
            icon:'info',
            title:'Report Kosong',
            text:'Belum ada siswa yang mencapai 3x pelanggaran.',
            confirmButtonColor:'#f97316'
        });
    }

    Swal.fire({
        title:'Mengeksport Report 3x...',
        html:'Menyiapkan seluruh siswa 3x+ pelanggaran.',
        allowOutsideClick:false,
        didOpen:()=>Swal.showLoading()
    });

    try{
        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Report 3x');

        ws.mergeCells('A1:J1');
        ws.mergeCells('A2:J2');
        ws.mergeCells('A3:J3');
        ws.getCell('A1').value = 'REPORT SISWA 3X PELANGGARAN';
        ws.getCell('A2').value = 'SMP GELORA BEKASI';
        ws.getCell('A3').value = 'TAHUN AJARAN 2026-2027';

        ['A1','A2','A3'].forEach((cell,i)=>{
            ws.getCell(cell).font = {
                name:'Arial',
                size:i===0?14:i===1?12:10,
                bold:true
            };
            ws.getCell(cell).alignment = {
                horizontal:'center',
                vertical:'middle'
            };
        });

        ws.addRow([]);

        const header = ws.addRow([
            'No','Foto Bukti Terbaru','Nama Siswa','Kelas','Total Pelanggaran',
            'Status Tindak Lanjut','Tanggal Tindakan','Ditindak Oleh',
            'Catatan','Riwayat Pelanggaran'
        ]);

        header.eachCell(cell=>{
            cell.fill = {
                type:'pattern',
                pattern:'solid',
                fgColor:{argb:'2F5597'}
            };
            cell.font = {bold:true, color:{argb:'FFFFFF'}};
            cell.alignment = {
                horizontal:'center',
                vertical:'middle',
                wrapText:true
            };
            cell.border = {
                top:{style:'thin'},
                left:{style:'thin'},
                bottom:{style:'thin'},
                right:{style:'thin'}
            };
        });

        [7,16,28,12,18,27,18,24,38,55]
            .forEach((w,i)=>ws.getColumn(i+1).width=w);

        let no = 0;

        for(const g of students){
            no++;

            const {key, follow} = getThreeStrikeFollowUp(g);

            const sorted = [...g.records].sort((a,b)=>
                String(a.tanggal||'').localeCompare(String(b.tanggal||'')) ||
                Number(a.id||0) - Number(b.id||0)
            );

            const latestWithPhoto = [...sorted]
                .reverse()
                .find(r => r.foto_url) || null;

            const riwayat = sorted
                .map((r,n)=>
                    `${n+1}. ${r.pelanggaran||'-'} — ${formatTanggalIndonesia(r.tanggal)||'-'}`
                )
                .join('\n');

            const row = ws.addRow([
                no,
                '',
                g.nama || '-',
                g.kelas || '-',
                g.records.length,
                follow.status || 'Belum Ditindak',
                follow.tanggal ? formatTanggalIndonesia(follow.tanggal) : '-',
                follow.oleh || '-',
                follow.catatan || '-',
                riwayat || '-'
            ]);

            row.height = Math.max(
                70,
                Math.min(180, 18 * Math.max(3, riwayat.split('\n').length))
            );

            row.eachCell({includeEmpty:true},cell=>{
                cell.alignment = {
                    vertical:'top',
                    horizontal:'left',
                    wrapText:true
                };
                cell.border = {
                    top:{style:'thin'},
                    left:{style:'thin'},
                    bottom:{style:'thin'},
                    right:{style:'thin'}
                };
            });

            [1,4,5,6].forEach(c=>{
                row.getCell(c).alignment = {
                    vertical:'top',
                    horizontal:'center',
                    wrapText:true
                };
            });

            if(latestWithPhoto){
                const dataUri = await imageUrlToDataUri(latestWithPhoto.foto_url);

                if(dataUri){
                    const ext = dataUri.startsWith('data:image/png')
                        ? 'png'
                        : 'jpeg';

                    const imageId = workbook.addImage({
                        base64:dataUri,
                        extension:ext
                    });

                    ws.addImage(imageId,{
                        tl:{col:1.15,row:row.number-0.85},
                        ext:{width:95,height:75}
                    });
                }else{
                    row.getCell(2).value = 'Foto gagal dimuat';
                }
            }else{
                row.getCell(2).value = 'Tidak ada foto';
            }
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer],{
            type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Report_3x_Pelanggaran_SMP_Gelora_${getLocalDateISO()}.xlsx`;
        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(()=>URL.revokeObjectURL(url),1000);

        Swal.fire({
            icon:'success',
            title:'Berhasil Export',
            text:`${students.length} siswa dengan 3x atau lebih pelanggaran berhasil dimasukkan ke Excel.`,
            confirmButtonColor:'#21a366'
        });

    }catch(err){
        console.error(err);
        Swal.fire({
            icon:'error',
            title:'Export Gagal',
            text:'Terjadi kesalahan saat export: '+err.message,
            confirmButtonColor:'#e53935'
        });
    }
}

function toggleAudio(){
    const audio = document.getElementById('bg-music');
    const text = document.getElementById('music-text');
    const icon = document.getElementById('music-icon');

    if(audio.paused){
        audio.volume = .2;
        audio.play().then(() => {
            text.textContent = "Hentikan Musik";
            icon.textContent = "🔇";
            Swal.fire({
                icon: 'info',
                title: 'Musik Diputar',
                text: 'Musik latar belakang berhasil diputar.',
                timer: 1500,
                showConfirmButton: false
            });
        }).catch(err => {
            Swal.fire('Error Audio', 'Tidak dapat memutar audio: ' + err.message, 'error');
        });
    } else {
        audio.pause();
        text.textContent = "Putar Musik";
        icon.textContent = "🎵";
    }
}

function getLocalDateISO(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseDateOnly(value) {
    const s = String(value || '').substring(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, m, d] = s.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeName(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function formatTanggalIndonesia(tanggal) {
    if (!tanggal) return '-';

    const [tahun, bulan, hari] = tanggal.substring(0, 10).split('-');

    const namaBulan = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    return `${parseInt(hari)} ${namaBulan[parseInt(bulan) - 1]} ${tahun}`;
}

function openPhotoLightbox(url){
    if(!url) return;
    const box = document.getElementById('photo-lightbox');
    const img = document.getElementById('photo-lightbox-img');
    if(!box || !img) return;
    img.src = url;
    box.classList.add('show');
    box.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closePhotoLightbox(event){
    if(event && event.target && event.target.id === 'photo-lightbox-img') return;
    const box = document.getElementById('photo-lightbox');
    const img = document.getElementById('photo-lightbox-img');
    if(!box || !img) return;
    box.classList.remove('show');
    box.setAttribute('aria-hidden', 'true');
    img.src = '';
    document.body.style.overflow = '';
}

document.addEventListener('keydown', function(e){
    if(e.key === 'Escape'){
        closePhotoLightbox();
    }
});

// Pulihkan halaman terakhir lebih dulu agar refresh tidak selalu kembali ke Beranda.
// Update UI auth segera dari localStorage agar tidak ada efek flash Tamu -> Admin.
const savedPageOnRefresh = localStorage.getItem('smpgelora_current_page') || 'home';
showAppLoading('Sedang memuat data...');
showPage(savedPageOnRefresh);
updateAdminUI();
loadData();
async function addNativeExcelCharts(xlsxBuffer, chartConfigs){
    if(typeof JSZip === 'undefined'){
        throw new Error('JSZip belum tersedia untuk membuat chart Excel native.');
    }
    if(!Array.isArray(chartConfigs) || !chartConfigs.length) return xlsxBuffer;

    const zip = await JSZip.loadAsync(xlsxBuffer);
    const sheetXmlPath = 'xl/worksheets/sheet1.xml';
    const relsPath = 'xl/worksheets/_rels/sheet1.xml.rels';
    const sheetXml = await zip.file(sheetXmlPath).async('string');
    const sheetRelsXml = await zip.file(relsPath).async('string');
    const drawingMatch = sheetXml.match(/<drawing[^>]*r:id="([^"]+)"[^>]*\/>/);
    if(!drawingMatch) throw new Error('Drawing Excel tidak ditemukan.');

    const drawingRelId = drawingMatch[1];
    const drawingRelRegex = new RegExp('<Relationship[^>]*Id="'+drawingRelId+'"[^>]*Target="([^"]+)"[^>]*/>');
    const drawingRelMatch = sheetRelsXml.match(drawingRelRegex);
    if(!drawingRelMatch) throw new Error('Relasi drawing Excel tidak ditemukan.');

    const drawingTarget = drawingRelMatch[1].replace(/^\.\.\//,'');
    const drawingPath = drawingTarget.startsWith('xl/') ? drawingTarget : 'xl/' + drawingTarget;
    const drawingRelsPath = drawingPath.replace(/([^/]+)$/, '_rels/$1.rels');
    let drawingXml = await zip.file(drawingPath).async('string');
    let drawingRelsXml = zip.file(drawingRelsPath)
        ? await zip.file(drawingRelsPath).async('string')
        : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';

    const esc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
    const existingRIds = Array.from(drawingRelsXml.matchAll(/Id="rId(\d+)"/g)).map(m => Number(m[1]));
    let nextRidNum = (existingRIds.length ? Math.max(...existingRIds) : 0) + 1;
    const chartNumsExisting = Object.keys(zip.files).map(k => { const m=k.match(/^xl\/charts\/chart(\d+)\.xml$/); return m?Number(m[1]):0; }).filter(Boolean);
    let chartNum = (chartNumsExisting.length ? Math.max(...chartNumsExisting) : 0) + 1;
    let frameId = 1000 + chartNum;

    let contentTypes = await zip.file('[Content_Types].xml').async('string');
    const colLetters = n => { let out=''; while(n>0){ let r=(n-1)%26; out=String.fromCharCode(65+r)+out; n=Math.floor((n-1)/26); } return out; };

    for(const cfg of chartConfigs){
        const labels = Array.isArray(cfg.labels) ? cfg.labels.map(v=>String(v ?? '')) : [];
        const values = Array.isArray(cfg.values) ? cfg.values.map(v=>Number(v)||0) : [];
        if(!labels.length) continue;

        const chartPath = `xl/charts/chart${chartNum}.xml`;
        const catCol = colLetters(cfg.catCol);
        const valCol = colLetters(cfg.valCol);
        const catFormula = `'Rekap Pelanggaran'!$${catCol}$${cfg.dataStart}:$${catCol}$${cfg.dataStart + labels.length - 1}`;
        const valFormula = `'Rekap Pelanggaran'!$${valCol}$${cfg.dataStart}:$${valCol}$${cfg.dataStart + values.length - 1}`;
        const catPts = labels.map((label,i)=>`<c:pt idx="${i}"><c:v>${esc(label)}</c:v></c:pt>`).join('');
        const numPts = values.map((v,i)=>`<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('');
        const chartType = cfg.chartType || 'bar';
        const isLine = chartType === 'line';
        const isPie = chartType === 'pie';
        const seriesLabel = cfg.seriesLabel || 'Jumlah';
        const barOrLine = isPie ? `<c:pieChart><c:varyColors val="1"/>` : isLine ? `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>` : `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="1"/>`;
        const endChart = isPie ? `</c:pieChart>` : isLine ? `</c:lineChart>` : `</c:barChart>`;
        const extra = isPie ? '' : isLine
            ? `<c:spPr><a:ln w="28575"><a:solidFill><a:srgbClr val="3B82F6"/></a:solidFill></a:ln></c:spPr><c:smooth val="0"/>`
            : `<c:invertIfNegative val="0"/>`;
        const axes = isPie ? '' : `<c:catAx><c:axId val="-201"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:tickLblPos val="nextTo"/><c:crossAx val="-202"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx><c:valAx><c:axId val="-202"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/><c:numFmt formatCode="0" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="-201"/><c:crosses val="autoZero"/><c:crossBetween val="midCat"/></c:valAx>`;

        // Excel desktop mengharapkan kedua axis ID berada DI DALAM chart type
        // (barChart/lineChart), bukan hanya di plotArea. WPS lebih toleran,
        // sehingga file lama bisa terlihat normal di WPS tetapi tidak di Excel.
        const chartAxisIds = isPie
            ? ''
            : '<c:axId val="-201"/><c:axId val="-202"/>';

        const chartXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<c:date1904 val="0"/><c:lang val="id-ID"/><c:roundedCorners val="0"/><c:chart><c:autoTitleDeleted val="0"/>
<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="id-ID" sz="1400" b="1"/><a:t>${esc(cfg.title)}</a:t></a:r></a:p></c:rich></c:tx><c:layout/><c:overlay val="0"/></c:title>
<c:plotArea><c:layout/>${barOrLine}
<c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:strRef><c:f>'Rekap Pelanggaran'!$${valCol}$1</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${esc(seriesLabel)}</c:v></c:pt></c:strCache></c:strRef></c:tx>
<c:cat><c:strRef><c:f>${catFormula}</c:f><c:strCache><c:ptCount val="${labels.length}"/>${catPts}</c:strCache></c:strRef></c:cat>
<c:val><c:numRef><c:f>${valFormula}</c:f><c:numCache><c:formatCode>0</c:formatCode><c:ptCount val="${values.length}"/>${numPts}</c:numCache></c:numRef></c:val>
${extra}</c:ser>${chartAxisIds}${endChart}${axes}</c:plotArea>${isPie ? '<c:legend><c:legendPos val="b"/><c:layout/><c:overlay val="0"/></c:legend>' : ''}<c:plotVisOnly val="0"/><c:dispBlanksAs val="gap"/><c:showDLblsOverMax val="0"/></c:chart></c:chartSpace>`;
        zip.file(chartPath, chartXml);

        const rid = 'rId' + nextRidNum++;
        drawingRelsXml = drawingRelsXml.replace('</Relationships>', `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${chartNum}.xml"/></Relationships>`);

        const row1 = cfg.anchorRow;
        const row2 = cfg.anchorRow + (cfg.heightRows || 15);
        const col1 = cfg.anchorCol ?? 7;
        const col2 = cfg.anchorColEnd ?? 13;
        const anchor = `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${col1}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${col2}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row2}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${frameId++}" name="Chart ${chartNum}"/><xdr:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></xdr:cNvGraphicFramePr></xdr:nvGraphicFramePr><xdr:xfrm/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${rid}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;
        drawingXml = drawingXml.replace('</xdr:wsDr>', anchor + '</xdr:wsDr>');

        if(!contentTypes.includes(`PartName="/xl/charts/chart${chartNum}.xml"`)){
            contentTypes = contentTypes.replace('</Types>', `<Override PartName="/xl/charts/chart${chartNum}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>`);
        }
        chartNum++;
    }

    zip.file(drawingRelsPath, drawingRelsXml);
    zip.file(drawingPath, drawingXml);
    zip.file('[Content_Types].xml', contentTypes);
    return await zip.generateAsync({type:'arraybuffer', compression:'DEFLATE'});
}

async function exportToExcel(){
    if(!records.length) return Swal.fire({
        icon: 'info',
        title: 'Data Kosong',
        text: 'Tidak ada data untuk diexport!',
        confirmButtonColor: '#f97316'
    });

    const today = getLocalDateISO();
    const pastDate = getLocalDateISO(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    const { value: formValues } = await Swal.fire({
        title: '📗 Export ke Excel',
        html: `
            <div style="text-align: left; font-size: 13px;">
                <label style="font-weight: bold; display: block; margin-bottom: 4px;">Dari Tanggal:</label>
                <input id="swal-export-from" type="date" class="swal2-input" value="${pastDate}" style="margin: 0 0 12px 0; width: 100%;">
                
                <label style="font-weight: bold; display: block; margin-bottom: 4px;">Sampai Tanggal:</label>
                <input id="swal-export-to" type="date" class="swal2-input" value="${today}" style="margin: 0 0 12px 0; width: 100%;">
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '📥 Export Sekarang',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#f97316',
        preConfirm: () => {
            const tglAwal = document.getElementById('swal-export-from').value;
            const tglAkhir = document.getElementById('swal-export-to').value;
            if (!tglAwal || !tglAkhir) {
                Swal.showValidationMessage('Harap isi kedua tanggal!');
                return false;
            }
            if (tglAwal > tglAkhir) {
                Swal.showValidationMessage('Tanggal awal tidak boleh lebih besar dari tanggal akhir!');
                return false;
            }
            return { tglAwal, tglAkhir };
        }
    });

    if (!formValues) return;

    const filteredRecords = records.filter(item => {
    const tanggal = item.tanggal
        ? item.tanggal.substring(0, 10)
        : '';

    return tanggal >= formValues.tglAwal &&
           tanggal <= formValues.tglAkhir;
});

    if (!filteredRecords.length) {
        return Swal.fire({
            icon: 'warning',
            title: 'Data Tidak Ditemukan',
            text: `Tidak ada data pelanggaran dari rentang tanggal ${formValues.tglAwal} s/d ${formValues.tglAkhir}.`,
            confirmButtonColor: '#f97316'
        });
    }

    Swal.fire({
        title: 'Mengeksport Data...',
        text: 'Mohon tunggu sebentar',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try{
        // Data chart native akan diambil langsung dari filteredRecords setelah workbook dibuat.

        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Rekap Pelanggaran');

        // Area A:F tetap untuk tabel. Grafik ditempatkan di sebelah kanan tabel, mulai kolom H.
        ws.mergeCells('A1:N1'); ws.mergeCells('A2:N2'); ws.mergeCells('A3:N3'); ws.mergeCells('A4:N4');
        ws.getCell('A1').value = 'REKAPITULASI PELANGGARAN SISWA/SISWI';
        ws.getCell('A2').value = 'SMP GELORA BEKASI';
        ws.getCell('A3').value = 'TAHUN AJARAN 2026-2027';
        ws.getCell('A4').value = `PERIODE: ${formValues.tglAwal} s/d ${formValues.tglAkhir}`;

        ['A1','A2','A3','A4'].forEach((cell,i) => {
            ws.getCell(cell).font = {name:'Arial', size:i===0?14:i===1?12:10, bold:true, italic: i===3};
            ws.getCell(cell).alignment = {horizontal:'center', vertical:'middle'};
        });

        ws.addRow([]);
        const header = ws.addRow(['No','Hari / Tanggal','Nama Siswa','Kelas','Jenis Pelanggaran','Foto']);
        header.eachCell(cell => {
            cell.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'2F5597'}};
            cell.font = {bold:true, color:{argb:'FFFFFF'}};
            cell.alignment = {horizontal:'center', vertical:'middle'};
            cell.border = {top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'}};
        });

        [8,18,28,12,32,20].forEach((w,i) => ws.getColumn(i+1).width = w);
        ws.getColumn(7).width = 3; // spacer
        [18,18,18,18,18,18,18].forEach((w,i) => ws.getColumn(i+8).width = w);

        // Buat SEMUA grafik seperti yang tersedia di aplikasi:
        // Jenis = bar, Kelas = bar, Tingkat = pie, Minggu = line, Bulan = line.
        // Semua menggunakan filteredRecords dari periode export yang sama.
        const chartDefinitions = [
            {key:'jenis', title:'Grafik: Jenis Pelanggaran', chartType:'bar', catCol:15, valCol:16, dataStart:2, anchorRow:4, heightRows:15},
            {key:'kelas', title:'Grafik: Per Kelas', chartType:'bar', catCol:18, valCol:19, dataStart:2, anchorRow:20, heightRows:15},
            {key:'tingkat', title:'Grafik: Per Tingkat', chartType:'pie', catCol:21, valCol:22, dataStart:2, anchorRow:36, heightRows:15},
            {key:'minggu', title:'Grafik: Tren Per Minggu', chartType:'line', catCol:24, valCol:25, dataStart:2, anchorRow:52, heightRows:15},
            {key:'bulan', title:'Grafik: Tren Per Bulan', chartType:'line', catCol:27, valCol:28, dataStart:2, anchorRow:68, heightRows:15}
        ];
        const nativeChartConfigs = [];
        chartDefinitions.forEach(def => {
            const grouped = getGroups(filteredRecords, def.key);
            const labels = grouped.map(item => item[0]);
            const values = grouped.map(item => Number(item[1]) || 0);
            const catColLetter = String.fromCharCode(64 + def.catCol);
            const valColLetter = String.fromCharCode(64 + def.valCol);
            ws.getCell(1, def.catCol).value = 'Kategori';
            ws.getCell(1, def.valCol).value = 'Jumlah';
            labels.forEach((label, idx) => {
                ws.getCell(def.dataStart + idx, def.catCol).value = label;
                ws.getCell(def.dataStart + idx, def.valCol).value = values[idx];
            });
            ws.getColumn(def.catCol).hidden = true;
            ws.getColumn(def.valCol).hidden = true;
            if(labels.length){
                nativeChartConfigs.push({
                    ...def,
                    labels,
                    values,
                    seriesLabel:'Jumlah'
                });
            }
        });

        for(let i=0; i<filteredRecords.length; i++){
            const item = filteredRecords[i];
            const row = ws.addRow([
                i+1, formatTanggalIndonesia(item.tanggal)||'-', item.nama||'-', item.kelas||'-',
                item.pelanggaran||'-', ''
            ]);
            row.height = 65;
            row.eachCell({includeEmpty:true}, cell => {
                cell.alignment = {vertical:'middle', horizontal:'center', wrapText:true};
                cell.border = {top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'}};
            });

            if(item.foto_url){
                try{
                    const response = await fetch(item.foto_url);
                    const arrayBuffer = await response.arrayBuffer();
                    const imageId = workbook.addImage({buffer:arrayBuffer, extension:'jpeg'});
                    ws.addImage(imageId, {
                        tl: {col:5.2, row:row.number-.9},
                        ext: {width:60, height:60},
                        editAs: 'oneCell'
                    });
                }catch(e){console.warn('Foto gagal dimasukkan:', e)}
            }
        }

        let buffer = await workbook.xlsx.writeBuffer();
        buffer = await addNativeExcelCharts(buffer, nativeChartConfigs);
        const blob = new Blob([buffer], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Rekap_Pelanggaran_${formValues.tglAwal}_sd_${formValues.tglAkhir}.xlsx`;
        link.click();
        URL.revokeObjectURL(url);

        Swal.fire({
            icon: 'success',
            title: 'Berhasil Export',
            text: 'File rekap Excel berhasil diunduh.',
            confirmButtonColor: '#21a366'
        });
    }catch(err){
        console.error(err);
        Swal.fire({
            icon: 'error',
            title: 'Export Gagal',
            text: 'Terjadi kesalahan saat export: '+err.message,
            confirmButtonColor: '#e53935'
        });
    }
}