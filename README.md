# Colocaciones

Aplicación web personal (un solo usuario) para controlar colocaciones, pensada para el celular, en pesos argentinos. Funciona 100 % en el teléfono: no hay servidor, nube, estadísticas, fuentes ni librerías externas.

## Cómo publicarla como página estática

Subí **solo el contenido de esta carpeta** (`index.html`, `manifest.json`, `sw.js`, `css/`, `js/`, `icons/`) a cualquier hosting estático, por ejemplo GitHub Pages. No hace falta compilar nada.

Importante:

- El cifrado (Web Crypto) y el service worker solo funcionan con **https** o en **localhost**. Si abrís `index.html` como archivo local, la app avisa y **no guarda nada**.
- El service worker es opcional: sin él la app funciona igual, solo que sin caché para uso sin conexión.
- Este repositorio no contiene tarifas, tasas ni montos reales: la app arranca vacía y los pegás vos en el primer uso.

## Cómo instalarla en Chrome de Android

1. Abrí la dirección de la app en Chrome.
2. Menú ⋮ → **Agregar a pantalla de inicio** (o **Instalar app**).
3. Abrila desde el ícono. Funciona sin conexión una vez cargada.

## Primer uso

1. Creá una contraseña (mínimo 6 caracteres; se recomienda una frase de 10 o más). **Si la olvidás, los datos no se pueden recuperar. Nadie puede recuperarlos.**
2. En "Configuración inicial", pegá el texto de configuración, una línea por dato:

```
tasa_propia=<número>            tasa mensual del capital propio, en %
tasa_tabla=<número>             tasa mensual de la tarifa Tabla, en %
costo_financiamiento=<número>   costo mensual del capital financiado, en %
reinversion=<número>            % de la ganancia neta que se reinvierte
redondeo=<número>               múltiplo de redondeo para totales estimados
tabla;<plazo1>;<plazo2>;...     cabecera de la tabla (cualquier cantidad de plazos)
<capital>;<total1>;<total2>;... [;D]   una fila por capital; "D" opcional al final
```

La configuración se valida antes de aplicarse, se puede editar celda por celda y exportar en el mismo formato desde **Configuración**.

## Recordatorios (honestidad sobre las notificaciones)

La app **no manda notificaciones propias**: sin servidor no pueden ser confiables. Lo que hace:

- Al abrirla y cada vez que vuelve a primer plano, muestra un aviso con lo que vence hoy, mañana y lo vencido sin cobrar.
- En **Vencimientos → Exportar vencimientos al calendario** genera un archivo `.ics` (un evento por fecha de cobro, hora flotante local, dos alarmas). **La alarma confiable es la del calendario del teléfono.**
- Recomendación: importalo en un calendario local del teléfono. Si cambia una fecha de cobro, volvé a exportar e importar (la app te avisa en Inicio cuando hay vencimientos que no pasaste al calendario). Un evento de una fecha que ya no tiene cobros no se borra solo del calendario: borralo a mano.

## Respaldos

En **Respaldo**:

- **Exportar cifrado con clave** (recomendado): AES-GCM con clave derivada por PBKDF2. Podés usar la misma contraseña de la app o una distinta. Si perdés la clave, el respaldo no se puede recuperar.
- **Importar**: valida el formato antes de reemplazar nada y pide confirmación; con una clave incorrecta no toca los datos.
- JSON y CSV sin cifrar quedan en segundo plano: se pueden leer con cualquier programa; borralos después de usarlos. Lo mismo vale para el `.ics`.
- Se usa el menú de compartir del teléfono cuando existe; si no, se descarga el archivo. Los nombres de archivo son genéricos (solo fecha).

## Seguridad

Qué hace la app:

- Todos los datos (colocaciones, rendiciones, movimientos y configuración con tarifas) se guardan en `localStorage` **solo cifrados**: AES-GCM de 256 bits, clave derivada de tu contraseña con PBKDF2-SHA256, sal aleatoria de 16 bytes, 600.000 iteraciones e IV nuevo en cada escritura.
- La contraseña y la clave derivada nunca se guardan; la clave vive solo en memoria mientras la app está desbloqueada.
- Si el navegador no ofrece `crypto.subtle`, la app no guarda nada (nunca cae a texto plano).
- Bloqueo automático: a los 2 minutos en segundo plano o 5 de inactividad (configurable entre 1 y 30 minutos). Al bloquear se borran de memoria la clave y los datos y se vacía la pantalla. También hay un botón "Bloquear ahora".
- Una contraseña incorrecta muestra "Contraseña incorrecta" con espera creciente (1, 2, 4… hasta 60 segundos).
- Content-Security-Policy que bloquea toda conexión saliente y todo recurso externo; `noindex`; sin datos en la URL, el título ni los nombres de archivo; el service worker solo guarda en caché los archivos de la app.

Qué **no** protege:

- No protege contra un teléfono ya infectado con malware.
- No protege contra alguien que mire la pantalla con la app desbloqueada.
- La espera entre intentos solo frena a quien usa la pantalla de la app. Si alguien copia los datos cifrados del teléfono puede probar contraseñas por su cuenta: por eso un PIN numérico corto es débil y se recomienda una frase de 10 o más caracteres.
- No protege los archivos que vos exportes sin cifrar, ni los eventos que importes al calendario.

## Cómo destruir todo

En **Configuración → Zona de peligro → Destruir todos los datos**: escribí `DESTRUIR` y tu contraseña. La app borra `localStorage` y `sessionStorage`, todas las bases de IndexedDB, todo el Cache Storage, desregistra los service workers, vacía la memoria y vuelve a la pantalla de primer uso, vacía.

Después hay que borrar **a mano** lo que queda fuera de la app:

1. Archivos de respaldo (carpeta Descargas, Drive, WhatsApp, correo).
2. Eventos importados al calendario.
3. Fotos del cuaderno y conversaciones con una IA donde se hayan enviado.
4. Desinstalar el ícono de la pantalla de inicio.
