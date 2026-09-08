// Asistente técnico de KAVANA Route AI (RAG sobre la documentación real del repo).
// - Indexa en memoria README, DECISIONS, ADRs, docs técnicos e HISTORY.
// - Búsqueda TF-IDF simple (sin embeddings ni coste).
// - Llama a OpenRouter: modelo gratuito por defecto, sube a DeepSeek para
//   preguntas complejas (razonamiento multi-paso).
// - Regla de honestidad: solo responde con lo documentado; si no lo sabe, lo dice.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

// Modelos OpenRouter: gratuito como principal, mismo para preguntas complejas.
const MODELO_FREE = process.env.ASSISTANT_MODEL_FREE || 'nvidia/nemotron-3-super-120b-a12b:free';
const MODELO_PRO = process.env.ASSISTANT_MODEL_PRO || 'nvidia/nemotron-3-super-120b-a12b:free';

// ---------------------------------------------------------------- indexado

export function cargarCorpus() {
  const fuentes = [
    'README.md',
    'DECISIONS.md',
    'SECURITY.md',
    'docs/HISTORY.md',
    'docs/DECISIONES_ESTRATEGICAS.md',
    'docs/METRICS.md',
  ];
  const adrDir = path.join(REPO_ROOT, 'docs/adr');
  const techDir = path.join(REPO_ROOT, 'docs/technical');
  for (const f of fs.readdirSync(adrDir).filter((f) => f.endsWith('.md') && !f.toLowerCase().includes('template')).sort()) fuentes.push(`docs/adr/${f}`);
  for (const f of fs.readdirSync(techDir).filter((f) => f.endsWith('.md') && !f.toLowerCase().includes('template')).sort()) fuentes.push(`docs/technical/${f}`);

  const chunks = [];
  for (const rel of fuentes) {
    const abs = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const texto = fs.readFileSync(abs, 'utf8');
    // Dividir por secciones (## / ###) para chunks temáticos con fuente clara
    const secciones = texto.split(/\n(?=#{1,3} )/);
    for (const sec of secciones) {
      const titulo = (sec.match(/^#{1,3} (.+)$/m) || [null, rel])[1];
      if (sec.trim().length < 60) continue; // saltar fragmentos vacíos
      chunks.push({ fuente: rel, titulo: titulo.trim(), texto: sec.trim().slice(0, 6000) });
    }
  }
  return chunks;
}

// Contexto base SIEMPRE presente: la visión general del README. Garantiza que
// preguntas generales ("qué es", "qué tecnologías usa", "cómo funciona") tengan
// respuesta aunque el TF-IDF no encuentre coincidencia literal (sinónimos,
// plural/singular, tildes). El system prompt sigue siendo el guardarraíl de
// honestidad: si la respuesta no está ni aquí ni en los chunks, el LLM remite a Jorge.
function leerContextoBase() {
  const abs = path.join(REPO_ROOT, 'README.md');
  if (!fs.existsSync(abs)) return '';
  return fs.readFileSync(abs, 'utf8').slice(0, 8000);
}

// ------------------------------------------------------------ TF-IDF simple

function tokenizar(texto) {
  return texto.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes: "tecnologías" == "tecnologias"
    .replace(/[^a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

const STOPWORDS = new Set(`
  para por con los las el la un una que como del al se su sus en de y o a
  este esta estos estas eso esa su donde cuando cual cuales sobre entre
  desde hasta tienen tienen hacer hace fue ser está estan fueron eran
`.trim().split(/\s+/));

function construirIndice(chunks) {
  // idf por término
  const df = new Map();
  for (const c of chunks) {
    const tokens = new Set(tokenizar(c.texto));
    for (const t of tokens) df.set(t, (df.get(t) || 0) + 1);
  }
  const N = chunks.length;
  const idf = new Map();
  for (const [t, d] of df) idf.set(t, Math.log(1 + N / d));

  // vector tf-idf por chunk
  const vectores = chunks.map((c) => {
    const tf = new Map();
    for (const t of tokenizar(c.texto)) tf.set(t, (tf.get(t) || 0) + 1);
    const vec = new Map();
    for (const [t, n] of tf) vec.set(t, n * (idf.get(t) || 0));
    return vec;
  });
  return { chunks, vectores };
}

function similitud(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (const [t, v] of a) { dot += v * (b.get(t) || 0); na += v * v; }
  for (const v of b.values()) nb += v * v;
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function buscar(indice, pregunta, top = 6) {
  const qVec = new Map();
  for (const t of tokenizar(pregunta)) qVec.set(t, (qVec.get(t) || 0) + 1);
  const scored = indice.vectores
    .map((vec, i) => ({ i, score: similitud(qVec, vec) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, top);
  return scored.map(({ i, score }) => ({ ...indice.chunks[i], score }));
}

// ------------------------------------------------------------ complejidad

// Detectar preguntas que requieren razonamiento multi-paso o comparación.
function esCompleja(pregunta) {
  const q = pregunta.toLowerCase();
  const senales = [
    'compara', 'diferencia', 'por qué no', 'por que no', 'alternativas',
    'tradeoff', 'desventaja', 'ventaja', 'decidiste', 'elegiste', 'descartaste',
    'cómo resolverías', 'cómo harías', 'mejoraría', 'cambiarías', 'evolucionaría',
    'arquitectura', 'diseño', 'escalabilidad', 'seguridad', 'multi-tenant',
  ];
  return senales.some((s) => q.includes(s));

// ------------------------------------------------------------ saludos y respuestas naturales

function detectarSaludo(pregunta) {
  const texto = pregunta.trim().toLowerCase();
  const saludos = ['hola', 'buenas', 'buenos días', 'buenas tardes', 'buenas noches', 'qué tal', 'que tal', 'hello', 'hi'];
  const esSaludo = saludos.some(s => texto === s || texto.startsWith(s + ' ') || texto.endsWith(' ' + s));
  
  if (esSaludo) {
    return '¡Hola! Soy el asistente técnico de KAVANA Route AI, una plataforma de gestión de repartos de última milla. Puedes preguntarme sobre:\n\n' +
      '• **Qué es y para qué sirve** el proyecto (arquitectura, stack, problemas que resuelve)\n' +
      '• **Cómo funciona** la asignación de rutas, el seguimiento de repartidores, la gestión de incidencias y el panel de control\n' +
      '• **Decisiones técnicas** documentadas en ADRs (por qué Node.js, arquitectura modular, etc.)\n' +
      '• **Cómo desplegarlo** o ejecutarlo en local (Docker, variables de entorno, CI/CD)\n' +
      '• **Detalles de dominio** (repartidores, paradas, pedidos, incidencias, reportes)\n\n' +
      '¿Sobre qué te gustaría saber más?';
  }
  return null;
}

function generarRespuestaSinResultados(pregunta) {
  const texto = pregunta.toLowerCase();
  
  // Sugerencias según tipo de pregunta
  if (texto.includes('precio') || texto.includes('coste') || texto.includes('licencia') || texto.includes('vender')) {
    return 'Esa información no está en la documentación técnica del proyecto. KAVANA Route AI es un proyecto de portfolio/demo abierto (MIT), no un producto comercial con precios publicados.\n\n' +
      'Puedo contarte sobre la arquitectura, el stack, cómo funciona el sistema de reparto, o cómo desplegarlo tú mismo. ¿Te interesa algún aspecto técnico?';
  }
  
  if (texto.includes('jorge') || texto.includes('creador') || texto.includes('autor') || texto.includes('contacto')) {
    return 'Jorge Adán es el arquitecto y creador de KAVANA Route AI. Las decisiones de arquitectura, producto y dominio son suyas; la IA actuó como copiloto de implementación.\n\n' +
      'Si quieres contactar con él, su perfil está en el README del proyecto. Mientras tanto, puedo explicarte cualquier aspecto técnico del sistema de reparto de última milla. ¿Por dónde empezamos?';
  }
  
  // Respuesta genérica con sugerencias basadas en lo que SÍ hay en docs
  return 'Perdón, no tengo esa información específica en la documentación del proyecto. Pero como conozco bien KAVANA Route AI, te sugiero estas preguntas que sí puedo responder con detalle:\n\n' +
    '• "¿Cómo funciona el algoritmo de asignación de rutas y la reoptimización en tiempo real?"\n' +
    '• "¿Por qué usar una arquitectura modular con Node.js y Express en lugar de un monolito?"\n' +
    '• "¿Cómo se manejan las incidencias y el seguimiento de repartidores en la Torre de Control?"\n' +
    '• "¿Qué stack usa el frontend para el repartidor y la oficina?"\n' +
    '• "¿Cómo se modelan paradas, pedidos y repartidores en la base de datos?"\n' +
    '• "¿Cómo desplegar en local con Docker Compose o en producción con Fly.io?"\n\n' +
    '¿Te gustaría que profundice en alguno de estos temas o tienes otra pregunta?';
}

// ------------------------------------------------------------ LLM (OpenRouter)

}

// ------------------------------------------------------------ LLM (OpenRouter)

// Base URL del proveedor (OpenRouter por defecto; DeepSeek: https://api.deepseek.com/v1)
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1';

async function llamarOpenRouter(apiKey, model, systemPrompt, userPrompt) {
  const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://routeai.kavanasystems.com',
      'X-Title': 'KAVANA Route AI Assistant',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 900,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// ------------------------------------------------------------ respuesta

export async function responderPregunta(apiKey, pregunta) {
  if (!apiKey) throw new Error('API key de LLM no configurada (DEEPSEEK_API_KEY u OPENROUTER_API_KEY)');

  // Detectar saludos simples para responder de forma natural sin LLM
  const saludo = detectarSaludo(pregunta);
  if (saludo) {
    return {
      respuesta: saludo,
      fuentes: [],
      modelo: null,
    };
  }

  const indice = getIndice();
  const docs = buscar(indice, pregunta);

  const contextoBase = leerContextoBase();
  // Solo se renuncia sin llamar al LLM si no hay NADA que ofrecer (ni README ni chunks).
  if (!contextoBase && docs.length === 0) {
    return {
      respuesta: generarRespuestaSinResultados(pregunta),
      fuentes: [],
      modelo: null,
    };
  }

  // Contexto: README completo (base, siempre) + chunks TF-IDF relevantes (sin duplicar README).
  const partes = [];
  if (contextoBase) partes.push(`[FUENTE: README.md — Visión general del proyecto]\n${contextoBase}`);
  for (const d of docs) {
    if (d.fuente === 'README.md') continue;
    partes.push(`[FUENTE: ${d.fuente} — ${d.titulo}]\n${d.texto}`);
  }
  const contexto = partes.join('\n\n---\n\n');

  const systemPrompt = [
    'Eres el asistente técnico de KAVANA Route AI, una plataforma de gestión de repartos de última milla.',
    'Tu objetivo es ayudar a usuarios (reclutadores, clientes, operarios) a entender el proyecto de forma clara y útil.',
    'Reglas:',
    '- Responde en español, claro y directo, como explicaría el desarrollador el proyecto.',
    '- Si el contexto contiene información relevante, úsala para responder con tus palabras y apóyate en los datos.',
    '- Si el contexto NO contiene información específica sobre la pregunta, pero puedes inferir algo razonable del contexto general del proyecto, hazlo y sé transparente sobre los límites.',
    '- Si realmente no tienes nada que decir basado en lo que conoces del proyecto, di: "Perdón, no tengo esa información en la documentación del proyecto. Pero puedo ayudarte con otras preguntas sobre cómo funciona KAVANA Route AI, su arquitectura, o cómo desplegarlo. ¿Te gustaría que intente con otra pregunta?"',
    '- NUNCA inventes datos, métricas, nombres de archivos o decisiones que no estén en el contexto o que no puedan inferirse razonablemente.',
    '- Siempre termina tus respuestas útiles con una invitación a hacer más preguntas: "¿Te gustaría saber más sobre algún aspecto específico?"',
    '- Solo añade la línea "Ver: [fuente1, fuente2]" al final cuando hayas respondido usando el contexto directamente. Si inferiste o no usaste contexto, no añadas fuentes.',
  ].join('\n');

  const userPrompt = [
    `PREGUNTA DEL RECLUTADOR:\n${pregunta}\n`,
    `CONTEXTO (documentación del proyecto):\n${contexto}`,
  ].join('\n\n');

  const compleja = esCompleja(pregunta);
  const model = compleja ? MODELO_PRO : MODELO_FREE;

  let respuesta;
  try {
    respuesta = await llamarOpenRouter(apiKey, model, systemPrompt, userPrompt);
  } catch (err) {
    // Si el modelo gratuito falla (límite de rate), reintentar con el de pago
    if (!compleja) {
      try {
        respuesta = await llamarOpenRouter(apiKey, MODELO_PRO, systemPrompt, userPrompt);
      } catch (err2) {
        throw new Error(`Fallo al llamar a OpenRouter: ${err2.message}`);
      }
    } else {
      throw err;
    }
  }

  return {
    respuesta,
    fuentes: [...new Set([...(contextoBase ? ['README.md'] : []), ...docs.map((d) => d.fuente)])],
    modelo: model,
  };
}

// ------------------------------------------------------------ singleton

let _indice = null;
function getIndice() {
  if (!_indice) _indice = construirIndice(cargarCorpus());
  return _indice;
}

export function estadisticasCorpus() {
  const idx = getIndice();
  return { chunks: idx.chunks.length, fuentes: new Set(idx.chunks.map((c) => c.fuente)).size };
}
