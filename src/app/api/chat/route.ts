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
    const { message, sessionId, userId } = await req.json();

    if (!message || !sessionId || !userId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Generate Embedding for the user query
    async function getGeminiEmbedding(text: string): Promise<number[]> {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`,
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
      if (!data.embedding?.values) throw new Error("Embedding generation failed");
      return data.embedding.values.slice(0, 768);
    }
    
    const queryEmbedding = await getGeminiEmbedding(message);

    // 2. Perform similarity search via edge function or direct DB query
    // Supabase RPC match_gns212_documents
    const { data: documents, error: matchError } = await supabase.rpc('match_gns212_documents', {
      query_embedding: queryEmbedding,
      match_count: 5,
    });

    if (matchError) {
      console.error('Error during vector search:', matchError);
      return NextResponse.json({ error: 'Failed to search documents' }, { status: 500 });
    }

    // 3. Format Context
    let contextText = '';
    if (documents && documents.length > 0) {
      contextText = documents
        .map((doc: any) => `[Page ${doc.metadata?.page || 'Unknown'}]: ${doc.content}`)
        .join('\n\n');
    }

    // 4. Invoke LLM and construct Prompt
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
