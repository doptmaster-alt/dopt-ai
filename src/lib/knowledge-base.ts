import fs from 'fs';
import path from 'path';

export type KnowledgeCategory = 'brief' | 'plan' | 'conti' | 'final' | 'process' | 'reference';
export type KnowledgeSource = 'notion' | 'gdrive' | 'figma' | 'upload';

export interface KnowledgeEntry {
  id: string;
  category: KnowledgeCategory;
  title: string;
  content: string;
  source: KnowledgeSource;
  sourceUrl: string;
  tags: string[];
  createdAt: string;
}

export interface KnowledgeStats {
  total: number;
  byCategory: Record<KnowledgeCategory, number>;
  bySource: Record<KnowledgeSource, number>;
}

const KB_PATH = path.resolve(process.cwd(), 'knowledge-base.json');

function loadKB(): KnowledgeEntry[] {
  try {
    if (fs.existsSync(KB_PATH)) {
      const raw = fs.readFileSync(KB_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('[KnowledgeBase] Failed to load:', e);
  }
  return [];
}

function saveKB(entries: KnowledgeEntry[]): void {
  fs.writeFileSync(KB_PATH, JSON.stringify(entries, null, 2), 'utf-8');
}

function generateId(): string {
  return `kb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function addKnowledge(entry: Omit<KnowledgeEntry, 'id' | 'createdAt'>): KnowledgeEntry {
  const entries = loadKB();
  const newEntry: KnowledgeEntry = {
    ...entry,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  entries.push(newEntry);
  saveKB(entries);
  return newEntry;
}

export function searchKnowledge(query: string, category?: KnowledgeCategory): KnowledgeEntry[] {
  const entries = loadKB();
  const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);

  if (keywords.length === 0 && !category) {
    return entries;
  }

  return entries.filter((entry) => {
    if (category && entry.category !== category) {
      return false;
    }
    if (keywords.length === 0) {
      return true;
    }
    const haystack = `${entry.title} ${entry.content} ${entry.tags.join(' ')}`.toLowerCase();
    return keywords.some((kw) => haystack.includes(kw));
  });
}

export function getAllKnowledge(): KnowledgeEntry[] {
  return loadKB();
}

export function deleteKnowledge(id: string): boolean {
  const entries = loadKB();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  entries.splice(idx, 1);
  saveKB(entries);
  return true;
}

export function getKnowledgeStats(): KnowledgeStats {
  const entries = loadKB();
  const stats: KnowledgeStats = {
    total: entries.length,
    byCategory: { brief: 0, plan: 0, conti: 0, final: 0, process: 0, reference: 0 },
    bySource: { notion: 0, gdrive: 0, figma: 0, upload: 0 },
  };
  for (const entry of entries) {
    if (stats.byCategory[entry.category] !== undefined) {
      stats.byCategory[entry.category]++;
    }
    if (stats.bySource[entry.source] !== undefined) {
      stats.bySource[entry.source]++;
    }
  }
  return stats;
}

/**
 * Get relevant knowledge entries for a given pipeline step.
 * Step mapping:
 *   0 = reference (market research)
 *   1-4 = brief
 *   5-7 = plan
 *   8-10 = conti
 *   11 = final
 */
export function getKnowledgeForStep(currentStep: number, limit: number = 5): KnowledgeEntry[] {
  let category: KnowledgeCategory;
  if (currentStep === 0) {
    category = 'reference';
  } else if (currentStep <= 4) {
    category = 'brief';
  } else if (currentStep <= 7) {
    category = 'plan';
  } else if (currentStep <= 10) {
    category = 'conti';
  } else {
    category = 'final';
  }

  const entries = loadKB();

  // First get entries matching the category
  const matched = entries.filter((e) => e.category === category);

  // If not enough, supplement with process/reference entries
  if (matched.length < limit) {
    const extras = entries
      .filter((e) => e.category === 'process' || (e.category === 'reference' && category !== 'reference'))
      .slice(0, limit - matched.length);
    return [...matched.slice(0, limit), ...extras];
  }

  // Return the most recent entries
  return matched.slice(-limit);
}
