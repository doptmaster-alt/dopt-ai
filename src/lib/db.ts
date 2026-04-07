import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_PATH = path.join(process.cwd(), 'data', 'diopt.db');

let db: Database.Database;

export function getDb() {
  if (!db) {
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initDb();
  }
  return db;
}

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'planner',
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      client_name TEXT DEFAULT '',
      product_name TEXT DEFAULT '',
      industry TEXT DEFAULT '',
      current_step INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      client_email TEXT DEFAULT '',
      client_contact TEXT DEFAULT '',
      planner_email TEXT DEFAULT '',
      brief_due TEXT DEFAULT '',
      plan_due TEXT DEFAULT '',
      shoot_date TEXT DEFAULT '',
      design_due TEXT DEFAULT '',
      final_due TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      step INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS step_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      step INTEGER NOT NULL,
      form_data TEXT NOT NULL DEFAULT '{}',
      status TEXT DEFAULT 'draft',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      UNIQUE(project_id, step)
    );
  `);

  // status 컬럼이 없으면 추가 (기존 DB 마이그레이션)
  try {
    db.prepare('SELECT status FROM users LIMIT 1').get();
  } catch {
    db.exec("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'approved'");
  }

  // 스케줄/클라이언트 컬럼 마이그레이션
  const scheduleColumns = ['client_email', 'client_contact', 'planner_email', 'brief_due', 'plan_due', 'shoot_date', 'design_due', 'final_due'];
  for (const col of scheduleColumns) {
    try {
      db.prepare(`SELECT ${col} FROM projects LIMIT 1`).get();
    } catch {
      db.exec(`ALTER TABLE projects ADD COLUMN ${col} TEXT DEFAULT ''`);
    }
  }

  // 이메일 발송 로그 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      email_type TEXT NOT NULL,
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'sent',
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
  `);

  // AI 학습 데이터 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_learnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      category TEXT NOT NULL,
      subcategory TEXT DEFAULT '',
      content TEXT NOT NULL,
      context TEXT DEFAULT '',
      quality_score INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS client_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      preference_key TEXT NOT NULL,
      preference_value TEXT NOT NULL,
      source TEXT DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(client_name, preference_key)
    );
  `);

  // ===== 디자인 패턴 라이브러리 =====
  db.exec(`
    CREATE TABLE IF NOT EXISTS design_patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_type TEXT NOT NULL,
      pattern_name TEXT NOT NULL,
      description TEXT DEFAULT '',
      industry TEXT DEFAULT '',
      tone TEXT DEFAULT '',
      thumbnail_url TEXT DEFAULT '',
      wireframe_blocks TEXT NOT NULL DEFAULT '[]',
      copy_blocks TEXT NOT NULL DEFAULT '[]',
      tags TEXT DEFAULT '',
      source TEXT DEFAULT 'seed',
      usage_count INTEGER DEFAULT 0,
      score REAL DEFAULT 5.0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pattern_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern_id INTEGER NOT NULL,
      project_id INTEGER,
      section_num INTEGER,
      action TEXT NOT NULL,
      feedback TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pattern_id) REFERENCES design_patterns(id),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE INDEX IF NOT EXISTS idx_patterns_section_type ON design_patterns(section_type);
    CREATE INDEX IF NOT EXISTS idx_patterns_industry ON design_patterns(industry);
    CREATE INDEX IF NOT EXISTS idx_patterns_score ON design_patterns(score DESC);
    CREATE INDEX IF NOT EXISTS idx_pattern_usage_pattern ON pattern_usage(pattern_id);
  `);

  // ===== AI 생성 이미지 (나노바나나) =====
  db.exec(`
    CREATE TABLE IF NOT EXISTS generated_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      image_key TEXT NOT NULL,
      image_data TEXT NOT NULL,
      prompt TEXT NOT NULL DEFAULT '',
      feedback_history TEXT NOT NULL DEFAULT '[]',
      status TEXT DEFAULT 'generated',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      UNIQUE(project_id, image_key)
    );
  `);

  // ===== 파이프라인 V2: 프로젝트 계약 조건 컬럼 마이그레이션 =====
  const v2Columns = [
    { col: 'section_count', def: '0' },
    { col: 'shooting_cut_count', def: '0' },
    { col: 'budget', def: "''" },
    { col: 'use_models', def: '1' },
    { col: 'pipeline_version', def: '1' },
  ];
  for (const { col, def } of v2Columns) {
    try {
      db.prepare(`SELECT ${col} FROM projects LIMIT 1`).get();
    } catch {
      db.exec(`ALTER TABLE projects ADD COLUMN ${col} ${def === '0' || def === '1' ? 'INTEGER' : 'TEXT'} DEFAULT ${def}`);
    }
  }

  // ===== 확정 데이터 테이블 (브리프/기획안 확정 스냅샷) =====
  db.exec(`
    CREATE TABLE IF NOT EXISTS confirmed_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      step INTEGER NOT NULL,
      data_type TEXT NOT NULL,
      confirmed_data TEXT NOT NULL,
      pdf_path TEXT DEFAULT '',
      confirmed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      confirmed_by INTEGER,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      UNIQUE(project_id, data_type)
    );
  `);

  // ===== 프로젝트 파일 테이블 (작업의뢰서, 콘티확정본, 디자인확정본, 최종PDF 등) =====
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      step INTEGER NOT NULL,
      file_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      mime_type TEXT DEFAULT '',
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
  `);

  // ===== AI 총평 테이블 =====
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      review_content TEXT NOT NULL,
      report_pdf_path TEXT DEFAULT '',
      email_sent_at DATETIME,
      gdrive_url TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
  `);

  // 에러/피드백 수집 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS error_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'error',
      severity TEXT NOT NULL DEFAULT 'medium',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      stack_trace TEXT DEFAULT '',
      url TEXT DEFAULT '',
      user_id INTEGER,
      user_name TEXT DEFAULT '',
      project_id INTEGER,
      browser_info TEXT DEFAULT '',
      status TEXT DEFAULT 'open',
      resolved_at DATETIME,
      resolved_by TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      priority TEXT NOT NULL DEFAULT 'normal',
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      screenshot_url TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      admin_response TEXT DEFAULT '',
      responded_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // 기본 관리자 계정 생성
  const admin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!admin) {
    const hash = bcrypt.hashSync('diopt2024', 10);
    db.prepare('INSERT INTO users (username, password, name, role, status) VALUES (?, ?, ?, ?, ?)').run('admin', hash, '관리자', 'admin', 'approved');
  }
}

// User queries
export function findUserByUsername(username: string) {
  return getDb().prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
}

// 관리자가 직접 추가 (바로 승인됨)
export function createUser(username: string, password: string, name: string) {
  const hash = bcrypt.hashSync(password, 10);
  return getDb().prepare('INSERT INTO users (username, password, name, status) VALUES (?, ?, ?, ?)').run(username, hash, name, 'approved');
}

// 기획자가 가입 신청 (대기 상태)
export function registerUser(username: string, password: string, name: string) {
  const hash = bcrypt.hashSync(password, 10);
  return getDb().prepare('INSERT INTO users (username, password, name, status) VALUES (?, ?, ?, ?)').run(username, hash, name, 'pending');
}

export function getAllUsers() {
  return getDb().prepare('SELECT id, username, name, role, status, created_at FROM users').all();
}

export function getPendingUsers() {
  return getDb().prepare("SELECT id, username, name, created_at FROM users WHERE status = 'pending' ORDER BY created_at DESC").all();
}

export function approveUser(id: number) {
  return getDb().prepare("UPDATE users SET status = 'approved' WHERE id = ?").run(id);
}

export function rejectUser(id: number) {
  return getDb().prepare('DELETE FROM users WHERE id = ? AND status = ?').run(id, 'pending');
}

// Project queries
export function getProjectsByUser(userId: number) {
  return getDb().prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC').all(userId) as any[];
}

export function getProject(id: number) {
  return getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
}

export function createProject(userId: number, title: string, clientName: string, productName: string, industry: string, schedule?: {
  clientEmail?: string; clientContact?: string; plannerEmail?: string;
  briefDue?: string; planDue?: string; shootDate?: string; designDue?: string; finalDue?: string;
}, contractSettings?: {
  sectionCount?: number; shootingCutCount?: number; budget?: string; useModels?: boolean;
}) {
  const s = schedule || {};
  const c = contractSettings || {};
  return getDb().prepare(
    `INSERT INTO projects (user_id, title, client_name, product_name, industry,
      client_email, client_contact, planner_email, brief_due, plan_due, shoot_date, design_due, final_due,
      section_count, shooting_cut_count, budget, use_models, pipeline_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 2)`
  ).run(userId, title, clientName, productName, industry,
    s.clientEmail || '', s.clientContact || '', s.plannerEmail || '',
    s.briefDue || '', s.planDue || '', s.shootDate || '', s.designDue || '', s.finalDue || '',
    c.sectionCount || 0, c.shootingCutCount || 0, c.budget || '', c.useModels !== false ? 1 : 0);
}

export function updateProjectSchedule(id: number, schedule: {
  clientEmail?: string; clientContact?: string; plannerEmail?: string;
  briefDue?: string; planDue?: string; shootDate?: string; designDue?: string; finalDue?: string;
}) {
  return getDb().prepare(`
    UPDATE projects SET
      client_email = ?, client_contact = ?, planner_email = ?,
      brief_due = ?, plan_due = ?, shoot_date = ?, design_due = ?, final_due = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    schedule.clientEmail || '', schedule.clientContact || '', schedule.plannerEmail || '',
    schedule.briefDue || '', schedule.planDue || '', schedule.shootDate || '', schedule.designDue || '', schedule.finalDue || '',
    id
  );
}

