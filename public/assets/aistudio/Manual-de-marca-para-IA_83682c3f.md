# Manual de marca (versión para IA)

Sube este archivo a cualquier IA junto con: "Usa este manual de marca. Nombre: ... Proyecto: ... Formato: ...".

```text
INSTRUCCIONES PARA LA INTELIGENCIA ARTIFICIAL QUE LEA ESTE ARCHIVO
===================================================================
Este archivo es el MANUAL DE MARCA del usuario. Léelo completo antes de diseñar o escribir código.
Aplícalo a CUALQUIER cosa que pida: página web, app móvil (APK), programa de computador, documento o PDF,
presentación, afiche, redes sociales, ícono, trabajo de clase o cualquier otro formato.

CÓMO USARLO
1. Si el usuario no dijo el nombre de la marca, el proyecto y el formato, pregunta las tres cosas en un solo mensaje.
   Ejemplo: "¿Cómo se llama la marca, de qué trata el proyecto y qué formato es (web, app, programa, documento)?"
2. Usa el nombre que el usuario te diga. Si no da uno nuevo, la marca base se llama InvenLote.
   Solo cambia el NOMBRE. Los colores, las fuentes, el cubo, las formas y las reglas se mantienen siempre.
3. Si lo que el usuario pide choca con este manual, gana el manual. Avisa del choque en una línea.
4. Si algo no está en este manual, pregunta antes de inventar un estilo nuevo.
5. Antes de entregar, revisa la lista "ANTES DE ENTREGAR" del final.

CÓMO CAMBIAR EL NOMBRE (el logo base InvenLote está dibujado con trazos fijos; un nombre nuevo se escribe como texto)
- Cubo: el mismo de siempre (viewBox 0 0 259.8 300, caras: arriba, izquierda, derecha; ver LOGO).
- Texto: Poppins Bold (700), espaciado entre letras -2 % (letter-spacing:-0.02em), escrito como UNA sola palabra,
  con la primera letra de cada parte en mayúscula y sin espacios (ejemplo: InvenLote, ArqMovil, StockFacil).
- Dos tonos: la primera parte del nombre en Azul #005198 y la segunda parte en Naranja #F28C1B.
  Parte la palabra donde tenga sentido (InvenLote = Inven + Lote). Si el nombre es corto, la última sílaba va en naranja.
- Proporciones de la versión horizontal (H = altura del cubo): tamaño de letra = 0.54 x H; espacio entre cubo y texto = 0.20 x H;
  el texto queda centrado en altura con el cubo; interlineado 1.
- Proporciones de la versión vertical: el cubo va arriba, centrado; el texto debajo, centrado, con tamaño de letra = 0.375 x H
  y una separación de 0.28 x H entre el cubo y el texto.
- Receta lista en SVG (cambia las dos palabras):
    <svg viewBox="0 0 1083 300" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(0,0)"><polygon fill="#F28C1B" points="0,75 129.9,0 259.8,75 129.9,150"/>
        <polygon fill="#005198" points="0,75 129.9,150 129.9,300 0,225"/>
        <polygon fill="#003A73" points="129.9,150 259.8,75 259.8,225 129.9,300"/></g>
      <text x="320" y="206" font-family="Poppins" font-weight="700" font-size="161" letter-spacing="-3.2">
        <tspan fill="#005198">Nombre1</tspan><tspan fill="#F28C1B">Nombre2</tspan></text></svg>
- En la versión blanca ambas partes van blancas; en la monocromática azul ambas #005198; en la negra ambas #1F2933.

TOKENS (la misma información está en el bloque JSON id="brand-spec" y en el CSS de este archivo)
- Azul InvenLote  #005198  RGB 0,81,152   principal: encabezados, botones secundarios, enlaces
- Azul profundo   #003A73  RGB 0,58,115   barra de estado, barra de título, pies, fondos oscuros, cara derecha del cubo
- Naranja         #F28C1B  RGB 242,140,27 SOLO acento: la acción principal y detalles cortos
- Blanco          #FFFFFF  fondos de tarjetas y campos, texto sobre azul
- Gris claro      #F2F4F7  RGB 242,244,247 fondo de pantallas, páginas y secciones
- Gris oscuro     #1F2933  RGB 31,41,51    texto principal
- Éxito           #2E9E5B  (como texto usar #1E7A44)
- Error           #D64545  (como texto usar #B03030)
- Aviso           texto #8A4B00 sobre fondo #FDEBD3
- Gris suave      #5B6670  notas y texto secundario
- Línea           #E3E7EC  separadores y bordes
- CONTRASTE: blanco sobre naranja da 2.46:1 y NO cumple. Sobre naranja siempre va texto gris oscuro #1F2933 (6.0:1).
  Blanco sobre azul #005198 da 7.98:1 y cumple. El naranja del logo es un acento gráfico; no lo uses para textos pequeños.

TIPOGRAFÍA (Google Fonts, gratuitas)
- Poppins: títulos, logotipo, botones y etiquetas (Bold 700, SemiBold 600, Medium 500).
- Inter: textos, tablas y formularios (Regular 400, Medium 500, Semi Bold 600).
- <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@500;600;700&display=swap" rel="stylesheet">
- Escala:  Título 1 Poppins Bold 48/56 · Título 2 Poppins SemiBold 32/40 · Título 3 Poppins SemiBold 24/32
           Texto Inter Regular 16/24 · Etiqueta Inter Medium 14/20 en MAYÚSCULAS con letra espaciada.
  En app móvil el texto base baja a 14 px y los títulos de pantalla a 20 px.
- Cada título de sección puede llevar arriba una línea naranja corta (40 a 50 px de ancho, 3 px de alto).

LOGO (la marca completa se llama "imagotipo": isotipo + logotipo)
- Isotipo: cubo isométrico de tres rombos iguales con ángulos de 30°. Es el lote (la caja). Cara superior naranja #F28C1B,
  cara izquierda azul #005198, cara derecha azul profundo #003A73.
- SVG exacto del cubo, viewBox="0 0 259.8 300":
    cara superior:  <polygon points="0,75 129.9,0 259.8,75 129.9,150"/>
    cara izquierda: <polygon points="0,75 129.9,150 129.9,300 0,225"/>
    cara derecha:   <polygon points="129.9,150 259.8,75 259.8,225 129.9,300"/>
- Cuatro versiones (se elige la que mejor contraste tenga con el fondo; nunca se inventan combinaciones):
  1. COLOR (principal): cubo naranja/azul/azul profundo y texto en dos tonos. Sobre blanco o gris claro.
  2. BLANCO: tres caras blancas con opacidad 1, 0.8 y 0.6 y texto blanco. Sobre azul o fondos muy oscuros.
  3. MONOCROMÁTICA AZUL: caras #005198 con opacidad 0.55 (arriba), 0.85 (izquierda) y 1 (derecha); texto #005198. Una sola tinta sobre fondos claros.
  4. MONOCROMÁTICA NEGRA: igual con #1F2933. Para fotocopias e impresión en blanco y negro.
- Dos disposiciones: HORIZONTAL (principal: cubo a la izquierda, texto a la derecha, centrados en altura)
  y VERTICAL (secundaria: cubo arriba, texto abajo, centrados).
- Área de seguridad: espacio vacío alrededor del logo igual a x = la mitad de la altura del cubo. Nada puede invadirla.
- Tamaño mínimo: horizontal 160 px de ancho (40 mm impreso); vertical 100 px (25 mm); solo cubo 24 px (8 mm).
- Solo el cubo (sin nombre) sirve para ícono de app, favicon y avatar: 16, 32, 48, 192 y 512 px.
- Los trazos exactos del logo InvenLote (cubo y letras) están dibujados en los bloques <svg> de este archivo,
  con id L-h-color, L-v-color, L-c-color, etc. Cópialos tal cual para InvenLote.

USOS INCORRECTOS DEL LOGO (nunca)
1. Deformarlo (estirarlo o aplastarlo; siempre se escala en proporción).   2. Rotarlo o inclinarlo.
3. Cambiar sus colores (nada de morados, verdes o rojos).   4. Ponerlo sobre un fondo sin contraste (azul sobre azul).
5. Agregarle sombras, brillos, contornos o efectos; va plano.   6. Cambiar el orden o las proporciones (el cubo va a la izquierda y con el tamaño oficial).
7. Separar "Inven" y "Lote", escribirlo con espacio o en minúscula (siempre InvenLote, con I y L mayúsculas).

ÍCONOS (los que se usan en las pantallas de InvenLote; rejilla de 24 x 24)
- Dos estilos que conviven: de LÍNEA (trazo de 2 px, puntas y uniones redondeadas, sin relleno) y DUOTONO (relleno con una parte al 50 % de opacidad).
  Todos toman el color del texto (currentColor): azul, gris oscuro o blanco.
- Los íconos van SUELTOS: sin cuadrito ni círculo de color detrás. Nada de emojis como íconos.
- Tamaños: 16, 20 y 24 px; en móvil 24 px dentro de una zona táctil de 48 px.
- Están en este archivo como <symbol> con id "i-nombre": i-home (inicio), i-box (artículo), i-apilado (lotes), i-stock, i-almacen, i-bodega,
  i-flujo (movimientos), i-entrada, i-salida, i-report (reporte), i-csv (exportar), i-etiqueta, i-ruler (medida), i-watch (ver),
  i-clock (vencimiento), i-alert (aviso), i-bell (notificación), i-search, i-list, i-plus, i-check, i-chev, i-menu.
  Úsalos así: <svg class="ic" width="24" height="24" style="fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><use href="#i-apilado"/></svg>
- Si necesitas un ícono que no está, usa uno de la misma familia (Iconify: line-md, solar, icons8, ic) con el mismo estilo, o dibújalo con estas reglas.

FORMA Y COMPONENTES
- Radio de borde de 5 px en TODO. En cuadros menores de 60 px, 2 px.
- Sombra suave: 0 2px 8px rgba(0,0,0,.08). Espacios en múltiplos de 4 (4, 8, 12, 16, 24, 32).
- Botón principal: naranja #F28C1B, texto gris oscuro, Poppins 600 14 px, alto 40 px (48 px en móvil). UNO por pantalla.
- Botón secundario: azul #005198, texto blanco. Botón de texto: sin fondo, texto azul.
- Campo: fondo blanco, borde 1 px #C9CFD6, radio 5, alto 40 px; foco con aro azul de 2 px. Nunca naranja.
- Tarjeta: blanco, radio 5, sombra suave, relleno 18 a 20 px.
- Estados como TEXTO de color, sin fondo: Entrada/Éxito #1E7A44, Salida/Error #B03030, Por vencer #8A4B00. Nada de píldoras rellenas.
- Tablas: encabezado en mayúsculas Poppins 500 12 px gris suave, filas con línea #E3E7EC, sin cebra.

POR FORMATO
- WEB: barra superior en blanco o azul con el logo; contenido en tarjetas blancas sobre gris claro; un solo botón naranja por pantalla;
  pie azul profundo con el logo blanco. Máximo 1100 a 1200 px de ancho de contenido; margen lateral mínimo de 16 px.
- APP MÓVIL (APK): barra de estado azul profundo, barra de la app azul con el logo blanco o el título, fondo gris claro,
  un solo botón naranja por pantalla (a todo el ancho en formularios) y a lo sumo un botón flotante naranja.
  Menú inferior de MÁXIMO 4 destinos con el activo en azul. Zonas táctiles de 48 px, texto de 14 px, margen lateral de 12 a 16 px.
  Las tablas anchas se vuelven listas de tarjetas.
- PROGRAMA DE ESCRITORIO: barra de título azul profundo, barra lateral azul con el cubo blanco arriba y el menú en blanco,
  contenido sobre gris claro, botones de 32 a 40 px, texto de 13 a 14 px, atajos de teclado visibles en el menú.
- DOCUMENTOS Y PDF: títulos en Poppins azul profundo, texto en Inter gris oscuro de 11 pt, línea naranja corta sobre cada título de sección,
  pie de página con el nombre y el cubo monocromático.
- PRESENTACIONES: portada azul con el logo blanco, diapositivas en blanco o gris claro, un mensaje por diapositiva,
  título en Poppins, máximo 6 líneas de texto, naranja solo para resaltar una cifra o una frase.
- REDES, AFICHES E IMPRESIÓN: fondo azul o blanco, logo en una esquina respetando el área de seguridad, título grande en Poppins,
  texto corto en Inter, capa azul sobre las imágenes que lleven texto.
- ÍCONO DE APP: cubo blanco sobre cuadrado azul #005198 con esquinas redondeadas (22 %), o cubo de color sobre blanco. Sin texto.
- CUALQUIER OTRO SOPORTE: paleta, dos fuentes, radio de 5 px y un solo acento naranja.

CÓDIGO DE REFERENCIA (CSS)
  :root{--azul:#005198;--azul-profundo:#003A73;--naranja:#F28C1B;--gris-claro:#F2F4F7;--gris-oscuro:#1F2933;--blanco:#FFFFFF;
        --exito-txt:#1E7A44;--error-txt:#B03030;--aviso-txt:#8A4B00;--aviso-fondo:#FDEBD3;--suave:#5B6670;--linea:#E3E7EC;
        --display:'Poppins',system-ui,sans-serif;--body:'Inter',system-ui,sans-serif;--r:5px;--r-chico:2px;
        --sombra:0 2px 8px rgba(0,0,0,.08)}
  Botón principal:  background:var(--naranja);color:var(--gris-oscuro);border:0;border-radius:var(--r);font:600 14px var(--display);height:40px;padding:0 20px
  Botón secundario: background:var(--azul);color:#fff;border:0;border-radius:var(--r);font:600 14px var(--display);height:40px;padding:0 20px
  Campo:            border:1px solid #C9CFD6;border-radius:var(--r);height:40px;padding:0 12px;foco: outline:2px solid var(--azul)
  Tarjeta:          background:#fff;border-radius:var(--r);box-shadow:var(--sombra);padding:18px 20px
  Título de sección: font:500 15px var(--display);text-transform:uppercase;letter-spacing:.06em; con ::before de 40x3 px color var(--naranja)

TEXTO QUE ESCRIBES (código, README, comentarios, mensajes)
- Lenguaje sencillo y natural, como lo escribiría un estudiante. Sin frases de folleto ni palabras rebuscadas.
- No escribas Claude, IA ni atribuciones en commits, README, comentarios ni archivos. Los commits quedan a nombre del usuario.
- No hagas commit ni push por tu cuenta: prepara los cambios y dile al usuario los comandos.

ANTES DE ENTREGAR (revisa cada punto)
[ ] Los colores son solo los de este manual y no hay texto blanco sobre naranja.
[ ] Los títulos y el logotipo son Poppins; el texto es Inter.
[ ] El nombre va como una sola palabra, en dos tonos (azul y naranja) en la versión de color.
[ ] Se eligió la versión del logo con mejor contraste y se respeta el área de seguridad y el tamaño mínimo.
[ ] Todos los bordes tienen radio de 5 px (2 px en cuadros pequeños).
[ ] Hay un solo acento naranja por pantalla o pieza, y ningún borde ni aro de foco naranja.
[ ] Los íconos son los de este manual, del color del texto y sin cuadro ni círculo detrás.
[ ] El logo no está deformado, girado, con sombras ni con colores cambiados.
[ ] Los estados van como texto de color, sin fondo.
[ ] En móvil: zonas táctiles de 48 px, texto de 14 px y máximo 4 destinos en el menú inferior.
[ ] Los textos están en lenguaje sencillo y no mencionan a la IA.
```

