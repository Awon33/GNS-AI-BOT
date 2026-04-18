import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { IterableReadableStream } from '@langchain/core/utils/stream';

// Suppress the console warning from LangChain
process.env.LANGCHAIN_TRACING_V2 = 'false';

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
            model: "gemini-2.5-flash", 
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
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GEMINI_API_KEY,
      modelName: "gemini-embedding-001",
    });

    const queryEmbedding = await embeddings.embedQuery(message);
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
    
    console.log('--- EXTRACTED CONTEXT ---');
    console.log(contextText);
    console.log('--- END EXTRACTED CONTEXT ---');

    // 3. Invoke LLM and construct Prompt
    const model = new ChatGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
      model: "gemini-2.5-flash", 
      temperature: 0.1, // Keep it objective for teaching
      streaming: true,
    });

    const SYSTEM_PROMPT = `
You are a helpful teaching assistant for the course GNS 212. 
Answer the student's query using ONLY the provided context below.
If the context does not contain the answer, reply exactly with: "I cannot find this in the textbook." 
For every piece of information you provide, you MUST cite the source using the page number from the metadata. 
Format your citation at the end of the sentence as [Page X].

Context:
{context}

Question:
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
