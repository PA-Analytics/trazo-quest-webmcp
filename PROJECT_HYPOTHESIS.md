# Hipótesis del proyecto: acompañante de implementación gamificado

## 1. Resumen

El proyecto busca convertir cursos y programas educativos orientados a resultados en experiencias visuales de progresión.

El producto transforma la metodología del creador en un árbol visual de habilidades, misiones principales y secundarias, dependencias, caminos desbloqueables, entregables verificables, feedback inicial asistido por IA, barras de progreso, rangos, recompensas, momentos de intervención humana y un panel de avances y bloqueos para el creador.

La inspiración de experiencia es un sistema como FTB Quests: el usuario ve el mapa completo, entiende dónde está, completa una misión y desbloquea la siguiente parte del recorrido. La IA funciona detrás del producto, pero no constituye por sí sola la propuesta de valor.

> [!NOTE]
> **Evolución del producto:** A partir del commit `fb07257a7401d8a4b3e5f6050e507c048a73c66f`, TRAZO formalizó dos líneas sobre el mismo núcleo de progresión:
> * **TRAZO Programs:** Metodología de coach $\rightarrow$ Ruta ejecutable.
> * **TRAZO Quest:** Intención de alumno + Agente externo (WebMCP) $\rightarrow$ Ruta ejecutable.
> Documentación canónica de Quest en [docs/quest/QUEST_THESIS.md](docs/quest/QUEST_THESIS.md).

## 2. Hipótesis central

Los creadores que venden cursos, cohortes, membresías o programas de acompañamiento con resultados concretos tienen dificultad para conseguir que sus alumnos implementen el contenido de manera constante.

**Hipótesis del creador:** los creadores pagarán por transformar su contenido y metodología en un skill tree personalizado si la experiencia consigue que más alumnos produzcan entregables reales, hace visible su progreso y permite que el creador intervenga únicamente donde su atención genera mayor valor.

**Hipótesis del alumno:** los alumnos utilizarán con mayor constancia un recorrido visual de misiones y desbloqueos que una biblioteca tradicional o un chatbot, porque pueden ver dónde están, qué deben hacer ahora, qué han conseguido y qué desbloquearán después.

Ambas hipótesis están sin validar.

## 3. Problema

### Problemas del alumno

- Consume contenido, pero no sabe qué hacer después.
- Se abruma ante demasiadas clases o recursos.
- Pierde la motivación inicial.
- No puede visualizar el camino completo.
- No recibe feedback suficientemente rápido.
- No sabe si aplicó correctamente lo aprendido.
- No percibe claramente su progreso.
- Abandona antes de llegar al resultado prometido.

### Problemas del creador

- No sabe con precisión quién está implementando.
- Persigue alumnos manualmente.
- Responde preguntas repetitivas.
- Revisa demasiadas entregas sencillas.
- Descubre demasiado tarde quién está bloqueado.
- Tiene contenido valioso presentado como una biblioteca monótona.
- Le cuesta escalar el acompañamiento sin perder cercanía.
- No puede distinguir fácilmente entre alumnos activos, detenidos y en riesgo.

## 4. Cliente y usuario

**Comprador:** creador, coach, consultor o academia con un programa de pago, transformación clara y observable, tareas o entregables frecuentes, involucramiento personal, cohorte/membresía/acompañamiento recurrente, equipo tecnológico pequeño, capacidad de pagar configuración inicial y mensualidad, e interés en mejorar implementación, experiencia y visibilidad.

**Usuario:** alumno del programa. No necesariamente compra el producto por separado; accede como parte de la experiencia del creador.

## 5. Nichos iniciales por validar

### A. Creación de contenido y marca personal

Entregables posibles: definición de nicho, posicionamiento, propuesta de valor, bio o perfil, ideas, hooks, guiones, videos, publicaciones, calendario, análisis de métricas e iteraciones sobre contenido publicado.

