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

### 2. Renderizado de Tablas
Las tablas se renderizan sin bordes ni estilos, lo que dificulta su lectura.
- **Objetivo:** Implementar estilos CSS para mejorar la legibilidad de las tablas.
- **Acción:** Añadir estilos que incluyan bordes, espaciado y un diseño más claro para las tablas renderizadas en el preview.

### 3. Uso de libraría de Emojis 
Se ha añadido una libraría de emojis que debe ser utilizada para renderizar emojis correctamente en el preview del playground.
- **Objetivo:** Implementar la nueva librería soporte para emojis para sustituir el renderizado actual con el mapa de emojis.
- **Acción:** Integrar una libraría de emojis que permita la representación correcta de emojis en el preview del playground.
