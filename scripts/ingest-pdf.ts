import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { pipeline, env } from '@xenova/transformers';
// Explicitly disable local models to force HF Hub download for the 768D model
env.allowLocalModels = false;

import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const pdf = require("pdf-parse");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_PRIVATE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GOOGLE_API_KEY = process.env.GEMINI_API_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_PRIVATE_KEY);

let extractorInstance: any = null;
async function getLocalEmbeddingBatch(texts: string[]): Promise<number[][]> {
  if (!extractorInstance) {
    console.log("Loading Xenova/nomic-embed-text-v1.5 model... (may take a minute the first time)");
    extractorInstance = await pipeline('feature-extraction', 'nomic-ai/nomic-embed-text-v1.5', { quantized: true });
  }

  // Feature extraction output is a tensor, we use pooling and normalization automatically mapped
  const output = await extractorInstance(texts, { pooling: 'mean', normalize: true });
  
  // output is a tensor, we must extract the float32 arrays
  // shape is [batch_size, 768]
  const embeddings: number[][] = [];
  const batchSize = texts.length;
  const dim = 768; // nomic outputs 768
  
  for (let i = 0; i < batchSize; i++) {
    const chunkArray = Array.from(output.data.subarray(i * dim, (i + 1) * dim)) as number[];
    embeddings.push(chunkArray);
  }

  return embeddings;
}

async function main() {
  const filePath = process.argv[2] || "gns212_textbook.pdf";
  if (!fs.existsSync(filePath)) {
    console.error(`File ${filePath} not found. Ensure the PDF is in the root directory.`);
    return;
  }

  console.log(`Processing ${filePath}...`);
  const dataBuffer = fs.readFileSync(filePath);

  // Custom function to handle pages properly for pdf-parse
  const options = {
    pagerender: function (pageData: any) {
      return pageData.getTextContent().then(function (textContent: any) {
        let lastY, text = '';
        for (let item of textContent.items) {
          if (lastY == item.transform[5] || !lastY) {
            text += item.str;
          } else {
            text += '\n' + item.str;
          }
          lastY = item.transform[5];
        }
        return text + `\n---PAGE_BOUNDARY_${pageData.pageIndex + 1}---\n`;
      });
    }
  };

  const parsedPdf = await pdf(dataBuffer, options);
  const pagesText = parsedPdf.text.split(/---PAGE_BOUNDARY_\d+---/);

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  console.log(`Extracted ${pagesText.length} pages. Chunking...`);

  type ChunkDoc = { pageContent: string; metadata: any };
  let allChunks: ChunkDoc[] = [];

  for (let i = 0; i < pagesText.length; i++) {
    const pageText = pagesText[i].trim();
    if (!pageText) continue;

    const pageNumber = i + 1;
    const splitChunks = await textSplitter.createDocuments([pageText], [{ source: "GNS 212", page: pageNumber }]);
    allChunks.push(...splitChunks);
  }

  console.log(`Generated ${allChunks.length} chunks. Generating embeddings and uploading to Supabase...`);

  // Batch insert to avoid hitting payload or rate limits
  const BATCH_SIZE = 50;
  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE);

    // Generate embeddings locally!
    console.log(`Processing batch ${i / BATCH_SIZE + 1} locally...`);
    const batchTexts = batch.map((doc) => doc.pageContent);
    const batchEmbeddings = await getLocalEmbeddingBatch(batchTexts);

    const rowsToInsert = batch.map((doc, idx) => ({
      content: doc.pageContent,
      metadata: doc.metadata,
      embedding: batchEmbeddings[idx],
    }));

    const { error } = await supabase.from('gns212_documents').insert(rowsToInsert);
    if (error) {
      console.error(`Error inserting batch ${i / BATCH_SIZE + 1}:`, error);
    } else {
      console.log(`Inserted batch ${i / BATCH_SIZE + 1} / ${Math.ceil(allChunks.length / BATCH_SIZE)}`);
    }

  }

  console.log("Ingestion complete!");
}

main().catch(console.error);
