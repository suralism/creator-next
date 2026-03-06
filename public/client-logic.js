// ============================================
// Creator Studio — Frontend Logic
// ============================================

// --- State ---
let currentProject = null;
let currentStep = 'script';
let generatedAudio = null;
let generatedImages = [];
let allCategories = [];
let dashboardPage = 1;
let dashboardPageSize = 10;

// --- Navigation ---
window.navigateTo = async function (page, data) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const pageEl = document.getElementById(`page-${page}`);
    const navEl = document.getElementById(`nav-${page}`);

    if (pageEl) {
        pageEl.classList.add('active');
        // Re-trigger animation
        pageEl.style.animation = 'none';
        pageEl.offsetHeight; // force reflow
        pageEl.style.animation = '';
    }
    if (navEl) navEl.classList.add('active');

    if (page === 'dashboard') {
        loadDashboard();
    } else if (page === 'project' && data?.projectId) {
        loadProject(data.projectId);
    } else if (page === 'settings') {
        loadSettings();
    } else if (page === 'autopilot') {
        if (allCategories.length === 0) {
            try { allCategories = await api('/categories'); } catch (e) { allCategories = []; }
        }
        populateCategoryDropdowns();
        await loadBgmList();
    }
};

// Navigation clicks are handled by React onClick props in page.js

