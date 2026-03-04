'use client';

import { useEffect, useRef } from 'react';

export default function Home() {
    const initialized = useRef(false);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        window.addEventListener('error', (e) => {
            const el = document.getElementById('api-status');
            if (el) el.innerHTML = `<span style="color:red">ERROR: ${e.message}</span>`;
            else alert(e.message);
        });
        window.addEventListener('unhandledrejection', (e) => {
            const el = document.getElementById('api-status');
            if (el) el.innerHTML = `<span style="color:red">PROMISE REJECTED: ${e.reason?.message || e.reason}</span>`;
        });

        // Dynamically load client logic after DOM is ready
        const script = document.createElement('script');
        script.src = `/client-logic.js?v=${Date.now()}`;
        script.async = true;
        document.body.appendChild(script);
    }, []);

    return (
        <>
            <div id="app">
                {/* Sidebar */}
                <Sidebar />
                {/* Main Content */}
                <main id="main-content" className="main-content">
                    <DashboardPage />
                    <CreatePage />
                    <AutopilotPage />
                    <ProjectPage />
                    <SettingsPage />
                </main>
            </div>
            {/* Toast Container */}
            <div id="toast-container" className="toast-container"></div>
        </>
    );
}

function Sidebar() {
    return (
        <aside id="sidebar" className="sidebar">
            <div className="sidebar-header">
                <div className="logo">
                    <div className="logo-icon">✦</div>
                    <span className="logo-text">Creator<span className="accent">Studio</span></span>
                </div>
            </div>
            <nav className="sidebar-nav">
                <button className="nav-item active" data-page="dashboard" id="nav-dashboard" onClick={() => navigateTo('dashboard')}>
                    <span className="nav-icon">🏠</span>
                    <span>แดชบอร์ด</span>
                </button>
                <button className="nav-item" data-page="create" id="nav-create" onClick={() => navigateTo('create')}>
                    <span className="nav-icon">✨</span>
                    <span>สร้างใหม่</span>
                </button>
                <button className="nav-item" data-page="project" id="nav-project" style={{ display: 'none' }} onClick={() => navigateTo('project')}>
                    <span className="nav-icon">📋</span>
                    <span>โปรเจค</span>
                </button>
                <button className="nav-item" data-page="autopilot" id="nav-autopilot" onClick={() => navigateTo('autopilot')}>
                    <span className="nav-icon">🚀</span>
                    <span>ออโต้ไพลอต</span>
                </button>
                <div style={{ flex: 1 }}></div>
                <button className="nav-item" data-page="settings" id="nav-settings" onClick={() => navigateTo('settings')}>
                    <span className="nav-icon">⚙️</span>
                    <span>ตั้งค่า</span>
                </button>
            </nav>
            <div className="sidebar-footer">
                <div className="api-status" id="api-status">
                    <span className="status-dot"></span>
                    <span>กำลังตรวจสอบ...</span>
                </div>
            </div>
        </aside>
    );
}

function DashboardPage() {
    return (
        <div id="page-dashboard" className="page active">
            <div className="page-header">
                <div>
                    <h1>แดชบอร์ด</h1>
                    <p className="subtitle">จัดการโปรเจคคอนเทนต์ทั้งหมดของคุณ</p>
                </div>
                <button className="btn btn-primary btn-glow" onClick={() => navigateTo('create')}>
                    <span>✨</span> สร้างโปรเจคใหม่
                </button>
            </div>

            <div className="stats-grid" id="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon">📁</div>
                    <div className="stat-info">
                        <span className="stat-value" id="stat-total">0</span>
                        <span className="stat-label">โปรเจคทั้งหมด</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">🎬</div>
                    <div className="stat-info">
                        <span className="stat-value" id="stat-videos">0</span>
                        <span className="stat-label">วิดีโอ</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">📢</div>
                    <div className="stat-info">
                        <span className="stat-value" id="stat-published">0</span>
                        <span className="stat-label">เผยแพร่แล้ว</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">👁️</div>
                    <div className="stat-info">
                        <span className="stat-value" id="stat-views">0</span>
                        <span className="stat-label">ยอดวิวรวม</span>
                    </div>
                </div>
            </div>

            <div className="section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <h2 style={{ margin: 0 }}>โปรเจคล่าสุด</h2>
                    <select id="filter-category" onChange={() => filterByCategory()} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                        <option value="">ทั้งหมด</option>
                    </select>
                </div>
                <div id="projects-list" className="projects-table-wrapper">
                    <div className="empty-state">
                        <div className="empty-icon">🎪</div>
                        <h3>ยังไม่มีโปรเจค</h3>
                        <p>เริ่มสร้างโปรเจคแรกของคุณเลย!</p>
                        <button className="btn btn-primary" onClick={() => navigateTo('create')}>สร้างเลย</button>
                    </div>
                </div>
                <div id="dashboard-pagination" className="pagination-wrapper"></div>
            </div>
        </div>
    );
}

