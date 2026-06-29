// Arquivo: api/generate.js

// 1. Avisa a Vercel para rodar este arquivo no ambiente super leve (Edge)
export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  // 2. Configuração de CORS para Edge (usando Headers nativos)
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS,PATCH,DELETE,POST,PUT",
    "Access-Control-Allow-Headers":
      "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
  };

  // Responde ao preflight do navegador imediatamente
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Chave de API não configurada." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }

  try {
    // No Edge, precisamos ler o body da requisição de forma assíncrona
    const body = await req.json();
    const { contents, model } = body;

    const modelName = model || "gemini-2.5-flash-lite";

    const googleResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_NONE",
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_NONE",
            },
          ],
        }),
      },
    );

    const data = await googleResponse.json();

    if (!googleResponse.ok) {
      return new Response(JSON.stringify(data), {
        status: googleResponse.status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Retorna sucesso para o Frontend
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("Erro no Backend Edge:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno ao processar solicitação." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
}