// --- Toast Notifications ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// --- API Helper ---
async function api(path, options = {}) {
    try {
        const res = await fetch(`/api${path}`, {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options,
            body: options.body ? JSON.stringify(options.body) : undefined,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'API Error');
        return data;
    } catch (err) {
        showToast(err.message, 'error');
        throw err;
    }
}

// --- Dashboard ---
async function loadDashboard() {
    try {
        const projects = await api('/projects');

        // Load categories
        try { allCategories = await api('/categories'); } catch (e) { allCategories = []; }
        populateCategoryDropdowns();

        // Update stats
        document.getElementById('stat-total').textContent = projects.length;

        // Count completed steps & published
        let videoCount = 0, publishedCount = 0;
        const fbVideoIds = [];
        const ytVideoIds = [];

        projects.forEach(p => {
            if (p.steps?.video?.status === 'done') videoCount++;
            if (p.publishHistory?.length > 0) {
                publishedCount++;
                p.publishHistory.forEach(ph => {
                    if (ph.platform === 'facebook' && ph.videoId) {
                        fbVideoIds.push({ projectId: p.id, videoId: ph.videoId, pageId: ph.pageId });
                    }
                    if (ph.platform === 'youtube' && ph.videoId) {
                        ytVideoIds.push({ projectId: p.id, videoId: ph.videoId, channelId: ph.channelId });
                    }
                });
            }
        });
        document.getElementById('stat-videos').textContent = videoCount;
        document.getElementById('stat-published').textContent = publishedCount;

        // Render projects
        const list = document.getElementById('projects-list');

        // Category filter
        const filterCatId = document.getElementById('filter-category')?.value || '';
        const filteredProjects = filterCatId ? projects.filter(p => p.category === filterCatId) : projects;

        if (filteredProjects.length === 0) {
            list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎪</div>
          <h3>ยังไม่มีโปรเจค${filterCatId ? 'ในหมวดหมู่นี้' : ''}</h3>
          <p>เริ่มสร้างโปรเจคแรกของคุณเลย!</p>
          <button class="btn btn-primary" onclick="navigateTo('create')">สร้างเลย</button>
        </div>`;
            // Clear pagination
            const paginationEl = document.getElementById('dashboard-pagination');
            if (paginationEl) paginationEl.innerHTML = '';
            return;
        }

        // --- Pagination logic ---
        const totalItems = filteredProjects.length;
        const totalPages = Math.ceil(totalItems / dashboardPageSize);
        if (dashboardPage > totalPages) dashboardPage = totalPages;
        if (dashboardPage < 1) dashboardPage = 1;
        const startIdx = (dashboardPage - 1) * dashboardPageSize;
        const endIdx = Math.min(startIdx + dashboardPageSize, totalItems);
        const paginatedProjects = filteredProjects.slice(startIdx, endIdx);

        const tableRows = paginatedProjects.map(p => {
            const progress = calculateProgress(p);
            const platformLabels = {
                youtube_shorts: '📱 Shorts',
                podcast: '🎙️ Podcast',
                tiktok: '🎵 TikTok',
                reels: '📸 Reels'
            };
            const date = new Date(p.updatedAt).toLocaleDateString('th-TH', {
                day: 'numeric', month: 'short', year: 'numeric'
            });

            // Build publish badges
            let publishBadges = '<span style="color: var(--text-muted); font-size: 0.8rem;">—</span>';
            if (p.publishHistory?.length > 0) {
                const badges = p.publishHistory.map(ph => {
                    if (ph.platform === 'facebook') {
                        const typeLabel = ph.type === 'reel' ? 'Reels' : 'Video';
                        return `<a href="${ph.postUrl}" target="_blank" class="publish-badge fb-badge" onclick="event.stopPropagation()" title="Facebook ${typeLabel}">🔵 FB ${typeLabel}</a>`;
                    }
                    if (ph.platform === 'youtube') {
                        const typeLabel = ph.type === 'video' ? 'Video' : 'Shorts';
                        return `<a href="${ph.postUrl}" target="_blank" class="publish-badge yt-badge" onclick="event.stopPropagation()" title="YouTube ${typeLabel}" style="background: rgba(239,68,68,0.1); color: #ef4444; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 500; text-decoration: none; border: 1px solid rgba(239,68,68,0.2); white-space: nowrap;">🔴 YT ${typeLabel}</a>`;
                    }
                    return '';
                }).filter(Boolean).join(' ');
                publishBadges = badges || publishBadges;
            }

            // Engagement stats placeholder
            const statsId = `stats-${p.id}`;
            const hasPublish = p.publishHistory?.some(ph => ph.platform === 'facebook' || ph.platform === 'youtube');

            const cat = allCategories.find(c => c.id === p.category);
            const catBadge = cat ? `<span class="category-badge" style="background:${cat.color}22;color:${cat.color};border:1px solid ${cat.color}44;padding:2px 8px;border-radius:12px;font-size:0.7rem;">${cat.icon} ${escapeHtml(cat.name)}</span>` : '';

            return `
        <tr class="project-table-row" onclick="openProject('${p.id}')">
          <td>
            <div class="project-name-cell">
              <strong>${escapeHtml(p.name)}</strong>
              <span class="project-desc">${escapeHtml(p.description || '')} ${catBadge}</span>
            </div>
          </td>
          <td><span class="platform-badge">${platformLabels[p.platform] || p.platform}</span></td>
          <td>
            <div class="progress-bar table-progress">
              <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
            <span class="progress-text">${progress}%</span>
          </td>
          <td>${publishBadges}</td>
          <td>
            <div class="engagement-stats" id="${statsId}">
              ${hasPublish ? '<span style="color: var(--text-muted); font-size: 0.75rem;">กำลังโหลด...</span>' : '<span style="color: var(--text-muted); font-size: 0.8rem;">—</span>'}
            </div>
          </td>
          <td class="date-cell">${date}</td>
          <td>
            <button class="btn btn-sm btn-danger delete-btn-table" onclick="event.stopPropagation(); deleteProject('${p.id}')" title="ลบ">🗑 ลบ</button>
          </td>
        </tr>`;
        }).join('');

        list.innerHTML = `
          <table class="projects-table">
            <thead>
              <tr>
                <th>โปรเจค</th>
                <th>แพลตฟอร์ม</th>
                <th>สถานะ</th>
                <th>เผยแพร่</th>
                <th>Engagement</th>
                <th>อัปเดตล่าสุด</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        `;

        // --- Render Pagination Controls ---
        renderDashboardPagination(totalItems, totalPages);

        // Fetch engagement stats in background
        if (fbVideoIds.length > 0 || ytVideoIds.length > 0) {
            fetchEngagementStats(projects, fbVideoIds, ytVideoIds);
        }
    } catch (err) {
        console.error('Load dashboard error:', err);
    }
}

// Fetch engagement stats
async function fetchEngagementStats(projects, fbVideoIds, ytVideoIds) {
    try {
        let stats = {};
        let fbMissingPerms = null;

        // 1. Fetch Facebook
        if (fbVideoIds && fbVideoIds.length > 0) {
            const uniqueReq = Array.from(new Set(fbVideoIds.map(v => v.videoId)))
                .map(id => fbVideoIds.find(v => v.videoId === id));

            try {
                const fbResult = await api('/publish/facebook/stats', {
                    method: 'POST',
                    body: { videoItems: uniqueReq }
                });
                if (fbResult.stats) {
                    stats = { ...stats, ...fbResult.stats };
                }
                if (fbResult.missingPermissions) {
                    fbMissingPerms = fbResult.missingPermissions;
                }
            } catch (e) { console.error('FB Stats Err:', e) }
        }

        // 2. Fetch YouTube
        if (ytVideoIds && ytVideoIds.length > 0) {
            const uniqueReq = Array.from(new Set(ytVideoIds.map(v => v.videoId)))
                .map(id => ytVideoIds.find(v => v.videoId === id));

            try {
                const ytResult = await api('/publish/youtube/stats', {
                    method: 'POST',
                    body: { videoItems: uniqueReq }
                });
                if (ytResult.stats) {
                    stats = { ...stats, ...ytResult.stats };
                }
            } catch (e) { console.error('YT Stats Err:', e) }
        }

        // Show permission warning if missing
        if (fbMissingPerms && fbMissingPerms.length > 0) {
            const permList = fbMissingPerms.map(p => `<b>${p.permission}</b> (${p.description})`).join(', ');
            const warningEl = document.getElementById('fb-permission-warning');
            if (warningEl) {
                warningEl.innerHTML = `
                    <div style="padding: 12px 16px; background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 12px; font-size: 0.85rem; color: var(--text-secondary); display: flex; align-items: flex-start; gap: 10px;">
                        <span style="font-size: 1.2rem;">⚠️</span>
                        <div>
                            <strong style="color: #f59e0b;">Facebook Token ขาด Permissions</strong>
                            <p style="margin: 4px 0 0; line-height: 1.5;">ไม่สามารถดึง Engagement ได้เพราะ Token ขาด: ${permList}</p>
                            <p style="margin: 6px 0 0; font-size: 0.8rem; color: var(--text-muted);">
                                กรุณาสร้าง Token ใหม่จาก <a href="https://developers.facebook.com/tools/explorer/" target="_blank" style="color: var(--accent-primary);">Graph API Explorer</a> 
                                โดยเพิ่ม permissions ที่ขาด แล้ว
                                <a href="#" onclick="navigateTo('settings'); return false;" style="color: var(--accent-primary);">อัปเดต Token ในหน้าตั้งค่า</a>
                            </p>
                        </div>
                    </div>
                `;
                warningEl.style.display = 'block';
            }
        }

        let totalViews = 0;

        projects.forEach(p => {
            if (!p.publishHistory?.length) return;

            const statsEl = document.getElementById(`stats-${p.id}`);
            if (!statsEl) return;

            let projectViews = 0, projectComments = 0, projectLikes = 0;
            let hasValidStats = false;

            p.publishHistory.forEach(ph => {
                if (ph.videoId && stats[ph.videoId]) {
                    const s = stats[ph.videoId];
                    projectViews += s.views;
                    projectComments += s.comments;
                    projectLikes += s.likes;
                    hasValidStats = true;
                }
            });

            totalViews += projectViews;

            if (hasValidStats) {
                statsEl.innerHTML = `
                    <span class="eng-stat" title="ยอดวิว">👁 ${formatNumber(projectViews)}</span>
                    <span class="eng-stat" title="ถูกใจ">❤️ ${formatNumber(projectLikes)}</span>
                    <span class="eng-stat" title="คอมเมนต์">💬 ${formatNumber(projectComments)}</span>
                `;
            } else {
                const isRequested = [...fbVideoIds, ...ytVideoIds].some(v => v.projectId === p.id);
                if (isRequested && fbMissingPerms && fbMissingPerms.length > 0) {
                    statsEl.innerHTML = '<span style="color: #f59e0b; font-size: 0.75rem;" title="Token ขาด permissions">⚠️ ขาด permissions</span>';
                } else {
                    statsEl.innerHTML = isRequested ?
                        '<span style="color: var(--text-muted); font-size: 0.75rem;">ไม่พบข้อมูล</span>' :
                        '<span style="color: var(--text-muted); font-size: 0.8rem;">—</span>';
                }
            }
        });

        document.getElementById('stat-views').textContent = formatNumber(totalViews);
    } catch (err) {
        console.error('Fetch stats error:', err);
    }
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function calculateProgress(project) {
    if (!project.steps) return 0;
    const steps = ['script', 'audio', 'images', 'video'];
    const done = steps.filter(s => project.steps[s]?.status === 'done').length;
    return Math.round((done / steps.length) * 100);
}

// --- Create Project ---
window.createProject = async function () {
    const name = document.getElementById('input-name').value.trim();
    const description = document.getElementById('input-description').value.trim();
    const platform = document.getElementById('input-platform').value;
    const language = document.getElementById('input-language').value;
    const category = document.getElementById('input-category')?.value || '';

    if (!name) {
        showToast('กรุณาใส่ชื่อโปรเจค', 'warning');
        return;
    }

    const btn = document.getElementById('btn-create');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> กำลังสร้าง...';

    try {
        const project = await api('/projects', {
            method: 'POST',
            body: { name, description, platform, language, category }
        });

        showToast('สร้างโปรเจคสำเร็จ! 🎉', 'success');

        // Clear form
        document.getElementById('input-name').value = '';
        document.getElementById('input-description').value = '';

        // Open project
        openProject(project.id);
    } catch (err) {
        showToast('สร้างโปรเจคล้มเหลว', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '🚀 สร้างโปรเจค';
    }
};

// --- AI Generate Description ---
window.aiGenerateDescription = async function () {
    const name = document.getElementById('input-name').value.trim();
    if (!name) {
        showToast('กรุณาใส่ชื่อโปรเจคก่อน แล้วกดให้ AI คิดคำอธิบาย', 'warning');
        return;
    }

    const btn = document.getElementById('btn-ai-desc');
    const spinner = document.getElementById('spinner-ai-desc');
    const descEl = document.getElementById('input-description');
    const platform = document.getElementById('input-platform')?.value || 'youtube_shorts';

    const platformNames = {
        youtube_shorts: 'YouTube Shorts',
        podcast: 'Podcast',
        tiktok: 'TikTok',
        reels: 'Instagram Reels'
    };

    btn.disabled = true;
    spinner.classList.remove('hidden');

    try {
        const result = await api('/ai/chat', {
            method: 'POST',
            body: {
                message: `จากหัวข้อ "${name}" สำหรับแพลตฟอร์ม ${platformNames[platform] || platform}

ช่วยเขียนคำอธิบายสั้นๆ 2-3 ประโยค ที่อธิบายเนื้อหาวิดีโอนี้ เพื่อนำไปใช้เป็นแนวทางในการเขียนสคริปต์

ตอบเป็นข้อความธรรมดา ไม่ต้องมีหัวข้อ ไม่ต้องมี markdown ไม่ต้องมี emoji ตอบสั้นๆ กระชับ ตรงประเด็น`
            }
        });

        if (result.reply) {
            descEl.value = result.reply.trim();
            showToast('✨ AI สร้างคำอธิบายเรียบร้อย!', 'success');
        }
    } catch (err) {
        showToast('AI สร้างคำอธิบายล้มเหลว: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        spinner.classList.add('hidden');
    }
};

window.openProject = async function (projectId) {
    document.getElementById('nav-project').style.display = 'flex';
    navigateTo('project', { projectId });
    await loadProject(projectId);
};

async function loadProject(projectId) {
    try {
        const project = await api(`/projects/${projectId}`);
        currentProject = project;

        document.getElementById('project-title').textContent = project.name;
        document.getElementById('project-subtitle').textContent =
            `${getPlatformLabel(project.platform)} • ${project.language === 'th' ? 'ไทย' : 'English'}`;

        // Populate project category dropdown
        if (allCategories.length === 0) {
            try { allCategories = await api('/categories'); } catch (e) { allCategories = []; }
        }
        const catSelect = document.getElementById('project-category');
        if (catSelect) {
            catSelect.innerHTML = '<option value="">ไม่ระบุหมวดหมู่</option>' + allCategories.map(c =>
                `<option value="${c.id}">${c.icon} ${escapeHtml(c.name)}</option>`
            ).join('');
            catSelect.value = project.category || '';
        }

        // Load script if exists
        if (project.steps?.script?.content) {
            document.getElementById('script-content').value = project.steps.script.content;
            document.getElementById('input-topic').value = project.description || '';

            // Restore script meta if it exists
            if (project.steps.script.title || project.steps.script.description) {
                const metaEl = document.getElementById('script-meta');
                metaEl.classList.remove('hidden');
                document.getElementById('script-title-display').textContent = project.steps.script.title || '';
                document.getElementById('script-description-display').textContent = project.steps.script.description || '';
                document.getElementById('script-hashtags-display').textContent =
                    (project.steps.script.hashtags || []).join(' ');
            } else {
                document.getElementById('script-meta').classList.add('hidden');
            }
        } else {
            document.getElementById('script-content').value = '';
            document.getElementById('input-topic').value = project.description || project.name;
            document.getElementById('script-meta').classList.add('hidden');
        }

        // Load audio if exists
        if (project.steps?.audio?.filePath) {
            generatedAudio = project.steps.audio;
            document.getElementById('tts-text').value = project.steps.script?.content || '';
            showAudioResult(project.steps.audio.filePath);
        } else {
            generatedAudio = null;
            document.getElementById('tts-text').value = project.steps?.script?.content || '';
            document.getElementById('audio-result').classList.add('hidden');
        }

        // Load images if exists
        if (project.steps?.images?.files?.length > 0) {
            generatedImages = project.steps.images.files;
            showImagesResult(generatedImages);
        } else {
            generatedImages = [];
            document.getElementById('images-result').classList.add('hidden');
            document.getElementById('images-result').innerHTML = '';
        }

        // Update step indicators
        updateStepStatus(project);

        // Update video step
        updateVideoAssets();

        // Check FFmpeg
        checkFFmpeg();

        // Show first step
        showStep('script');

    } catch (err) {
        showToast('โหลดโปรเจคล้มเหลว', 'error');
        navigateTo('dashboard');
    }
}

function updateStepStatus(project) {
    const steps = ['script', 'audio', 'images', 'video'];
    steps.forEach(s => {
        const btn = document.getElementById(`step-btn-${s}`);
        if (btn) {
            btn.classList.remove('completed');
            if (project.steps?.[s]?.status === 'done') {
                btn.classList.add('completed');
            }
        }
    });
}

// --- Steps Navigation ---
window.showStep = function (step) {
    currentStep = step;

    document.querySelectorAll('.step-content').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.step-indicator .step').forEach(s => s.classList.remove('active'));

    const content = document.getElementById(`step-${step}`);
    const btn = document.getElementById(`step-btn-${step}`);
    if (content) content.classList.add('active');
    if (btn) btn.classList.add('active');

    // Auto-fill TTS text from script
    if (step === 'audio') {
        const scriptText = document.getElementById('script-content').value;
        if (scriptText && !document.getElementById('tts-text').value) {
            document.getElementById('tts-text').value = scriptText;
        }
    }

    // Auto-set aspect ratio from platform when entering images step
    if (step === 'images' && currentProject?.platform) {
        const aspectMap = {
            youtube_shorts: '9:16',
            tiktok: '9:16',
            reels: '9:16',
            podcast: '16:9'
        };
        const aspect = aspectMap[currentProject.platform];
        if (aspect) {
            document.getElementById('image-aspect').value = aspect;
        }
    }

    // Update video assets display
    if (step === 'video') {
        updateVideoAssets();
    }

    // Load publish data when entering publish step
    if (step === 'publish') {
        loadPublishData();
    }
};

// --- Publish Data ---
async function loadPublishData() {
    if (!currentProject) return;

    // Show video preview
    const videoSection = document.getElementById('publish-video-section');
    if (currentProject.steps?.video?.filePath) {
        videoSection.style.display = 'block';
        document.getElementById('publish-video-player').src = currentProject.steps.video.filePath;
        const dlBtn = document.getElementById('publish-video-download');
        dlBtn.href = currentProject.steps.video.filePath;
        dlBtn.download = currentProject.steps.video.fileName || 'video.mp4';
    } else {
        videoSection.style.display = 'none';
    }

    // Platform meta
    const platformLabels = {
        youtube_shorts: '📱 YouTube Shorts',
        podcast: '🎙️ Podcast',
        tiktok: '🎵 TikTok',
        reels: '📸 Instagram Reels'
    };
    const created = currentProject.createdAt
        ? new Date(currentProject.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
        : '-';
    const meta = [
        `แพลตฟอร์ม: ${platformLabels[currentProject.platform] || currentProject.platform}`,
        `ภาษา: ${currentProject.language === 'th' ? 'ไทย' : 'English'}`,
        `สร้างเมื่อ: ${created}`,
        currentProject.steps?.audio?.status === 'done' ? '✅ เสียง' : '⬜ เสียง',
        (currentProject.steps?.images?.files?.length || 0) > 0 ? `✅ รูปภาพ (${currentProject.steps.images.files.length} รูป)` : '⬜ รูปภาพ',
        currentProject.steps?.video?.status === 'done' ? '✅ วิดีโอ' : '⬜ วิดีโอ'
    ].join('\n');
    document.getElementById('publish-meta').textContent = meta;

    // Auto generate SEO content if not saved yet
    if (currentProject.steps?.seo) {
        fillPublishFields(currentProject.steps.seo);
    } else {
        await generateSeoContent();
    }

    // Load Facebook status for publish buttons
    await loadFacebookSettings();
}

async function generateSeoContent() {
    if (!currentProject) return;

    const script = currentProject.steps?.script?.content || currentProject.description || currentProject.name;
    if (!script) {
        document.getElementById('publish-title').textContent = currentProject.name || '-';
        document.getElementById('publish-description').textContent = '-';
        document.getElementById('publish-hashtags').textContent = '-';
        document.getElementById('publish-all-preview').textContent = '-';
        return;
    }

    // Show loading state
    document.getElementById('publish-title').textContent = '⏳ AI กำลังคิด SEO...';
    document.getElementById('publish-description').textContent = '⏳ กำลังสร้าง...';
    document.getElementById('publish-hashtags').textContent = '⏳ กำลังสร้าง...';
    document.getElementById('publish-all-preview').textContent = '⏳ กำลังสร้าง...';

    const platformLabels = {
        youtube_shorts: 'YouTube Shorts',
        podcast: 'Podcast',
        tiktok: 'TikTok',
        reels: 'Instagram Reels'
    };
    const platform = platformLabels[currentProject.platform] || currentProject.platform;
    const lang = currentProject.language === 'th' ? 'ภาษาไทย' : 'English';

    try {
        const result = await api('/ai/chat', {
            method: 'POST',
            body: {
                message: `จากบทพูดนี้ ช่วยสร้างข้อมูล SEO สำหรับโพสลง ${platform} ใน${lang}:

บทพูด:
${script.substring(0, 1000)}

กรุณาสร้าง:
1. title - ชื่อเรื่องที่ดึงดูดคน ใช้ SEO keywords เหมาะกับ ${platform} สั้นกระชับ จับใจ
2. description - คำอธิบายที่เหมาะกับ caption โพส ดึงดูดให้คนอยากดู มี call to action
3. hashtags - 8-15 แฮชแท็กที่เกี่ยวข้อง มีทั้งแฮชแท็กยอดนิยมและเฉพาะเจาะจง ต้องเริ่มด้วย #

ตอบเป็น JSON:
{
  "title": "...",
  "description": "...",
  "hashtags": ["#...", "#...", "#..."]
}`,
                context: 'SEO content generation'
            }
        });

        let seo;
        try {
            let text = result.reply.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            seo = JSON.parse(text);
        } catch {
            seo = {
                title: currentProject.steps?.script?.title || currentProject.name,
                description: currentProject.steps?.script?.description || '',
                hashtags: currentProject.steps?.script?.hashtags || []
            };
        }

        // Save SEO to project so it persists
        const updatedSteps = {
            ...currentProject.steps,
            seo: {
                ...seo,
                generatedAt: new Date().toISOString()
            }
        };
        await api(`/projects/${currentProject.id}`, {
            method: 'PUT',
            body: { steps: updatedSteps }
        });
        currentProject.steps = updatedSteps;

        fillPublishFields(seo);
        showToast('✨ สร้าง SEO content สำเร็จ!', 'success');
    } catch (err) {
        // Fallback to project data
        const fallback = {
            title: currentProject.steps?.script?.title || currentProject.name || '-',
            description: currentProject.steps?.script?.description || '-',
            hashtags: currentProject.steps?.script?.hashtags || []
        };
        fillPublishFields(fallback);
        showToast('ใช้ข้อมูลจากโปรเจคแทน (AI ไม่พร้อม)', 'warning');
    }
}

function fillPublishFields(seo) {
    const title = seo.title || '-';
    const description = seo.description || '-';
    const hashtags = seo.hashtags || [];
    const hashtagStr = hashtags.join(' ');

    document.getElementById('publish-title').textContent = title;
    document.getElementById('publish-description').textContent = description;
    document.getElementById('publish-hashtags').textContent = hashtagStr || '-';

    const allText = [title, '', description, '', hashtagStr].join('\n');
    document.getElementById('publish-all-preview').textContent = allText;
}

window.regenerateSeo = async function () {
    if (!currentProject) return;
    showToast('🔄 กำลังสร้าง SEO ใหม่...', 'info');
    // Clear saved SEO so it regenerates
    const updatedSteps = { ...currentProject.steps };
    delete updatedSteps.seo;
    currentProject.steps = updatedSteps;
    await generateSeoContent();
};

window.copyToClipboard = function (elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    navigator.clipboard.writeText(el.textContent).then(() => {
        showToast('📋 คัดลอกแล้ว!', 'success');
    }).catch(() => {
        showToast('คัดลอกไม่สำเร็จ', 'error');
    });
};

window.copyAllPublish = function () {
    const el = document.getElementById('publish-all-preview');
    if (!el) return;
    navigator.clipboard.writeText(el.textContent).then(() => {
        showToast('📋 คัดลอกทั้งหมดแล้ว — พร้อมวางโพส!', 'success');
    }).catch(() => {
        showToast('คัดลอกไม่สำเร็จ', 'error');
    });
};

// --- Replace Project Video ---
window.replaceProjectVideo = async function (input) {
    if (!currentProject || !input.files || input.files.length === 0) return;

    const file = input.files[0];
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);

    const statusEl = document.getElementById('video-replace-status');
    statusEl.classList.remove('hidden');
    statusEl.style.background = 'rgba(59, 130, 246, 0.1)';
    statusEl.style.color = 'var(--text-secondary)';
    statusEl.textContent = `📤 กำลังอัพโหลด ${file.name} (${fileSizeMB} MB)...`;

    try {
        const formData = new FormData();
        formData.append('video', file);

        const response = await fetch('/api/publish/upload-video', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Upload failed');

        // Update project with new video
        const updatedSteps = {
            ...currentProject.steps,
            video: {
                ...currentProject.steps.video,
                filePath: result.filePath,
                fileName: result.fileName,
                replacedAt: new Date().toISOString()
            }
        };

        await api(`/projects/${currentProject.id}`, {
            method: 'PUT',
            body: { steps: updatedSteps }
        });

        currentProject.steps = updatedSteps;

        // Refresh video player
        const player = document.getElementById('publish-video-player');
        player.src = result.filePath;
        const dlBtn = document.getElementById('publish-video-download');
        dlBtn.href = result.filePath;
        dlBtn.download = result.fileName;

        statusEl.style.background = 'rgba(74, 222, 128, 0.1)';
        statusEl.style.color = 'var(--success)';
        statusEl.textContent = `✅ ${result.message} — วิดีโอถูกแทนที่เรียบร้อย`;

        showToast('✅ อัพโหลดวิดีโอใหม่สำเร็จ!', 'success');
    } catch (err) {
        statusEl.style.background = 'rgba(248, 113, 113, 0.1)';
        statusEl.style.color = 'var(--danger)';
        statusEl.textContent = `❌ อัพโหลดล้มเหลว: ${err.message}`;

        showToast('❌ อัพโหลดล้มเหลว: ' + err.message, 'error');
    }

    // Reset file input so same file can be re-selected
    input.value = '';
};

// --- Autopilot ---
window.openAutopilotModal = function () {
    if (!currentProject) return;

    if (document.getElementById('autopilot-config-modal')) {
        document.getElementById('autopilot-config-modal').remove();
    }

    const durationOptions = document.getElementById('input-duration').innerHTML;
    const genderOptions = document.getElementById('input-gender').innerHTML;
    const voiceOptions = document.getElementById('tts-voice').innerHTML;
    const styleOptions = document.getElementById('image-style').innerHTML;
    const countOptions = document.getElementById('image-count-select').innerHTML;
    const animOptions = document.getElementById('video-animation').innerHTML;

    const modal = document.createElement('div');
    modal.id = 'autopilot-config-modal';
    modal.innerHTML = `
        <div style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85); z-index: 9999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px);">
            <div style="background: var(--bg-card); padding: 32px; border-radius: 20px; width: 100%; max-width: 500px; border: 1px solid var(--border-color); box-shadow: 0 20px 40px rgba(0,0,0,0.4);">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
                    <span style="font-size: 2rem;">🚀</span>
                    <h2 style="margin: 0; font-size: 1.5rem;">ตั้งค่า Autopilot</h2>
                </div>
                
                <p style="color: var(--text-muted); margin-bottom: 24px; font-size: 0.95rem;">
                ปรับแต่งการตั้งค่าก่อนเริ่มสร้างอัตโนมัติ (ระบบจะใช้เวลาประมาณ 2-5 นาที)
                </p>

                <div class="form-row" style="margin-bottom: 16px; display: flex; gap: 12px;">
                    <div class="form-group" style="flex: 1;">
                        <label style="font-weight: 600; margin-bottom: 6px; display: block;">⏱️ ความยาวบทพูด</label>
                        <select id="auto-duration" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary);">${durationOptions}</select>
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label style="font-weight: 600; margin-bottom: 6px; display: block;">🎭 เพศ</label>
                        <select id="auto-gender" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary);">${genderOptions}</select>
                    </div>
                </div>

                <div class="form-row" style="margin-bottom: 16px;">
                    <div class="form-group" style="width: 100%;">
                        <label style="font-weight: 600; margin-bottom: 6px; display: block;">🎤 เลือกเสียงพากย์</label>
                        <select id="auto-voice" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary);">${voiceOptions}</select>
                    </div>
                </div>
                
                <div class="form-row" style="margin-bottom: 16px; display: flex; gap: 12px;">
                    <div class="form-group" style="flex: 1;">
                        <label style="font-weight: 600; margin-bottom: 6px; display: block;">🎨 สไตล์ภาพ</label>
                        <select id="auto-style" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary);">${styleOptions}</select>
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label style="font-weight: 600; margin-bottom: 6px; display: block;">🖼️ จำนวนภาพสูงสุด</label>
                        <select id="auto-count" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary);">${countOptions}</select>
                    </div>
                </div>

                <div class="form-row" style="margin-bottom: 24px;">
                    <div class="form-group" style="width: 100%;">
                        <label style="font-weight: 600; margin-bottom: 6px; display: block;">🎬 Animation (วิดีโอ)</label>
                        <select id="auto-anim" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary);">${animOptions}</select>
                    </div>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 32px;">
                    <button class="btn btn-ghost" onclick="document.getElementById('autopilot-config-modal').remove()">ยกเลิก</button>
                    <button class="btn btn-primary" onclick="runAutopilot()" style="background: linear-gradient(135deg, #FF6B6B, #845EC2); border: none; color: white;">🚀 เริ่มทำงาน</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Sync current UI values
    document.getElementById('auto-duration').value = document.getElementById('input-duration').value;
    document.getElementById('auto-gender').value = document.getElementById('input-gender').value;
    document.getElementById('auto-voice').value = document.getElementById('tts-voice').value;
    document.getElementById('auto-style').value = document.getElementById('image-style').value;
    document.getElementById('auto-count').value = document.getElementById('image-count-select').value;
    document.getElementById('auto-anim').value = document.getElementById('video-animation').value;
};