export function getProjectsDueTomorrow() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];
  return getDb().prepare(`
    SELECT p.*, u.name as user_name, u.username
    FROM projects p JOIN users u ON p.user_id = u.id
    WHERE p.status = 'active' AND (
      p.brief_due = ? OR p.plan_due = ? OR p.shoot_date LIKE ? OR p.design_due = ? OR p.final_due = ?
    )
  `).all(dateStr, dateStr, `%${dateStr}%`, dateStr, dateStr) as any[];
}

export function addEmailLog(projectId: number, emailType: string, recipient: string, subject: string) {
  return getDb().prepare(
    'INSERT INTO email_logs (project_id, email_type, recipient, subject) VALUES (?, ?, ?, ?)'
  ).run(projectId, emailType, recipient, subject);
}

export function getEmailLogs(projectId: number) {
  return getDb().prepare('SELECT * FROM email_logs WHERE project_id = ? ORDER BY sent_at DESC').all(projectId) as any[];
}

export function updateProjectStep(id: number, step: number) {
  return getDb().prepare('UPDATE projects SET current_step = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(step, id);
}

export function deleteProject(id: number) {
  const db = getDb();
  // FOREIGN KEY 제약 때문에 자식 테이블부터 삭제해야 함
  db.prepare('DELETE FROM messages WHERE project_id = ?').run(id);
  db.prepare('DELETE FROM step_data WHERE project_id = ?').run(id);
  try { db.prepare('DELETE FROM project_files WHERE project_id = ?').run(id); } catch {}
  try { db.prepare('DELETE FROM ai_reviews WHERE project_id = ?').run(id); } catch {}
  try { db.prepare('DELETE FROM ai_learnings WHERE project_id = ?').run(id); } catch {}
  return db.prepare('DELETE FROM projects WHERE id = ?').run(id);
}

// Message queries
export function getMessages(projectId: number) {
  return getDb().prepare('SELECT * FROM messages WHERE project_id = ? ORDER BY created_at ASC').all(projectId) as any[];
}

export function addMessage(projectId: number, role: string, content: string, step: number) {
  return getDb().prepare(
    'INSERT INTO messages (project_id, role, content, step) VALUES (?, ?, ?, ?)'
  ).run(projectId, role, content, step);
}

export function deleteUser(id: number) {
  // 사용자의 메시지 → 프로젝트 → 사용자 순서로 삭제
  const projects = getDb().prepare('SELECT id FROM projects WHERE user_id = ?').all(id) as any[];
  for (const p of projects) {
    getDb().prepare('DELETE FROM messages WHERE project_id = ?').run(p.id);
  }
  getDb().prepare('DELETE FROM projects WHERE user_id = ?').run(id);
  return getDb().prepare('DELETE FROM users WHERE id = ? AND role != ?').run(id, 'admin');
}

export function resetUserPassword(id: number, newPassword: string) {
  const hash = bcrypt.hashSync(newPassword, 10);
  return getDb().prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, id);
}

