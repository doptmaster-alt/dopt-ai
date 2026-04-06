/**
 * Google Drive 연동 모듈
 *
 * 인증 방식: 서비스 계정 (Service Account)
 * 필요한 환경변수:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL - 서비스 계정 이메일
 *   GOOGLE_PRIVATE_KEY - 서비스 계정 비공개 키 (PEM 형식)
 *
 * 또는:
 *   GOOGLE_SERVICE_ACCOUNT_KEY - 서비스 계정 JSON 키 파일 경로
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// 환경변수 로드 (.env.local에서 직접 읽기)
function loadEnvVar(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(new RegExp(`^${key}=(.+)$`, 'm'));
    if (match) {
      const val = match[1].trim();
      process.env[key] = val;
      return val;
    }
  } catch {}
  return undefined;
}

// Google Drive 인증 클라이언트 생성
function getAuthClient() {
  // 방법 1: JSON 키 파일 경로
  const keyFilePath = loadEnvVar('GOOGLE_SERVICE_ACCOUNT_KEY');
  if (keyFilePath) {
    const resolvedPath = path.isAbsolute(keyFilePath)
      ? keyFilePath
      : path.resolve(process.cwd(), keyFilePath);

    if (fs.existsSync(resolvedPath)) {
      const keyFile = JSON.parse(fs.readFileSync(resolvedPath, 'utf-8'));
      const auth = new google.auth.JWT({
        email: keyFile.client_email,
        key: keyFile.private_key,
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      });
      return auth;
    }
  }

  // 방법 2: 환경변수에서 직접 이메일 + 키
  const email = loadEnvVar('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const privateKey = loadEnvVar('GOOGLE_PRIVATE_KEY');
  if (email && privateKey) {
    // 환경변수에서 \n이 문자열로 들어올 수 있음
    const formattedKey = privateKey.replace(/\\n/g, '\n');
    const auth = new google.auth.JWT({
      email,
      key: formattedKey,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    return auth;
  }

  // 방법 3: OAuth2 (리프레시 토큰)
  const clientId = loadEnvVar('GOOGLE_CLIENT_ID');
  const clientSecret = loadEnvVar('GOOGLE_CLIENT_SECRET');
  const refreshToken = loadEnvVar('GOOGLE_REFRESH_TOKEN');
  if (clientId && clientSecret && refreshToken) {
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
    oauth2.setCredentials({ refresh_token: refreshToken });
    return oauth2;
  }

  throw new Error(
    'Google Drive 인증 정보가 없습니다.\n' +
    '다음 중 하나를 .env.local에 설정해주세요:\n' +
    '1. GOOGLE_SERVICE_ACCOUNT_KEY=./google-service-account.json\n' +
    '2. GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY\n' +
    '3. GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN'
  );
}

function getDriveClient() {
  const auth = getAuthClient();
  return google.drive({ version: 'v3', auth });
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  modifiedTime: string;
  parents?: string[];
  size?: string;
}

export interface DriveSearchResult {
  files: DriveFile[];
  nextPageToken?: string;
}

// Google Drive 파일 검색
export async function searchDriveFiles(
  query?: string,
  options?: {
    mimeType?: string;
    folderId?: string;
    pageSize?: number;
    pageToken?: string;
  }
): Promise<DriveSearchResult> {
  const drive = getDriveClient();

  const conditions: string[] = ['trashed = false'];

  if (query) {
    conditions.push(`name contains '${query.replace(/'/g, "\\'")}'`);
  }
  if (options?.mimeType) {
    conditions.push(`mimeType = '${options.mimeType}'`);
  }
  if (options?.folderId) {
    conditions.push(`'${options.folderId}' in parents`);
  }

  const q = conditions.join(' and ');

  const res = await drive.files.list({
    q,
    pageSize: options?.pageSize || 100,
    pageToken: options?.pageToken,
    fields: 'nextPageToken, files(id, name, mimeType, webViewLink, modifiedTime, parents, size)',
    orderBy: 'modifiedTime desc',
  });

  return {
    files: (res.data.files || []) as DriveFile[],
    nextPageToken: res.data.nextPageToken || undefined,
  };
}

// 모든 파일 목록 가져오기 (페이지네이션 자동 처리)
export async function listAllFiles(options?: {
  query?: string;
  folderId?: string;
  maxFiles?: number;
}): Promise<DriveFile[]> {
  const allFiles: DriveFile[] = [];
  let pageToken: string | undefined;
  const maxFiles = options?.maxFiles || 500;

  do {
    const result = await searchDriveFiles(options?.query, {
      folderId: options?.folderId,
      pageSize: 100,
      pageToken,
    });
    allFiles.push(...result.files);
    pageToken = result.nextPageToken;

    if (allFiles.length >= maxFiles) break;
  } while (pageToken);

  return allFiles.slice(0, maxFiles);
}

// Google Docs 문서 내용 읽기
export async function readGoogleDoc(fileId: string): Promise<string> {
  const drive = getDriveClient();

  try {
    // Google Docs → 일반 텍스트로 export
    const res = await drive.files.export({
      fileId,
      mimeType: 'text/plain',
    });
    return (res.data as string) || '';
  } catch (e: any) {
    throw new Error(`Google Doc 읽기 실패: ${e.message}`);
  }
}

// Google Sheets 내용 읽기 (CSV 형식)
export async function readGoogleSheet(fileId: string): Promise<string> {
  const drive = getDriveClient();

  try {
    const res = await drive.files.export({
      fileId,
      mimeType: 'text/csv',
    });
    return (res.data as string) || '';
  } catch (e: any) {
    throw new Error(`Google Sheet 읽기 실패: ${e.message}`);
  }
}

// Google Slides 내용 읽기 (텍스트만)
export async function readGoogleSlides(fileId: string): Promise<string> {
  const drive = getDriveClient();

  try {
    const res = await drive.files.export({
      fileId,
      mimeType: 'text/plain',
    });
    return (res.data as string) || '';
  } catch (e: any) {
    throw new Error(`Google Slides 읽기 실패: ${e.message}`);
  }
}

// 파일 내용 읽기 (텍스트 기반 파일)
export async function readFileContent(fileId: string, mimeType: string): Promise<string> {
  const drive = getDriveClient();

  // Google Workspace 파일은 export 사용
  if (mimeType === 'application/vnd.google-apps.document') {
    return readGoogleDoc(fileId);
  }
  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    return readGoogleSheet(fileId);
  }
  if (mimeType === 'application/vnd.google-apps.presentation') {
    return readGoogleSlides(fileId);
  }

  // 일반 텍스트 파일은 직접 다운로드
  const textMimeTypes = [
    'text/plain', 'text/csv', 'text/markdown',
    'application/json', 'text/html',
  ];

  if (textMimeTypes.some(t => mimeType.startsWith(t))) {
    try {
      const res = await drive.files.get({
        fileId,
        alt: 'media',
      });
      return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    } catch (e: any) {
      throw new Error(`파일 읽기 실패: ${e.message}`);
    }
  }

  // PDF → 텍스트 추출 불가 (바이너리)
  if (mimeType === 'application/pdf') {
    return '[PDF 파일 - 텍스트 추출 필요]';
  }

  return `[지원하지 않는 파일 형식: ${mimeType}]`;
}

// 폴더 구조 탐색
export async function listFolderContents(folderId: string): Promise<DriveFile[]> {
  const drive = getDriveClient();
  const allFiles: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      pageSize: 100,
      pageToken,
      fields: 'nextPageToken, files(id, name, mimeType, webViewLink, modifiedTime, parents, size)',
      orderBy: 'name',
    });
    allFiles.push(...(res.data.files || []) as DriveFile[]);
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  return allFiles;
}

// 하위 폴더까지 재귀적으로 탐색
export async function listFilesRecursive(
  folderId: string,
  maxDepth: number = 3,
  currentDepth: number = 0,
): Promise<DriveFile[]> {
  if (currentDepth >= maxDepth) return [];

  const files = await listFolderContents(folderId);
  const allFiles: DriveFile[] = [];

  for (const file of files) {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      // 하위 폴더 재귀 탐색
      const subFiles = await listFilesRecursive(file.id, maxDepth, currentDepth + 1);
      allFiles.push(...subFiles);
    } else {
      allFiles.push(file);
    }
  }

  return allFiles;
}

// 읽기 가능한 파일인지 확인
export function isReadableFile(mimeType: string): boolean {
  const readableTypes = [
    'application/vnd.google-apps.document',
    'application/vnd.google-apps.spreadsheet',
    'application/vnd.google-apps.presentation',
    'text/plain',
    'text/csv',
    'text/markdown',
    'text/html',
    'application/json',
  ];
  return readableTypes.includes(mimeType);
}

// MIME 타입을 한글 설명으로
export function mimeTypeLabel(mimeType: string): string {
  const labels: Record<string, string> = {
    'application/vnd.google-apps.document': 'Google Docs',
    'application/vnd.google-apps.spreadsheet': 'Google Sheets',
    'application/vnd.google-apps.presentation': 'Google Slides',
    'application/vnd.google-apps.folder': '폴더',
    'application/pdf': 'PDF',
    'text/plain': '텍스트',
    'text/csv': 'CSV',
    'text/markdown': 'Markdown',
    'text/html': 'HTML',
    'application/json': 'JSON',
    'image/png': 'PNG 이미지',
    'image/jpeg': 'JPEG 이미지',
  };
  return labels[mimeType] || mimeType;
}
