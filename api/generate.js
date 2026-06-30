// Arquivo: api/generate.js

export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  // Configuração de CORS para Edge (usando Headers nativos)
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

  const geminiKey = process.env.GEMINI_API_KEY;
  const openRouterKey = process.env.OPEN_API_KEY;

  if (!geminiKey || !openRouterKey) {
    return new Response(
      JSON.stringify({
        error: "Chaves de API não configuradas no ambiente da Vercel.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }

  try {
    // No Edge, precisamos ler o body da requisição de forma assíncrona
    const body = await req.json();
    const prompt = body.contents?.[0]?.parts?.[0]?.text;

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "O prompt enviado está vazio ou incorreto." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    // 🚀 PIPELINE DE FALLBACK (Tier 1 a Tier 6)
    const pipeline = [
      // Modelos do Gemini (Gratuitos / Atuais)
      { provider: "gemini", id: "gemini-3.1-flash-lite" },
      { provider: "gemini", id: "gemini-2.5-pro" },
      { provider: "gemini", id: "gemini-2.5-flash" },

      // Modelos do OpenRouter (Com a tag :free para garantir gratuidade)
      { provider: "openrouter", id: "cohere/north-mini-code:free" },
      { provider: "openrouter", id: "nvidia/nemotron-3.5-content-safety:free" },
      { provider: "openrouter", id: "google/gemma-4-26b-a4b-it:free" },
    ];

    let lastError = null;

    // Percorre o pipeline tentando executar cada modelo sequencialmente se o anterior falhar
    for (const tier of pipeline) {
      try {
        if (tier.provider === "gemini") {
          const googleResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${tier.id}:generateContent?key=${geminiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                safetySettings: [
                  {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_NONE",
                  },
                  {
                    category: "HARM_CATEGORY_HATE_SPEECH",
                    threshold: "BLOCK_NONE",
                  },
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

          if (!googleResponse.ok) {
            throw new Error(
              `Gemini ${tier.id} respondeu com status ${googleResponse.status}`,
            );
          }

          const data = await googleResponse.json();
          // Retorna o sucesso imediatamente para o Frontend se funcionar
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        } else if (tier.provider === "openrouter") {
          const openRouterResponse = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${openRouterKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: tier.id,
                messages: [{ role: "user", content: prompt }],
              }),
            },
          );

          if (!openRouterResponse.ok) {
            throw new Error(
              `OpenRouter ${tier.id} respondeu com status ${openRouterResponse.status}`,
            );
          }

          const data = await openRouterResponse.json();

          // 🛠️ ADAPTADOR: Transforma o formato de resposta do OpenRouter no formato padrão do Gemini
          const adaptedData = {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: data.choices?.[0]?.message?.content || "",
                    },
                  ],
                },
              },
            ],
          };

          return new Response(JSON.stringify(adaptedData), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
      } catch (error) {
        console.warn(
          `[Pipeline Fallback] Falha no modelo ${tier.id}:`,
          error.message,
        );
        lastError = error;
        // Continua para o próximo item do array (próximo fallback)
        continue;
      }
    }

    // Se sair do loop, significa que todos os modelos falharam consecutivamente
    return new Response(
      JSON.stringify({
        error: "Todos os modelos do pipeline falharam de forma consecutiva.",
        details: lastError?.message,
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error) {
    console.error("Erro geral no Backend Edge:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno ao processar solicitação." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
}