Transformación: pasar de no tener un sistema de contenido a publicar piezas estratégicas de manera constante.

### B. Primer cliente digital

Entregables posibles: elección de habilidad, mercado, oferta, proyecto de muestra, portafolio, caso de estudio, prospectos, mensajes y seguimientos, llamadas, propuesta comercial y primer pago.

Transformación: pasar de tener una habilidad sin monetizar a conseguir el primer cliente digital.

No se deben construir dos productos. Se crearán dos prototipos comparables y se continuará con el nicho cuyo creador ofrezca el compromiso más fuerte.

## 6. Propuesta de valor

- **Versión corta:** Convertimos tu curso en un skill tree de implementación.
- **Para el creador:** Transformamos tu contenido en misiones, entregables y progreso visible para que tus alumnos apliquen tu método y tú sepas exactamente dónde intervenir.
- **Para el alumno:** Convierte tu aprendizaje en un mapa de habilidades: completa misiones, entrega trabajo real y desbloquea tu siguiente paso.
- **Tesis interna:** GPT puede generar misiones. Nosotros convertimos esas misiones en un mundo que el alumno quiere recorrer y que el creador puede gestionar.

## 7. Diferenciación frente a ChatGPT o Claude

Un modelo generalista responde preguntas, genera tareas y planes, revisa textos, da feedback y explica contenidos. El producto debe aportar mapa visual, estado persistente, dependencias, ramas bloqueadas/disponibles, secuencia de misiones, evidencias estructuradas, historial de correcciones, progreso acumulado, recompensas, panel agregado, alertas de bloqueo, coordinación entre alumno/IA/humano y experiencia personalizada con la marca y metodología del creador.

La ventaja no dependerá de un modelo concreto: GPT, Claude, Gemini u otros serán componentes intercambiables.

## 8. Experiencia del alumno

El alumno ve su objetivo, árbol de habilidades, ramas bloqueadas/disponibles/completadas, misión actual, esfuerzo estimado, evidencia requerida, progreso, rango, próxima recompensa y siguiente nodo desbloqueable.

**Loop principal:** misión → evidencia → feedback → corrección → progreso visible → desbloqueo → reconocimiento → siguiente misión.

Estados de un nodo: bloqueado, disponible, en progreso, pendiente de revisión, completado y dominado.

## 9. Experiencia del creador

Debe poder ver quién comenzó, entregó y regresó; quién lleva varios días detenido; qué entregas requieren revisión humana; errores repetidos; misiones que provocan abandono; alumnos cerca de un hito; quién necesita intervención y cuánto tiempo está ahorrando o invirtiendo.

El sistema disminuye el ruido para que el creador se concentre en decisiones importantes, feedback complejo, reconocimiento, bloqueos emocionales o estratégicos, hitos relevantes y sesiones grupales. No debe reemplazar al creador.

## 10. Personalización por creador

Cada implementación parte del curso real del creador. Puede incluir videos, textos, módulos, plantillas, ejercicios, metodología, lenguaje, tono, resultados esperados, criterios de calidad, contenido público, recompensas y momentos de intervención humana.

La transformación produce: skill tree, capítulos, ramas, dependencias, misiones principales/secundarias, boss fights o hitos, evidencias, rúbricas, recompensas, condiciones de desbloqueo y alertas para el creador.

## 11. Misiones que también benefician al creador

Las misiones pueden dirigir alumnos hacia videos, publicaciones o recursos del creador cuando exista beneficio educativo auténtico.

Ejemplo correcto: ver un video, identificar el hook utilizado y comentar qué principio de la metodología aparece.

Ejemplo incorrecto: comentar cualquier cosa para recibir puntos.

Toda acción que aumente la actividad del creador también debe enseñar, practicar o demostrar una habilidad. No se debe fabricar engagement vacío.

## 12. Gamificación

