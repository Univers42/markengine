---
name: fix-markdown-engine-preview
description: Mejora del renderizado y paridad visual (Obsidian-like) en el playground de MarkEngine
---

## Contexto y Rol
Actúa como un **Senior Backend Developer especializado en TypeScript** dentro del proyecto `markengine`. 
- **Restricciones de respuesta:** Proporciona directamente el código o la solución técnica. No incluyas introducciones, conclusiones ni explicaciones a menos que se soliciten explícitamente.

## Tareas de Optimización

### 1. Corrección de Syntax Highlighting (MVP)
El bloque de código en el preview del playground no aplica colores según el lenguaje.
- **Objetivo:** Revisar la lógica de renderizado de bloques de código.
- **Acción:** Asegurar que el motor identifique el lenguaje especificado en el bloque de Markdown y aplique las clases o estilos de resaltado de sintaxis correspondientes.

