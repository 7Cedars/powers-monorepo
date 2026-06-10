import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from '@huggingface/transformers';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Chunk } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = join(__dirname, '..', 'embeddings', 'index.json');
const MODEL = 'nomic-ai/nomic-embed-text-v1.5';

let index: Chunk[] = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractor: any;

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function embedQuery(query: string): Promise<number[]> {
  // nomic-embed requires "search_query:" prefix for query embedding
  const output = await extractor([`search_query: ${query}`], { pooling: 'mean', normalize: true });
  return (output.tolist() as number[][])[0];
}

async function search(query: string, k: number) {
  const qVec = await embedQuery(query);
  return index
    .map((c) => ({ source: c.source, sourceType: c.sourceType, text: c.text, score: cosine(qVec, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((r) => ({ source: r.source, sourceType: r.sourceType, text: r.text, relevanceScore: Math.round(r.score * 100) / 100 }));
}

async function main() {
  // Load embedding index
  try {
    const raw = await readFile(INDEX_PATH, 'utf-8');
    index = JSON.parse(raw) as Chunk[];
    process.stderr.write(`[governance-rag] Loaded ${index.length} chunks\n`);
  } catch {
    process.stderr.write(`[governance-rag] Warning: no index found at ${INDEX_PATH}. Run pnpm ingest first.\n`);
  }

  // Load model eagerly so first search is not slow (~2–5 s from cache)
  process.stderr.write(`[governance-rag] Loading embedding model ${MODEL}...\n`);
  extractor = await pipeline('feature-extraction', MODEL);
  process.stderr.write(`[governance-rag] Model ready\n`);

  const server = new Server(
    { name: 'governance-rag', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'search_governance_sources',
        description:
          'Search the governance design reference library by semantic similarity. Returns relevant excerpts from academic papers and summaries in the ai/sources corpus. Use this to find theory, frameworks, and empirical evidence relevant to a governance design question.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'A governance design question or topic (e.g. "polycentric commons institutional design", "veto mechanisms legitimacy accountability")',
            },
            k: {
              type: 'number',
              description: 'Number of results to return (default: 5, max: 10)',
            },
          },
          required: ['query'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== 'search_governance_sources') {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }

    const { query, k = 5 } = request.params.arguments as { query: string; k?: number };

    if (index.length === 0) {
      return {
        content: [{ type: 'text', text: 'Index is empty. Run `pnpm ingest` in the ai/ directory first.' }],
      };
    }

    const results = await search(query, Math.min(k, 10));
    const text = results
      .map((r, i) => `## Result ${i + 1} — ${r.source} (${r.sourceType}, relevance: ${r.relevanceScore})\n\n${r.text}`)
      .join('\n\n---\n\n');

    return { content: [{ type: 'text', text }] };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`[governance-rag] Fatal: ${err}\n`);
  process.exit(1);
});
