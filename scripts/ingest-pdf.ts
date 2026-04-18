import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const pdf = require("pdf-parse");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_PRIVATE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GOOGLE_API_KEY = process.env.GEMINI_API_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_PRIVATE_KEY);

// Gemini embeddings instance (768D slice)
const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: GOOGLE_API_KEY,
  modelName: "gemini-embedding-001",
});

// Helper: sleep for N ms
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper: embed a single text with retry logic for rate limits
async function embedSingleWithRetry(text: string, maxRetries = 5): Promise<number[] | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const rawEmbedding = await embeddings.embedQuery(text);
      const sliced = rawEmbedding.slice(0, 768);
      
      // Validate: must have actual dimensions
      if (!sliced || sliced.length === 0) {
        console.warn(`  ⚠ Empty embedding returned, skipping this chunk.`);
        return null;
      }
      return sliced;
    } catch (err: any) {
      const status = err?.status || err?.response?.status;
      if (status === 429) {
        const waitTime = Math.min(15000 * (attempt + 1), 65000);
        console.log(`  [HTTP 429] Rate limited. Waiting ${waitTime / 1000}s before retry ${attempt + 1}/${maxRetries}...`);
        await sleep(waitTime);
      } else {
        console.error(`  ✗ Embedding error (non-429):`, err?.message || err);
        return null; // Skip this chunk rather than crashing
      }
    }
  }
  console.warn(`  ⚠ Max retries exceeded, skipping chunk.`);
  return null;
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

  // Filter out chunks that are too short to produce meaningful embeddings
  const MIN_CHUNK_LENGTH = 20;
  const validChunks = allChunks.filter(c => c.pageContent.trim().length >= MIN_CHUNK_LENGTH);
  const skippedCount = allChunks.length - validChunks.length;

  console.log(`Generated ${allChunks.length} chunks total.`);
  if (skippedCount > 0) {
    console.log(`Filtered out ${skippedCount} chunks (< ${MIN_CHUNK_LENGTH} chars).`);
  }
  console.log(`Embedding ${validChunks.length} valid chunks using Gemini API...`);
  console.log(`Processing one at a time with 1s delay to stay under free tier limits.\n`);

  let successCount = 0;
  let skipCount = 0;

  for (let i = 0; i < validChunks.length; i++) {
    const chunk = validChunks[i];
    const progress = `[${i + 1}/${validChunks.length}]`;

    // Generate embedding (one at a time to avoid batch failures)
    const embedding = await embedSingleWithRetry(chunk.pageContent);

    if (!embedding) {
      console.log(`${progress} ⚠ Skipped (empty/failed embedding) — Page ${chunk.metadata?.page}`);
      skipCount++;
      await sleep(1000);
      continue;
    }

    // Insert one row at a time so a single failure doesn't lose a whole batch
    const { error } = await supabase.from('gns212_documents').insert({
      content: chunk.pageContent,
      metadata: chunk.metadata,
      embedding: embedding,
    });

    if (error) {
      console.error(`${progress} ✗ Insert error:`, error.message);
      skipCount++;
    } else {
      successCount++;
      if (successCount % 25 === 0 || i === validChunks.length - 1) {
        console.log(`${progress} ✓ ${successCount} inserted so far...`);
      }
    }

    // 1-second delay between each API call (~60 RPM, well under limits)
    if (i < validChunks.length - 1) {
      await sleep(1000);
    }
  }

  console.log(`\n✅ Ingestion complete!`);
  console.log(`   Inserted: ${successCount}`);
  console.log(`   Skipped:  ${skipCount}`);
}

main().catch(console.error);