function CreatePage() {
    return (
        <div id="page-create" className="page">
            <div className="page-header">
                <div>
                    <h1>✨ สร้างโปรเจคใหม่</h1>
                    <p className="subtitle">กรอกข้อมูลเพื่อเริ่มสร้างคอนเทนต์</p>
                </div>
            </div>

            <form id="create-form" className="create-form" onSubmit={(e) => e.preventDefault()}>
                <div className="form-card">
                    <div className="form-group">
                        <label htmlFor="input-name">ชื่อโปรเจค</label>
                        <input type="text" id="input-name" placeholder="เช่น ทำไมแมวชอบกล่อง?" required />
                    </div>

                    <div className="form-group">
                        <label htmlFor="input-description">คำอธิบาย / หัวข้อ</label>
                        <textarea id="input-description" rows="3"
                            placeholder="อธิบายเนื้อหาที่อยากทำ หรือใส่หัวข้อให้ AI คิดบทให้"></textarea>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="input-platform">แพลตฟอร์ม</label>
                            <select id="input-platform">
                                <option value="youtube_shorts">📱 YouTube Shorts</option>
                                <option value="podcast">🎙️ Podcast</option>
                                <option value="tiktok">🎵 TikTok</option>
                                <option value="reels">📸 Instagram Reels</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="input-language">ภาษา</label>
                            <select id="input-language">
                                <option value="th">🇹🇭 ไทย</option>
                                <option value="en">🇺🇸 English</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="input-category">หมวดหมู่</label>
                            <select id="input-category">
                                <option value="">— ไม่ระบุ —</option>
                            </select>
                        </div>
                    </div>

                    <button type="button" className="btn btn-primary btn-lg btn-glow" onClick={() => createProject()} id="btn-create">
                        🚀 สร้างโปรเจค
                    </button>
                </div>
            </form>

            {/* Bulk Create Section */}
            <div style={{ marginTop: '32px' }}>
                <div className="form-card">
                    <h2 style={{ marginBottom: '8px' }}>⚡ สร้างพร้อมกันหลายโปรเจค (Bulk Create)</h2>
                    <p className="subtitle" style={{ marginBottom: '24px' }}>ให้ AI คิดหัวข้อตามหมวดหมู่แล้วสร้างโปรเจคทีเดียวหลายอัน</p>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="bulk-category">หมวดหมู่</label>
                            <select id="bulk-category">
                                <option value="">— เลือกหมวดหมู่ —</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="bulk-count">จำนวนหัวข้อ</label>
                            <select id="bulk-count" defaultValue="5">
                                <option value="3">3 หัวข้อ</option>
                                <option value="5">5 หัวข้อ</option>
                                <option value="10">10 หัวข้อ</option>
                                <option value="15">15 หัวข้อ</option>
                                <option value="20">20 หัวข้อ</option>
                            </select>
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="bulk-platform">แพลตฟอร์ม</label>
                            <select id="bulk-platform">
                                <option value="youtube_shorts">📱 YouTube Shorts</option>
                                <option value="podcast">🎙️ Podcast</option>
                                <option value="tiktok">🎵 TikTok</option>
                                <option value="reels">📸 Instagram Reels</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="bulk-language">ภาษา</label>
                            <select id="bulk-language">
                                <option value="th">🇹🇭 ไทย</option>
                                <option value="en">🇺🇸 English</option>
                            </select>
                        </div>
                    </div>

                    <button type="button" className="btn btn-secondary btn-lg" onClick={() => window.generateBulkTopics()} id="btn-bulk-generate">
                        🤖 ให้ AI คิดหัวข้อ
                    </button>

                    <div id="bulk-topics-list" style={{ marginTop: '20px' }}></div>
                </div>
            </div>
        </div>
    );
}

function ProjectPage() {
    return (
        <div id="page-project" className="page">
            <div className="page-header">
                <div>
                    <h1 id="project-title">โปรเจค</h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <p className="subtitle" id="project-subtitle" style={{ margin: 0 }}>กำลังโหลด...</p>
                        <select id="project-category" onChange={() => changeProjectCategory()} style={{ padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                            <option value="">ไม่ระบุหมวดหมู่</option>
                        </select>
                    </div>
                </div>
                <button className="btn btn-ghost" onClick={() => navigateTo('dashboard')}>← กลับ</button>
            </div>

            {/* Workflow Steps */}
            <div className="workflow-steps">
                <div className="step-indicator">
                    <button className="step active" data-step="script" onClick={() => showStep('script')} id="step-btn-script">
                        <span className="step-number">1</span>
                        <span className="step-label">สร้างบท</span>
                    </button>
                    <div className="step-line"></div>
                    <button className="step" data-step="audio" onClick={() => showStep('audio')} id="step-btn-audio">
                        <span className="step-number">2</span>
                        <span className="step-label">สร้างเสียง</span>
                    </button>
                    <div className="step-line"></div>
                    <button className="step" data-step="images" onClick={() => showStep('images')} id="step-btn-images">
                        <span className="step-number">3</span>
                        <span className="step-label">สร้างรูป</span>
                    </button>
                    <div className="step-line"></div>
                    <button className="step" data-step="video" onClick={() => showStep('video')} id="step-btn-video">
                        <span className="step-number">4</span>
                        <span className="step-label">สร้างวิดีโอ</span>
                    </button>
                    <div className="step-line"></div>
                    <button className="step" data-step="publish" onClick={() => showStep('publish')} id="step-btn-publish">
                        <span className="step-number">5</span>
                        <span className="step-label">เผยแพร่</span>
                    </button>
                </div>
            </div>

            <ScriptStep />
            <AudioStep />
            <ImagesStep />
            <VideoStep />
            <PublishStep />
        </div>
    );
}

function ScriptStep() {
    return (
        <div id="step-script" className="step-content active">
            <div className="step-card">
                <div className="step-card-header">
                    <h2>📝 สร้างบทด้วย AI</h2>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-secondary" onClick={() => openAutopilotModal()} id="btn-autopilot"
                            style={{ background: 'linear-gradient(135deg, #FF6B6B, #845EC2)', border: 'none', color: 'white' }}
                            title="ให้ AI คิดบท, สร้างเสียง, สร้างรูป และประกอบวิดีโอให้เสร็จในคลิกเดียว">
                            🚀 Autopilot (ทำให้เสร็จ)
                        </button>
                        <button className="btn btn-primary" onClick={() => generateScript()} id="btn-generate-script">
                            <span className="spinner hidden" id="spinner-script"></span>
                            ✨ สร้างบทอัตโนมัติ
                        </button>
                    </div>
                </div>

                <div className="form-group">
                    <label htmlFor="input-topic">หัวข้อ / คำอธิบายเพิ่มเติม</label>
                    <input type="text" id="input-topic" placeholder="เพิ่มรายละเอียดเพื่อให้ AI สร้างบทที่ตรงใจ" />
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="input-style">สไตล์การเล่า</label>
                        <select id="input-style" defaultValue="storytelling">
                            <option value="storytelling">📖 เล่าเรื่อง (Storytelling)</option>
                            <option value="funny">😂 ตลกขบขัน (Funny)</option>
                            <option value="educational">🧠 ให้ความรู้ (Educational)</option>
                            <option value="drama">🎭 ดราม่า/น่าลุ้น (Drama)</option>
                            <option value="inspirational">✨ สร้างแรงบันดาลใจ (Inspirational)</option>
                            <option value="scary">👻 สยองขวัญ/ลี้ลับ (Scary)</option>
                            <option value="news">📰 สรุปข่าว/อัปเดต (News)</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="input-duration">ความยาวบท</label>
                        <select id="input-duration" defaultValue="2 นาที (ประมาณ 300-400 คำ)">
                            <option value="30 วินาที (ประมาณ 80-100 คำ)">30 วินาที</option>
                            <option value="1 นาที (ประมาณ 150-200 คำ)">1 นาที</option>
                            <option value="2 นาที (ประมาณ 300-400 คำ)">2 นาที</option>
                            <option value="3 นาที (ประมาณ 450-600 คำ)">3 นาที</option>
                            <option value="5 นาที (ประมาณ 750-1000 คำ)">5 นาที</option>
                            <option value="7 นาที (ประมาณ 1050-1400 คำ)">7 นาที</option>
                            <option value="10 นาที (ประมาณ 1500-2000 คำ)">10 นาที</option>
                        </select>
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="input-gender">🎭 เพศผู้พูด</label>
                        <select id="input-gender" defaultValue="neutral">
                            <option value="male">👨 ชาย (ครับ/ผม)</option>
                            <option value="female">👩 หญิง (ค่ะ/ดิฉัน)</option>
                            <option value="neutral">⚪ ไม่ระบุเพศ</option>
                        </select>
                    </div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '12px' }}>
                            💡 กำหนดเพศผู้พูดเพื่อให้ AI ใช้คำลงท้าย (ครับ/ค่ะ) ถูกต้อง และแนะนำเสียง TTS ที่เหมาะสม
                        </p>
                    </div>
                </div>

                <div className="form-group">
                    <label>บทพูด</label>
                    <textarea id="script-content" rows="10"
                        placeholder="พิมพ์บทเอง หรือกด 'สร้างบทอัตโนมัติ' ให้ AI ช่วยคิด"></textarea>
                </div>

                <div id="script-meta" className="script-meta hidden">
                    <div className="meta-item">
                        <span className="meta-label">ชื่อคอนเทนต์:</span>
                        <span id="script-title-display"></span>
                    </div>
                    <div className="meta-item">
                        <span className="meta-label">คำอธิบาย:</span>
                        <span id="script-description-display"></span>
                    </div>
                    <div className="meta-item">
                        <span className="meta-label">แฮชแท็ก:</span>
                        <span id="script-hashtags-display"></span>
                    </div>
                </div>

                <div className="step-actions">
                    <button className="btn btn-primary" onClick={() => saveScript()}>💾 บันทึกบท</button>
                    <button className="btn btn-secondary" onClick={() => showStep('audio')}>ถัดไป: สร้างเสียง →</button>
                </div>
            </div>
        </div>
    );
}

