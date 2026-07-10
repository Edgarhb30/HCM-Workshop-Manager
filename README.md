# HCM Workshop Manager v0.1

Base profesional en React + Vite + Supabase para Herrera Custom Motorcycle.

## Incluido

- Inicio de sesión con Supabase Auth.
- Dashboard conectado a citas y motocicletas.
- Agenda con cambio de estado.
- Registro y listado de clientes.
- Registro y listado de motocicletas vinculadas a clientes.
- Menú preparado para órdenes, presupuestos, inventario, reportes y configuración.
- Diseño adaptable a computadora y celular.

## Ejecutar en la computadora

1. Instala Node.js LTS.
2. Abre una terminal dentro de esta carpeta.
3. Ejecuta:

```bash
npm install
npm run dev
```

4. Abre la dirección que muestre Vite, normalmente `http://localhost:5173`.
5. Ingresa con el usuario creado en Supabase.

## Publicar

Ejecuta `npm run build`. La carpeta `dist` resultante se puede publicar en Netlify o Vercel.

## Seguridad

La aplicación usa únicamente la clave pública de Supabase. No agregues claves `secret` ni `service_role` al frontend.