// ===== Step Data (폼 데이터) =====

export function getStepData(projectId: number, step: number) {
  return getDb().prepare('SELECT * FROM step_data WHERE project_id = ? AND step = ?').get(projectId, step) as any;
}

export function getAllStepData(projectId: number) {
  return getDb().prepare('SELECT * FROM step_data WHERE project_id = ? ORDER BY step ASC').all(projectId) as any[];
}

export function saveStepData(projectId: number, step: number, formData: string, status: string = 'draft') {
  return getDb().prepare(`
    INSERT INTO step_data (project_id, step, form_data, status, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(project_id, step)
    DO UPDATE SET form_data = ?, status = ?, updated_at = CURRENT_TIMESTAMP
  `).run(projectId, step, formData, status, formData, status);
}

export function updateStepStatus(projectId: number, step: number, status: string) {
  return getDb().prepare('UPDATE step_data SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE project_id = ? AND step = ?').run(status, projectId, step);
}

// ===== AI 생성 이미지 (나노바나나) =====

export function getGeneratedImage(projectId: number, imageKey: string) {
  return getDb().prepare('SELECT * FROM generated_images WHERE project_id = ? AND image_key = ?').get(projectId, imageKey) as any;
}

export function getProjectImages(projectId: number) {
  return getDb().prepare('SELECT * FROM generated_images WHERE project_id = ? ORDER BY updated_at DESC').all(projectId) as any[];
}

