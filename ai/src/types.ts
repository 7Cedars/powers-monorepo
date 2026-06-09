export interface Chunk {
  id: string;
  source: string;
  sourceType: 'pdf' | 'markdown';
  text: string;
  embedding: number[];
}

export type EmbeddingIndex = Chunk[];