window.runAutopilot = async function () {
    if (!currentProject) return;

    const modal = document.getElementById('autopilot-config-modal');
    if (modal) {
        // Apply back to underlying UI so they persist
        document.getElementById('input-duration').value = document.getElementById('auto-duration').value;
        document.getElementById('input-gender').value = document.getElementById('auto-gender').value;
        document.getElementById('tts-voice').value = document.getElementById('auto-voice').value;
        document.getElementById('image-style').value = document.getElementById('auto-style').value;
        document.getElementById('image-count-select').value = document.getElementById('auto-count').value;
        document.getElementById('video-animation').value = document.getElementById('auto-anim').value;
        modal.remove();
    } else {
        if (!confirm('🚀 เริ่มต้น Autopilot?')) return;
    }

    // Show autopilot overlay/modal or spinning loading
    const autopilotOverlay = document.createElement('div');
    autopilotOverlay.id = 'autopilot-overlay';
    autopilotOverlay.innerHTML = `
        <div style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.95); z-index: 9999; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; backdrop-filter: blur(10px);">
            <div style="text-align: center; max-width: 400px; padding: 40px; background: rgba(255,255,255,0.05); border-radius: 24px; border: 1px solid rgba(255,255,255,0.1);">
                <div style="font-size: 3rem; margin-bottom: 20px;">🚀</div>
                <h2 style="font-size: 1.5rem; margin-bottom: 12px; font-weight: 600;">Autopilot กำลังทำงาน...</h2>
                <div class="progress-bar" style="width: 100%; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden; margin-bottom: 20px;">
                    <div id="autopilot-progress" style="width: 0%; height: 100%; background: linear-gradient(90deg, #FF6B6B, #845EC2); transition: width 0.3s ease;"></div>
                </div>
                <p id="autopilot-status" style="color: #cbd5e1; font-size: 1.1rem; font-weight: 500;">เตรียมข้อมูล...</p>
                <p style="margin-top: 24px; font-size: 0.85rem; color: #64748b;">⚠️ กรุณาอย่าปิดหน้านี้จนกว่าจะสำเร็จ</p>
            </div>
        </div>
    `;
    document.body.appendChild(autopilotOverlay);

    const setStatus = (msg, percent) => {
        const statusEl = document.getElementById('autopilot-status');
        const progressEl = document.getElementById('autopilot-progress');
        if (statusEl) statusEl.textContent = msg;
        if (progressEl && percent) progressEl.style.width = percent + '%';
        console.log(`[Autopilot] ${msg}`);
    };

    try {
        // Step 1: Generate Script
        setStatus('1/4 กำลังคิดบท (Script)...', 10);

        const topic = document.getElementById('input-topic')?.value || currentProject.name;
        const style = document.getElementById('input-style')?.value || 'storytelling';
        const scriptDuration = document.getElementById('input-duration')?.value || '90';
        const gender = document.getElementById('input-gender')?.value || 'female';

        const scriptRes = await api('/ai/generate-script', {
            method: 'POST',
            body: { topic, platform: currentProject.platform, language: currentProject.language, style, duration: scriptDuration, gender }
        });

        const scriptContent = scriptRes.script || '';
        if (!scriptContent) throw new Error('Cannot generate script');

        const title = scriptRes.title || currentProject.name;
        const description = scriptRes.description || '';
        const hashtags = scriptRes.hashtags || [];

        // Update Project with Script
        let updatedSteps = {
            ...currentProject.steps,
            script: {
                status: 'done',
                content: scriptContent,
                title,
                description,
                hashtags,
                generatedAt: new Date().toISOString()
            }
        };

        await api(`/projects/${currentProject.id}`, { method: 'PUT', body: { steps: updatedSteps } });
        currentProject.steps = updatedSteps;

        // Ensure we have image prompts
        let promptsToUse = scriptRes.imagePrompts || [];
        const maxImageCount = parseInt(document.getElementById('image-count-select')?.value || '5', 10);

        if (promptsToUse.length === 0) {
            const lines = scriptContent.split('\n').filter(l => l.trim().length > 10);
            promptsToUse = lines.slice(0, maxImageCount).map(l => l.substring(0, 100)); // fallback
        } else if (promptsToUse.length > maxImageCount) {
            promptsToUse = promptsToUse.slice(0, maxImageCount);
        }

        setStatus('2/4 กำลังสร้างเสียง (Audio)...', 35);

        // Step 2: Generate Audio
        const ttsVoice = document.getElementById('tts-voice')?.value || 'th-TH-Standard-A'; // Default voice
        const ttsEmotion = document.getElementById('tts-emotion')?.value || 'neutral';
        const audioRes = await api('/tts/generate', {
            method: 'POST',
            body: { text: scriptContent, projectId: currentProject.id, voice: ttsVoice, emotion: ttsEmotion }
        });

        updatedSteps = {
            ...currentProject.steps,
            audio: {
                status: 'done',
                filePath: audioRes.filePath,
                emotion: ttsEmotion,
                voice: ttsVoice,
                generatedAt: new Date().toISOString()
            }
        };
        await api(`/projects/${currentProject.id}`, { method: 'PUT', body: { steps: updatedSteps } });
        currentProject.steps = updatedSteps;

        setStatus('3/4 สร้างภาพประกอบ (Images)... อาจใช้เวลาหลายนาที', 60);

        // Step 3: Generate Images
        const imageStyle = document.getElementById('image-style')?.value || 'cinematic';
        let aspectRatio = document.getElementById('image-aspect')?.value || '16:9';
        if (currentProject.platform.includes('shorts') || currentProject.platform.includes('tiktok') || currentProject.platform.includes('reels')) {
            aspectRatio = '9:16';
        }

        const imagesRes = await api('/images/generate-batch', {
            method: 'POST',
            body: {
                prompts: promptsToUse,
                projectId: currentProject.id,
                style: imageStyle,
                aspectRatio,
                scriptContext: scriptContent
            }
        });

        const successFiles = imagesRes.results.filter(r => r.success).map(r => r.filePath);
        if (successFiles.length === 0) throw new Error('ไม่สามารถสร้างรูปภาพได้เลย');

        // Update UI state
        generatedImages = successFiles;

        updatedSteps = {
            ...currentProject.steps,
            images: {
                status: 'done',
                files: successFiles,
                generatedAt: new Date().toISOString()
            }
        };
        await api(`/projects/${currentProject.id}`, { method: 'PUT', body: { steps: updatedSteps } });
        currentProject.steps = updatedSteps;

        setStatus('4/4 กำลังตัดต่อและเรนเดอร์วิดีโอ (Video)...', 85);

        // Step 4: Create Video
        const videoFormat = currentProject.platform || 'youtube_shorts';
        const videoAnimation = document.getElementById('video-animation')?.value || 'pan_zoom';
        const videoSubtitle = document.getElementById('video-subtitle')?.value === 'yes';

        // Subtitle Styles
        const subFont = document.getElementById('sub-font')?.value || 'Kanit';
        const subSize = document.getElementById('sub-size')?.value || 'medium';
        const subColor = document.getElementById('sub-color')?.value || 'white_black';
        const subBg = document.getElementById('sub-bg')?.value || 'shadow';

        const videoRes = await api('/video/create', {
            method: 'POST',
            body: {
                projectId: currentProject.id,
                audioFile: audioRes.filePath,
                imageFiles: successFiles,
                format: videoFormat,
                animation: videoAnimation,
                subtitle: videoSubtitle,
                subtitleStyle: { font: subFont, size: subSize, color: subColor, bg: subBg },
                titleOverlay: {
                    show: true,
                    aiAnalysis: true,
                    style: 'modern',
                    duration: 4,
                    projectName: currentProject.name
                },
                scriptText: currentProject.steps.script.content,
                ttsEmotion: ttsEmotion
            }
        });

        updatedSteps = {
            ...currentProject.steps,
            video: {
                status: 'done',
                filePath: videoRes.filePath,
                fileName: videoRes.fileName,
                resolution: videoRes.resolution,
                generatedAt: new Date().toISOString()
            }
        };
        await api(`/projects/${currentProject.id}`, { method: 'PUT', body: { steps: updatedSteps } });
        currentProject.steps = updatedSteps;

        setStatus('✅ เสร็จสมบูรณ์! พร้อมเผยแพร่ 🎉', 100);

        // Refresh the project in UI and jump to publish step
        setTimeout(async () => {
            autopilotOverlay.remove();
            await loadProject(currentProject.id);
            showStep('publish');
            showToast('สร้างทุกอย่างด้วย Autopilot สำเร็จ!', 'success');
        }, 1500);

    } catch (err) {
        autopilotOverlay.innerHTML = `
            <div style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.95); z-index: 9999; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; backdrop-filter: blur(10px);">
                <div style="text-align: center; max-width: 400px; padding: 40px; background: rgba(239, 68, 68, 0.1); border-radius: 24px; border: 1px solid rgba(239, 68, 68, 0.3);">
                    <div style="font-size: 3rem; margin-bottom: 20px;">❌</div>
                    <h2 style="font-size: 1.5rem; margin-bottom: 12px; font-weight: 600;">Autopilot ทำงานผิดพลาด</h2>
                    <p style="color: #fca5a5; font-size: 1.1rem; line-height: 1.5; margin-bottom: 24px;">${err.message}</p>
                    <button class="btn btn-primary" style="padding: 12px 24px; border-radius: 50px;" onclick="document.getElementById('autopilot-overlay').remove(); loadProject('${currentProject.id}');">ตกลง</button>
                </div>
            </div>
        `;
    }
};

