import { Client } from '@notionhq/client';
import fs from 'fs';
import path from 'path';

function getNotionClient(): Client {
  let apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const match = envContent.match(/^NOTION_API_KEY=(.+)$/m);
      if (match) {
        apiKey = match[1].trim();
        process.env.NOTION_API_KEY = apiKey;
      }
    } catch {}
  }
  if (!apiKey) throw new Error('NOTION_API_KEY가 설정되지 않았습니다.');
  return new Client({ auth: apiKey });
}

// 노션 검색 - 페이지 및 데이터베이스 찾기
export async function notionSearch(query: string): Promise<string> {
  const notion = getNotionClient();
  try {
    const response = await notion.search({
      query,
      page_size: 10,
    });

    if (response.results.length === 0) {
      return '검색 결과가 없습니다. 해당 페이지에 DIOPT AI Integration이 연결되어 있는지 확인하세요.';
    }

    const items = response.results.map((item: any, i: number) => {
      const type = item.object; // 'page' or 'database'
      let title = '';
      if (type === 'page') {
        const titleProp = item.properties?.title || item.properties?.Name;
        if (titleProp?.title?.[0]?.plain_text) {
          title = titleProp.title[0].plain_text;
        } else if (titleProp?.rich_text?.[0]?.plain_text) {
          title = titleProp.rich_text[0].plain_text;
        } else {
          title = '(제목 없음)';
        }
      } else if (type === 'database') {
        title = item.title?.[0]?.plain_text || '(제목 없음)';
      }
      return `[${i + 1}] [${type}] ${title}\n    ID: ${item.id}\n    URL: ${item.url || ''}`;
    });

    return items.join('\n\n');
  } catch (error: any) {
    return `노션 검색 오류: ${error.message}`;
  }
}

// 노션 페이지 내용 읽기
export async function notionReadPage(pageId: string): Promise<string> {
  const notion = getNotionClient();
  try {
    // 페이지 제목 가져오기
    const page = await notion.pages.retrieve({ page_id: pageId }) as any;
    let title = '';
    const titleProp = page.properties?.title || page.properties?.Name || page.properties?.['이름'];
    if (titleProp?.title?.[0]?.plain_text) {
      title = titleProp.title[0].plain_text;
    }

    // 페이지 블록 내용 가져오기
    const blocks = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100,
    });

    const content = blocks.results.map((block: any) => blockToText(block)).filter(Boolean).join('\n');

    return `# ${title}\n\n${content}`;
  } catch (error: any) {
    return `노션 페이지 읽기 오류: ${error.message}`;
  }
}

// 노션 데이터베이스 조회
export async function notionQueryDatabase(databaseId: string): Promise<string> {
  const notion = getNotionClient();
  try {
    const response = await (notion.databases as any).query({
      database_id: databaseId,
      page_size: 20,
    });

    if (response.results.length === 0) {
      return '데이터베이스에 항목이 없습니다.';
    }

    const rows = response.results.map((page: any, i: number) => {
      const props = page.properties;
      const fields: string[] = [];
      for (const [key, val] of Object.entries(props) as any[]) {
        const text = extractPropertyValue(val);
        if (text) fields.push(`${key}: ${text}`);
      }
      return `[${i + 1}] ${fields.join(' | ')}\n    ID: ${page.id}`;
    });

    return rows.join('\n\n');
  } catch (error: any) {
    return `노션 DB 조회 오류: ${error.message}`;
  }
}

// 노션 페이지 생성
export async function notionCreatePage(
  parentId: string,
  title: string,
  content: string,
): Promise<string> {
  const notion = getNotionClient();
  try {
    // 부모가 데이터베이스인지 페이지인지 판단
    let parent: any;
    try {
      await notion.databases.retrieve({ database_id: parentId });
      parent = { database_id: parentId };
    } catch {
      parent = { page_id: parentId };
    }

    // 컨텐츠를 블록으로 변환
    const children = contentToBlocks(content);

    const properties: any = parent.database_id
      ? { title: { title: [{ text: { content: title } }] } }
      : { title: { title: [{ text: { content: title } }] } };

    const page = await notion.pages.create({
      parent,
      properties,
      children,
    });

    return `노션 페이지가 생성되었습니다!\nID: ${page.id}\nURL: ${(page as any).url}`;
  } catch (error: any) {
    return `노션 페이지 생성 오류: ${error.message}`;
  }
}