export function saveGeneratedImage(projectId: number, imageKey: string, imageData: string, prompt: string, feedbackHistory: string = '[]', status: string = 'generated') {
  return getDb().prepare(`
    INSERT INTO generated_images (project_id, image_key, image_data, prompt, feedback_history, status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(project_id, image_key)
    DO UPDATE SET image_data = ?, prompt = ?, feedback_history = ?, status = ?, updated_at = CURRENT_TIMESTAMP
  `).run(projectId, imageKey, imageData, prompt, feedbackHistory, status, imageData, prompt, feedbackHistory, status);
}

export function confirmGeneratedImage(projectId: number, imageKey: string) {
  return getDb().prepare('UPDATE generated_images SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE project_id = ? AND image_key = ?').run('confirmed', projectId, imageKey);
}

export function deleteGeneratedImage(projectId: number, imageKey: string) {
  return getDb().prepare('DELETE FROM generated_images WHERE project_id = ? AND image_key = ?').run(projectId, imageKey);
}

// ===== 관리자 통계 쿼리 =====

export function getAllProjects() {
  return getDb().prepare(`
    SELECT p.*, u.name as user_name, u.username
    FROM projects p
    JOIN users u ON p.user_id = u.id
    ORDER BY p.updated_at DESC
  `).all() as any[];
}

// ===== AI 학습 데이터 =====

