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

async function getGeminiEmbedding(text: string): Promise<number[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GOOGLE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/gemini-embedding-001",
        content: { parts: [{ text }] },
      }),
    }
  );
  const data = await response.json();
  const embedding = data.embedding?.values;
  if (!embedding) {
    throw new Error(`Gemini API Error: ${JSON.stringify(data)}`);
  }
  return embedding.slice(0, 768); // Force 768 to match vector DB schema
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

    // Generate embeddings for the batch
    const batchEmbeddings: number[][] = [];
    for (const doc of batch) {
      batchEmbeddings.push(await getGeminiEmbedding(doc.pageContent));
    }

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