// --- Generate Script ---
window.generateScript = async function () {
    if (!currentProject) return;

    const btn = document.getElementById('btn-generate-script');
    const spinner = document.getElementById('spinner-script');
    btn.disabled = true;
    spinner.classList.remove('hidden');

    const topic = document.getElementById('input-topic').value || currentProject.name;
    const style = document.getElementById('input-style').value;
    const duration = document.getElementById('input-duration').value;
    const gender = document.getElementById('input-gender').value;

    try {
        showToast('🤖 AI กำลังคิดบทให้...', 'info');

        const result = await api('/ai/generate-script', {
            method: 'POST',
            body: {
                topic,
                platform: currentProject.platform,
                language: currentProject.language,
                style,
                duration,
                gender
            }
        });

        // Fill in the script
        document.getElementById('script-content').value = result.script || '';

        // Show meta info
        if (result.title || result.description || result.hashtags) {
            const metaEl = document.getElementById('script-meta');
            metaEl.classList.remove('hidden');
            document.getElementById('script-title-display').textContent = result.title || '';
            document.getElementById('script-description-display').textContent = result.description || '';
            document.getElementById('script-hashtags-display').textContent =
                (result.hashtags || []).join(' ');
        }

        // Fill image prompts if available
        if (result.imagePrompts?.length > 0) {
            const promptsList = document.getElementById('image-prompts-list');
            promptsList.innerHTML = result.imagePrompts.map(prompt => `
                <div class="image-prompt-item">
                    <input type="text" class="image-prompt-input" value="${escapeHtml(prompt)}">
                    <button class="btn btn-sm btn-danger" onclick="removeImagePrompt(this)">✕</button>
                </div>
            `).join('');
        }

        showToast('สร้างบทสำเร็จ! ✨', 'success');
    } catch (err) {
        showToast('สร้างบทล้มเหลว: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        spinner.classList.add('hidden');
    }
};

// --- Save Script ---
window.saveScript = async function () {
    if (!currentProject) return;

    const content = document.getElementById('script-content').value;
    if (!content.trim()) {
        showToast('ไม่มีบทที่จะบันทึก', 'warning');
        return;
    }

    try {
        // Grab meta info if available
        const title = document.getElementById('script-title-display')?.textContent || currentProject.name;
        const description = document.getElementById('script-description-display')?.textContent || '';
        const hashtagText = document.getElementById('script-hashtags-display')?.textContent || '';
        const hashtags = hashtagText.split(/\s+/).filter(h => h.startsWith('#'));

        const updatedSteps = {
            ...currentProject.steps,
            script: {
                status: 'done',
                content,
                title,
                description,
                hashtags,
                generatedAt: new Date().toISOString()
            }
        };

        await api(`/projects/${currentProject.id}`, {
            method: 'PUT',
            body: { steps: updatedSteps }
        });

        currentProject.steps = updatedSteps;
        updateStepStatus(currentProject);

        // Auto-fill TTS
        document.getElementById('tts-text').value = content;

        showToast('บันทึกบทสำเร็จ! 💾', 'success');
    } catch (err) {
        showToast('บันทึกล้มเหลว', 'error');
    }
};

// --- Generate Audio ---
window.generateAudio = async function () {
    if (!currentProject) return;

    const text = document.getElementById('tts-text').value;
    if (!text.trim()) {
        showToast('กรุณาใส่ข้อความ', 'warning');
        return;
    }

    const btn = document.getElementById('btn-generate-audio');
    const spinner = document.getElementById('spinner-audio');
    btn.disabled = true;
    spinner.classList.remove('hidden');

    const voice = document.getElementById('tts-voice').value;
    const emotion = document.getElementById('tts-emotion')?.value || 'neutral';

    try {
        showToast('🎙️ กำลังสร้างเสียง...', 'info');

        const result = await api('/tts/generate', {
            method: 'POST',
            body: {
                text,
                voice,
                emotion,
                projectId: currentProject.id
            }
        });

        generatedAudio = result;
        showAudioResult(result.filePath);

        // Save to project
        const updatedSteps = {
            ...currentProject.steps,
            audio: {
                status: 'done',
                filePath: result.filePath,
                fileName: result.fileName,
                emotion,
                voice,
                generatedAt: new Date().toISOString()
            }
        };

        await api(`/projects/${currentProject.id}`, {
            method: 'PUT',
            body: { steps: updatedSteps }
        });

        currentProject.steps = updatedSteps;
        updateStepStatus(currentProject);

        showToast('สร้างเสียงสำเร็จ! 🎉', 'success');
    } catch (err) {
        showToast('สร้างเสียงล้มเหลว: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        spinner.classList.add('hidden');
    }
};

function showAudioResult(filePath) {
    const resultEl = document.getElementById('audio-result');
    const player = document.getElementById('audio-player');
    const info = document.getElementById('audio-info-text');

    player.src = filePath;
    info.textContent = `ไฟล์: ${filePath} `;
    resultEl.classList.remove('hidden');
}

// --- Image Prompts ---
window.addImagePrompt = function () {
    const list = document.getElementById('image-prompts-list');
    const item = document.createElement('div');
    item.className = 'image-prompt-item';
    item.innerHTML = `
        <input type="text" class="image-prompt-input" placeholder="อธิบายรูปที่ต้องการ (ภาษาอังกฤษ)">
        <button class="btn btn-sm btn-danger" onclick="removeImagePrompt(this)">✕</button>
    `;
    list.appendChild(item);
};

window.removeImagePrompt = function (btn) {
    const list = document.getElementById('image-prompts-list');
    if (list.children.length > 1) {
        btn.closest('.image-prompt-item').remove();
    }
};

window.fillImagePromptsFromScript = async function () {
    const script = document.getElementById('script-content')?.value;
    if (!script || !script.trim()) {
        showToast('ยังไม่มีบทพูด — สร้างบทในขั้นตอนที่ 1 ก่อน', 'warning');
        return;
    }

    const count = document.getElementById('image-count-select')?.value || '5';

    try {
        showToast(`🤖 AI กำลังสกัดฉากภาพ ${count} ภาพ...`, 'info');

        const result = await api('/ai/chat', {
            method: 'POST',
            body: {
                message: `จากบทพูดนี้ ช่วยสร้าง image generation prompts เป็นภาษาอังกฤษ จำนวน ${count} รายการเป๊ะๆ! ที่สัมพันธ์กับเนื้อหาในแต่ละช่วงของบทพูดอย่างต่อเนื่อง แต่ละ prompt ต้องอธิบายฉากที่เห็นให้ชัดเจนสำหรับภาพประกอบ

ตอบเป็น JSON array เท่านั้น ตัวอย่าง: ["prompt1", "prompt2", ..., "prompt${count}"]

        บทพูด:
${script} `,
                context: 'Image prompt generation'
            }
        });

        let prompts;
        try {
            let text = result.reply.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            prompts = JSON.parse(text);
        } catch {
            showToast('AI ตอบกลับผิดรูปแบบ กรุณาลองใหม่', 'error');
            return;
        }

        if (Array.isArray(prompts) && prompts.length > 0) {
            const promptsList = document.getElementById('image-prompts-list');
            promptsList.innerHTML = prompts.map(prompt => `
                <div class="image-prompt-item">
                    <input type="text" class="image-prompt-input" value="${escapeHtml(prompt)}">
                    <button class="btn btn-sm btn-danger" onclick="removeImagePrompt(this)">✕</button>
                </div>
            `).join('');
            showToast(`สร้าง prompt สำเร็จ ${prompts.length} รายการ! ✨`, 'success');
        }
    } catch (err) {
        showToast('สร้าง prompt ล้มเหลว: ' + err.message, 'error');
    }
};

// --- Generate Images ---
window.generateImages = async function () {
    if (!currentProject) return;

    const inputs = document.querySelectorAll('.image-prompt-input');
    const prompts = Array.from(inputs).map(i => i.value.trim()).filter(Boolean);

    if (prompts.length === 0) {
        showToast('กรุณาใส่ prompt สำหรับสร้างรูป', 'warning');
        return;
    }

    const btn = document.getElementById('btn-generate-images');
    const spinner = document.getElementById('spinner-images');
    btn.disabled = true;
    spinner.classList.remove('hidden');

    const style = document.getElementById('image-style').value;
    const aspectRatio = document.getElementById('image-aspect').value;
    const scriptContext = document.getElementById('script-content')?.value || '';

    try {
        showToast('🎨 กำลังสร้างรูปภาพ... อาจใช้เวลาสักครู่', 'info');

        const result = await api('/images/generate-batch', {
            method: 'POST',
            body: {
                prompts,
                projectId: currentProject.id,
                style,
                aspectRatio,
                scriptContext
            }
        });

        const successFiles = result.results
            .filter(r => r.success)
            .map(r => r.filePath);

        generatedImages = successFiles;
        showImagesResult(successFiles);

        // Save to project
        const updatedSteps = {
            ...currentProject.steps,
            images: {
                status: 'done',
                files: successFiles,
                generatedAt: new Date().toISOString()
            }
        };

        await api(`/projects/${currentProject.id}`, {
            method: 'PUT',
            body: { steps: updatedSteps }
        });

        currentProject.steps = updatedSteps;
        updateStepStatus(currentProject);

        const failCount = result.results.filter(r => !r.success).length;
        if (failCount > 0) {
            showToast(`สร้างรูปสำเร็จ ${successFiles.length} รูป, ล้มเหลว ${failCount} รูป`, 'warning');
        } else {
            showToast(`สร้างรูปสำเร็จ ${successFiles.length} รูป! 🖼️`, 'success');
        }
    } catch (err) {
        showToast('สร้างรูปล้มเหลว: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        spinner.classList.add('hidden');
    }
};

function showImagesResult(files) {
    const grid = document.getElementById('images-result');
    const header = document.getElementById('images-result-header');
    grid.classList.remove('hidden');
    if (header) {
        header.classList.remove('hidden');
        header.style.display = 'flex';
    }

    generatedImages = [...files]; // keep in sync

    grid.innerHTML = files.map((f, i) => {
        const isVideo = /\.(mp4|mov|webm|avi)$/i.test(f);
        const mediaEl = isVideo
            ? `<video src="${f}" controls autoplay muted loop playsinline style="width:100%; height:100%; object-fit:cover;"></video>`
            : `<img src="${f}" alt="Image ${i + 1}" loading="lazy">`;

        return `
            <div class="image-card" draggable="true" data-index="${i}"
                 ondragstart="window._imgDragStart(event)" ondragover="window._imgDragOver(event)"
                 ondrop="window._imgDrop(event)" ondragend="window._imgDragEnd(event)"
                 style="position: relative; cursor: grab;">
                ${mediaEl}
                <div class="image-overlay" style="display: flex; justify-content: space-between; align-items: center; padding: 4px 8px;">
                    <span style="font-weight: 600;">${isVideo ? '🎬' : '🖼️'} ${i + 1}</span>
                    <button onclick="window.deleteImage(${i})" class="btn btn-sm" style="background: rgba(239,68,68,0.8); color: white; padding: 2px 8px; font-size: 0.75rem; border-radius: 6px; min-width: auto;">✕</button>
                </div>
                <div class="drag-handle" style="position: absolute; top: 6px; left: 6px; background: rgba(0,0,0,0.6); color: white; padding: 2px 6px; border-radius: 6px; font-size: 0.7rem; pointer-events: none;">⠿</div>
            </div>
        `;
    }).join('');
}

// --- Upload Custom Images/Videos ---
window.uploadCustomImages = async function () {
    const input = document.getElementById('upload-images-input');
    if (!input.files || input.files.length === 0) return;
    if (!currentProject) {
        showToast('กรุณาเปิดโปรเจคก่อนอัปโหลด', 'warning');
        return;
    }

    const preview = document.getElementById('upload-preview');
    preview.style.display = 'block';
    preview.innerHTML = `<span class="spinner"></span> กำลังอัปโหลด ${input.files.length} ไฟล์...`;

    try {
        const formData = new FormData();
        formData.append('projectId', currentProject.id);
        for (const file of input.files) {
            formData.append('files', file);
        }

        const response = await fetch('/api/images/upload', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();

        if (result.success) {
            const uploadedFiles = result.results.filter(r => r.success).map(r => r.filePath);

            // Add to existing images
            generatedImages = [...generatedImages, ...uploadedFiles];
            showImagesResult(generatedImages);

            // Save to project
            await saveImageOrder();

            preview.innerHTML = `✅ อัปโหลดสำเร็จ ${result.uploaded} ไฟล์${result.failed > 0 ? `, ล้มเหลว ${result.failed} ไฟล์` : ''}`;
            showToast(`📤 อัปโหลดสำเร็จ ${result.uploaded} ไฟล์!`, 'success');
        } else {
            preview.innerHTML = `❌ ${result.error}`;
            showToast('อัปโหลดล้มเหลว', 'error');
        }
    } catch (err) {
        preview.innerHTML = `❌ ${err.message}`;
        showToast('อัปโหลดล้มเหลว: ' + err.message, 'error');
    }

    // Reset input
    input.value = '';
};

// --- Delete Image ---
window.deleteImage = async function (index) {
    if (!confirm(`ลบ ${/\.(mp4|mov|webm|avi)$/i.test(generatedImages[index]) ? 'วิดีโอ' : 'รูป'}ที่ ${index + 1} หรือไม่?`)) return;
    generatedImages.splice(index, 1);
    showImagesResult(generatedImages);
    await saveImageOrder();
    showToast('ลบสำเร็จ', 'success');
};

// --- Drag & Drop Reorder ---
let _dragIdx = null;

window._imgDragStart = function (e) {
    _dragIdx = parseInt(e.currentTarget.dataset.index);
    e.currentTarget.style.opacity = '0.4';
    e.dataTransfer.effectAllowed = 'move';
};

window._imgDragOver = function (e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const card = e.currentTarget;
    card.style.outline = '2px solid var(--accent-primary)';
    card.style.outlineOffset = '-2px';
};

window._imgDrop = function (e) {
    e.preventDefault();
    const dropIdx = parseInt(e.currentTarget.dataset.index);
    e.currentTarget.style.outline = '';

    if (_dragIdx !== null && _dragIdx !== dropIdx) {
        // Swap items
        const item = generatedImages.splice(_dragIdx, 1)[0];
        generatedImages.splice(dropIdx, 0, item);
        showImagesResult(generatedImages);
        saveImageOrder();
        showToast(`ย้ายจากตำแหน่ง ${_dragIdx + 1} → ${dropIdx + 1}`, 'info');
    }
    _dragIdx = null;
};

window._imgDragEnd = function (e) {
    e.currentTarget.style.opacity = '1';
    e.currentTarget.style.outline = '';
    // Clear all outlines
    document.querySelectorAll('#images-result .image-card').forEach(c => {
        c.style.outline = '';
        c.style.opacity = '1';
    });
};

// --- Save Image Order ---
async function saveImageOrder() {
    if (!currentProject) return;
    try {
        const updatedSteps = {
            ...currentProject.steps,
            images: {
                status: 'done',
                files: generatedImages,
                generatedAt: currentProject.steps?.images?.generatedAt || new Date().toISOString()
            }
        };

        await api(`/projects/${currentProject.id}`, {
            method: 'PUT',
            body: { steps: updatedSteps }
        });

        currentProject.steps = updatedSteps;
        updateStepStatus(currentProject);
    } catch (err) {
        console.error('Save image order error:', err);
    }
}

// --- Video ---
async function checkFFmpeg() {
    const statusEl = document.getElementById('ffmpeg-status');
    try {
        const result = await api('/video/check-ffmpeg');
        if (result.available) {
            statusEl.className = 'ffmpeg-status ready';
            statusEl.innerHTML = `✅ FFmpeg พร้อมใช้งาน`;
        } else {
            statusEl.className = 'ffmpeg-status error';
            statusEl.innerHTML = `❌ ไม่พบ FFmpeg - กรุณาติดตั้งก่อน`;
        }
    } catch {
        statusEl.className = 'ffmpeg-status error';
        statusEl.innerHTML = `❌ ไม่สามารถตรวจสอบ FFmpeg ได้`;
    }
}

function updateVideoAssets() {
    const audioEl = document.getElementById('video-audio-file');
    const imageEl = document.getElementById('video-image-count');

    if (currentProject?.steps?.audio?.filePath) {
        audioEl.textContent = `✅ ${currentProject.steps.audio.fileName || 'มีไฟล์เสียง'} `;
    } else {
        audioEl.textContent = '⚠️ ยังไม่มีไฟล์เสียง - สร้างในขั้นตอนที่ 2';
    }

    if (generatedImages.length > 0) {
        imageEl.textContent = `✅ ${generatedImages.length} รูปภาพ`;
    } else {
        imageEl.textContent = '⚠️ ยังไม่มีรูปภาพ - สร้างในขั้นตอนที่ 3';
    }

    // Set video format from project platform
    if (currentProject?.platform) {
        const formatSelect = document.getElementById('video-format');
        if (formatSelect) {
            formatSelect.value = currentProject.platform;
        }
    }
}

// --- Generate Cover Preview ---
window.currentCoverImage = null;
window.generateCoverPreview = async function () {
    if (!currentProject) return;

    const btn = document.getElementById('btn-preview-cover');
    const spinner = document.getElementById('spinner-cover');
    const previewArea = document.getElementById('cover-preview-area');
    const previewImg = document.getElementById('cover-preview-img');
    const previewText = document.getElementById('cover-preview-text');

    btn.disabled = true;
    spinner.classList.remove('hidden');

    const aiAnalysis = document.getElementById('title-ai-analysis')?.value === 'yes';
    const format = document.getElementById('video-format').value;
    const aspectRatio = format === 'youtube_doc' || format === 'podcast' ? '16:9' : '9:16';

    try {
        const result = await api('/video/generate-cover', {
            method: 'POST',
            body: {
                projectName: currentProject.name,
                aiAnalysis,
                aspectRatio,
                projectId: currentProject.id
            }
        });

        if (result.success) {
            window.currentCoverImage = result.filePath;
            window.currentHookText = result.hookText;
            previewImg.src = result.filePath;
            previewText.textContent = `🎯 พาดหัวที่ AI วิเคราะห์: "${result.hookText}"`;
            previewArea.classList.remove('hidden');
            showToast('สร้างพรีวิวหน้าปกสำเร็จ!', 'success');
        }
    } catch (err) {
        showToast('สร้างพรีวิวหน้าปกล้มเหลว: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        spinner.classList.add('hidden');
    }
};

window.createVideo = async function () {
    if (!currentProject) return;

    if (!currentProject.steps?.audio?.filePath) {
        showToast('ต้องสร้างเสียงก่อน (ขั้นตอนที่ 2)', 'warning');
        return;
    }

    if (generatedImages.length === 0) {
        showToast('ต้องสร้างรูปภาพก่อน (ขั้นตอนที่ 3)', 'warning');
        return;
    }

    const btn = document.getElementById('btn-create-video');
    const spinner = document.getElementById('spinner-video');
    btn.disabled = true;
    spinner.classList.remove('hidden');

    const format = document.getElementById('video-format').value;
    const animation = document.getElementById('video-animation').value;
    const subtitle = document.getElementById('video-subtitle')?.value === 'yes';

    // Subtitle Styles
    const subFont = document.getElementById('sub-font')?.value || 'Kanit';
    const subSize = document.getElementById('sub-size')?.value || 'medium';
    const subColor = document.getElementById('sub-color')?.value || 'white_black';
    const subBg = document.getElementById('sub-bg')?.value || 'shadow';
    const subPos = document.getElementById('sub-pos')?.value || 'bottom';

    const bgmFile = document.getElementById('video-bgm')?.value || null;
    const bgmVolume = document.getElementById('bgm-volume')?.value || 20;

    // Get TTS emotion to help subtitle sync for fast-paced speech
    const ttsEmotion = currentProject.steps?.audio?.emotion || document.getElementById('tts-emotion')?.value || 'neutral';

    // Title Overlay Settings
    const showTitleOverlay = document.getElementById('check-title-overlay')?.checked || false;
    const titleAiAnalysis = document.getElementById('title-ai-analysis')?.value === 'yes';
    const titleDuration = parseInt(document.getElementById('title-duration')?.value || '4');

    try {
        showToast('🎬 กำลังสร้างวิดีโอ... อาจใช้เวลา 1-2 นาที', 'info');

        const result = await api('/video/create', {
            method: 'POST',
            body: {
                projectId: currentProject.id,
                audioFile: currentProject.steps.audio.filePath,
                imageFiles: generatedImages,
                format,
                animation,
                subtitle,
                subtitleStyle: { font: subFont, size: subSize, color: subColor, bg: subBg, pos: subPos },
                titleOverlay: {
                    show: showTitleOverlay,
                    type: 'ai_cover',
                    aiAnalysis: titleAiAnalysis,
                    duration: titleDuration,
                    projectName: currentProject.name,
                    activeTitleText: window.currentHookText || currentProject.name,
                    aspectRatio: format === 'youtube_doc' || format === 'podcast' ? '16:9' : '9:16',
                    useExistingCover: !!window.currentCoverImage,
                    existingCoverPath: window.currentCoverImage
                },
                scriptText: currentProject.steps.script.content,
                bgmFile,
                bgmVolume: parseFloat(bgmVolume) / 100,
                ttsEmotion
            }
        });

        // Show video result
        const resultEl = document.getElementById('video-result');
        const player = document.getElementById('video-player');
        const downloadBtn = document.getElementById('video-download');

        player.src = result.filePath;
        downloadBtn.href = result.filePath;
        downloadBtn.download = result.fileName;
        resultEl.classList.remove('hidden');

        // Save to project
        const updatedSteps = {
            ...currentProject.steps,
            video: {
                status: 'done',
                filePath: result.filePath,
                fileName: result.fileName,
                thumbnailPath: result.thumbnailPath || null,
                resolution: result.resolution,
                generatedAt: new Date().toISOString()
            }
        };

        await api(`/projects/${currentProject.id}`, {
            method: 'PUT',
            body: { steps: updatedSteps }
        });

        currentProject.steps = updatedSteps;
        updateStepStatus(currentProject);

        showToast('สร้างวิดีโอสำเร็จ! 🎬🎉', 'success');
    } catch (err) {
        showToast('สร้างวิดีโอล้มเหลว: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        spinner.classList.add('hidden');
    }
};

// --- Delete Project ---
window.deleteProject = async function (projectId) {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบโปรเจคนี้?')) return;

    try {
        await api(`/projects/${projectId}`, { method: 'DELETE' });
        showToast('ลบโปรเจคสำเร็จ', 'success');
        loadDashboard();
    } catch (err) {
        showToast('ลบโปรเจคล้มเหลว', 'error');
    }
};

// --- Utilities ---
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getPlatformLabel(platform) {
    const labels = {
        youtube_shorts: '📱 YouTube Shorts',
        youtube_doc: '🎬 YouTube Documentary',
        podcast: '🎙️ Podcast',
        tiktok: '🎵 TikTok',
        reels: '📸 Instagram Reels'
    };
    return labels[platform] || platform;
}

// --- Settings: API Key Management ---
async function loadSettings() {
    try {
        const settings = await api('/settings');
        renderApiKeys(settings.apiKeys || [], settings.activeKeyId);
    } catch (err) {
        console.error('Load settings error:', err);
    }
    // Load categories for management
    try { allCategories = await api('/categories'); } catch (e) { allCategories = []; }
    renderCategoryList();
    // Load BGM list
    await loadBgmList();
    // Also load Facebook settings
    await loadFacebookSettings();
    // Load storage info
    await loadStorageInfo();
}

// --- Storage Management ---
async function loadStorageInfo() {
    const container = document.getElementById('storage-section');
    if (!container) return;

    container.innerHTML = `<div style="text-align: center; padding: 20px;"><span class="spinner"></span> กำลังวิเคราะห์พื้นที่...</div>`;

    try {
        const data = await api('/storage');

        const folderRows = Object.entries(data.folders).map(([name, info]) => {
            const icons = { images: '🖼️', audio: '🔊', videos: '🎬', exports: '📦' };
            const pct = data.totalSize > 0 ? ((info.size / data.totalSize) * 100).toFixed(1) : 0;
            return `
                <div style="display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
                    <span style="min-width: 30px;">${icons[name] || '📁'}</span>
                    <span style="min-width: 80px; font-weight: 600;">${name}</span>
                    <div style="flex: 1; background: var(--bg-secondary); border-radius: 8px; height: 20px; overflow: hidden;">
                        <div style="height: 100%; width: ${pct}%; background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary)); border-radius: 8px; transition: width 0.5s;"></div>
                    </div>
                    <span style="min-width: 80px; text-align: right; font-weight: 500;">${info.sizeFormatted}</span>
                    <span style="min-width: 60px; text-align: right; color: var(--text-muted);">${info.files} ไฟล์</span>
                </div>
            `;
        }).join('');

        const orphanedProjects = data.projects.filter(p => p.isOrphaned);
        const activeProjects = data.projects.filter(p => !p.isOrphaned);

        const projectRows = activeProjects.slice(0, 10).map(p => `
            <div style="display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(p.name)}</span>
                <span style="min-width: 80px; text-align: right; color: var(--text-muted);">${p.files} ไฟล์</span>
                <span style="min-width: 80px; text-align: right; font-weight: 500;">${p.sizeFormatted}</span>
                <button onclick="cleanupStorage('project', '${p.id}')" class="btn btn-sm" style="background: rgba(239,68,68,0.15); color: #ef4444; padding: 2px 8px; font-size: 0.75rem;">🗑️ ลบไฟล์</button>
            </div>
        `).join('');

        container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                <div>
                    <h3 style="margin: 0;">💾 พื้นที่จัดเก็บ</h3>
                    <p style="margin: 4px 0 0; color: var(--text-muted); font-size: 0.85rem;">ใช้พื้นที่ทั้งหมด <strong>${data.totalSizeFormatted}</strong> • ${data.activeProjectCount} โปรเจค</p>
                </div>
            </div>

            <div style="margin-bottom: 20px;">${folderRows}</div>

            ${data.orphanedSize > 0 ? `
            <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: var(--radius-md); padding: 16px; margin-bottom: 16px;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <h4 style="margin: 0; color: #ef4444;">⚠️ ไฟล์จากโปรเจคที่ลบแล้ว</h4>
                        <p style="margin: 4px 0 0; font-size: 0.85rem; color: var(--text-muted);">
                            พบ <strong>${data.orphanedFileCount}</strong> ไฟล์ ขนาดรวม <strong>${data.orphanedSizeFormatted}</strong> ที่เป็นของโปรเจคที่ลบไปแล้ว
                        </p>
                    </div>
                    <button onclick="cleanupStorage('orphaned')" class="btn btn-sm" style="background: #ef4444; color: white; white-space: nowrap;">🧹 เคลียร์ทั้งหมด</button>
                </div>
            </div>
            ` : ''}

            ${data.tempFilesCount > 0 ? `
            <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: var(--radius-md); padding: 16px; margin-bottom: 16px;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <h4 style="margin: 0; color: #f59e0b;">🧹 ไฟล์ชั่วคราว</h4>
                        <p style="margin: 4px 0 0; font-size: 0.85rem; color: var(--text-muted);">
                            พบ <strong>${data.tempFilesCount}</strong> ไฟล์ (subtitle, segment, replaced) ขนาดรวม <strong>${data.tempFilesSizeFormatted}</strong>
                        </p>
                    </div>
                    <button onclick="cleanupStorage('temp')" class="btn btn-sm" style="background: #f59e0b; color: white; white-space: nowrap;">🧹 ลบไฟล์ temp</button>
                </div>
            </div>
            ` : ''}

            ${projectRows ? `
            <div style="margin-top: 16px;">
                <h4 style="margin: 0 0 8px;">📊 พื้นที่แยกตามโปรเจค (Top 10)</h4>
                ${projectRows}
            </div>
            ` : ''}
        `;
    } catch (err) {
        container.innerHTML = `<p style="color: #ef4444;">❌ โหลดข้อมูลพื้นที่ล้มเหลว: ${err.message}</p>`;
    }
}

window.cleanupStorage = async function (action, projectId) {
    const messages = {
        orphaned: 'ลบไฟล์จากโปรเจคที่ถูกลบทั้งหมด?',
        temp: 'ลบไฟล์ชั่วคราว (segment, concat, sub_test)?',
        project: 'ลบไฟล์ทั้งหมดของโปรเจคนี้? (ข้อมูลโปรเจคจะยังอยู่)'
    };

    if (!confirm(messages[action] || 'ยืนยันการลบ?')) return;

    try {
        showToast('🧹 กำลังเคลียร์ไฟล์...', 'info');
        const result = await fetch('/api/storage', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, projectId })
        }).then(r => r.json());

        if (result.success) {
            showToast(`✅ ลบสำเร็จ ${result.deletedCount} ไฟล์ คืนพื้นที่ ${result.freedSpaceFormatted}`, 'success');
            await loadStorageInfo(); // Refresh
        } else {
            showToast('ลบล้มเหลว', 'error');
        }
    } catch (err) {
        showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    }
};

function renderApiKeys(keys, activeKeyId) {
    const list = document.getElementById('api-keys-list');

    if (keys.length === 0) {
        list.innerHTML = `
            <div class="empty-keys">
                <p>ยังไม่มี API Key — เพิ่ม Key ด้านบนเพื่อเริ่มใช้งาน</p>
      </div>`;
        return;
    }

    list.innerHTML = keys.map(k => {
        const isActive = k.id === activeKeyId;
        const date = new Date(k.createdAt).toLocaleDateString('th-TH', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
        return `
            <div class="key-card ${isActive ? 'active' : ''}">
        <div class="key-status"></div>
        <div class="key-info" style="flex: 1; min-width: 0;">
          <div class="key-label">${escapeHtml(k.label)} ${isActive ? '✅ Active' : ''}</div>
          <div class="key-value" style="word-break: break-all;">${k.key}</div>
          <div class="key-date">เพิ่มเมื่อ ${date}</div>
        </div>
        <div class="key-actions">
          <button class="btn btn-secondary" onclick="testExistingApiKey('${k.id}')">ทดสอบการเชื่อมต่อ</button>
          ${!isActive ? `<button class="btn btn-secondary" onclick="activateApiKey('${k.id}')">เปิดใช้</button>` : ''}
          <button class="btn btn-danger" onclick="deleteApiKey('${k.id}')">ลบ</button>
        </div>
      </div>`;
    }).join('');
}

window.addApiKey = async function () {
    const label = document.getElementById('new-key-label').value.trim();
    const key = document.getElementById('new-key-value').value.trim();

    if (!key) {
        showToast('กรุณาใส่ API Key', 'warning');
        return;
    }

    try {
        await api('/settings/api-keys', {
            method: 'POST',
            body: { label: label || 'API Key', key }
        });

        // Clear form
        document.getElementById('new-key-label').value = '';
        document.getElementById('new-key-value').value = '';

        showToast('เพิ่ม API Key สำเร็จ! 🔑', 'success');
        loadSettings();
    } catch (err) {
        showToast('เพิ่ม API Key ล้มเหลว', 'error');
    }
};

window.testApiKey = async function () {
    const key = document.getElementById('new-key-value').value.trim();
    if (!key) {
        showToast('กรุณาใส่ API Key ที่จะทดสอบ', 'warning');
        return;
    }

    const btn = document.getElementById('btn-test-key');
    const spinner = document.getElementById('spinner-test-key');
    btn.disabled = true;
    spinner.classList.remove('hidden');

    try {
        const result = await api('/settings/api-keys/test', {
            method: 'POST',
            body: { key }
        });

        if (result.success) {
            showToast(`✅ ${result.message} `, 'success');
        } else {
            showToast(`❌ ${result.message} `, 'error');
        }
    } catch (err) {
        showToast('ทดสอบ Key ล้มเหลว', 'error');
    } finally {
        btn.disabled = false;
        spinner.classList.add('hidden');
    }
};

window.testExistingApiKey = async function (keyId) {
    try {
        showToast('กำลังทดสอบการเชื่อมต่อ...', 'info');
        const result = await api('/settings/api-keys/test', {
            method: 'POST',
            body: { id: keyId }
        });

        if (result.success) {
            showToast(`✅ ${result.message}`, 'success');
        } else {
            showToast(`❌ ${result.message}`, 'error');
        }
    } catch (err) {
        showToast('ทดสอบ Key ล้มเหลว', 'error');
    }
};

window.activateApiKey = async function (keyId) {
    try {
        await api(`/settings/api-keys/${keyId}/activate`, { method: 'PUT' });
        showToast('เปลี่ยน Active Key สำเร็จ! ✅', 'success');
        loadSettings();
    } catch (err) {
        showToast('เปลี่ยน Key ล้มเหลว', 'error');
    }
};

window.deleteApiKey = async function (keyId) {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบ API Key นี้?')) return;

    try {
        await api(`/settings/api-keys/${keyId}`, { method: 'DELETE' });
        showToast('ลบ API Key สำเร็จ', 'success');
        loadSettings();
    } catch (err) {
        showToast('ลบ Key ล้มเหลว', 'error');
    }
};

// --- Check API Status ---
async function checkApiStatus() {
    const statusEl = document.getElementById('api-status');
    try {
        const result = await fetch('/api/health');
        if (result.ok) {
            statusEl.innerHTML = '<span class="status-dot online"></span><span>API พร้อมใช้งาน</span>';
        } else {
            statusEl.innerHTML = '<span class="status-dot offline"></span><span>API ไม่พร้อม</span>';
        }
    } catch {
        statusEl.innerHTML = '<span class="status-dot offline"></span><span>ไม่สามารถเชื่อมต่อ API</span>';
    }
}

// --- Facebook Pages Integration (Multi-Page) ---
let cachedFbPages = [];

async function loadFacebookSettings() {
    try {
        const result = await api('/settings/facebook');
        cachedFbPages = result.pages || [];

        // Render pages list in settings
        const listEl = document.getElementById('fb-pages-list');
        if (listEl) {
            if (cachedFbPages.length === 0) {
                listEl.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">ยังไม่มี Facebook Page — เพิ่ม Page ด้านล่าง</p>';
            } else {
                listEl.innerHTML = cachedFbPages.map(p => `
                    <div style="padding: 12px 16px; background: rgba(66, 133, 244, 0.08); border: 1px solid rgba(66, 133, 244, 0.2); border-radius: var(--radius-md); margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="font-size: 1.2rem;">✅</span>
                            <div style="flex: 1; min-width: 0;">
                                <strong>${escapeHtml(p.pageName || p.pageId)}</strong>
                                <span style="color: var(--text-muted); font-size: 0.8rem; display: block; word-break: break-all;">
                                    ID: ${p.pageId} · Token: ${p.tokenMasked}
                                </span>
                            </div>
                            <button class="btn btn-sm btn-secondary" onclick="editFacebookPageToken('${p.pageId}', '${escapeHtml(p.pageName || p.pageId)}')" title="แก้ไข Token">✏️ แก้ไข</button>
                            <button class="btn btn-sm btn-secondary" onclick="testExistingFacebookPage('${p.pageId}')" title="ทดสอบ">ทดสอบ</button>
                            <button class="btn btn-sm btn-danger" onclick="removeFacebookPage('${p.id}')" title="ลบ">🗑️</button>
                        </div>
                        <div id="fb-edit-form-${p.pageId}" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(66, 133, 244, 0.15);">
                            <label style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 6px; display: block;">🔑 ใส่ Token ใหม่สำหรับ ${escapeHtml(p.pageName || p.pageId)}</label>
                            <div style="display: flex; gap: 8px;">
                                <input type="text" id="fb-edit-token-${p.pageId}" placeholder="ใส่ Page Access Token ใหม่..." style="flex: 1; padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary); font-size: 0.9rem;">
                                <button class="btn btn-primary btn-sm" onclick="updateFacebookPageToken('${p.pageId}', '${escapeHtml(p.pageName || '')}')">💾 บันทึก</button>
                                <button class="btn btn-secondary btn-sm" onclick="document.getElementById('fb-edit-form-${p.pageId}').style.display='none'">ยกเลิก</button>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        }

        // Update publish page Facebook status
        updateFacebookPublishUI();
    } catch (err) {
        console.error('Load FB settings error:', err);
    }
}

function updateFacebookPublishUI() {
    const notConnected = document.getElementById('fb-not-connected');
    const connected = document.getElementById('fb-connected');
    if (!notConnected || !connected) return;

    if (cachedFbPages.length > 0) {
        notConnected.style.display = 'none';
        connected.style.display = 'block';

        // Populate page selector
        const select = document.getElementById('fb-publish-page');
        if (select) {
            select.innerHTML = cachedFbPages.map(p =>
                `<option value="${p.pageId}">${escapeHtml(p.pageName || p.pageId)}</option>`
            ).join('');
        }
    } else {
        notConnected.style.display = 'block';
        connected.style.display = 'none';
    }
}

window.saveFacebookSettings = async function () {
    const pageId = document.getElementById('fb-page-id').value.trim();
    const pageToken = document.getElementById('fb-page-token').value.trim();
    const pageName = document.getElementById('fb-page-name').value.trim();

    if (!pageId || !pageToken) {
        showToast('กรุณาใส่ Page ID และ Token', 'warning');
        return;
    }

    try {
        const result = await api('/settings/facebook', {
            method: 'POST',
            body: { pageId, pageToken, pageName }
        });

        showToast(`✅ ${result.message}`, 'success');
        document.getElementById('fb-page-id').value = '';
        document.getElementById('fb-page-token').value = '';
        document.getElementById('fb-page-name').value = '';
        await loadFacebookSettings();
    } catch (err) {
        showToast('เพิ่ม Page ล้มเหลว: ' + err.message, 'error');
    }
};

window.testFacebookToken = async function () {
    const token = document.getElementById('fb-page-token').value.trim();
    const pageId = document.getElementById('fb-page-id').value.trim();

    if (!token || !pageId) {
        showToast('กรุณาใส่ Page ID และ Token ก่อนทดสอบ', 'warning');
        return;
    }

    const btn = document.getElementById('btn-test-fb');
    const spinner = document.getElementById('spinner-test-fb');
    btn.disabled = true;
    spinner.classList.remove('hidden');

    try {
        const result = await api('/publish/facebook/test', {
            method: 'POST',
            body: { token, pageId }
        });

        const resultEl = document.getElementById('fb-test-result');
        const msgEl = document.getElementById('fb-test-message');
        resultEl.classList.remove('hidden');

        if (result.success) {
            msgEl.style.background = 'rgba(74, 222, 128, 0.1)';
            msgEl.style.color = 'var(--success)';
            msgEl.textContent = `✅ ${result.message}`;
        } else {
            msgEl.style.background = 'rgba(248, 113, 113, 0.1)';
            msgEl.style.color = 'var(--danger)';
            msgEl.textContent = `❌ ${result.message}`;
        }
    } catch (err) {
        showToast('ทดสอบล้มเหลว: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        spinner.classList.add('hidden');
    }
};

window.testExistingFacebookPage = async function (pageId) {
    try {
        showToast('กำลังทดสอบการเชื่อมต่อ Facebook...', 'info');
        // Fetch the list of pages to get the token for the specific pageId from the backend
        // We could get it from the cachedFbPages, but it might only have the masked token
        const result = await api('/publish/facebook/test', {
            method: 'POST',
            body: { pageId, useExistingToken: true }
        });

        if (result.success) {
            showToast(`✅ ${result.message}`, 'success');
        } else {
            showToast(`❌ ${result.message}`, 'error');
        }
    } catch (err) {
        showToast('ทดสอบล้มเหลว: ' + err.message, 'error');
    }
};

window.removeFacebookPage = async function (id) {
    if (!confirm('ต้องการลบ Facebook Page นี้หรือไม่?')) return;

    try {
        await api(`/settings/facebook/${id}`, { method: 'DELETE' });
        showToast('ลบ Facebook Page สำเร็จ', 'success');
        await loadFacebookSettings();
    } catch (err) {
        showToast('ลบล้มเหลว: ' + err.message, 'error');
    }
};

window.editFacebookPageToken = function (pageId, pageName) {
    const formEl = document.getElementById(`fb-edit-form-${pageId}`);
    if (formEl) {
        // Toggle visibility
        const isVisible = formEl.style.display !== 'none';
        formEl.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
            // Focus on input
            const input = document.getElementById(`fb-edit-token-${pageId}`);
            if (input) input.focus();
        }
    }
};

window.updateFacebookPageToken = async function (pageId, pageName) {
    const input = document.getElementById(`fb-edit-token-${pageId}`);
    const newToken = input?.value?.trim();

    if (!newToken) {
        showToast('กรุณาใส่ Token ใหม่', 'warning');
        return;
    }

    try {
        const result = await api('/settings/facebook', {
            method: 'POST',
            body: { pageId, pageToken: newToken, pageName }
        });

        showToast(`✅ ${result.message}`, 'success');
        await loadFacebookSettings();
    } catch (err) {
        showToast('อัปเดต Token ล้มเหลว: ' + err.message, 'error');
    }
};

window.toggleSchedule = function (checkbox) {
    const picker = document.getElementById('fb-schedule-picker');
    if (checkbox.checked) {
        picker.classList.remove('hidden');
        // Set default to 1 hour from now
        const now = new Date();
        now.setHours(now.getHours() + 1);
        now.setMinutes(0, 0, 0);
        const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        document.getElementById('fb-schedule-time').value = localIso;
    } else {
        picker.classList.add('hidden');
    }
};

window.publishToFacebook = async function (type) {
    if (!currentProject) return;

    if (!currentProject.steps?.video?.filePath) {
        showToast('ยังไม่มีวิดีโอ — สร้างวิดีโอก่อนในขั้นตอนที่ 4', 'warning');
        return;
    }

    // Get selected page
    const select = document.getElementById('fb-publish-page');
    const selectedPageId = select?.value;
    if (!selectedPageId) {
        showToast('กรุณาเลือก Facebook Page', 'warning');
        return;
    }

    // Check scheduling
    let scheduledTime = null;
    const scheduleToggle = document.getElementById('fb-schedule-toggle');
    if (scheduleToggle?.checked) {
        scheduledTime = document.getElementById('fb-schedule-time')?.value;
        if (!scheduledTime) {
            showToast('กรุณาเลือกวันเวลาที่ต้องการตั้งเวลา', 'warning');
            return;
        }
        // Convert to ISO string to ensure correct timezone parsing on backend (VPS might be UTC)
        const schedDate = new Date(scheduledTime);
        scheduledTime = schedDate.toISOString();
    }

    const btnReel = document.getElementById('btn-fb-reel');
    const btnPost = document.getElementById('btn-fb-post');
    const spinner = document.getElementById('spinner-fb-publish');

    btnReel.disabled = true;
    btnPost.disabled = true;
    spinner.classList.remove('hidden');

    const title = document.getElementById('publish-title')?.textContent || currentProject.name;
    const description = document.getElementById('publish-description')?.textContent || '';
    const hashtags = document.getElementById('publish-hashtags')?.textContent || '';
    const fullDescription = [description, '', hashtags].filter(Boolean).join('\n');

    const selectedPage = cachedFbPages.find(p => p.pageId === selectedPageId);
    const pageName = selectedPage?.pageName || selectedPageId;
    const schedInfo = scheduledTime ? ` ⏰ ตั้งเวลา ${new Date(scheduledTime).toLocaleString('th-TH')}` : '';

    try {
        showToast(`📤 กำลัง upload ไป ${pageName}...${schedInfo}`, 'info');

        const endpoint = type === 'reel' ? '/publish/facebook' : '/publish/facebook/post';
        const result = await api(endpoint, {
            method: 'POST',
            body: {
                videoFilePath: currentProject.steps.video.filePath,
                title: title,
                description: fullDescription,
                pageId: selectedPageId,
                scheduledTime: scheduledTime || undefined
            }
        });

        // Show success result
        const resultEl = document.getElementById('fb-publish-result');
        const statusEl = document.getElementById('fb-publish-status');
        resultEl.classList.remove('hidden');

        statusEl.innerHTML = `
            <div style="padding: 16px; background: rgba(74, 222, 128, 0.1); border: 1px solid rgba(74, 222, 128, 0.3); border-radius: var(--radius-md);">
                <p style="margin-bottom: 8px;"><strong>✅ ${result.message}</strong></p>
                <p style="font-size: 0.85rem; color: var(--text-muted);">Page: ${pageName}</p>
                <a href="${result.postUrl}" target="_blank" style="color: var(--accent-secondary);">
                    🔗 ดูบน Facebook
                </a>
            </div>
        `;

        // Save publish record to project
        const publishHistory = currentProject.publishHistory || [];
        publishHistory.push({
            platform: 'facebook',
            type: type,
            videoId: result.videoId,
            postUrl: result.postUrl,
            pageId: selectedPageId,
            pageName: pageName,
            scheduled: result.scheduled || false,
            scheduledTime: result.scheduledTime || null,
            publishedAt: new Date().toISOString()
        });

        await api(`/projects/${currentProject.id}`, {
            method: 'PUT',
            body: { publishHistory }
        });
        currentProject.publishHistory = publishHistory;

        showToast(`✅ ${result.message}`, 'success');
    } catch (err) {
        const resultEl = document.getElementById('fb-publish-result');
        const statusEl = document.getElementById('fb-publish-status');
        resultEl.classList.remove('hidden');

        statusEl.innerHTML = `
            <div style="padding: 16px; background: rgba(248, 113, 113, 0.1); border: 1px solid rgba(248, 113, 113, 0.3); border-radius: var(--radius-md);">
                <p><strong>❌ Upload ล้มเหลว</strong></p>
                <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px;">${err.message}</p>
            </div>
        `;

        showToast('❌ เผยแพร่ไป Facebook ล้มเหลว: ' + err.message, 'error');
    } finally {
        btnReel.disabled = false;
        btnPost.disabled = false;
        spinner.classList.add('hidden');
    }
};

// --- YouTube Integration ---
async function loadYouTubeSettings() {
    try {
        const result = await api('/settings/youtube');

        const listEl = document.getElementById('yt-channels-list');
        const connectedEl = document.getElementById('yt-settings-connected');
        const formEl = document.getElementById('yt-settings-form');

        // Fill input fields if keys exist
        if (result.clientId) document.getElementById('yt-client-id').value = result.clientId;
        if (result.clientSecretMasked) document.getElementById('yt-client-secret').value = result.clientSecretMasked;

        const channels = result.channels || [];

        if (channels.length > 0) {
            if (formEl) formEl.style.display = 'none';

            // Render channels list in settings
            if (listEl) {
                listEl.innerHTML = channels.map(c => {
                    const isExpired = c.tokenExpired;
                    const statusIcon = isExpired ? '🔴' : '🟢';
                    const bgColor = isExpired ? 'rgba(255, 0, 0, 0.08)' : 'rgba(74, 222, 128, 0.08)';
                    const borderColor = isExpired ? 'rgba(255, 0, 0, 0.2)' : 'rgba(74, 222, 128, 0.2)';
                    return `
                    <div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: var(--radius-md); margin-bottom: 8px;">
                        <span style="font-size: 1.5rem;">${statusIcon}</span>
                        <div style="flex: 1; min-width: 0;">
                            <strong>${escapeHtml(c.title)}</strong>
                            <span style="color: var(--text-muted); font-size: 0.8rem; display: block;">
                                เชื่อมต่อเมื่อ: ${new Date(c.addedAt).toLocaleString('th-TH')}
                            </span>
                        </div>
                        <button class="btn btn-sm" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; border: none; cursor: pointer;" onclick="renewYouTubeToken('${c.id}')" title="ต่ออายุ Token">🔄 ต่ออายุ</button>
                        <button class="btn btn-sm btn-secondary" onclick="testExistingYoutubeChannel('${c.id}')" title="ทดสอบ">ทดสอบ</button>
                        <button class="btn btn-sm btn-danger" onclick="disconnectYouTube('${c.id}')" title="ยกเลิกการเชื่อมต่อ">🗑️</button>
                    </div>
                `}).join('');

                // Add a button to add more channels
                listEl.innerHTML += `
                    <div style="margin-top: 12px;">
                        <button class="btn btn-secondary" onclick="document.getElementById('yt-settings-form').style.display='block';">
                            ➕ เพิ่ม Channel อีก
                        </button>
                    </div>
                `;
            }

            // Update publish page UI
            const publishNotConnected = document.getElementById('yt-not-connected');
            const publishConnected = document.getElementById('yt-connected');
            if (publishNotConnected && publishConnected) {
                publishNotConnected.style.display = 'none';
                publishConnected.style.display = 'block';

                const selectEl = document.getElementById('yt-publish-channel');
                if (selectEl) {
                    selectEl.innerHTML = channels.map(c => `<option value="${c.id}">${escapeHtml(c.title)}</option>`).join('');
                }
            }
        } else {
            if (listEl) {
                listEl.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">ยังไม่ได้เชื่อมต่อ YouTube Account — กรุณาเริ่มด้วยการใส่ Client ID</p>';
            }
            if (formEl) formEl.style.display = 'block';

            // Update publish page UI
            const publishNotConnected = document.getElementById('yt-not-connected');
            const publishConnected = document.getElementById('yt-connected');
            if (publishNotConnected && publishConnected) {
                publishNotConnected.style.display = 'block';
                publishConnected.style.display = 'none';
            }
        }
    } catch (err) {
        console.error('Load YouTube settings error:', err);
    }
}

window.saveYouTubeKeys = async function () {
    const clientId = document.getElementById('yt-client-id').value.trim();
    const clientSecret = document.getElementById('yt-client-secret').value.trim();

    if (!clientId || !clientSecret) {
        showToast('กรุณาใส่ Client ID และ Client Secret', 'warning');
        return;
    }

    try {
        const result = await api('/settings/youtube/keys', {
            method: 'POST',
            body: { clientId, clientSecret }
        });
        showToast(`✅ ${result.message}`, 'success');
        await loadYouTubeSettings();
    } catch (err) {
        showToast('บันทึกล้มเหลว: ' + err.message, 'error');
    }
};

window.connectYouTube = async function () {
    const btn = document.getElementById('btn-connect-yt');
    const spinner = document.getElementById('spinner-connect-yt');
    btn.disabled = true;
    spinner.classList.remove('hidden');

    try {
        // Must ensure keys are saved first if fields have changed
        await window.saveYouTubeKeys();

        const result = await api('/settings/youtube/auth-url');
        if (result.url) {
            window.location.href = result.url;
        } else {
            throw new Error('ไม่พบ Auth URL');
        }
    } catch (err) {
        showToast('ไม่สามารถขอ Auth URL ได้: ' + err.message, 'error');
        btn.disabled = false;
        spinner.classList.add('hidden');
    }
};

window.disconnectYouTube = async function (id) {
    if (!confirm('ต้องการยกเลิกการเชื่อมต่อ YouTube Channel นี้หรือไม่?')) return;
    try {
        await api(`/settings/youtube/${id}`, { method: 'DELETE' });
        showToast('ยกเลิกการเชื่อมต่อ YouTube สำเร็จ', 'success');
        await loadYouTubeSettings();
    } catch (err) {
        showToast('ยกเลิกการเชื่อมต้อล้มเหลว', 'error');
    }
};

window.renewYouTubeToken = async function (channelId) {
    try {
        showToast('🔄 กำลังเปิดหน้าต่อ OAuth เพื่อต่ออายุ Token...', 'info');
        const result = await api('/settings/youtube/auth-url');
        if (result.url) {
            window.location.href = result.url;
        } else {
            throw new Error('ไม่พบ Auth URL');
        }
    } catch (err) {
        showToast('ไม่สามารถต่ออายุ Token ได้: ' + err.message, 'error');
    }
};

window.testExistingYoutubeChannel = async function (channelId) {
    try {
        showToast('กำลังทดสอบการเชื่อมต่อ YouTube...', 'info');
        const result = await api('/settings/youtube/test', {
            method: 'POST',
            body: { channelId }
        });

        if (result.success) {
            showToast(`✅ ${result.message}`, 'success');
            await loadYouTubeSettings();
        } else {
            showToast(`❌ ${result.message}`, 'error');
        }
    } catch (err) {
        showToast('ทดสอบล้มเหลว: ' + err.message, 'error');
    }
};

window.toggleYtSchedule = function (checkbox) {
    const picker = document.getElementById('yt-schedule-picker');
    if (checkbox.checked) {
        picker.classList.remove('hidden');
        // Set default to 1 hour from now
        const now = new Date();
        now.setHours(now.getHours() + 1);
        now.setMinutes(0, 0, 0);
        const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        document.getElementById('yt-schedule-time').value = localIso;
    } else {
        picker.classList.add('hidden');
    }
};

window.publishToYouTube = async function () {
    if (!currentProject) return;

    if (!currentProject.steps?.video?.filePath) {
        showToast('ยังไม่มีวิดีโอ — สร้างวิดีโอก่อนในขั้นตอนที่ 4', 'warning');
        return;
    }

    // Check scheduling
    let scheduledTime = null;
    const scheduleToggle = document.getElementById('yt-schedule-toggle');
    if (scheduleToggle?.checked) {
        scheduledTime = document.getElementById('yt-schedule-time')?.value;
        if (!scheduledTime) {
            showToast('กรุณาเลือกวันเวลาที่ต้องการตั้งเวลา', 'warning');
            return;
        }
        // Convert to ISO string to ensure consistent timezone parsing on backend
        const schedDate = new Date(scheduledTime);
        scheduledTime = schedDate.toISOString();
    }

    const btn = document.getElementById('btn-yt-publish');
    const spinner = document.getElementById('spinner-yt-publish');

    btn.disabled = true;
    spinner.classList.remove('hidden');

    const title = document.getElementById('publish-title')?.textContent || currentProject.name;
    const description = document.getElementById('publish-description')?.textContent || '';
    const hashtags = document.getElementById('publish-hashtags')?.textContent || '';

    // Convert hashtags #example #test to commas for YouTube tags -> example, test
    const tags = (hashtags.match(/#[A-Za-z0-9_เ-์]+/g) || []).map(t => t.replace('#', '')).join(', ');
    const fullDescription = [description, '', hashtags].filter(Boolean).join('\n');

    const privacyStatus = document.getElementById('yt-privacy-status').value;

    const selectedChannelId = document.getElementById('yt-publish-channel')?.value;

    const schedInfo = scheduledTime ? ` ⏰ ตั้งเวลา ${new Date(scheduledTime).toLocaleString('th-TH')}` : '';

    try {
        showToast(`📤 กำลัง upload ไป YouTube...${schedInfo}`, 'info');

        const result = await api('/publish/youtube', {
            method: 'POST',
            body: {
                videoFilePath: currentProject.steps.video.filePath,
                thumbnailPath: currentProject.steps.video.thumbnailPath || null,
                title: title,
                description: fullDescription,
                tags: tags,
                privacyStatus: privacyStatus,
                scheduledTime: scheduledTime || undefined,
                channelId: selectedChannelId
            }
        });

        // Show success result
        const resultEl = document.getElementById('yt-publish-result');
        const statusEl = document.getElementById('yt-publish-status');
        resultEl.classList.remove('hidden');

        statusEl.innerHTML = `
            <div style="padding: 16px; background: rgba(74, 222, 128, 0.1); border: 1px solid rgba(74, 222, 128, 0.3); border-radius: var(--radius-md);">
                <p style="margin-bottom: 8px;"><strong>✅ ${result.message}</strong></p>
                <a href="${result.postUrl}" target="_blank" style="color: var(--accent-secondary);">
                    🔗 ดูบน YouTube
                </a>
            </div>
        `;

        // Save publish record to project
        const publishHistory = currentProject.publishHistory || [];
        publishHistory.push({
            platform: 'youtube',
            type: 'video',
            videoId: result.videoId,
            postUrl: result.postUrl,
            channelId: selectedChannelId,
            scheduled: result.scheduled || false,
            scheduledTime: result.scheduledTime || null,
            publishedAt: new Date().toISOString()
        });

        await api(`/projects/${currentProject.id}`, {
            method: 'PUT',
            body: { publishHistory }
        });
        currentProject.publishHistory = publishHistory;

        showToast(`✅ ${result.message}`, 'success');
    } catch (err) {
        const resultEl = document.getElementById('yt-publish-result');
        const statusEl = document.getElementById('yt-publish-status');
        resultEl.classList.remove('hidden');

        statusEl.innerHTML = `
            <div style="padding: 16px; background: rgba(248, 113, 113, 0.1); border: 1px solid rgba(248, 113, 113, 0.3); border-radius: var(--radius-md);">
                <p><strong>❌ Upload ล้มเหลว</strong></p>
                <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px;">${err.message}</p>
            </div>
        `;

        showToast('❌ เผยแพร่ไป YouTube ล้มเหลว: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        spinner.classList.add('hidden');
    }
};

// --- Init ---
// Auto-initialize when script loads (DOM is already ready via React)
window.loadDashboard = loadDashboard;
window.checkApiStatus = checkApiStatus;
window.loadYouTubeSettings = loadYouTubeSettings;
window.showToast = showToast;
window.loadSettings = loadSettings;
window.loadProject = loadProject;
window.deleteProject = deleteProject;
window.saveScript = saveScript;
window.generateScript = generateScript;
window.generateAudio = generateAudio;
window.generateImages = generateImages;
window.createVideo = createVideo;
window.addImagePrompt = addImagePrompt;
window.removeImagePrompt = removeImagePrompt;
window.fillImagePromptsFromScript = fillImagePromptsFromScript;
window.addApiKey = addApiKey;
window.testApiKey = testApiKey;
window.saveFacebookSettings = saveFacebookSettings;
window.testFacebookToken = testFacebookToken;
window.saveYouTubeKeys = saveYouTubeKeys;
window.connectYouTube = connectYouTube;
window.renewYouTubeToken = renewYouTubeToken;
window.publishToFacebook = publishToFacebook;
window.publishToYouTube = publishToYouTube;
window.toggleSchedule = toggleSchedule;
window.toggleYtSchedule = toggleYtSchedule;

// Run initialization
loadDashboard();
checkApiStatus();
loadYouTubeSettings();
loadBgmList();

// Check URL for OAuth callback result
const urlParams = new URLSearchParams(window.location.search);
const ytOauth = urlParams.get('youtube_oauth');
if (ytOauth === 'success') {
    showToast('✅ เชื่อมต่อ YouTube สำเร็จ!', 'success');
    window.history.replaceState({}, document.title, '/');
    setTimeout(() => navigateTo('settings'), 500);
} else if (ytOauth === 'error') {
    const msg = urlParams.get('msg') || 'Unknown error';
    showToast('❌ เชื่อมต่อ YouTube ล้มเหลว: ' + msg, 'error');
    window.history.replaceState({}, document.title, '/');
    setTimeout(() => navigateTo('settings'), 500);
}

// Re-check API status every 30 seconds
setInterval(checkApiStatus, 30000);

// --- BGM Management ---
let allBgms = [];

async function loadBgmList() {
    try {
        const res = await fetch('/api/bgm');
        allBgms = await res.json();
    } catch (e) { allBgms = []; }
    renderBgmList();
    populateBgmDropdown();
}

function renderBgmList() {
    const el = document.getElementById('bgm-list');
    if (!el) return;
    if (allBgms.length === 0) {
        el.innerHTML = '<p style="color: var(--text-muted); text-align: center;">ยังไม่มี BGM อัปโหลด</p>';
        return;
    }
    el.innerHTML = allBgms.map(b => {
        const sizeKb = (b.size / 1024).toFixed(0);
        const sizeMb = (b.size / (1024 * 1024)).toFixed(1);
        const sizeText = b.size > 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;
        return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-radius:8px;background:var(--card-bg);margin-bottom:6px;border:1px solid var(--border-color);">
            <div style="flex:1;">
                <strong style="font-size:0.9rem;">${escapeHtml(b.label)}</strong>
                <span style="color:var(--text-muted);font-size:0.75rem;margin-left:8px;">${escapeHtml(b.originalName)} (${sizeText})</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
                <audio src="/api/uploads/bgm/${b.fileName}" controls preload="none" style="height:32px;max-width:200px;"></audio>
                <button class="btn btn-sm btn-danger" onclick="deleteBgm('${b.id}')" title="ลบ">🗑</button>
            </div>
        </div>`;
    }).join('');
}

function populateBgmDropdown() {
    const dropdownIds = ['video-bgm', 'ap-bgm'];
    dropdownIds.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const current = sel.value;
        sel.innerHTML = '<option value="">ไม่ใส่ BGM</option>' + allBgms.map(b =>
            `<option value="${b.fileName}">${escapeHtml(b.label)}</option>`
        ).join('');
        sel.value = current || '';
    });
}

window.uploadBgm = async function () {
    const fileInput = document.getElementById('bgm-file');
    const label = document.getElementById('bgm-label')?.value.trim() || '';

    if (!fileInput?.files?.length) {
        showToast('กรุณาเลือกไฟล์เพลง', 'warning');
        return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('label', label || file.name);

    const btn = document.getElementById('btn-upload-bgm');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> กำลังอัปโหลด...';

    try {
        const res = await fetch('/api/bgm', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        showToast('อัปโหลด BGM สำเร็จ! 🎵', 'success');
        fileInput.value = '';
        document.getElementById('bgm-label').value = '';
        await loadBgmList();
    } catch (e) {
        showToast('อัปโหลดล้มเหลว: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '📤 อัปโหลด BGM';
    }
};

window.deleteBgm = async function (id) {
    if (!confirm('ลบ BGM นี้?')) return;
    try {
        const res = await fetch(`/api/bgm/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
        showToast('ลบ BGM สำเร็จ', 'success');
        await loadBgmList();
    } catch (e) {
        showToast('ลบล้มเหลว', 'error');
    }
};

window.quickUploadBgm = async function () {
    const fileInput = document.getElementById('quick-bgm-file');
    const label = document.getElementById('quick-bgm-label')?.value.trim() || '';

    if (!fileInput?.files?.length) {
        showToast('กรุณาเลือกไฟล์เพลงก่อน', 'warning');
        return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('label', label || file.name.replace(/\.[^.]+$/, ''));

    const btn = document.getElementById('btn-quick-bgm-upload');
    btn.disabled = true;
    btn.textContent = '⏳ กำลังอัพโหลด...';

    try {
        const res = await fetch('/api/bgm', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        showToast('อัพโหลด BGM สำเร็จ! 🎵', 'success');

        // Clear inputs
        fileInput.value = '';
        document.getElementById('quick-bgm-label').value = '';
        document.getElementById('quick-bgm-filename').textContent = '';

        // Reload BGM list and auto-select the new file
        await loadBgmList();
        const sel = document.getElementById('video-bgm');
        if (sel && data.fileName) {
            sel.value = data.fileName;
        }
    } catch (e) {
        showToast('อัพโหลดล้มเหลว: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '📤 อัพโหลด';
    }
};
// --- Category Management ---
function populateCategoryDropdowns() {
    const dropdowns = ['input-category', 'filter-category', 'bulk-category', 'ap-category'];
    dropdowns.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const currentVal = el.value;
        const defaultOpt = id === 'filter-category' ? '<option value="">ทั้งหมด</option>' : '<option value="">— ไม่ระบุ —</option>';
        el.innerHTML = defaultOpt + allCategories.map(c =>
            `<option value="${c.id}">${c.icon} ${escapeHtml(c.name)}</option>`
        ).join('');
        el.value = currentVal || '';
    });
}

window.addCategory = async function () {
    const name = prompt('ชื่อหมวดหมู่:');
    if (!name) return;
    const icon = prompt('ไอคอน (emoji):', '📁') || '📁';
    const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#14b8a6'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    try {
        await api('/categories', { method: 'POST', body: { name, icon, color } });
        showToast('เพิ่มหมวดหมู่สำเร็จ!', 'success');
        allCategories = await api('/categories');
        populateCategoryDropdowns();
        renderCategoryList();
    } catch (e) { }
};

window.editCategory = async function (id) {
    const cat = allCategories.find(c => c.id === id);
    if (!cat) return;
    const name = prompt('แก้ไขชื่อหมวดหมู่:', cat.name);
    if (!name) return;
    const icon = prompt('ไอคอน (emoji):', cat.icon) || cat.icon;
    try {
        await api(`/categories/${id}`, { method: 'PUT', body: { name, icon } });
        showToast('แก้ไขสำเร็จ!', 'success');
        allCategories = await api('/categories');
        populateCategoryDropdowns();
        renderCategoryList();
    } catch (e) { }
};

window.deleteCategory = async function (id) {
    if (!confirm('ลบหมวดหมู่นี้?')) return;
    try {
        await api(`/categories/${id}`, { method: 'DELETE' });
        showToast('ลบหมวดหมู่สำเร็จ', 'success');
        allCategories = await api('/categories');
        populateCategoryDropdowns();
        renderCategoryList();
    } catch (e) { }
};

function renderCategoryList() {
    const el = document.getElementById('category-list');
    if (!el) return;
    if (allCategories.length === 0) {
        el.innerHTML = '<p style="color: var(--text-muted); text-align: center;">ยังไม่มีหมวดหมู่</p>';
        return;
    }
    el.innerHTML = allCategories.map(c => `
        <div class="category-item" style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:8px;background:var(--card-bg);margin-bottom:6px;">
            <span style="display:flex;align-items:center;gap:8px;">
                <span style="background:${c.color}22;color:${c.color};padding:4px 10px;border-radius:8px;font-size:0.85rem;border:1px solid ${c.color}44;">${c.icon} ${escapeHtml(c.name)}</span>
            </span>
            <span style="display:flex;gap:4px;">
                <button class="btn btn-sm" onclick="editCategory('${c.id}')" title="แก้ไข">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="deleteCategory('${c.id}')" title="ลบ">🗑</button>
            </span>
        </div>
    `).join('');
}
window.renderCategoryList = renderCategoryList;

window.filterByCategory = function () {
    dashboardPage = 1;
    loadDashboard();
};

// --- Dashboard Pagination ---
function renderDashboardPagination(totalItems, totalPages) {
    const paginationEl = document.getElementById('dashboard-pagination');
    if (!paginationEl) return;

    if (totalPages <= 1) {
        paginationEl.innerHTML = `<div class="pagination-info">ทั้งหมด ${totalItems} โปรเจค</div>`;
        return;
    }

    const startItem = (dashboardPage - 1) * dashboardPageSize + 1;
    const endItem = Math.min(dashboardPage * dashboardPageSize, totalItems);

    // Build page buttons
    let pageButtons = '';
    const maxVisible = 5;
    let startPage = Math.max(1, dashboardPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
        pageButtons += `<button class="pagination-btn" onclick="goToDashboardPage(1)">1</button>`;
        if (startPage > 2) pageButtons += `<span class="pagination-ellipsis">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        pageButtons += `<button class="pagination-btn${i === dashboardPage ? ' active' : ''}" onclick="goToDashboardPage(${i})">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) pageButtons += `<span class="pagination-ellipsis">...</span>`;
        pageButtons += `<button class="pagination-btn" onclick="goToDashboardPage(${totalPages})">${totalPages}</button>`;
    }

    paginationEl.innerHTML = `
        <div class="pagination-info">แสดง ${startItem}–${endItem} จาก ${totalItems} โปรเจค</div>
        <div class="pagination-controls">
            <button class="pagination-btn pagination-nav" onclick="goToDashboardPage(${dashboardPage - 1})" ${dashboardPage <= 1 ? 'disabled' : ''}>‹ ก่อนหน้า</button>
            ${pageButtons}
            <button class="pagination-btn pagination-nav" onclick="goToDashboardPage(${dashboardPage + 1})" ${dashboardPage >= totalPages ? 'disabled' : ''}>ถัดไป ›</button>
        </div>
        <div class="pagination-size">
            <label>แสดง</label>
            <select onchange="changeDashboardPageSize(this.value)">
                <option value="10" ${dashboardPageSize === 10 ? 'selected' : ''}>10</option>
                <option value="20" ${dashboardPageSize === 20 ? 'selected' : ''}>20</option>
                <option value="50" ${dashboardPageSize === 50 ? 'selected' : ''}>50</option>
                <option value="100" ${dashboardPageSize === 100 ? 'selected' : ''}>100</option>
            </select>
            <label>รายการ</label>
        </div>
    `;
}

window.goToDashboardPage = function (page) {
    dashboardPage = page;
    loadDashboard();
    // Scroll to top of projects list
    const list = document.getElementById('projects-list');
    if (list) list.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.changeDashboardPageSize = function (size) {
    dashboardPageSize = parseInt(size, 10);
    dashboardPage = 1;
    loadDashboard();
};

window.changeProjectCategory = async function () {
    if (!currentProject) return;
    const category = document.getElementById('project-category')?.value || '';
    try {
        await api(`/projects/${currentProject.id}`, { method: 'PUT', body: { category } });
        currentProject.category = category;
        showToast('อัปเดตหมวดหมู่สำเร็จ', 'success');
    } catch (e) {
        showToast('อัปเดตหมวดหมู่ล้มเหลว', 'error');
    }
};

// --- Bulk Create ---
window.generateBulkTopics = async function () {
    const catId = document.getElementById('bulk-category')?.value;
    const count = document.getElementById('bulk-count')?.value || '5';
    const platform = document.getElementById('bulk-platform')?.value || 'youtube_shorts';
    const language = document.getElementById('bulk-language')?.value || 'th';

    if (!catId) {
        showToast('กรุณาเลือกหมวดหมู่', 'warning');
        return;
    }

    const cat = allCategories.find(c => c.id === catId);
    const categoryName = cat ? cat.name : 'ทั่วไป';

    const btn = document.getElementById('btn-bulk-generate');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> AI กำลังคิดหัวข้อ...';

    try {
        const result = await api('/ai/generate-topics', {
            method: 'POST',
            body: { category: categoryName, count: parseInt(count), platform, language }
        });

        const topics = result.topics || [];
        if (topics.length === 0) {
            showToast('AI ไม่สามารถสร้างหัวข้อได้', 'error');
            return;
        }

        const listEl = document.getElementById('bulk-topics-list');
        listEl.innerHTML = `
            <div style="border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow: hidden;">
                <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(124,92,252,0.08);border-bottom:1px solid var(--border-color);">
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600;color:var(--accent-secondary);margin:0;">
                        <input type="checkbox" id="bulk-select-all" checked onchange="toggleBulkAll()" style="width:18px;height:18px;cursor:pointer;">
                        เลือกทั้งหมด (${topics.length} หัวข้อ)
                    </label>
                    <span style="color:var(--text-muted);font-size:0.8rem;">✏️ คลิกเพื่อแก้ไขชื่อ/คำอธิบายได้</span>
                </div>
                <div id="bulk-items">
                    ${topics.map((t, i) => `
                        <div class="bulk-topic-item" style="display:flex;align-items:flex-start;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border-color);">
                            <input type="checkbox" class="bulk-check" data-idx="${i}" checked style="width:18px;height:18px;cursor:pointer;margin-top:4px;flex-shrink:0;">
                            <div style="flex:1;">
                                <input type="text" class="bulk-name" data-idx="${i}" value="${escapeHtml(t.name)}" style="width:100%;background:transparent;border:none;color:var(--text-primary);font-weight:600;font-size:0.95rem;padding:2px 0;font-family:var(--font-sans);">
                                <input type="text" class="bulk-desc" data-idx="${i}" value="${escapeHtml(t.description)}" style="width:100%;background:transparent;border:none;color:var(--text-secondary);font-size:0.85rem;padding:2px 0;font-family:var(--font-sans);">
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div style="margin-top:16px;display:flex;gap:12px;">
                <button class="btn btn-primary btn-lg btn-glow" onclick="bulkCreateProjects()">
                    🚀 สร้างโปรเจคที่เลือก
                </button>
                <button class="btn btn-ghost" onclick="document.getElementById('bulk-topics-list').innerHTML='';">
                    ✕ ยกเลิก
                </button>
            </div>
        `;
    } catch (e) {
        showToast('สร้างหัวข้อล้มเหลว', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '🤖 ให้ AI คิดหัวข้อ';
    }
};

window.toggleBulkAll = function () {
    const selectAll = document.getElementById('bulk-select-all')?.checked;
    document.querySelectorAll('.bulk-check').forEach(cb => cb.checked = selectAll);
};

window.bulkCreateProjects = async function () {
    const checks = document.querySelectorAll('.bulk-check:checked');
    if (checks.length === 0) {
        showToast('กรุณาเลือกอย่างน้อย 1 หัวข้อ', 'warning');
        return;
    }

    const catId = document.getElementById('bulk-category')?.value || '';
    const platform = document.getElementById('bulk-platform')?.value || 'youtube_shorts';
    const language = document.getElementById('bulk-language')?.value || 'th';

    const items = [];
    checks.forEach(cb => {
        const idx = cb.dataset.idx;
        const name = document.querySelector(`.bulk-name[data-idx="${idx}"]`)?.value || '';
        const desc = document.querySelector(`.bulk-desc[data-idx="${idx}"]`)?.value || '';
        if (name) items.push({ name, description: desc });
    });

    showToast(`กำลังสร้าง ${items.length} โปรเจค...`, 'info');

    let success = 0;
    for (const item of items) {
        try {
            await api('/projects', {
                method: 'POST',
                body: { name: item.name, description: item.description, platform, language, category: catId }
            });
            success++;
        } catch (e) { }
    }

    showToast(`สร้างสำเร็จ ${success}/${items.length} โปรเจค! 🎉`, 'success');
    document.getElementById('bulk-topics-list').innerHTML = '';
    navigateTo('dashboard');
};

// --- Smart Autopilot ---
let autopilotActive = false;

window.stopSmartAutopilot = function () {
    autopilotActive = false;
    document.getElementById('btn-stop-autopilot').style.display = 'none';
    logAutopilot('⛔ ยกเลิกการทำงานแล้ว (รอรอบปัจจุบันเสร็จสิ้นระบบจะหยุด)');
    document.getElementById('btn-start-autopilot').disabled = false;
};

function logAutopilot(msg) {
    const container = document.getElementById('ap-log-container');
    if (!container) return;
    const div = document.createElement('div');
    div.style.marginBottom = '6px';
    div.innerHTML = `<span style="color:var(--text-muted)">[${new Date().toLocaleTimeString('th-TH')}]</span> ${msg}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

window.startSmartAutopilot = async function () {
    if (autopilotActive) return;

    const catalog = document.getElementById('ap-catalog').value.trim();
    if (!catalog) {
        showToast('กรุณาระบุหัวข้อแคตตาล็อก', 'warning');
        return;
    }

    const count = parseInt(document.getElementById('ap-count').value);
    const platform = document.getElementById('ap-platform').value;
    const duration = document.getElementById('ap-duration').value;
    const voice = document.getElementById('ap-voice').value;
    const imageStyle = document.getElementById('ap-image-style').value;
    const isSubtitleEnabled = document.getElementById('ap-subtitle').value === 'yes';
    const lang = document.getElementById('ap-language').value;
    const category = document.getElementById('ap-category').value;
    const delaySeconds = parseInt(document.getElementById('ap-delay')?.value || '120');
    const bgmFile = document.getElementById('ap-bgm')?.value || null;
    const bgmVolume = parseFloat(document.getElementById('ap-bgm-volume')?.value || '20') / 100;

    autopilotActive = true;
    document.getElementById('ap-progress-section').style.display = 'block';
    document.getElementById('btn-stop-autopilot').style.display = 'inline-block';

    const startBtn = document.getElementById('btn-start-autopilot');
    startBtn.disabled = true;
    startBtn.innerHTML = '<span class="spinner"></span> กำลังรัน Smart Autopilot...';

    const container = document.getElementById('ap-log-container');
    container.innerHTML = ''; // clear previous logs

    logAutopilot(`🚀 <b>เริ่มระบบ Smart Autopilot</b> (${count} เรื่อง)`);
    logAutopilot(`หมวดหมู่/หัวข้อที่กำหนด: <span style="color:var(--accent-primary)">"${catalog}"</span>`);

    try {
        logAutopilot(`🤖 กำลังให้ AI คิดหัวข้อคลิป จำนวน ${count} เรื่อง...`);
        const topicPrompt = `คุณคือครีเอเตอร์นักสร้างสรรค์ ช่วยคิดหัวข้อคอนเทนต์จำนวน ${count} เรื่อง ในตีม/หัวข้อหลัก: "${catalog}"
แพลตฟอร์ม: ${platform}
ภาษา: ${lang === 'th' ? 'Thai' : 'English'}

ตอบกลับเป็น JSON array ประกอบด้วย:
[
  { "name": "ชื่อหัวข้อคลิปที่น่าสนใจ", "description": "โครงเรื่อง/บทสรุป ว่าคลิปเกี่ยวกับอะไร เพื่อให้ AI เล่าเรื่องได้ถูก" },
  ...
]
ตอบแค่ JSON array ห้ามพิมพ์ข้อความอื่นเพิ่มเติม`;

        const topicRes = await api('/ai/chat', {
            method: 'POST',
            body: { message: topicPrompt, context: 'brainstorm' }
        });

        let topics = [];
        try {
            let text = topicRes.reply.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            topics = JSON.parse(text);
        } catch (e) {
            logAutopilot(`⚠ AI ไม่ยอมตอบเป็น JSON ที่ถูกต้อง พยายามสร้างจากข้อความดิบ...`);
            // simplistic fallback
            topics = Array(count).fill(catalog).map((cat, i) => ({ name: `${cat} - Part ${i + 1}`, description: `A video about ${cat}` }));
        }

        if (!Array.isArray(topics) || topics.length === 0) {
            throw new Error('คิดหัวข้อไม่สำเร็จจากข้อมูล AI');
        }

        logAutopilot(`✅ คิดหัวข้อสำเร็จ! ได้ ${topics.slice(0, count).length} เรื่อง`);
        topics.slice(0, count).forEach((t, i) => logAutopilot(` - ${i + 1}. ${t.name}`));

        let completed = 0;
        let failed = 0;

        for (let i = 0; i < topics.length && i < count; i++) {
            if (!autopilotActive) break;

            const topic = topics[i];
            logAutopilot(`<hr style="border-color:var(--border-color);margin:12px 0;"/>`);
            logAutopilot(`🎬 <b>เริ่มทำเรื่องที่ ${i + 1}/${count}: ${topic.name}</b>`);
            logAutopilot(`[1/5] สร้างโปรเจคใหม่...`);

            let proj = null;
            try {
                // 1. Create Project
                proj = await api('/projects', {
                    method: 'POST',
                    body: { name: topic.name, description: topic.description, platform, language: lang, category }
                });

                if (!autopilotActive) break;

                // 2. Generate Script
                logAutopilot(`[2/5] 📝 กำลังเขียนบท (Script)...`);
                const scriptRes = await api('/ai/generate-script', {
                    method: 'POST',
                    body: {
                        topic: topic.description,
                        platform: platform,
                        language: lang,
                        style: 'storytelling',
                        duration: duration,
                        gender: 'neutral'
                    }
                });

                let updatedSteps = {
                    ...proj.steps,
                    script: {
                        status: 'done',
                        content: scriptRes.script,
                        title: scriptRes.title,
                        description: scriptRes.description,
                        generatedAt: new Date().toISOString()
                    }
                };
                await api(`/projects/${proj.id}`, { method: 'PUT', body: { steps: updatedSteps } });
                proj.steps = updatedSteps;

                if (!autopilotActive) break;

                // 3. Generate Audio
                logAutopilot(`[3/5] 🎤 กำลังสร้างเสียงบรรยาย Voice: ${voice}...`);
                const audioRes = await api('/tts/generate', {
                    method: 'POST',
                    body: {
                        text: scriptRes.script,
                        projectId: proj.id,
                        voice: voice,
                        emotion: 'neutral'
                    }
                });

                updatedSteps = {
                    ...proj.steps,
                    audio: {
                        status: 'done',
                        filePath: audioRes.filePath,
                        voice: voice,
                        generatedAt: new Date().toISOString()
                    }
                };
                await api(`/projects/${proj.id}`, { method: 'PUT', body: { steps: updatedSteps } });
                proj.steps = updatedSteps;

                if (!autopilotActive) break;

                // 4. Generate Images
                logAutopilot(`[4/5] 🖼️ กำลังสร้างภาพประกอบ Style: ${imageStyle}...`);
                let promptsToUse = scriptRes.imagePrompts || [];
                if (promptsToUse.length === 0) {
                    const lines = scriptRes.script.split('\\n').filter(l => l.trim().length > 10);
                    promptsToUse = lines.slice(0, 5).map(l => l.substring(0, 80));
                } else if (promptsToUse.length > 5) {
                    promptsToUse = promptsToUse.slice(0, 5);
                }

                let aspectRatio = '16:9';
                if (platform.includes('shorts') || platform.includes('tiktok') || platform.includes('reels')) aspectRatio = '9:16';
                if (platform === 'square') aspectRatio = '1:1';

                const imagesRes = await api('/images/generate-batch', {
                    method: 'POST',
                    body: {
                        prompts: promptsToUse,
                        projectId: proj.id,
                        style: imageStyle,
                        aspectRatio: aspectRatio,
                        scriptContext: scriptRes.script
                    }
                });

                const successFiles = imagesRes.results.filter(r => r.success).map(r => r.filePath);
                if (successFiles.length === 0) throw new Error('Cannot generate ANY images.');

                updatedSteps = {
                    ...proj.steps,
                    images: {
                        status: 'done',
                        files: successFiles,
                        generatedAt: new Date().toISOString()
                    }
                };
                await api(`/projects/${proj.id}`, { method: 'PUT', body: { steps: updatedSteps } });
                proj.steps = updatedSteps;

                if (!autopilotActive) break;

                // 5. Generate Video
                logAutopilot(`[5/5] 🎬 เริ่มตั้งค่าตัดต่อและประกอบคลิปวิดีโอ...`);

                const videoRes = await api('/video/create', {
                    method: 'POST',
                    body: {
                        projectId: proj.id,
                        audioFile: audioRes.filePath,
                        imageFiles: successFiles,
                        format: platform,
                        animation: 'random',
                        subtitle: isSubtitleEnabled,
                        subtitleStyle: { font: 'Kanit', size: '80', color: 'yellow_black', bg: 'normal', pos: 'top' },
                        scriptText: scriptRes.script,
                        ttsEmotion: 'neutral',
                        bgmFile: bgmFile,
                        bgmVolume: bgmVolume
                    }
                });

                updatedSteps = {
                    ...proj.steps,
                    video: {
                        status: 'done',
                        filePath: videoRes.filePath,
                        fileName: videoRes.fileName,
                        resolution: videoRes.resolution,
                        generatedAt: new Date().toISOString()
                    }
                };
                await api(`/projects/${proj.id}`, { method: 'PUT', body: { steps: updatedSteps } });

                logAutopilot(`✨ <b style="color:var(--success)">สร้างคลิปที่ ${i + 1} สำเร็จ!</b>`);
                completed++;

            } catch (err) {
                logAutopilot(`❌ <b style="color:var(--danger)">เกิดข้อผิดพลาดกับคลิปที่ ${i + 1}:</b> ${err.message}`);
                failed++;
            }

            // Wait between projects if there's a delay and it's not the last project
            if (i < Math.min(topics.length, count) - 1 && autopilotActive) {
                if (delaySeconds > 0) {
                    logAutopilot(`⏱️ <i>พัก ${delaySeconds} วินาที ระหว่างรอบเพื่อกัน Rate Limit...</i>`);
                    await new Promise(r => setTimeout(r, delaySeconds * 1000));
                } else {
                    await new Promise(r => setTimeout(r, 2000));
                }
            }
        }

        logAutopilot(`<hr style="border-color:var(--border-color);margin:12px 0;"/>`);
        if (autopilotActive) {
            logAutopilot(`🎉 <b>Autopilot จบการทำงาน!</b>`);
        } else {
            logAutopilot(`⛔ <b>Autopilot ถูกยกเลิกกลางคัน</b>`);
        }
        logAutopilot(`ทำสำเร็จ: ${completed} เรื่อง, ล้มเหลว: ${failed} เรื่อง`);
        logAutopilot(`👉 ไปที่เมนู "แดชบอร์ด" เพื่อดูวิดีโอที่สร้างเสร็จแล้ว`);

    } catch (err) {
        logAutopilot(`❌ <b>ระบบพบข้อผิดพลาดหล้ายแรง:</b> ${err.message}`);
        showToast('Autopilot หยุดทำงานฉุกเฉิน', 'error');
    } finally {
        autopilotActive = false;
        document.getElementById('btn-stop-autopilot').style.display = 'none';

        const startBtn = document.getElementById('btn-start-autopilot');
        startBtn.disabled = false;
        startBtn.innerHTML = '🚀 เริ่มรันระบบ Autopilot';
    }
};