// 노션 페이지에 내용 추가
export async function notionAppendContent(pageId: string, content: string): Promise<string> {
  const notion = getNotionClient();
  try {
    const children = contentToBlocks(content);
    await notion.blocks.children.append({
      block_id: pageId,
      children,
    });
    return '노션 페이지에 내용이 추가되었습니다.';
  } catch (error: any) {
    return `노션 내용 추가 오류: ${error.message}`;
  }
}

// 블록을 텍스트로 변환
function blockToText(block: any): string {
  const type = block.type;
  const data = block[type];
  if (!data) return '';

  const richText = data.rich_text || data.text || [];
  const text = richText.map((t: any) => t.plain_text || '').join('');

  switch (type) {
    case 'paragraph': return text;
    case 'heading_1': return `# ${text}`;
    case 'heading_2': return `## ${text}`;
    case 'heading_3': return `### ${text}`;
    case 'bulleted_list_item': return `• ${text}`;
    case 'numbered_list_item': return `1. ${text}`;
    case 'to_do': return `${data.checked ? '☑' : '☐'} ${text}`;
    case 'toggle': return `▸ ${text}`;
    case 'quote': return `> ${text}`;
    case 'callout': return `💡 ${text}`;
    case 'code': return `\`\`\`\n${text}\n\`\`\``;
    case 'divider': return '---';
    case 'table_row': {
      const cells = data.cells?.map((cell: any[]) =>
        cell.map((t: any) => t.plain_text || '').join('')
      ) || [];
      return `| ${cells.join(' | ')} |`;
    }
    default: return text;
  }
}

// 마크다운 텍스트를 노션 블록으로 변환
function contentToBlocks(content: string): any[] {
  const lines = content.split('\n');
  const blocks: any[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    if (line.startsWith('### ')) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: { rich_text: [{ type: 'text', text: { content: line.slice(4) } }] },
      });
    } else if (line.startsWith('## ')) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: { rich_text: [{ type: 'text', text: { content: line.slice(3) } }] },
      });
    } else if (line.startsWith('# ')) {
      blocks.push({
        object: 'block',
        type: 'heading_1',
        heading_1: { rich_text: [{ type: 'text', text: { content: line.slice(2) } }] },
      });
    } else if (line.startsWith('- ') || line.startsWith('• ')) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: [{ type: 'text', text: { content: line.slice(2) } }] },
      });
    } else if (line.startsWith('---')) {
      blocks.push({ object: 'block', type: 'divider', divider: {} });
    } else if (line.startsWith('> ')) {
      blocks.push({
        object: 'block',
        type: 'quote',
        quote: { rich_text: [{ type: 'text', text: { content: line.slice(2) } }] },
      });
    } else {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', text: { content: line } }] },
      });
    }
  }

  return blocks;
}

// 프로퍼티 값 추출
function extractPropertyValue(prop: any): string {
  if (!prop) return '';
  switch (prop.type) {
    case 'title': return prop.title?.map((t: any) => t.plain_text).join('') || '';
    case 'rich_text': return prop.rich_text?.map((t: any) => t.plain_text).join('') || '';
    case 'number': return prop.number?.toString() || '';
    case 'select': return prop.select?.name || '';
    case 'multi_select': return prop.multi_select?.map((s: any) => s.name).join(', ') || '';
    case 'date': return prop.date?.start || '';
    case 'checkbox': return prop.checkbox ? '✅' : '❌';
    case 'url': return prop.url || '';
    case 'email': return prop.email || '';
    case 'phone_number': return prop.phone_number || '';
    case 'status': return prop.status?.name || '';
    case 'formula': return prop.formula?.string || prop.formula?.number?.toString() || '';
    default: return '';
  }
}