function AudioStep() {
    return (
        <div id="step-audio" className="step-content">
            <div className="step-card">
                <div className="step-card-header">
                    <h2>🎤 สร้างเสียง Text-to-Speech</h2>
                </div>

                <div className="form-group">
                    <label>ข้อความที่จะแปลงเป็นเสียง</label>
                    <textarea id="tts-text" rows="6"
                        placeholder="ระบบจะใช้บทจากขั้นตอนก่อนหน้า หรือพิมพ์ข้อความใหม่ได้"></textarea>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="tts-voice">เลือกเสียง</label>
                        <select id="tts-voice" defaultValue="Kore">
                            <option value="Kore">Kore (หญิง)</option>
                            <option value="Zephyr">Zephyr (หญิง)</option>
                            <option value="Aoede">Aoede (หญิง)</option>
                            <option value="Leda">Leda (หญิง)</option>
                            <option value="Puck">Puck (ชาย)</option>
                            <option value="Charon">Charon (ชาย)</option>
                            <option value="Fenrir">Fenrir (ชาย)</option>
                            <option value="Orus">Orus (ชาย)</option>
                            <option value="Achernar">Achernar</option>
                            <option value="Achird">Achird</option>
                            <option value="Algenib">Algenib</option>
                            <option value="Algieba">Algieba</option>
                            <option value="Alnilam">Alnilam</option>
                            <option value="Autonoe">Autonoe</option>
                            <option value="Callirrhoe">Callirrhoe</option>
                            <option value="Despina">Despina</option>
                            <option value="Enceladus">Enceladus</option>
                            <option value="Erinome">Erinome</option>
                            <option value="Gacrux">Gacrux</option>
                            <option value="Iapetus">Iapetus</option>
                            <option value="Laomedeia">Laomedeia</option>
                            <option value="Pulcherrima">Pulcherrima</option>
                            <option value="Rasalgethi">Rasalgethi</option>
                            <option value="Sadachbia">Sadachbia</option>
                            <option value="Sadaltager">Sadaltager</option>
                            <option value="Schedar">Schedar</option>
                            <option value="Sulafat">Sulafat</option>
                            <option value="Umbriel">Umbriel</option>
                            <option value="Vindemiatrix">Vindemiatrix</option>
                            <option value="Zubenelgenubi">Zubenelgenubi</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="tts-emotion">อารมณ์/น้ำเสียง</label>
                        <select id="tts-emotion" defaultValue="neutral">
                            <option value="neutral">😐 ปกติ (Neutral)</option>
                            <option value="happy">😄 ร่าเริง/มีความสุข (Happy)</option>
                            <option value="sad">😢 เศร้า (Sad)</option>
                            <option value="angry">😠 โกรธ (Angry)</option>
                            <option value="fearful">😨 หวาดกลัว/สยองขวัญ (Fearful)</option>
                            <option value="surprised">😲 ประหลาดใจ/ตื่นเต้น (Surprised)</option>
                            <option value="drama">🎭 ดราม่า/เล่าเรื่องลุ้นระทึก (Drama)</option>
                            <option value="calm">🧘 สงบ/ผ่อนคลายบรรยายธรรม (Calm)</option>
                            <option value="professional">💼 มืออาชีพ/เล่าธุรกิจ (Professional)</option>
                            <option value="serious">🧐 จริงจัง/เป็นทางการ (Serious)</option>
                        </select>
                    </div>
                </div>

                <button className="btn btn-primary btn-lg" onClick={() => generateAudio()} id="btn-generate-audio">
                    <span className="spinner hidden" id="spinner-audio"></span>
                    🎙️ สร้างเสียง
                </button>

                <div id="audio-result" className="audio-result hidden">
                    <div className="audio-player-card">
                        <h3>🔊 เสียงที่สร้าง</h3>
                        <audio id="audio-player" controls></audio>
                        <div className="audio-info">
                            <span id="audio-info-text"></span>
                        </div>
                    </div>
                </div>

                <div className="step-actions">
                    <button className="btn btn-ghost" onClick={() => showStep('script')}>← กลับ</button>
                    <button className="btn btn-secondary" onClick={() => showStep('images')}>ถัดไป: สร้างรูป →</button>
                </div>
            </div >
        </div >
    );
}

