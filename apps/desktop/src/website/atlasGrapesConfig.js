export function buildGrapesConfig(container) {
  return {
    container,
    height: '100%',
    width: 'auto',
    fromElement: false,
    storageManager: false,

    canvas: {
      styles: ['https://cdn.tailwindcss.com'],
    },

    deviceManager: {
      devices: [
        { name: 'Desktop', width: '' },
        { name: 'Tablet', width: '768px', widthMedia: '768px' },
        { name: 'Mobile', width: '375px', widthMedia: '375px' },
      ],
    },

    styleManager: {
      sectors: [
        {
          name: 'Dimension',
          open: false,
          properties: ['width', 'height', 'max-width', 'min-height', 'margin', 'padding'],
        },
        {
          name: 'Tipografia',
          open: false,
          properties: ['font-family', 'font-size', 'font-weight', 'color', 'line-height', 'text-align', 'letter-spacing'],
        },
        {
          name: 'Fondo',
          open: false,
          properties: ['background-color', 'background', 'opacity'],
        },
        {
          name: 'Bordes',
          open: false,
          properties: ['border-radius', 'border', 'box-shadow'],
        },
      ],
    },

    blockManager: {
      blocks: [
        {
          id: 'hero',
          label: 'Hero',
          category: 'Secciones',
          content: `<section class="min-h-screen flex items-center justify-center bg-indigo-700 text-white px-6"><div class="max-w-3xl mx-auto text-center py-24"><h1 class="text-5xl font-bold mb-6 leading-tight">Tu titulo principal</h1><p class="text-xl text-indigo-100 mb-10">Agrega una descripcion breve de tu propuesta de valor.</p><a href="#" class="inline-block bg-white text-indigo-700 font-semibold px-8 py-3 rounded-lg hover:bg-indigo-50 transition-colors">Comenzar ahora</a></div></section>`,
        },
        {
          id: 'section',
          label: 'Seccion',
          category: 'Secciones',
          content: `<section class="py-16 px-6 bg-white"><div class="max-w-5xl mx-auto"><p class="text-gray-600">Contenido de la seccion</p></div></section>`,
        },
        {
          id: 'cta',
          label: 'Llamada a accion',
          category: 'Secciones',
          content: `<section class="bg-indigo-600 py-16 px-6 text-white text-center"><div class="max-w-2xl mx-auto"><h2 class="text-3xl font-bold mb-4">Listo para empezar?</h2><p class="text-indigo-100 mb-8">Unete a miles de usuarios que ya confian en nosotros.</p><a href="#" class="inline-block bg-white text-indigo-700 font-semibold px-8 py-3 rounded-lg">Solicitar demo</a></div></section>`,
        },
        {
          id: 'features',
          label: 'Caracteristicas',
          category: 'Secciones',
          content: `<section class="py-20 px-6 bg-gray-50"><div class="max-w-5xl mx-auto"><h2 class="text-3xl font-bold text-center text-gray-900 mb-12">Por que elegirnos?</h2><div class="grid grid-cols-1 md:grid-cols-3 gap-8"><div class="bg-white p-6 rounded-xl shadow-sm"><div class="text-indigo-600 text-2xl mb-4">&#10003;</div><h3 class="font-semibold text-lg mb-2">Caracteristica uno</h3><p class="text-gray-500 text-sm">Descripcion breve.</p></div><div class="bg-white p-6 rounded-xl shadow-sm"><div class="text-indigo-600 text-2xl mb-4">&#10003;</div><h3 class="font-semibold text-lg mb-2">Caracteristica dos</h3><p class="text-gray-500 text-sm">Descripcion breve.</p></div><div class="bg-white p-6 rounded-xl shadow-sm"><div class="text-indigo-600 text-2xl mb-4">&#10003;</div><h3 class="font-semibold text-lg mb-2">Caracteristica tres</h3><p class="text-gray-500 text-sm">Descripcion breve.</p></div></div></div></section>`,
        },
        {
          id: 'faq',
          label: 'Preguntas frecuentes',
          category: 'Secciones',
          content: `<section class="py-20 px-6 bg-white"><div class="max-w-2xl mx-auto"><h2 class="text-3xl font-bold text-center text-gray-900 mb-12">Preguntas frecuentes</h2><div class="divide-y divide-gray-200"><div class="py-5"><h3 class="font-semibold text-gray-900 mb-2">Pregunta uno</h3><p class="text-gray-500 text-sm">Respuesta a la pregunta uno.</p></div><div class="py-5"><h3 class="font-semibold text-gray-900 mb-2">Pregunta dos</h3><p class="text-gray-500 text-sm">Respuesta a la pregunta dos.</p></div><div class="py-5"><h3 class="font-semibold text-gray-900 mb-2">Pregunta tres</h3><p class="text-gray-500 text-sm">Respuesta a la pregunta tres.</p></div></div></div></section>`,
        },
        {
          id: 'two-columns',
          label: '2 Columnas',
          category: 'Estructura',
          content: `<div class="py-12 px-6"><div class="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8"><div class="p-6 bg-gray-50 rounded-lg"><h3 class="font-semibold text-lg mb-2">Columna izquierda</h3><p class="text-gray-500 text-sm">Contenido.</p></div><div class="p-6 bg-gray-50 rounded-lg"><h3 class="font-semibold text-lg mb-2">Columna derecha</h3><p class="text-gray-500 text-sm">Contenido.</p></div></div></div>`,
        },
        {
          id: 'three-columns',
          label: '3 Columnas',
          category: 'Estructura',
          content: `<div class="py-12 px-6"><div class="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6"><div class="p-5 bg-gray-50 rounded-lg"><h3 class="font-semibold mb-2">Columna 1</h3><p class="text-gray-500 text-sm">Contenido.</p></div><div class="p-5 bg-gray-50 rounded-lg"><h3 class="font-semibold mb-2">Columna 2</h3><p class="text-gray-500 text-sm">Contenido.</p></div><div class="p-5 bg-gray-50 rounded-lg"><h3 class="font-semibold mb-2">Columna 3</h3><p class="text-gray-500 text-sm">Contenido.</p></div></div></div>`,
        },
        {
          id: 'heading',
          label: 'Titulo',
          category: 'Texto',
          content: '<h2 class="text-4xl font-bold text-gray-900 text-center py-8 px-6">Tu titulo aqui</h2>',
        },
        {
          id: 'text',
          label: 'Parrafo',
          category: 'Texto',
          content: '<p class="text-gray-600 text-base leading-relaxed py-4 px-6 max-w-3xl mx-auto">Escribe tu contenido aqui. Este es un bloque de texto editable.</p>',
        },
        {
          id: 'image',
          label: 'Imagen',
          category: 'Media',
          content: '<img src="https://placehold.co/1200x400?text=Imagen" alt="Imagen" class="w-full rounded-xl object-cover" />',
        },
      ],
    },
  }
}