## Cubo (SVG exacto)

```svg
<svg viewBox="0 0 259.8 300" xmlns="http://www.w3.org/2000/svg">
  <polygon fill="#F28C1B" points="0,75 129.9,0 259.8,75 129.9,150"/>
  <polygon fill="#005198" points="0,75 129.9,150 129.9,300 0,225"/>
  <polygon fill="#003A73" points="129.9,150 259.8,75 259.8,225 129.9,300"/>
</svg>
```

## Datos en JSON

```json
{
  "marca_base": "InvenLote",
  "se_cambia_por_proyecto": [
    "nombre"
  ],
  "nombre": {
    "regla": "una sola palabra en dos tonos: primera parte azul #005198, segunda parte naranja #F28C1B",
    "fuente": "Poppins Bold 700",
    "espaciado_letras": "-2%"
  },
  "colores": {
    "azul": "#005198",
    "azul_profundo": "#003A73",
    "naranja": "#F28C1B",
    "blanco": "#FFFFFF",
    "gris_claro": "#F2F4F7",
    "gris_oscuro": "#1F2933",
    "exito": "#2E9E5B",
    "exito_texto": "#1E7A44",
    "error": "#D64545",
    "error_texto": "#B03030",
    "aviso_texto": "#8A4B00",
    "aviso_fondo": "#FDEBD3",
    "gris_suave": "#5B6670",
    "linea": "#E3E7EC"
  },
  "contraste": {
    "blanco_sobre_naranja": "2.46 NO cumple",
    "gris_oscuro_sobre_naranja": "6.00 cumple",
    "blanco_sobre_azul": "7.98 cumple"
  },
  "fuentes": {
    "titulos_logotipo_botones": "Poppins 500/600/700",
    "texto_tablas_formularios": "Inter 400/500/600"
  },
  "escala_tipografica": {
    "titulo_1": "Poppins Bold 48/56",
    "titulo_2": "Poppins SemiBold 32/40",
    "titulo_3": "Poppins SemiBold 24/32",
    "texto": "Inter Regular 16/24",
    "etiqueta": "Inter Medium 14/20 MAYUSCULAS"
  },
  "forma": {
    "radio_px": 5,
    "radio_cuadro_menor_60px": 2,
    "sombra": "0 2px 8px rgba(0,0,0,.08)",
    "espaciado_px": [
      4,
      8,
      12,
      16,
      24,
      32
    ],
    "alto_boton_px": {
      "escritorio": 40,
      "movil": 48
    }
  },
  "logo": {
    "isotipo": "cubo isometrico, tres rombos iguales, angulos de 30 grados",
    "viewBox": "0 0 259.8 300",
    "caras": {
      "superior": "#F28C1B",
      "izquierda": "#005198",
      "derecha": "#003A73"
    },
    "versiones": [
      "color",
      "blanco",
      "monocromatica azul",
      "monocromatica negra"
    ],
    "disposiciones": [
      "horizontal (principal)",
      "vertical (secundaria)"
    ],
    "area_de_seguridad": "x = mitad de la altura del cubo",
    "tamano_minimo": {
      "horizontal": "160 px / 40 mm",
      "vertical": "100 px / 25 mm",
      "solo_cubo": "24 px / 8 mm"
    },
    "proporciones_horizontal": {
      "letra": "0.54 x altura del cubo",
      "separacion": "0.20 x altura del cubo"
    },
    "proporciones_vertical": {
      "letra": "0.375 x altura del cubo",
      "separacion": "0.28 x altura del cubo"
    }
  },
  "iconos": {
    "rejilla": 24,
    "estilos": [
      "linea: trazo 2 px, puntas redondeadas, sin relleno",
      "duotono: relleno del color del icono con una parte al 50 % de opacidad"
    ],
    "color": "currentColor (hereda el del texto)",
    "fondo_detras": "prohibido",
    "lista": [
      "home",
      "box",
      "apilado",
      "stock",
      "almacen",
      "bodega",
      "flujo",
      "entrada",
      "salida",
      "report",
      "csv",
      "etiqueta",
      "ruler",
      "watch",
      "clock",
      "alert",
      "bell",
      "search",
      "list",
      "plus",
      "check",
      "chev",
      "menu"
    ]
  },
  "prohibido": [
    "bordes o aros de foco naranjas",
    "cuadro o circulo de color detras de iconos",
    "texto blanco sobre naranja",
    "emojis como iconos",
    "pildoras con fondo de color para estados",
    "degradados de moda",
    "deformar, rotar, cambiar colores, sombrear o reordenar el logo"
  ]
}
```