function ImagesStep() {
    return (
        <div id="step-images" className="step-content">
            <div className="step-card">
                <div className="step-card-header">
                    <h2>🖼️ สร้างรูปภาพประกอบ</h2>
                </div>

                <div id="image-prompts-container">
                    <div className="form-group">
                        <label>Prompt สำหรับสร้างรูป
                            <span style={{ fontWeight: 'normal', marginLeft: '12px' }}>จำนวน:</span>
                            <select id="image-count-select"
                                style={{ width: 'auto', display: 'inline-block', padding: '4px 12px', fontSize: '0.9em' }}>
                                <option value="3">3 ภาพ</option>
                                <option value="5" defaultValue>5 ภาพ</option>
                                <option value="10">10 ภาพ</option>
                                <option value="15">15 ภาพ</option>
                                <option value="20">20 ภาพ</option>
                            </select>
                            <button className="btn btn-sm btn-secondary" onClick={() => fillImagePromptsFromScript()}
                                style={{ marginLeft: '8px' }}>📝 สกัดจากบทพูด</button>
                        </label>
                        <div id="image-prompts-list" className="image-prompts-list">
                            <div className="image-prompt-item">
                                <input type="text" className="image-prompt-input" placeholder="อธิบายรูปที่ต้องการ (ภาษาอังกฤษ)" />
                                <button className="btn btn-sm btn-danger" onClick={(e) => removeImagePrompt(e.target)}>✕</button>
                            </div>
                        </div>
                        <button className="btn btn-sm btn-ghost" onClick={() => addImagePrompt()}>+ เพิ่ม Prompt</button>
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="image-style">สไตล์ภาพ</label>
                        <select id="image-style">
                            <option value="digital art, vibrant colors">🎨 Digital Art (สีสดใสสไตล์ดิจิทัล)</option>
                            <option value="highly detailed realistic photography, 8k, cinematic lighting">📷 Realistic (สมจริงเหมือนภาพถ่าย)</option>
                            <option value="anime style, studio ghibli, beautiful scenery">🌸 Anime (อนิเมะสไตล์ Ghibli)</option>
                            <option value="3d pixar disney style, cute and expressive">🧸 3D Pixar (สามมิติน่ารัก)</option>
                            <option value="beautiful watercolor painting, soft strokes">🖌️ Watercolor (ภาพวาดสีน้ำนุ่มนวล)</option>
                            <option value="cyberpunk sci-fi style, neon lights, highly detailed">🌃 Cyberpunk (ไซไฟล้ำยุค)</option>
                            <option value="minimalist flat vector art, clean lines">📐 Minimalist Vector (ภาพเวกเตอร์เรียบง่าย)</option>
                            <option value="dark fantasy, moody lighting, highly detailed">🌑 Dark Fantasy (แฟนตาซีดาร์กๆ)</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="image-aspect">อัตราส่วนภาพ</label>
                        <select id="image-aspect">
                            <option value="9:16">📱 แนวตั้ง 9:16 (Shorts/TikTok)</option>
                            <option value="3:4">📱 แนวตั้ง 3:4</option>
                            <option value="1:1">⬜ สี่เหลี่ยม 1:1</option>
                            <option value="4:3">🖥️ แนวนอน 4:3</option>
                            <option value="16:9">🖥️ แนวนอน 16:9</option>
                        </select>
                    </div>
                </div>

                <button className="btn btn-primary btn-lg" onClick={() => generateImages()} id="btn-generate-images">
                    <span className="spinner hidden" id="spinner-images"></span>
                    🎨 สร้างรูปทั้งหมด
                </button>

                <div id="images-result" className="images-grid hidden">
                </div>

                <div className="step-actions">
                    <button className="btn btn-ghost" onClick={() => showStep('audio')}>← กลับ</button>
                    <button className="btn btn-secondary" onClick={() => showStep('video')}>ถัดไป: สร้างวิดีโอ →</button>
                </div>
            </div>
        </div>
    );
}

