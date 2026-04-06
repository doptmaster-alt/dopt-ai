// Figma 플러그인 명령 큐
// Next.js에서 라우트 간 globalThis가 분리될 수 있어 파일 기반 상태 관리 병행

import fs from 'fs';
import path from 'path';

interface FigmaCommand {
  action: string;
  [key: string]: any;
}

interface CommandResult {
  success: boolean;
  command: string;
  result?: string;
  error?: string;
}

// 상태 파일 경로
const STATE_FILE = path.join(process.cwd(), '.figma-plugin-state.json');

interface PluginState {
  lastPollTime: number;
  pollCount: number;
  pendingCommands: FigmaCommand[];
  lastResults: CommandResult[];
}

function readState(): PluginState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {}
  return { lastPollTime: 0, pollCount: 0, pendingCommands: [], lastResults: [] };
}

function writeState(state: PluginState) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state), 'utf-8');
  } catch (e) {}
}

// 결과 대기 resolver (인메모리 - 같은 프로세스 내에서만 작동)
const g = globalThis as any;
if (!g.__figmaResolvers) {
  g.__figmaResolvers = [];
}

// AI가 명령을 큐에 추가
export function addCommands(commands: FigmaCommand[]) {
  const state = readState();
  state.pendingCommands.push(...commands);
  // 이전 결과를 클리어 (waitForResults가 이전 결과를 새 명령의 결과로 착각하는 버그 방지)
  state.lastResults = [];
  writeState(state);
  console.log(`[FigmaQueue] ${commands.length}개 명령 추가됨. 대기 중: ${state.pendingCommands.length}`);
}

// 플러그인이 명령을 가져감
export function getAndClearCommands(): FigmaCommand[] {
  const state = readState();
  const commands = [...state.pendingCommands];
  state.pendingCommands = [];
  state.lastPollTime = Date.now();
  state.pollCount++;
  writeState(state);
  if (commands.length > 0) {
    console.log(`[FigmaQueue] 플러그인이 ${commands.length}개 명령 수신`);
  }
  return commands;
}

// 플러그인이 실행 결과를 보고
export function reportResults(results: CommandResult[]) {
  const state = readState();
  state.lastResults = results;
  writeState(state);
  console.log(`[FigmaQueue] 실행 결과 수신:`, results.map(r => r.success ? `✓ ${r.command}` : `✗ ${r.command}`).join(', '));

  // 인메모리 resolver 알림
  for (const resolve of g.__figmaResolvers) {
    resolve(results);
  }
  g.__figmaResolvers = [];
}

// AI가 결과를 기다림 (타임아웃: 120초 - 대량 명령 처리 고려)
export function waitForResults(timeout = 120000): Promise<CommandResult[]> {
  return new Promise((resolve) => {
    // 이미 파일에 결과가 있으면 바로 반환
    const state = readState();
    if (state.lastResults.length > 0) {
      const results = [...state.lastResults];
      state.lastResults = [];
      writeState(state);
      resolve(results);
      return;
    }

    g.__figmaResolvers.push(resolve);

    // 파일 폴링 (resolver가 작동 안 할 경우 대비)
    let elapsed = 0;
    const pollInterval = setInterval(() => {
      elapsed += 1000;
      const s = readState();
      if (s.lastResults.length > 0) {
        clearInterval(pollInterval);
        const results = [...s.lastResults];
        s.lastResults = [];
        writeState(s);
        // resolver 목록에서 제거
        const idx = g.__figmaResolvers.indexOf(resolve);
        if (idx >= 0) g.__figmaResolvers.splice(idx, 1);
        resolve(results);
      }
      if (elapsed >= timeout) {
        clearInterval(pollInterval);
        const idx = g.__figmaResolvers.indexOf(resolve);
        if (idx >= 0) g.__figmaResolvers.splice(idx, 1);
        resolve([{ success: false, command: 'timeout', error: 'Figma 플러그인 응답 시간 초과 (120초)' }]);
      }
    }, 1000);

    // 기존 타임아웃도 유지
    setTimeout(() => {
      clearInterval(pollInterval);
      const idx = g.__figmaResolvers.indexOf(resolve);
      if (idx >= 0) {
        g.__figmaResolvers.splice(idx, 1);
        resolve([{ success: false, command: 'timeout', error: 'Figma 플러그인 응답 시간 초과 (120초)' }]);
      }
    }, timeout);
  });
}

// 플러그인 연결 상태 확인
export function updatePollTime() {
  const state = readState();
  state.lastPollTime = Date.now();
  state.pollCount++;
  writeState(state);
}

export function isPluginConnected(): boolean {
  const state = readState();
  // AI API 호출이 60초+ 걸릴 수 있어 그 사이 플러그인 poll이 끊길 수 있음
  // 120초로 넉넉하게 설정 (플러그인이 일시적으로 Failed to fetch 후 복구될 수 있음)
  const connected = state.pollCount > 0 && (Date.now() - state.lastPollTime < 120000);
  console.log(`[FigmaQueue] 플러그인 연결: ${connected ? '✓' : '✗'} (마지막 poll: ${state.lastPollTime > 0 ? Math.round((Date.now() - state.lastPollTime) / 1000) + '초 전' : '없음'}, 총 ${state.pollCount}회)`);
  return connected;
}
