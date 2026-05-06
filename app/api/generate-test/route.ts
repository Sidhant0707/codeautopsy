import { NextRequest, NextResponse } from "next/server";

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { fileName, fileContent } = await req.json();

    if (!fileName || !fileContent) {
      return NextResponse.json({ error: "Missing fileName or fileContent" }, { status: 400 });
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      return NextResponse.json({ error: "Server configuration error: Missing Groq API Key" }, { status: 500 });
    }

    const prompt = `
      You are a Senior Software Engineer in Test (SDET). 
      I am handing you a high-risk source file named "${fileName}" that currently has 0 unit tests.
      
      Your job is to write a robust, production-ready test suite for this file using Jest syntax.
      
      FILE CONTENT:
      """
      ${fileContent}
      """
      
      REQUIREMENTS:
      1. Import the necessary functions from the file.
      2. Write at least 3 meaningful test cases covering standard behavior and edge cases.
      3. Mock any external dependencies (like Supabase clients or Next.js routers).
      4. Output ONLY a strict JSON object. No markdown, no conversational text.
      
      EXPECTED JSON SCHEMA:
      {
        "test_file_name": "${fileName.replace(/\.[jt]sx?$/, '.test.ts')}",
        "test_code": "import { ... } from './${fileName.split('/').pop()}';\\n\\ndescribe('...', () => { ... });"
      }
    `;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", 
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }, 
        temperature: 0.1, 
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API Error: ${await response.text()}`);
    }

    const data = await response.json();
    const generatedTest = JSON.parse(data.choices[0].message.content);

    return NextResponse.json(generatedTest);

  } catch (error) {
    console.error("Test Generation Failed:", error);
    return NextResponse.json(
      { error: "Failed to generate test. Check server logs." }, 
      { status: 500 }
    );
  }
}