function VideoStep() {
    return (
        <div id="step-video" className="step-content">
            <div className="step-card">
                <div className="step-card-header">
                    <h2>🎬 สร้างวิดีโอ</h2>
                </div>

                <div id="ffmpeg-status" className="ffmpeg-status">
                    <span className="spinner"></span> กำลังตรวจสอบ FFmpeg...
                </div>

                <div className="video-preview-area">
                    <h3>ไฟล์ที่จะใช้</h3>
                    <div className="video-assets">
                        <div className="asset-item">
                            <span className="asset-icon">🎤</span>
                            <span id="video-audio-file">ยังไม่มีไฟล์เสียง</span>
                        </div>
                        <div className="asset-item">
                            <span className="asset-icon">🖼️</span>
                            <span id="video-image-count">ยังไม่มีรูปภาพ</span>
                        </div>
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="video-format">รูปแบบวิดีโอ</label>
                        <select id="video-format">
                            <option value="youtube_shorts">📱 YouTube Shorts (1080x1920)</option>
                            <option value="podcast">🎙️ Podcast (1920x1080)</option>
                            <option value="tiktok">🎵 TikTok (1080x1920)</option>
                            <option value="reels">📸 Reels (1080x1920)</option>
                            <option value="square">⬜ Square (1080x1080)</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="video-animation">🎬 Animation Style</label>
                        <select id="video-animation" defaultValue="random">
                            <option value="kenburns">🔍 Ken Burns (ซูม + แพน)</option>
                            <option value="zoom_in">🔎 Zoom In (ซูมเข้า)</option>
                            <option value="zoom_out">🔭 Zoom Out (ซูมออก)</option>
                            <option value="pan_lr">↔️ Pan ซ้าย-ขวา</option>
                            <option value="pan_ud">↕️ Pan บน-ล่าง</option>
                            <option value="random">🎲 Random Mix (สุ่ม)</option>
                            <option value="none">⏹️ ไม่มี Animation</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="video-subtitle">📝 ซับไตเติ้ล</label>
                        <select id="video-subtitle" defaultValue="yes" onChange={(e) => {
                            const sty = document.getElementById('subtitle-styles-container');
                            if (sty) sty.style.display = e.target.value === 'yes' ? 'block' : 'none';
                        }}>
                            <option value="yes">✅ ใส่ซับอัตโนมัติ (เปิด)</option>
                            <option value="no">❌ ไม่ใส่ซับไตเติ้ล</option>
                        </select>
                    </div>
                </div>

                <div id="subtitle-styles-container" style={{ display: 'block', background: 'var(--bg-input)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '24px', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ marginBottom: '12px', fontSize: '0.95rem' }}>🎨 ปรับแต่งสไตล์ซับไตเติ้ล</h4>
                    <div className="form-row" style={{ marginBottom: '0' }}>
                        <div className="form-group">
                            <label htmlFor="sub-font">แบบฟอนต์</label>
                            <select id="sub-font" defaultValue="Kanit">
                                <option value="Kanit">🅰️ คณิต (Kanit) - ทันสมัย</option>
                                <option value="Prompt">🅱️ พร้อม (Prompt) - เรียบหรู</option>
                                <option value="Sarabun">📄 สารบรรณ (Sarabun) - ทางการ</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="sub-size">ขนาดตัวอักษร (px)</label>
                            <select id="sub-size" defaultValue="80">
                                <option value="36">36px — เล็ก</option>
                                <option value="42">42px</option>
                                <option value="48">48px — แนะนำ</option>
                                <option value="56">56px</option>
                                <option value="64">64px — ใหญ่</option>
                                <option value="72">72px</option>
                                <option value="80">80px — ใหญ่มาก</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="sub-color">โทนสี</label>
                            <select id="sub-color" defaultValue="yellow_black">
                                <option value="white_black">⚪ ขาว / ขอบดำ</option>
                                <option value="yellow_black">⭐ เหลือง / ขอบดำ</option>
                                <option value="black_white">⚫ ดำ / ขอบขาว</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="sub-bg">ความหนาขอบ</label>
                            <select id="sub-bg" defaultValue="normal">
                                <option value="thin">เส้นบาง</option>
                                <option value="normal">ปกติ - แนะนำ</option>
                                <option value="thick">เส้นหนา</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="sub-pos">ตำแหน่ง</label>
                            <select id="sub-pos" defaultValue="top">
                                <option value="top">⬆️ ส่วนบน</option>
                                <option value="center">⏺️ ส่วนกลาง</option>
                                <option value="bottom">⬇️ ส่วนล่าง</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* BGM Settings */}
                <div className="form-card" style={{ marginTop: '16px', marginBottom: '16px' }}>
                    <h3 style={{ marginBottom: '12px' }}>🎵 เพลงประกอบ (BGM)</h3>
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="video-bgm">เลือก BGM</label>
                            <select id="video-bgm" defaultValue="">
                                <option value="">ไม่ใส่ BGM</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="bgm-volume">ระดับเสียง BGM</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input type="range" id="bgm-volume" min="5" max="100" defaultValue="20" style={{ flex: 1 }} onChange={() => { document.getElementById('bgm-volume-label').textContent = document.getElementById('bgm-volume').value + '%'; }} />
                                <span id="bgm-volume-label" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', minWidth: '35px' }}>20%</span>
                            </div>
                        </div>
                    </div>
                </div>

                <button className="btn btn-primary btn-lg btn-glow" onClick={() => createVideo()} id="btn-create-video">
                    <span className="spinner hidden" id="spinner-video"></span>
                    🎬 สร้างวิดีโอ
                </button>

                <div id="video-result" className="video-result hidden">
                    <h3>🎉 วิดีโอพร้อมแล้ว!</h3>
                    <video id="video-player" controls></video>
                    <div className="video-actions">
                        <a id="video-download" className="btn btn-primary" download>⬇️ ดาวน์โหลด</a>
                    </div>
                </div>

                <div className="step-actions">
                    <button className="btn btn-ghost" onClick={() => showStep('images')}>← กลับ</button>
                    <button className="btn btn-secondary" onClick={() => showStep('publish')}>ถัดไป: เผยแพร่ →</button>
                </div>
            </div>
        </div>
    );
}

function PublishStep() {
    return (
        <div id="step-publish" className="step-content">
            <div className="step-card">
                <div className="step-card-header">
                    <h2>📢 เผยแพร่คอนเทนต์</h2>
                    <button className="btn btn-secondary" onClick={() => regenerateSeo()}>
                        🔄 AI สร้าง SEO ใหม่
                    </button>
                </div>

                <div className="publish-section">
                    <div className="publish-field">
                        <div className="publish-field-header">
                            <label>📌 ชื่อเรื่อง / Title</label>
                            <button className="btn btn-sm btn-ghost" onClick={() => copyToClipboard('publish-title')}>📋 คัดลอก</button>
                        </div>
                        <div className="publish-content" id="publish-title">-</div>
                    </div>

                    <div className="publish-field">
                        <div className="publish-field-header">
                            <label>📝 คำอธิบาย / Description</label>
                            <button className="btn btn-sm btn-ghost" onClick={() => copyToClipboard('publish-description')}>📋 คัดลอก</button>
                        </div>
                        <div className="publish-content" id="publish-description">-</div>
                    </div>

                    <div className="publish-field">
                        <div className="publish-field-header">
                            <label>🏷️ แฮชแท็ก</label>
                            <button className="btn btn-sm btn-ghost" onClick={() => copyToClipboard('publish-hashtags')}>📋 คัดลอก</button>
                        </div>
                        <div className="publish-content publish-hashtags" id="publish-hashtags">-</div>
                    </div>

                    <div className="publish-field">
                        <div className="publish-field-header">
                            <label>📄 คัดลอกทั้งหมด (พร้อมโพส)</label>
                            <button className="btn btn-sm btn-primary" onClick={() => copyAllPublish()}>📋 คัดลอกทั้งหมด</button>
                        </div>
                        <div className="publish-content publish-preview" id="publish-all-preview">-</div>
                    </div>

                    <div className="publish-field" id="publish-video-section" style={{ display: 'none' }}>
                        <div className="publish-field-header">
                            <label>🎬 วิดีโอ</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <a id="publish-video-download" className="btn btn-sm btn-primary" download>⬇️ ดาวน์โหลด</a>
                                <label htmlFor="video-replace-input" className="btn btn-sm btn-secondary"
                                    style={{ cursor: 'pointer', margin: 0 }}>
                                    📤 อัพโหลดแทนที่
                                </label>
                                <input type="file" id="video-replace-input" accept="video/mp4,video/*" style={{ display: 'none' }}
                                    onChange={(e) => replaceProjectVideo(e.target)} />
                            </div>
                        </div>
                        <video id="publish-video-player" controls
                            style={{ width: '100%', maxWidth: '360px', borderRadius: '12px', border: '1px solid var(--border-color)' }}></video>
                        <div id="video-replace-status" className="hidden"
                            style={{ marginTop: '12px', padding: '12px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                        </div>
                    </div>

                    <div className="publish-field">
                        <div className="publish-field-header">
                            <label>📊 ข้อมูลโปรเจค</label>
                        </div>
                        <div className="publish-meta" id="publish-meta">-</div>
                    </div>
                </div>

                {/* Facebook Upload Section */}
                <div className="publish-section" style={{ marginTop: '24px' }}>
                    <div className="publish-field">
                        <div className="publish-field-header">
                            <label>🔵 เผยแพร่ไป Facebook Page</label>
                        </div>
                        <div id="fb-publish-area">
                            <div id="fb-not-connected" className="fb-status-card">
                                <p style={{ color: 'var(--text-muted)', marginBottom: '12px' }}>
                                    ⚠️ ยังไม่ได้เพิ่ม Facebook Page — ไปเพิ่มที่หน้า{' '}
                                    <a href="#" onClick={(e) => { e.preventDefault(); navigateTo('settings'); }} style={{ color: 'var(--accent-secondary)' }}>ตั้งค่า</a>
                                </p>
                            </div>
                            <div id="fb-connected" className="fb-status-card" style={{ display: 'none' }}>
                                <div className="form-group" style={{ marginBottom: '16px' }}>
                                    <label htmlFor="fb-publish-page" style={{ fontWeight: 600, marginBottom: '6px', display: 'block' }}>📄 เลือก Page</label>
                                    <select id="fb-publish-page" style={{ maxWidth: '400px' }}>
                                        <option value="">กำลังโหลด...</option>
                                    </select>
                                </div>

                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                                        <input type="checkbox" id="fb-schedule-toggle" onChange={(e) => toggleSchedule(e.target)}
                                            style={{ width: 'auto', accentColor: 'var(--accent-primary)' }} />
                                        <span>⏰ ตั้งเวลาเผยแพร่ล่วงหน้า</span>
                                    </label>
                                    <div id="fb-schedule-picker" className="hidden" style={{ marginTop: '8px' }}>
                                        <input type="datetime-local" id="fb-schedule-time"
                                            style={{ maxWidth: '300px', padding: '10px 14px' }} />
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>
                                            Facebook ต้องตั้งเวลาล่วงหน้าอย่างน้อย 10 นาที และไม่เกิน 6 เดือน
                                        </p>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <button className="btn btn-primary" onClick={() => publishToFacebook('reel')} id="btn-fb-reel">
                                        <span className="spinner hidden" id="spinner-fb-publish"></span>
                                        🎬 โพสเป็น Reels
                                    </button>
                                    <button className="btn btn-secondary" onClick={() => publishToFacebook('post')} id="btn-fb-post">
                                        📹 โพสเป็นวิดีโอ
                                    </button>
                                </div>
                                <div id="fb-publish-result" className="hidden" style={{ marginTop: '16px' }}>
                                    <div id="fb-publish-status" className="fb-result-card"></div>
                                </div>
                            </div>
                        </div>

                        {/* YouTube Publish Section */}
                        <div id="yt-publish-area" style={{ marginTop: '16px' }}>
                            <h3 style={{ marginBottom: '12px', fontSize: '1rem' }}>🔴 เผยแพร่ไป YouTube</h3>
                            <div id="yt-not-connected" className="fb-status-card"
                                style={{ background: 'rgba(255, 0, 0, 0.05)', borderColor: 'rgba(255, 0, 0, 0.15)' }}>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '12px' }}>
                                    ⚠️ ยังไม่ได้เชื่อมต่อ YouTube — ไปเพิ่มที่หน้า{' '}
                                    <a href="#" onClick={(e) => { e.preventDefault(); navigateTo('settings'); }} style={{ color: 'var(--accent-secondary)' }}>ตั้งค่า</a>
                                </p>
                            </div>
                            <div id="yt-connected" className="fb-status-card"
                                style={{ display: 'none', background: 'rgba(255, 0, 0, 0.05)', borderColor: 'rgba(255, 0, 0, 0.15)' }}>
                                <div className="form-group" style={{ marginBottom: '16px' }}>
                                    <label style={{ fontWeight: 600, marginBottom: '6px', display: 'block' }}>📄 เลือก Channel</label>
                                    <select id="yt-publish-channel" style={{ maxWidth: '400px', padding: '10px 14px' }}>
                                    </select>
                                </div>

                                <div className="form-group" style={{ marginBottom: '16px' }}>
                                    <label style={{ fontWeight: 600, marginBottom: '6px', display: 'block' }}>👀 ความเป็นส่วนตัว</label>
                                    <select id="yt-privacy-status" style={{ maxWidth: '400px' }}>
                                        <option value="public">🌍 สาธารณะ (Public)</option>
                                        <option value="unlisted">🔗 ไม่เป็นสาธารณะ (Unlisted)</option>
                                        <option value="private">🔒 ส่วนตัว (Private)</option>
                                    </select>
                                </div>

                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                                        <input type="checkbox" id="yt-schedule-toggle" onChange={(e) => toggleYtSchedule(e.target)}
                                            style={{ width: 'auto', accentColor: 'var(--danger)' }} />
                                        <span>⏰ ตั้งเวลาเผยแพร่ล่วงหน้า (YouTube)</span>
                                    </label>
                                    <div id="yt-schedule-picker" className="hidden" style={{ marginTop: '8px' }}>
                                        <input type="datetime-local" id="yt-schedule-time"
                                            style={{ maxWidth: '300px', padding: '10px 14px' }} />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <button className="btn btn-primary" onClick={() => publishToYouTube()} id="btn-yt-publish"
                                        style={{ background: 'var(--danger)' }}>
                                        <span className="spinner hidden" id="spinner-yt-publish"></span>
                                        ▶️ อัปโหลดลง YouTube
                                    </button>
                                </div>

                                <div id="yt-publish-result" className="hidden" style={{ marginTop: '16px' }}>
                                    <div id="yt-publish-status" className="fb-result-card"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="step-actions">
                    <button className="btn btn-ghost" onClick={() => showStep('video')}>← กลับ</button>
                    <button className="btn btn-primary btn-lg btn-glow" onClick={() => navigateTo('dashboard')}>✅ เสร็จสิ้น — กลับ Dashboard</button>
                </div>
            </div>
        </div>
    );
}

function SettingsPage() {
    return (
        <div id="page-settings" className="page">
            <div className="page-header">
                <div>
                    <h1>⚙️ ตั้งค่า</h1>
                    <p className="subtitle">จัดการ API Key และการตั้งค่าระบบ</p>
                </div>
            </div>
            <div className="settings-section" style={{ marginBottom: '24px' }}>
                <div className="form-card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <h2 style={{ margin: 0 }}>📂 หมวดหมู่โปรเจค</h2>
                        <button className="btn btn-primary btn-sm" onClick={() => window.addCategory()}>+ เพิ่มหมวดหมู่</button>
                    </div>
                    <div id="category-list">
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>กำลังโหลด...</p>
                    </div>
                </div>
            </div>

            <div className="settings-section" style={{ marginBottom: '24px' }}>
                <div className="form-card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <h2 style={{ margin: 0 }}>🎵 เพลงประกอบ (BGM)</h2>
                    </div>
                    <p className="subtitle" style={{ marginBottom: '16px' }}>อัปโหลดไฟล์เพลงเพื่อใช้เป็น Background Music ในคลิป (รองรับ .mp3, .wav, .ogg, .m4a)</p>
                    <div className="form-row" style={{ marginBottom: '12px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label htmlFor="bgm-label">ชื่อเพลง</label>
                            <input type="text" id="bgm-label" placeholder="เช่น เพลงสบาย ๆ, เปียโนเบา ๆ" />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label htmlFor="bgm-file">เลือกไฟล์</label>
                            <input type="file" id="bgm-file" accept=".mp3,.wav,.ogg,.m4a,.aac,.flac" style={{ padding: '8px' }} />
                        </div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => window.uploadBgm()} id="btn-upload-bgm">📤 อัปโหลด BGM</button>

                    <div id="bgm-list" style={{ marginTop: '20px' }}>
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>กำลังโหลด...</p>
                    </div>
                </div>
            </div>

            <div className="settings-section">
                <div className="form-card">
                    <h2 style={{ marginBottom: '8px' }}>🔑 Google AI Studio API Keys</h2>
                    <p className="subtitle" style={{ marginBottom: '24px' }}>เพิ่ม API Key จาก{' '}
                        <a href="https://aistudio.google.com/apikey" target="_blank" style={{ color: 'var(--accent-secondary)' }}>Google AI Studio</a>{' '}
                        เพื่อใช้งาน AI, TTS และสร้างรูป
                    </p>

                    <div className="add-key-form">
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="new-key-label">ชื่อ / Label</label>
                                <input type="text" id="new-key-label" placeholder="เช่น Key หลัก, Key ทดสอบ" />
                            </div>
                            <div className="form-group" style={{ flex: 2 }}>
                                <label htmlFor="new-key-value">API Key</label>
                                <input type="password" id="new-key-value" placeholder="AIzaSy..." />
                            </div>
                        </div>
                        <div className="add-key-actions">
                            <button className="btn btn-primary" onClick={() => addApiKey()} id="btn-add-key">
                                ➕ เพิ่ม Key
                            </button>
                            <button className="btn btn-ghost" onClick={() => testApiKey()} id="btn-test-key">
                                <span className="spinner hidden" id="spinner-test-key"></span>
                                🧪 ทดสอบ Key
                            </button>
                        </div>
                    </div>

                    <div className="keys-list-header">
                        <h3>API Keys ทั้งหมด</h3>
                    </div>
                    <div id="api-keys-list" className="api-keys-list">
                        <div className="empty-keys">
                            <p>ยังไม่มี API Key — เพิ่ม Key ด้านบนเพื่อเริ่มใช้งาน</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Facebook Pages Settings */}
            <div className="settings-section" style={{ marginTop: '24px' }}>
                <div className="form-card">
                    <h2 style={{ marginBottom: '8px' }}>🔵 Facebook Pages</h2>
                    <p className="subtitle" style={{ marginBottom: '24px' }}>เชื่อมต่อหลาย Facebook Pages เพื่อเผยแพร่วิดีโอ —{' '}
                        <a href="https://developers.facebook.com/tools/explorer/" target="_blank"
                            style={{ color: 'var(--accent-secondary)' }}>สร้าง Token ที่นี่</a>
                    </p>

                    <div id="fb-pages-list" style={{ marginBottom: '20px' }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>กำลังโหลด...</p>
                    </div>

                    <div style={{ padding: '16px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                        <h3 style={{ fontSize: '0.95rem', marginBottom: '12px' }}>➕ เพิ่ม Page ใหม่</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="fb-page-id">Page ID</label>
                                <input type="text" id="fb-page-id" placeholder="เช่น 123456789012345" />
                            </div>
                            <div className="form-group">
                                <label htmlFor="fb-page-name">ชื่อ Page (ไม่จำเป็น)</label>
                                <input type="text" id="fb-page-name" placeholder="เช่น My Creator Page" />
                            </div>
                        </div>
                        <div className="form-group">
                            <label htmlFor="fb-page-token">Page Access Token</label>
                            <input type="password" id="fb-page-token" placeholder="EAAxxxxxxx..." />
                        </div>
                        <div className="add-key-actions">
                            <button className="btn btn-primary" onClick={() => saveFacebookSettings()} id="btn-save-fb">
                                ➕ เพิ่ม Page
                            </button>
                            <button className="btn btn-ghost" onClick={() => testFacebookToken()} id="btn-test-fb">
                                <span className="spinner hidden" id="spinner-test-fb"></span>
                                🧪 ทดสอบ Token
                            </button>
                        </div>
                    </div>

                    <div id="fb-test-result" className="hidden" style={{ marginTop: '12px' }}>
                        <div id="fb-test-message" style={{ padding: '12px', borderRadius: 'var(--radius-md)', fontSize: '0.9rem' }}>
                        </div>
                    </div>
                </div>
            </div>

            {/* YouTube Settings */}
            <div className="settings-section" style={{ marginTop: '24px' }}>
                <div className="form-card">
                    <h2 style={{ marginBottom: '8px' }}>🔴 YouTube Channel</h2>
                    <p className="subtitle" style={{ marginBottom: '24px' }}>เชื่อมต่อช่อง YouTube ด้วย Google OAuth 2.0 (ประเภท Desktop / Web) <br />
                        <a href="https://console.cloud.google.com/apis/credentials" target="_blank"
                            style={{ color: 'var(--accent-secondary)' }}>→ จัดการ Credentials ที่นี่</a><br />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>* ต้องตั้ง Authorized redirect URIs เป็น:
                            <code>http://localhost:3000/api/settings/youtube/oauth2callback</code></span>
                    </p>

                    <div id="yt-channels-list" style={{ marginBottom: '20px' }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>กำลังโหลด...</p>
                    </div>

                    <div id="yt-settings-form">
                        <div className="form-row">
                            <div className="form-group" style={{ flex: 2 }}>
                                <label htmlFor="yt-client-id">Client ID</label>
                                <input type="text" id="yt-client-id" placeholder="123456789...apps.googleusercontent.com" />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="yt-client-secret">Client Secret</label>
                                <input type="password" id="yt-client-secret" placeholder="GOCSPX-xxxxxx..." />
                            </div>
                        </div>
                        <div className="add-key-actions">
                            <button className="btn btn-primary" onClick={() => saveYouTubeKeys()} id="btn-save-yt"
                                style={{ background: 'var(--danger)' }}>
                                💾 บันทึก Client ID &amp; Secret
                            </button>
                            <button className="btn btn-ghost" onClick={() => connectYouTube()} id="btn-connect-yt"
                                style={{ border: '1px solid var(--danger)', color: 'var(--danger)' }}>
                                <span className="spinner hidden" id="spinner-connect-yt"></span>
                                🔗 เชื่อมต่อบัญชี YouTube
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function AutopilotPage() {
    return (
        <div id="page-autopilot" className="page">
            <div className="page-header">
                <div>
                    <h1>🚀 ระบบ Autopilot (Smart Generator)</h1>
                    <p className="subtitle">กำหนดแคตตาล็อก (หัวข้อหลัก) แล้วให้ระบบสร้างวิดีโอหลายเรื่องให้รวดเดียวตั้งแต่ต้นจนจบ</p>
                </div>
            </div>

            <div className="form-card">
                <div className="form-group">
                    <label htmlFor="ap-catalog">หัวข้อแคตตาล็อก (Catalog / Topic)</label>
                    <input type="text" id="ap-catalog" placeholder="เช่น 10 อันดับสัตว์โลกน่ารัก, ประวัติศาสตร์ไทย, ความรู้รอบตัว" required />
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="ap-count">จำนวนเรื่องที่ต้องการสร้าง</label>
                        <select id="ap-count" defaultValue="3">
                            <option value="1">1 เรื่อง</option>
                            <option value="3">3 เรื่อง</option>
                            <option value="5">5 เรื่อง</option>
                            <option value="10">10 เรื่อง</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="ap-platform">แพลตฟอร์ม & รูปแบบวิดีโอ</label>
                        <select id="ap-platform" defaultValue="youtube_shorts">
                            <option value="youtube_shorts">📱 YouTube Shorts (9:16)</option>
                            <option value="youtube_doc">🎬 YouTube Documentary (16:9)</option>
                            <option value="tiktok">🎵 TikTok (9:16)</option>
                            <option value="reels">📸 Instagram Reels (9:16)</option>
                        </select>
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="ap-duration">ความยาวคลิป (โดยประมาณ)</label>
                        <select id="ap-duration" defaultValue="2 นาที (ประมาณ 300-400 คำ)">
                            <option value="30 วินาที (ประมาณ 80-100 คำ)">30 วินาที</option>
                            <option value="1 นาที (ประมาณ 150-200 คำ)">1 นาที</option>
                            <option value="2 นาที (ประมาณ 300-400 คำ)">2 นาที</option>
                            <option value="3 นาที (ประมาณ 450-600 คำ)">3 นาที</option>
                            <option value="5 นาที (ประมาณ 750-1000 คำ)">5 นาที</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="ap-voice">รูปแบบเสียง (Voice)</label>
                        <select id="ap-voice" defaultValue="Kore">
                            <option value="Kore">Kore (หญิง)</option>
                            <option value="Zephyr">Zephyr (หญิง)</option>
                            <option value="Aoede">Aoede (หญิง)</option>
                            <option value="Leda">Leda (หญิง)</option>
                            <option value="Puck">Puck (ชาย)</option>
                            <option value="Charon">Charon (ชาย)</option>
                            <option value="Fenrir">Fenrir (ชาย)</option>
                            <option value="Orus">Orus (ชาย)</option>
                            <option value="Achernar">Achernar</option>
                            <option value="Achird">Achird</option>
                            <option value="Algenib">Algenib</option>
                            <option value="Algieba">Algieba</option>
                            <option value="Alnilam">Alnilam</option>
                            <option value="Autonoe">Autonoe</option>
                            <option value="Callirrhoe">Callirrhoe</option>
                            <option value="Despina">Despina</option>
                            <option value="Enceladus">Enceladus</option>
                            <option value="Erinome">Erinome</option>
                            <option value="Gacrux">Gacrux</option>
                            <option value="Iapetus">Iapetus</option>
                            <option value="Laomedeia">Laomedeia</option>
                            <option value="Pulcherrima">Pulcherrima</option>
                            <option value="Rasalgethi">Rasalgethi</option>
                            <option value="Sadachbia">Sadachbia</option>
                            <option value="Sadaltager">Sadaltager</option>
                            <option value="Schedar">Schedar</option>
                            <option value="Sulafat">Sulafat</option>
                            <option value="Umbriel">Umbriel</option>
                            <option value="Vindemiatrix">Vindemiatrix</option>
                            <option value="Zubenelgenubi">Zubenelgenubi</option>
                        </select>
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="ap-image-style">รูปแบบภาพประกอบ</label>
                        <select id="ap-image-style" defaultValue="digital art, vibrant colors">
                            <option value="digital art, vibrant colors">🎨 Digital Art</option>
                            <option value="highly detailed realistic photography, 8k, cinematic lighting">📷 Realistic</option>
                            <option value="anime style, studio ghibli, beautiful scenery">🌸 Anime</option>
                            <option value="3d pixar disney style, cute and expressive">🧸 3D Pixar</option>
                            <option value="cyberpunk sci-fi style, neon lights, highly detailed">🌃 Cyberpunk</option>
                            <option value="dark fantasy, moody lighting, highly detailed">🌑 Dark Fantasy</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="ap-subtitle">ตั้งค่าซับไตเติ้ล</label>
                        <select id="ap-subtitle" defaultValue="yes">
                            <option value="yes">✅ ใส่ซับอัตโนมัติ (เปิด)</option>
                            <option value="no">❌ ไม่ใส่ซับไตเติ้ล</option>
                        </select>
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="ap-language">ภาษา</label>
                        <select id="ap-language" defaultValue="th">
                            <option value="th">🇹🇭 ไทย</option>
                            <option value="en">🇺🇸 English</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="ap-category">หมวดหมู่</label>
                        <select id="ap-category">
                            <option value="">— ไม่ระบุ —</option>
                        </select>
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                        <label htmlFor="ap-delay">⏱️ เวลาพักระหว่างคลิป (ลด Rate Limit)</label>
                        <select id="ap-delay" defaultValue="120">
                            <option value="0">ไม่ต้องพัก (เสร็จปุ๊บรันต่อเลย)</option>
                            <option value="60">พัก 1 นาที</option>
                            <option value="120">พัก 2 นาที (แนะนำ)</option>
                            <option value="300">พัก 5 นาที</option>
                            <option value="600">พัก 10 นาที</option>
                        </select>
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="ap-bgm">🎵 เพลงประกอบ (BGM)</label>
                        <select id="ap-bgm" defaultValue="">
                            <option value="">ไม่ใส่ BGM</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="ap-bgm-volume">ระดับเสียง BGM</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input type="range" id="ap-bgm-volume" min="5" max="100" defaultValue="20" style={{ flex: 1 }} onChange={() => { document.getElementById('ap-bgm-volume-label').textContent = document.getElementById('ap-bgm-volume').value + '%'; }} />
                            <span id="ap-bgm-volume-label" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', minWidth: '35px' }}>20%</span>
                        </div>
                    </div>
                </div>

                <button type="button" className="btn btn-primary btn-lg btn-glow" onClick={() => { if (window.startSmartAutopilot) window.startSmartAutopilot(); }} id="btn-start-autopilot" style={{ width: '100%', marginTop: '16px' }}>
                    🚀 เริ่มรันระบบ Autopilot
                </button>
            </div>

            <div id="ap-progress-section" style={{ display: 'none', marginTop: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0 }}>สถานะการทำงาน</h3>
                    <button className="btn btn-sm btn-danger" id="btn-stop-autopilot" onClick={() => { if (window.stopSmartAutopilot) window.stopSmartAutopilot(); }} style={{ display: 'none' }}>⏹️ หยุด</button>
                </div>
                <div id="ap-log-container" style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', height: '400px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    <div style={{ color: 'var(--text-muted)' }}>รอเริ่มทำงาน...</div>
                </div>
            </div>
        </div>
    );
}