// 학습 데이터 저장 (성공 패턴, 수정 피드백, 클라이언트 특성 등)
export function addLearning(params: {
  projectId?: number;
  category: string;       // 'brief_pattern' | 'correction' | 'style' | 'client_feedback' | 'successful_output' | 'email_pattern'
  subcategory?: string;   // 세부 분류
  content: string;        // 학습 내용
  context?: string;       // 맥락 정보
  qualityScore?: number;  // 품질 점수 (QC 결과 등)
}) {
  return getDb().prepare(`
    INSERT INTO ai_learnings (project_id, category, subcategory, content, context, quality_score)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(params.projectId || null, params.category, params.subcategory || '', params.content, params.context || '', params.qualityScore || 0);
}

// 카테고리별 학습 데이터 조회
export function getLearnings(category?: string, limit: number = 20) {
  if (category) {
    return getDb().prepare(`
      SELECT l.*, p.title as project_title, p.client_name, p.product_name
      FROM ai_learnings l
      LEFT JOIN projects p ON l.project_id = p.id
      WHERE l.category = ?
      ORDER BY l.quality_score DESC, l.created_at DESC
      LIMIT ?
    `).all(category, limit) as any[];
  }
  return getDb().prepare(`
    SELECT l.*, p.title as project_title, p.client_name, p.product_name
    FROM ai_learnings l
    LEFT JOIN projects p ON l.project_id = p.id
    ORDER BY l.created_at DESC
    LIMIT ?
  `).all(limit) as any[];
}

// 특정 클라이언트 관련 학습 데이터
export function getLearningsByClient(clientName: string, limit: number = 10) {
  return getDb().prepare(`
    SELECT l.*, p.title as project_title
    FROM ai_learnings l
    LEFT JOIN projects p ON l.project_id = p.id
    WHERE p.client_name LIKE ? OR l.content LIKE ?
    ORDER BY l.created_at DESC
    LIMIT ?
  `).all(`%${clientName}%`, `%${clientName}%`, limit) as any[];
}

// 클라이언트 선호도 저장/업데이트
export function setClientPreference(clientName: string, key: string, value: string, source?: string) {
  return getDb().prepare(`
    INSERT INTO client_preferences (client_name, preference_key, preference_value, source, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(client_name, preference_key)
    DO UPDATE SET preference_value = ?, source = ?, updated_at = CURRENT_TIMESTAMP
  `).run(clientName, key, value, source || '', value, source || '');
}

// 클라이언트 선호도 조회
export function getClientPreferences(clientName: string) {
  return getDb().prepare(`
    SELECT * FROM client_preferences WHERE client_name = ? ORDER BY updated_at DESC
  `).all(clientName) as any[];
}

// 학습 통계
export function getLearningStats() {
  const db = getDb();
  const total = (db.prepare('SELECT COUNT(*) as count FROM ai_learnings').get() as any).count;
  const byCategory = db.prepare(`
    SELECT category, COUNT(*) as count FROM ai_learnings GROUP BY category ORDER BY count DESC
  `).all() as any[];
  const recentCount = (db.prepare("SELECT COUNT(*) as count FROM ai_learnings WHERE created_at >= datetime('now', '-7 days')").get() as any).count;
  const avgScore = (db.prepare('SELECT AVG(quality_score) as avg FROM ai_learnings WHERE quality_score > 0').get() as any).avg || 0;
  const clientCount = (db.prepare('SELECT COUNT(DISTINCT client_name) as count FROM client_preferences').get() as any).count;

  return { total, byCategory, recentCount, avgScore: Math.round(avgScore), clientCount };
}

// ===== 디자인 패턴 라이브러리 =====

export function getPatternsBySectionType(sectionType: string, industry?: string, limit: number = 10) {
  if (industry) {
    return getDb().prepare(`
      SELECT * FROM design_patterns
      WHERE section_type = ? AND (industry = ? OR industry = '') AND is_active = 1
      ORDER BY score DESC, usage_count DESC
      LIMIT ?
    `).all(sectionType, industry, limit) as any[];
  }
  return getDb().prepare(`
    SELECT * FROM design_patterns
    WHERE section_type = ? AND is_active = 1
    ORDER BY score DESC, usage_count DESC
    LIMIT ?
  `).all(sectionType, limit) as any[];
}

export function getAllPatterns(limit: number = 100) {
  return getDb().prepare(`
    SELECT * FROM design_patterns WHERE is_active = 1
    ORDER BY section_type, score DESC
    LIMIT ?
  `).all(limit) as any[];
}

export function getPatternById(id: number) {
  return getDb().prepare('SELECT * FROM design_patterns WHERE id = ?').get(id) as any;
}

export function createPattern(params: {
  sectionType: string;
  patternName: string;
  description?: string;
  industry?: string;
  tone?: string;
  thumbnailUrl?: string;
  wireframeBlocks: string;
  copyBlocks?: string;
  tags?: string;
  source?: string;
}) {
  return getDb().prepare(`
    INSERT INTO design_patterns (section_type, pattern_name, description, industry, tone, thumbnail_url, wireframe_blocks, copy_blocks, tags, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.sectionType, params.patternName, params.description || '',
    params.industry || '', params.tone || '', params.thumbnailUrl || '',
    params.wireframeBlocks, params.copyBlocks || '[]',
    params.tags || '', params.source || 'manual'
  );
}

export function updatePatternScore(id: number, scoreDelta: number) {
  return getDb().prepare(`
    UPDATE design_patterns
    SET score = MAX(0, MIN(10, score + ?)), usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(scoreDelta, id);
}

export function recordPatternUsage(patternId: number, projectId: number | null, sectionNum: number | null, action: string, feedback?: string) {
  getDb().prepare(`
    INSERT INTO pattern_usage (pattern_id, project_id, section_num, action, feedback)
    VALUES (?, ?, ?, ?, ?)
  `).run(patternId, projectId, sectionNum, action, feedback || '');
  // 사용 시 점수 반영
  if (action === 'applied') {
    updatePatternScore(patternId, 0.3);
  } else if (action === 'liked') {
    updatePatternScore(patternId, 0.5);
  } else if (action === 'disliked') {
    updatePatternScore(patternId, -0.3);
  } else if (action === 'reverted') {
    updatePatternScore(patternId, -0.2);
  }
}

export function getPatternStats() {
  const db = getDb();
  const totalPatterns = (db.prepare('SELECT COUNT(*) as count FROM design_patterns WHERE is_active = 1').get() as any).count;
  const bySectionType = db.prepare(`
    SELECT section_type, COUNT(*) as count FROM design_patterns WHERE is_active = 1 GROUP BY section_type ORDER BY count DESC
  `).all() as any[];
  const topPatterns = db.prepare(`
    SELECT id, pattern_name, section_type, score, usage_count
    FROM design_patterns WHERE is_active = 1
    ORDER BY usage_count DESC LIMIT 10
  `).all() as any[];
  return { totalPatterns, bySectionType, topPatterns };
}

export function searchPatterns(query: string, limit: number = 20) {
  return getDb().prepare(`
    SELECT * FROM design_patterns
    WHERE is_active = 1 AND (
      pattern_name LIKE ? OR description LIKE ? OR tags LIKE ? OR section_type LIKE ?
    )
    ORDER BY score DESC
    LIMIT ?
  `).all(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, limit) as any[];
}

export function getAdminStats() {
  const db = getDb();

  const totalUsers = (db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('planner') as any).count;
  const totalProjects = (db.prepare('SELECT COUNT(*) as count FROM projects').get() as any).count;
  const activeProjects = (db.prepare("SELECT COUNT(*) as count FROM projects WHERE status = 'active'").get() as any).count;
  const completedProjects = (db.prepare("SELECT COUNT(*) as count FROM projects WHERE status = 'completed'").get() as any).count;
  const totalMessages = (db.prepare('SELECT COUNT(*) as count FROM messages').get() as any).count;
  const aiMessages = (db.prepare("SELECT COUNT(*) as count FROM messages WHERE role = 'assistant'").get() as any).count;

  // 업종별 프로젝트 수
  const byIndustry = db.prepare(`
    SELECT industry, COUNT(*) as count
    FROM projects
    WHERE industry != ''
    GROUP BY industry
    ORDER BY count DESC
  `).all() as any[];

  // 단계별 프로젝트 분포
  const byStep = db.prepare(`
    SELECT current_step, COUNT(*) as count
    FROM projects
    WHERE status = 'active'
    GROUP BY current_step
    ORDER BY current_step
  `).all() as any[];

  // 기획자별 프로젝트 수
  const byPlanner = db.prepare(`
    SELECT u.name, u.username, COUNT(p.id) as project_count,
           SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END) as active_count
    FROM users u
    LEFT JOIN projects p ON u.id = p.user_id
    WHERE u.role = 'planner'
    GROUP BY u.id
    ORDER BY project_count DESC
  `).all() as any[];

  // 최근 7일간 일별 메시지 수
  const dailyActivity = db.prepare(`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM messages
    WHERE created_at >= datetime('now', '-7 days')
    GROUP BY DATE(created_at)
    ORDER BY date
  `).all() as any[];

  // 최근 활동 (최근 프로젝트 업데이트)
  const recentActivity = db.prepare(`
    SELECT p.title, p.client_name, p.product_name, p.current_step, p.updated_at,
           u.name as user_name
    FROM projects p
    JOIN users u ON p.user_id = u.id
    ORDER BY p.updated_at DESC
    LIMIT 10
  `).all() as any[];

  return {
    totalUsers,
    totalProjects,
    activeProjects,
    completedProjects,
    totalMessages,
    aiMessages,
    byIndustry,
    byStep,
    byPlanner,
    dailyActivity,
    recentActivity,
  };
}

// ══════════════════════════════════════════════════════════
// 파이프라인 V2: 프로젝트 설정 (계약 조건)
// ══════════════════════════════════════════════════════════

export function updateProjectSettings(id: number, settings: {
  sectionCount?: number;
  shootingCutCount?: number;
  budget?: string;
  useModels?: boolean;
}) {
  return getDb().prepare(`
    UPDATE projects SET
      section_count = COALESCE(?, section_count),
      shooting_cut_count = COALESCE(?, shooting_cut_count),
      budget = COALESCE(?, budget),
      use_models = COALESCE(?, use_models),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    settings.sectionCount ?? null,
    settings.shootingCutCount ?? null,
    settings.budget ?? null,
    settings.useModels !== undefined ? (settings.useModels ? 1 : 0) : null,
    id
  );
}

export function updateProjectInfo(id: number, info: {
  title?: string;
  clientName?: string;
  productName?: string;
  industry?: string;
}) {
  return getDb().prepare(`
    UPDATE projects SET
      title = COALESCE(?, title),
      client_name = COALESCE(?, client_name),
      product_name = COALESCE(?, product_name),
      industry = COALESCE(?, industry),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    info.title ?? null,
    info.clientName ?? null,
    info.productName ?? null,
    info.industry ?? null,
    id
  );
}

export function getProjectSettings(id: number) {
  return getDb().prepare(`
    SELECT section_count, shooting_cut_count, budget, use_models, pipeline_version
    FROM projects WHERE id = ?
  `).get(id) as any;
}

// ══════════════════════════════════════════════════════════
// 파이프라인 V2: 확정 데이터 (브리프/기획안 스냅샷)
// ══════════════════════════════════════════════════════════

export function confirmStepData(
  projectId: number,
  step: number,
  dataType: 'brief' | 'plan',
  confirmedDataJson: string,
  pdfPath: string = '',
  confirmedBy: number = 0
) {
  // 확정 스냅샷 저장 (UPSERT)
  getDb().prepare(`
    INSERT INTO confirmed_data (project_id, step, data_type, confirmed_data, pdf_path, confirmed_at, confirmed_by)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    ON CONFLICT(project_id, data_type)
    DO UPDATE SET confirmed_data = ?, pdf_path = ?, confirmed_at = CURRENT_TIMESTAMP, confirmed_by = ?
  `).run(projectId, step, dataType, confirmedDataJson, pdfPath, confirmedBy, confirmedDataJson, pdfPath, confirmedBy);

  // step_data 상태도 'confirmed'로 업데이트
  getDb().prepare(`
    UPDATE step_data SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP
    WHERE project_id = ? AND step = ?
  `).run(projectId, step);

  return getConfirmedData(projectId, dataType);
}

export function getConfirmedData(projectId: number, dataType: 'brief' | 'plan') {
  return getDb().prepare(`
    SELECT * FROM confirmed_data WHERE project_id = ? AND data_type = ?
  `).get(projectId, dataType) as any;
}

export function getAllConfirmedData(projectId: number) {
  return getDb().prepare(`
    SELECT * FROM confirmed_data WHERE project_id = ? ORDER BY step ASC
  `).all(projectId) as any[];
}

export function isStepConfirmed(projectId: number, dataType: 'brief' | 'plan'): boolean {
  const row = getDb().prepare(`
    SELECT id FROM confirmed_data WHERE project_id = ? AND data_type = ?
  `).get(projectId, dataType) as any;
  return !!row;
}

// ══════════════════════════════════════════════════════════
// 파이프라인 V2: 프로젝트 파일 (업로드)
// ══════════════════════════════════════════════════════════

export function addProjectFile(
  projectId: number,
  step: number,
  fileType: string,
  filePath: string,
  fileName: string,
  fileSize: number = 0,
  mimeType: string = ''
) {
  return getDb().prepare(`
    INSERT INTO project_files (project_id, step, file_type, file_path, file_name, file_size, mime_type)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(projectId, step, fileType, filePath, fileName, fileSize, mimeType);
}

export function getProjectFiles(projectId: number, step?: number) {
  if (step !== undefined) {
    return getDb().prepare(`
      SELECT * FROM project_files WHERE project_id = ? AND step = ? ORDER BY uploaded_at DESC
    `).all(projectId, step) as any[];
  }
  return getDb().prepare(`
    SELECT * FROM project_files WHERE project_id = ? ORDER BY step ASC, uploaded_at DESC
  `).all(projectId) as any[];
}

export function getProjectFilesByType(projectId: number, fileType: string) {
  return getDb().prepare(`
    SELECT * FROM project_files WHERE project_id = ? AND file_type = ? ORDER BY uploaded_at DESC
  `).all(projectId, fileType) as any[];
}

export function deleteProjectFile(fileId: number) {
  return getDb().prepare('DELETE FROM project_files WHERE id = ?').run(fileId);
}

// ══════════════════════════════════════════════════════════
// 파이프라인 V2: AI 총평 & 리포팅
// ══════════════════════════════════════════════════════════

export function saveAiReview(projectId: number, reviewContent: string) {
  return getDb().prepare(`
    INSERT INTO ai_reviews (project_id, review_content)
    VALUES (?, ?)
  `).run(projectId, reviewContent);
}

export function getAiReview(projectId: number) {
  return getDb().prepare(`
    SELECT * FROM ai_reviews WHERE project_id = ? ORDER BY created_at DESC LIMIT 1
  `).get(projectId) as any;
}

export function updateAiReviewEmail(projectId: number) {
  return getDb().prepare(`
    UPDATE ai_reviews SET email_sent_at = CURRENT_TIMESTAMP
    WHERE project_id = ? AND id = (
      SELECT id FROM ai_reviews WHERE project_id = ? ORDER BY created_at DESC LIMIT 1
    )
  `).run(projectId, projectId);
}

export function updateAiReviewGdrive(projectId: number, gdriveUrl: string) {
  return getDb().prepare(`
    UPDATE ai_reviews SET gdrive_url = ?
    WHERE project_id = ? AND id = (
      SELECT id FROM ai_reviews WHERE project_id = ? ORDER BY created_at DESC LIMIT 1
    )
  `).run(gdriveUrl, projectId, projectId);
}

// ============================================
// Error Log Functions
// ============================================

export function createErrorLog(data: {
  type?: string; severity?: string; title: string; message: string;
  stackTrace?: string; url?: string; userId?: number; userName?: string;
  projectId?: number; browserInfo?: string;
}) {
  return getDb().prepare(`
    INSERT INTO error_logs (type, severity, title, message, stack_trace, url, user_id, user_name, project_id, browser_info)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.type || 'error', data.severity || 'medium', data.title, data.message,
    data.stackTrace || '', data.url || '', data.userId || null, data.userName || '',
    data.projectId || null, data.browserInfo || ''
  );
}

export function getErrorLogs(options: { status?: string; limit?: number; offset?: number } = {}) {
  const { status, limit = 50, offset = 0 } = options;
  if (status) {
    return getDb().prepare(
      'SELECT * FROM error_logs WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(status, limit, offset) as any[];
  }
  return getDb().prepare(
    'SELECT * FROM error_logs ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset) as any[];
}

export function getErrorLogStats() {
  return getDb().prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_count,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
      SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_count,
      SUM(CASE WHEN severity = 'critical' AND status = 'open' THEN 1 ELSE 0 END) as critical_open
    FROM error_logs
  `).get() as any;
}

export function updateErrorLog(id: number, data: { status?: string; notes?: string; resolvedBy?: string }) {
  const updates: string[] = [];
  const values: any[] = [];
  if (data.status) { updates.push('status = ?'); values.push(data.status); }
  if (data.notes !== undefined) { updates.push('notes = ?'); values.push(data.notes); }
  if (data.resolvedBy) { updates.push('resolved_by = ?'); values.push(data.resolvedBy); }
  if (data.status === 'resolved') { updates.push('resolved_at = CURRENT_TIMESTAMP'); }
  values.push(id);
  return getDb().prepare(`UPDATE error_logs SET ${updates.join(', ')} WHERE id = ?`).run(...values);
}

// ============================================
// Feedback Functions
// ============================================

export function createFeedback(data: {
  userId: number; userName: string; category?: string; priority?: string;
  title: string; description: string; screenshotUrl?: string;
}) {
  return getDb().prepare(`
    INSERT INTO feedback (user_id, user_name, category, priority, title, description, screenshot_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.userId, data.userName, data.category || 'general', data.priority || 'normal',
    data.title, data.description, data.screenshotUrl || ''
  );
}

export function getFeedbackList(options: { status?: string; limit?: number; offset?: number } = {}) {
  const { status, limit = 50, offset = 0 } = options;
  if (status) {
    return getDb().prepare(
      'SELECT * FROM feedback WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(status, limit, offset) as any[];
  }
  return getDb().prepare(
    'SELECT * FROM feedback ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset) as any[];
}

export function getFeedbackStats() {
  return getDb().prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN status = 'reviewed' THEN 1 ELSE 0 END) as reviewed_count,
      SUM(CASE WHEN status = 'implemented' THEN 1 ELSE 0 END) as implemented_count,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count
    FROM feedback
  `).get() as any;
}

export function updateFeedback(id: number, data: { status?: string; adminResponse?: string }) {
  const updates: string[] = [];
  const values: any[] = [];
  if (data.status) { updates.push('status = ?'); values.push(data.status); }
  if (data.adminResponse !== undefined) {
    updates.push('admin_response = ?'); values.push(data.adminResponse);
    updates.push('responded_at = CURRENT_TIMESTAMP');
  }
  values.push(id);
  return getDb().prepare(`UPDATE feedback SET ${updates.join(', ')} WHERE id = ?`).run(...values);
}
