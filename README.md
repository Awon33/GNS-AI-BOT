# 📚 GNS 212 AI Teaching Assistant

A **Zero-Cost Architecture** RAG (Retrieval-Augmented Generation) AI assistant designed to answer student questions based strictly on the provided course textbook, and cite exact page numbers for every response. 

This project was built to empower students with rapid context retrieval using an entirely free deployment stack.

## ✨ Features

- **Strict Knowledge Retrieval (RAG):** The AI answers *only* from the provided course material (PDF). It refuses to hallucinate facts outside the textbook.
- **Accurate Citations:** Provides `[Page X]` page-level citations for the extracted context so you can cross-reference the actual book.
- **Modern User Interface:** Built with Tailwind CSS and `shadcn/ui` for a sleek, responsive, dark-mode-first chat experience.
- **Zero-Cost Deployment:** Operates on the free tiers of Vercel, Supabase (PostgreSQL + pgvector), and Google's Gemini API.
- **Fast Similarity Search:** Powered by Supabase `pgvector` for hyper-fast semantic nearest-neighbor searches.

## 🛠️ Technology Stack

1. **Frontend & Backend:** Next.js 15 (App Router), React, TypeScript.
2. **Database & Auth:** Supabase (PostgreSQL, `pgvector` extension)
3. **AI Provider (LLM):** Google Gemini (`gemini-2.5-flash` for chatting)
4. **Embeddings:** Google Gemini Embeddings (`gemini-embedding-001` with 768-D slice optimization)
5. **RAG Framework:** Custom pipeline combining LangChain.js (`@langchain/google-genai`, `@langchain/textsplitters`) with native Fetch streams.

## 🚀 Local Developer Setup

### 1. Prerequisites

- [Node.js](https://nodejs.org/en/) (v20 or higher)
- A free [Supabase](https://supabase.com/) account
- A free [Google Gemini API Key](https://aistudio.google.com/)

### 2. Clone and Install Dependencies

```bash
git clone <your-repository-url>
cd project-gns
npm install --legacy-peer-deps
```
*(Note: `--legacy-peer-deps` is recommended due to some LangChain and React 19 version mismatches.)*

### 3. Database Initialization

1. Create a new Supabase project.
2. Go to the SQL Editor in the Supabase Dashboard and copy/paste the migration code located at `supabase/migrations/20260417000000_init.sql`.
3. Run the SQL script to create the necessary tables, configure PostgREST Role Level Security, and set up the `match_gns212_documents` Postgres function.

### 4. Environment Variables

Create a `.env.local` file in the root directory and add your credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL="your-supabase-project-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"  # REQUIRED for local ingestion scripts only
GEMINI_API_KEY="your-gemini-api-key"
```

### 5. Ingest the Textbook PDF

Drop your textbook (e.g. `gns212_textbook.pdf`) into the root of the project. This script uses a custom `pdf-parse` pipeline to intelligently chunk the book while retaining strict page demarcations.

```bash
npx tsx scripts/ingest-pdf.ts gns212_textbook.pdf
```
*You will see the script extract pages, chunk the text, generate embeddings natively via Google Gemini, and insert them into your Supabase vector store.*

### 6. Run the Development Server

Execute the Next.js local server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The application requires basic signup/login authentication (managed automatically via Supabase) before users can query the chatbot.

## 🤝 Contributing & License

This project was built specifically for students studying GNS 212 but can easily be repurposed for other course materials. Contributions and pull requests are welcome. 

*Designed and engineered with care.*