La gamificación amplifica la progresión, no la sustituye. Puede otorgarse progreso por entregar tareas, corregir versiones, aplicar feedback, terminar proyectos, publicar piezas, ejecutar acciones comerciales, demostrar habilidades, conseguir resultados intermedios o ayudar útilmente a otro alumno.

No deben ser el centro: abrir la aplicación, ver videos sin aplicar, comentarios vacíos, permanecer conectado o repetir tareas irrelevantes.

Recompensas posibles: desbloquear ramas, plantillas, feedback prioritario, revisión del creador, sesiones especiales, grupo avanzado, certificados, reconocimiento comunitario, contenido premium y descuentos únicamente tras comprobar que mejoran la renovación rentable.

La permanencia debe provenir de progreso útil acumulado, no del miedo a perder puntos.

## 13. Papel de la IA

### Funciones apropiadas

- Analizar contenido del creador.
- Proponer misiones y dependencias.
- Personalizar dificultad.
- Generar feedback preliminar y revisar entregas sencillas.
- Detectar patrones y resumir progreso.
- Recomendar la siguiente rama.
- Preparar intervenciones humanas.
- Detectar posibles alumnos bloqueados.

### Límites

No sustituir decisiones humanas sensibles, aprobar automáticamente evidencia ambigua, controlar descuentos monetarios sin reglas deterministas, representar la metodología sin validación ni convertirse en la única razón de compra.

## 14. Modelo operativo inicial

El proyecto comienza como servicio productizado combinado con software.

Trabajo inicial: diagnosticar el programa, entender la transformación, identificar entregables, diseñar skill tree, crear misiones y rúbricas, configurar recompensas, construir experiencia visual, ejecutar piloto, observar alumnos y ajustar.

Evolución: **Etapa 1, concierge:** producción manual; **Etapa 2, producción asistida:** IA propone y humanos editan; **Etapa 3, herramientas internas:** plantillas, bibliotecas y editor; **Etapa 4, self-service parcial:** el creador configura partes. No construir self-service completo antes de descubrir qué se repite.

## 15. Modelo de negocio hipotético

**Configuración:** análisis del curso, árbol, misiones, rúbricas, personalización visual, instalación y piloto.

**Mensualidad:** alumnos activos, IA, hosting, panel, seguimiento, soporte, nuevas misiones, analítica y white-label.

Precios aún no validados.

## 16. Plataforma e integración

La experiencia debe sentirse integrada dentro del curso. WhatsApp puede ser canal de notificaciones, no interfaz central.

Skool no parece adecuado inicialmente para integración profunda por sus limitaciones en embeds, HTML/JavaScript, API pública, SSO y acceso programático al progreso.

Hipótesis técnicas: GoHighLevel; WordPress con LearnDash, Tutor LMS o LifterLMS; Circle o Teachable después de probar embeds, identidad y móvil. No construir integración multi-plataforma desde el inicio.

## 17. Riesgos principales

1. Alumnos ignoran el sistema como ignoran el curso.
2. La progresión visual solo genera novedad.
3. El problema es motivación y no experiencia.
4. Exceso de producción personalizada.
5. El negocio se convierte en agencia.
6. Evaluaciones deficientes de IA.
7. Revisión manual excesiva del creador.
8. Actividad superficial por gamificación.
9. Copia por plataformas existentes.
10. Sustitución del feedback básico por modelos generalistas.
11. Costos multimodales dañan el margen.
12. Instalación difícil.
13. Automatización reduce percepción de acompañamiento.
14. Alumnos no quieren otra superficie.
15. El creador valora pero no paga.
16. Menor disposición de pago en mercado hispanohablante.
17. El producto es una función y no una empresa.

## 18. Hipótesis falsificables

