exports.handler = async function (event, context) {

  // Preflight CORS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Método não permitido." }),
    };
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "GEMINI_API_KEY não configurada no Netlify." }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Body inválido: " + e.message }),
    };
  }

  const { tipo, objeto, secretaria, servidor, cargo } = body;

  if (!tipo) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Campo 'tipo' não informado." }),
    };
  }

  const prompts = {
    objeto: `Você é um redator jurídico especialista em licitações públicas brasileiras (Lei 14.133/2021).
Redija o OBJETO de um Documento de Formalização de Demanda (DFD) de forma técnica, formal e completa, em um único parágrafo.
Use apenas linguagem administrativa oficial brasileira.

Secretaria requisitante: ${secretaria || "não informada"}
Responsável: ${servidor || "não informado"} — ${cargo || "não informado"}
Descrição fornecida pelo usuário: ${objeto}

Responda APENAS com o texto do objeto, sem títulos, sem numeração, sem explicações.`,

    justificativa: `Você é um redator jurídico especialista em licitações públicas brasileiras (Lei 14.133/2021).
Redija a JUSTIFICATIVA de um Documento de Formalização de Demanda (DFD) em três parágrafos formais.
Fundamente com base nos princípios da eficiência, economicidade e continuidade do serviço público.

Secretaria requisitante: ${secretaria || "não informada"}
Responsável: ${servidor || "não informado"} — ${cargo || "não informado"}
Objeto da contratação: ${objeto}

Responda APENAS com o texto da justificativa, sem títulos, sem numeração, sem explicações.`,

    fiscalizacao: `Você é um redator jurídico especialista em licitações públicas brasileiras (Lei 14.133/2021).
Redija o texto de RESPONSABILIDADE PELA GESTÃO E FISCALIZAÇÃO de um DFD da Prefeitura de Tapira-MG.
Mencione que o gestor e fiscal serão designados formalmente e que suas atribuições constam do Decreto Municipal nº 24, de 13 de janeiro de 2025.

Secretaria: ${secretaria || "não informada"}
Responsável indicado: ${servidor || "não informado"} — ${cargo || "não informado"}
Objeto: ${objeto}

Responda APENAS com dois parágrafos, sem títulos, sem numeração.`,

    alinhamento: `Você é um redator jurídico especialista em licitações públicas brasileiras (Lei 14.133/2021).
Redija o texto de ALINHAMENTO DA CONTRATAÇÃO NO PLANEJAMENTO DA ADMINISTRAÇÃO para um DFD da Prefeitura de Tapira-MG.
Mencione que não há Plano de Contratações Anual (PCA) formalizado, mas que a contratação está alinhada ao orçamento municipal vigente.

Objeto: ${objeto}
Secretaria: ${secretaria || "não informada"}

Responda APENAS com um parágrafo, sem títulos, sem numeração.`,
  };

  const prompt = prompts[tipo];
  if (!prompt) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: `Tipo '${tipo}' inválido.` }),
    };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1024,
        },
      }),
    });

    const rawText = await response.text();

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Resposta inesperada do Gemini: " + rawText.substring(0, 200) }),
      };
    }

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: data.error?.message || "Erro na API do Gemini." }),
      };
    }

    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ texto }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Erro interno: " + err.message }),
    };
  }
};
