import fs from 'fs';
import path from 'path';

function getFigmaToken(): string {
  let token = process.env.FIGMA_API_KEY;
  if (!token) {
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const match = envContent.match(/^FIGMA_API_KEY=(.+)$/m);
      if (match) {
        token = match[1].trim();
        process.env.FIGMA_API_KEY = token;
      }
    } catch {}
  }
  if (!token) throw new Error('FIGMA_API_KEY가 설정되지 않았습니다.');
  return token;
}

async function figmaFetch(endpoint: string, options?: RequestInit) {
  const token = getFigmaToken();
  const res = await fetch(`https://api.figma.com/v1${endpoint}`, {
    ...options,
    headers: {
      'X-Figma-Token': token,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Figma API 오류 (${res.status}): ${text}`);
  }
  return res.json();
}

// 내 Figma 파일 목록 가져오기 (최근 프로젝트)
export async function figmaListFiles(): Promise<string> {
  try {
    const data = await figmaFetch('/me');
    const userId = data.id;

    // 팀 프로젝트 조회를 위해 팀 정보 가져오기
    const teamsRes = await figmaFetch('/me');

    return `Figma 사용자: ${data.handle} (${data.email})\n\n파일을 열려면 Figma 파일 URL에서 file key를 추출하세요.\nURL 형식: figma.com/design/{FILE_KEY}/...\n\n특정 파일을 분석하려면 figma_get_file 도구에 file key를 입력하세요.`;
  } catch (error: any) {
    return `Figma 연결 오류: ${error.message}`;
  }
}

// Figma 파일 구조 가져오기
export async function figmaGetFile(fileKey: string): Promise<string> {
  try {
    const data = await figmaFetch(`/files/${fileKey}?depth=2`);

    let result = `# ${data.name}\n`;
    result += `마지막 수정: ${data.lastModified}\n`;
    result += `버전: ${data.version}\n\n`;
    result += `## 페이지 구조\n`;

    for (const page of data.document.children) {
      result += `\n### 📄 ${page.name} (ID: ${page.id})\n`;
      if (page.children) {
        for (const frame of page.children.slice(0, 20)) {
          const size = frame.absoluteBoundingBox
            ? `${Math.round(frame.absoluteBoundingBox.width)}x${Math.round(frame.absoluteBoundingBox.height)}`
            : '';
          result += `  - ${frame.type}: ${frame.name} ${size ? `(${size})` : ''} [ID: ${frame.id}]\n`;
        }
        if (page.children.length > 20) {
          result += `  ... 외 ${page.children.length - 20}개 요소\n`;
        }
      }
    }

    return result;
  } catch (error: any) {
    return `Figma 파일 읽기 오류: ${error.message}`;
  }
}

// Figma 파일의 특정 노드 이미지 내보내기
export async function figmaExportImage(fileKey: string, nodeId: string, format: string = 'png'): Promise<string> {
  try {
    const data = await figmaFetch(
      `/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=${format}&scale=2`
    );

    if (data.images && data.images[nodeId]) {
      return `이미지 URL: ${data.images[nodeId]}\n\n이 URL로 이미지를 다운로드하거나 확인할 수 있습니다.`;
    }
    return '이미지 내보내기에 실패했습니다.';
  } catch (error: any) {
    return `Figma 이미지 내보내기 오류: ${error.message}`;
  }
}

// Figma 파일에 댓글 추가
export async function figmaAddComment(fileKey: string, message: string): Promise<string> {
  try {
    const data = await figmaFetch(`/files/${fileKey}/comments`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    return `Figma에 댓글이 추가되었습니다. (ID: ${data.id})`;
  } catch (error: any) {
    return `Figma 댓글 추가 오류: ${error.message}`;
  }
}

// Figma 파일의 댓글 목록
export async function figmaGetComments(fileKey: string): Promise<string> {
  try {
    const data = await figmaFetch(`/files/${fileKey}/comments`);

    if (!data.comments || data.comments.length === 0) {
      return '댓글이 없습니다.';
    }

    return data.comments.map((c: any, i: number) =>
      `[${i + 1}] ${c.user.handle}: ${c.message}\n    (${c.created_at})`
    ).join('\n\n');
  } catch (error: any) {
    return `Figma 댓글 조회 오류: ${error.message}`;
  }
}

// Figma 특정 노드의 상세 정보
export async function figmaGetNode(fileKey: string, nodeId: string): Promise<string> {
  try {
    const data = await figmaFetch(`/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}&depth=3`);

    const node = data.nodes[nodeId];
    if (!node) return '노드를 찾을 수 없습니다.';

    const doc = node.document;
    let result = `# ${doc.name} (${doc.type})\n`;

    if (doc.absoluteBoundingBox) {
      const bb = doc.absoluteBoundingBox;
      result += `크기: ${Math.round(bb.width)}x${Math.round(bb.height)}\n`;
      result += `위치: (${Math.round(bb.x)}, ${Math.round(bb.y)})\n`;
    }

    if (doc.fills?.length > 0) {
      result += `배경: ${JSON.stringify(doc.fills[0])}\n`;
    }

    if (doc.children) {
      result += `\n## 하위 요소 (${doc.children.length}개)\n`;
      for (const child of doc.children.slice(0, 30)) {
        result += describeNode(child, 0);
      }
    }

    return result;
  } catch (error: any) {
    return `Figma 노드 조회 오류: ${error.message}`;
  }
}

// Figma 팀 프로젝트 목록
export async function figmaListTeamProjects(teamId: string): Promise<string> {
  try {
    const data = await figmaFetch(`/teams/${teamId}/projects`);

    if (!data.projects || data.projects.length === 0) {
      return '프로젝트가 없습니다.';
    }

    return data.projects.map((p: any, i: number) =>
      `[${i + 1}] ${p.name} (ID: ${p.id})`
    ).join('\n');
  } catch (error: any) {
    return `Figma 팀 프로젝트 조회 오류: ${error.message}`;
  }
}

// Figma 프로젝트 내 파일 목록
export async function figmaListProjectFiles(projectId: string): Promise<string> {
  try {
    const data = await figmaFetch(`/projects/${projectId}/files`);

    if (!data.files || data.files.length === 0) {
      return '파일이 없습니다.';
    }

    return data.files.map((f: any, i: number) =>
      `[${i + 1}] ${f.name}\n    Key: ${f.key}\n    수정: ${f.last_modified}`
    ).join('\n\n');
  } catch (error: any) {
    return `Figma 파일 목록 조회 오류: ${error.message}`;
  }
}

function describeNode(node: any, depth: number): string {
  const indent = '  '.repeat(depth + 1);
  let line = `${indent}- ${node.type}: "${node.name}"`;

  if (node.absoluteBoundingBox) {
    line += ` (${Math.round(node.absoluteBoundingBox.width)}x${Math.round(node.absoluteBoundingBox.height)})`;
  }

  if (node.characters) {
    const text = node.characters.length > 50 ? node.characters.slice(0, 50) + '...' : node.characters;
    line += ` 텍스트: "${text}"`;
  }

  line += '\n';

  if (node.children && depth < 2) {
    for (const child of node.children.slice(0, 10)) {
      line += describeNode(child, depth + 1);
    }
  }

  return line;
}
