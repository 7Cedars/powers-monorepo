import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { pipeline } from '@huggingface/transformers';
import type { Chunk } from './types.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;

const __dirname = dirname(fileURLToPath(import.meta.url));
const AI_ROOT = join(__dirname, '..');
const MODEL = 'nomic-ai/nomic-embed-text-v1.5';

// ~500 tokens / ~80 token overlap (approximated at 4 chars/token)
const CHUNK_CHARS = 2000;
const OVERLAP_CHARS = 320;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractor: any = null;

async function getExtractor() {
  if (!extractor) {
    console.log(`Downloading/loading model ${MODEL} (first run downloads ~275 MB)...`);
    extractor = await pipeline('feature-extraction', MODEL);
    console.log('Model ready.');
  }
  return extractor;
}

function makeChunks(
  text: string,
  source: string,
  sourceType: 'pdf' | 'markdown',
): Omit<Chunk, 'embedding'>[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const chunks: Omit<Chunk, 'embedding'>[] = [];
  let start = 0;
  let index = 0;

  while (start < normalized.length) {
    const end = Math.min(start + CHUNK_CHARS, normalized.length);
    const slice = normalized.slice(start, end).trim();

    if (slice.length > 100) {
      chunks.push({ id: `${source}-${index}`, source, sourceType, text: slice });
      index++;
    }

    if (end === normalized.length) break;
    start = end - OVERLAP_CHARS;
  }

  return chunks;
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const ext = await getExtractor();
  // nomic-embed requires "search_document:" prefix for passage/document embedding
  const prefixed = texts.map((t) => `search_document: ${t}`);
  const output = await ext(prefixed, { pooling: 'mean', normalize: true });
  return output.tolist() as number[][];
}

async function ingest() {
  const rawChunks: Omit<Chunk, 'embedding'>[] = [];

  // Index PDFs from sources/
  const sourcesDir = join(AI_ROOT, 'sources');
  const pdfFiles = (await readdir(sourcesDir)).filter((f) => f.endsWith('.pdf'));
  for (const file of pdfFiles) {
    console.log(`  Parsing PDF: ${file}`);
    const buf = await readFile(join(sourcesDir, file));
    const { text } = await pdfParse(buf);
    rawChunks.push(...makeChunks(text, file, 'pdf'));
  }

  // Index markdown summaries from references/
  const refsDir = join(AI_ROOT, 'references');
  const mdFiles = (await readdir(refsDir)).filter((f) => f.endsWith('.md') && !f.includes('template'));
  for (const file of mdFiles) {
    console.log(`  Parsing markdown: ${file}`);
    const text = await readFile(join(refsDir, file), 'utf-8');
    rawChunks.push(...makeChunks(text, file, 'markdown'));
  }

  console.log(`\nEmbedding ${rawChunks.length} chunks...`);

  // Batch size of 8 — reduced from 32 to keep peak memory manageable on memory-constrained hosts
  const BATCH = 8;
  const chunks: Chunk[] = [];

  for (let i = 0; i < rawChunks.length; i += BATCH) {
    const batch = rawChunks.slice(i, i + BATCH);
    const batchNum = Math.floor(i / BATCH) + 1;
    const total = Math.ceil(rawChunks.length / BATCH);
    console.log(`  Batch ${batchNum}/${total}`);
    const embeddings = await embedBatch(batch.map((c) => c.text));
    batch.forEach((c, j) => chunks.push({ ...c, embedding: embeddings[j] }));
  }

  const outDir = join(AI_ROOT, 'embeddings');
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, 'index.json');
  await writeFile(outPath, JSON.stringify(chunks));

  const sizeMB = (Buffer.byteLength(JSON.stringify(chunks)) / 1024 / 1024).toFixed(1);
  console.log(`\nDone. ${chunks.length} chunks from ${pdfFiles.length + mdFiles.length} sources → ${outPath} (${sizeMB} MB)`);
}

ingest().catch((err) => {
  console.error(err);
  process.exit(1);
});
