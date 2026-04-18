import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { IterableReadableStream } from '@langchain/core/utils/stream';

// Suppress the console warning from LangChain
process.env.LANGCHAIN_TRACING_V2 = 'false';

// Cache the embeddings instance globally (persists across requests in the same serverless instance)
const cachedEmbeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GEMINI_API_KEY!,
  modelName: "gemini-embedding-001",
});

// Helper function to convert Langchain IterableStream to standard Web ReadableStream
function langChainStreamToReadableStream(stream: IterableReadableStream<any>) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });
}

export async function POST(req: Request) {
  try {
    const { message, sessionId, userId, generateTitle } = await req.json();

    if (!message || !sessionId || !userId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const supabase = await createClient();

    // Optionally auto-generate a title rapidly in the background if this is the very first query
    if (generateTitle) {
      // Intentionally don't await this so it doesn't block the actual streaming response!
      (async () => {
        try {
          const titleModel = new ChatGoogleGenerativeAI({
            apiKey: process.env.GEMINI_API_KEY,
            model: "gemini-2.0-flash-lite", // Fastest model — perfect for a simple title
            temperature: 0.3,
          });
          const titlePrompt = `Summarize this user prompt into a short, concise chat title (max 4 words). Do not use quotes or prefixes. Prompt: "${message}"`;
          const titleResponse = await titleModel.invoke(titlePrompt);
          let rawTitle = titleResponse.content.toString().replace(/["']/g, '').trim();
          if (rawTitle.length > 50) rawTitle = rawTitle.substring(0, 50);
          
          await supabase.from('chat_sessions').update({ title: rawTitle }).eq('id', sessionId);
        } catch (e) {
          console.error("Failed to cleanly auto-generate chat title:", e);
        }
      })();
    }

    // 1. Generate query embedding via Gemini API (single call — no rate limit risk)
    const queryEmbedding = await cachedEmbeddings.embedQuery(message);
    // Slice to 768 dimensions to match the DB vectors
    const queryEmbedding768 = queryEmbedding.slice(0, 768);

    // 2. Perform similarity search via Supabase RPC
    const { data: documents, error: matchError } = await supabase.rpc('match_gns212_documents', {
      query_embedding: queryEmbedding768,
      match_count: 5,
    });

    if (matchError) {
      console.error('Error during vector search:', matchError);
      return NextResponse.json({ error: 'Failed to search documents' }, { status: 500 });
    }

    let contextText = '';
    if (documents && documents.length > 0) {
      contextText = documents
        .map((doc: any) => `[Page ${doc.metadata?.page || 'Unknown'}]: ${doc.content}`)
        .join('\n\n');
    }
    
    // 3. Invoke LLM — using gemini-2.0-flash (much faster than 2.5-flash which has a thinking delay)
    const model = new ChatGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
      model: "gemini-2.5-flash", 
      temperature: 0.3, // Balanced: accurate but conversational
      streaming: true,
    });

    const SYSTEM_PROMPT = `
You are a knowledgeable and friendly teaching assistant for the university course GNS 212 (Nigerian Peoples and Culture, or the relevant GNS course this textbook covers).

Your job is to help students learn and understand the course material deeply. Follow this priority system:

**TIER 1 — Textbook Context (Highest Priority):**
When the provided context below contains relevant information, use it as your PRIMARY source. 
You MUST cite every piece of textbook information with [Page X] at the end of the sentence.

**TIER 2 — Related Academic Knowledge:**
If the student asks something related to the course subject area (Nigerian history, culture, governance, geography, ethnic groups, national development, etc.) but the provided context doesn't directly answer it, you MAY use your general knowledge to give a helpful academic answer. 
However, you must clearly indicate this by prefacing with: "While this isn't directly covered in your textbook, here's what I can share:" 
Do NOT fabricate page citations for information not from the context.

**TIER 3 — Off-Topic:**
If the question is completely unrelated to the course or its subject area (e.g., coding, weather, sports), politely redirect: 
"That's outside the scope of GNS 212. I'm here to help you with your coursework — feel free to ask me anything related to the course!"

**Style guidelines:**
- Be warm, encouraging, and conversational — like a helpful senior student, not a robot.
- Use clear formatting: bullet points, bold key terms, and numbered lists where helpful.
- When the textbook context is available, always ground your answer in it first, then expand if needed.
- Keep answers focused and educational.

Context from textbook:
{context}

Student's question:
{question}
`;

    const promptTemplate = PromptTemplate.fromTemplate(SYSTEM_PROMPT);
    const chain = promptTemplate.pipe(model).pipe(new StringOutputParser());

    // Asynchronously save the user message to database
    supabase.from('messages').insert({
      session_id: sessionId,
      role: 'user',
      content: message
    }).then(({error}) => {
      if(error) console.error("Could not save user message", error);
    });

    // We intercept the stream to aggregate the response for saving into the DB.
    let fullAiResponse = "";
    
    // Create the stream
    const rawStream = await chain.stream({
      context: contextText || "No context found.",
      question: message,
    });

    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        // Collect the full response text internally
        const text = new TextDecoder().decode(chunk);
        fullAiResponse += text;
        controller.enqueue(chunk);
      },
      async flush() {
        // Flush happens when stream closes - save the complete AI message to DB
        supabase.from('messages').insert({
          session_id: sessionId,
          role: 'ai',
          content: fullAiResponse
        }).then(({error}) => {
          if(error) console.error("Could not save AI message", error);
        });
      }
    });

    const streamResponse = langChainStreamToReadableStream(rawStream).pipeThrough(transformStream);

    return new Response(streamResponse, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