- **H1 Dolor del creador:** se debilita si reconoce el problema pero no entrega contenido, alumnos, tiempo ni dinero.
- **H2 Valor visual:** se debilita si elogian el diseño pero no completan misiones.
- **H3 Uso repetido:** se debilita si desaparecen durante la segunda semana.
- **H4 Evidencia real:** se debilita si solo aumentan vistas, clics, comentarios o puntos.
- **H5 Intervención selectiva:** se debilita si el creador debe revisar o perseguir a casi todos.
- **H6 Configuración escalable:** se debilita si cada cliente exige reconstruir todo.
- **H7 Confianza:** se debilita si exige revisión humana para casi todas las entregas.
- **H8 Integración:** se debilita si requiere soporte constante, falla en móvil o exige múltiples accesos.
- **H9 Pago:** se debilita si hay entusiasmo verbal pero nadie paga después del piloto.

## 19. MVP

### Alcance

Un creador, un módulo, un capítulo del skill tree, 5–8 misiones, cohorte pequeña, operación manual/semi-manual, un nicho, una plataforma y periodo corto.

### Funciones necesarias

Skill tree visual, misión actual, entrega de evidencia, feedback inicial, barra de progreso, nodo desbloqueable, una recompensa, historial básico, panel simple del creador y marcación de alumno bloqueado.

### Fuera de alcance

Aplicación móvil nativa, marketplace, multi-LMS, integración universal, pagos avanzados, descuentos automáticos, mentor autónomo completo, editor self-service terminado, analítica predictiva avanzada y constructor universal de cursos.

## 20. Métricas del piloto

**Alumno:** inicios, primera misión, evidencia real, regreso en segunda semana, misiones completadas, correcciones, abandonos y utilidad atribuida al mapa.

**Creador:** tiempo de configuración, revisión semanal, entregas que requieren intervención, preguntas repetidas, bloqueos detectados, carga percibida, deseo de repetir y disposición de pago.

**Producto:** producción por módulo, misiones reutilizables, costo de IA, errores de evaluación, instalación, uso móvil y fricción de acceso.

## 21. Criterios de decisión

### Continuar

Creador entrega contenido real, autoriza prueba con alumnos, los alumnos entregan trabajo, existe uso repetido, la carga no es excesiva, desea repetir, hay condición comercial concreta y parte de la producción es reutilizable.

### Modificar

Los alumnos avanzan solo con contacto humano; el panel aporta más valor que la experiencia; la organización importa más que la gamificación; la personalización domina el costo; o funciona mejor como copiloto de coaches/community managers.

### Abandonar

No regresan ni con acompañamiento, no hay entregables reales, la mayoría de evaluaciones requiere revisión humana, el creador siente más carga, cada curso exige reconstrucción total, la integración es frágil, nadie entrega contenido/alumnos/dinero o solo genera entusiasmo visual.

## 22. Próximo experimento

Crear dos prototipos visuales equivalentes:

- **Prototipo A:** “Publica tus primeras piezas estratégicas”.
- **Prototipo B:** “Consigue tu primer cliente digital”.

Cada uno debe incluir mapa de habilidades, tres ramas, misiones bloqueadas y disponibles, una misión abierta, un entregable, una recompensa, un boss fight y una vista simple del creador.

El criterio no será cuál recibe más elogios, sino cuál consigue que un creador entregue un módulo real, seleccione alumnos y fije fecha de prueba.

## 23. Regla estratégica

No construir la plataforma completa antes de conseguir un design partner.

Orden: propuesta → prototipo → conversaciones → compromiso del creador → acceso a contenido → piloto → evidencia de comportamiento → pago → construcción progresiva.

## 24. Estado actual

- Problema: identificado, no validado comercialmente.
- Propuesta de valor: definida provisionalmente.
- Diferenciación visual: definida.
- Nichos: dos candidatos.
- Cliente: perfil provisional.
- Plataforma: sin elegir.
- Design partner: pendiente.
- MVP: delimitado conceptualmente.
- Precio: sin validar.
- Producto funcional: no construido.
- Próximo objetivo: conseguir que un creador quiera ver su curso convertido en un skill tree.
