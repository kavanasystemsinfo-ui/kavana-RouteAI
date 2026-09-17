# ADR-008: Modelo gratuito para el asistente y coste cero como decisión explícita

**Estado:** ✅ Implementado · **Fecha:** 2026-09-17 · **Relacionado:** [ADR-006](006-reemplazo-ia-por-2opt.md) (se retiró la IA de la optimización de rutas), [ADR-007](007-blindaje-demo.md) (blindaje de la demo)

## Contexto

KAVANA Route AI es una demo de portafolio con **un solo usuario real: su autor**. Este proyecto ya tomó antes una decisión en la misma dirección que este ADR: en el ADR-006 se **retiró la IA** de la optimización de rutas porque un algoritmo 2-opt local era mejor, determinista, instantáneo y gratis.

Queda un solo uso de IA en el proyecto: el **asistente técnico** (`server/src/services/assistantService.js`), que responde preguntas sobre la documentación del repositorio con recuperación **TF-IDF en memoria** (sin embeddings ni base vectorial) y un modelo de lenguaje solo para redactar. Ese modelo es una variante gratuita de OpenRouter por defecto en el código, y el proyecto tiene además un modelo "pro" configurable por variable de entorno para preguntas complejas.

## Decisión

1. El asistente usa la **variante gratuita** `nvidia/nemotron-3-super-120b-a12b:free` por defecto, con `LLM_BASE_URL` apuntando a OpenRouter. Ambos valores son configurables (`ASSISTANT_MODEL_FREE`, `ASSISTANT_MODEL_PRO`, `LLM_BASE_URL`) y el código se comporta igual sin ninguna variable definida.
2. **No se paga por IA en este proyecto.** La optimización es determinista (2-opt, ADR-006), la geocodificación usa Nominatim y fallbacks gratuitos (ADR-002) y el asistente usa el modelo gratuito.
3. Se documenta el encuadre «hoy / con presupuesto» en el README, junto a las demás decisiones.

## Alternativas evaluadas

| Alternativa | A favor | En contra | Veredicto |
|---|---|---|---|
| Modelo de pago para el asistente | Respuestas algo mejores en preguntas complejas | Coste por pregunta y latencia mayor en una demo personal; innecesario para responder sobre la documentación del repo | Descartado; es la elección con usuarios reales |
| IA para la optimización de rutas | Conocimiento geográfico semántico | Lento, caro e impredecible; no mejoraba las rutas | Ya descartado en ADR-006 a favor del 2-opt |
| Modelo autoalojado | Coste 0 y datos en el servidor | La máquina de 256 MB del despliegue no puede servirlo | Aplazado; ruta natural si hay datos sensibles |

## Consecuencias

- **Coste de IA del proyecto: 0 €.** La recuperación de contexto también es 0 por diseño (TF-IDF en memoria).
- El asistente solo responde con la documentación del repositorio y dice que no lo sabe cuando la respuesta no está documentada; además tiene un límite de peticiones por IP en memoria (ventana de 24 h) para que un visitante no pueda usarlo como puerta gratis a un modelo.
- **Límites asumidos:** cuota diaria del proveedor gratuito y disponibilidad variable (los `429` del proveedor de origen son posibles); los modelos gratuitos pueden registrar los prompts, así que la demo no debe usarse con datos personales.
- **Aviso de alcance honesto:** la comprobación de este ADR es sobre el código del repositorio y las variables del servicio de Render. El backend de producción vive en Fly.io según el ADR-005, y esa plataforma queda fuera de la revisión de coste hecha aquí.

## Señal de revisión

Se revisa si el proyecto pasa a tener usuarios reales, si entran datos sensibles, si la cuota diaria deja de cubrir el uso o si se quiere subir la calidad de las respuestas del asistente. En los cuatro casos el cambio es de configuración y de plan, no de arquitectura.
