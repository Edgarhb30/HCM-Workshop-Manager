# HCM Workshop Manager 1.0

## Lista de cierre de producción

### Completado

- Aplicación web desplegada en Vercel.
- Base de datos, autenticación y archivos en Supabase.
- Aplicación Android firmada con identidad de HCM.
- Aislamiento de datos por `workshop_id` y roles.
- RLS habilitado en las tablas del sistema.
- Variables privadas excluidas de Git.
- APK y archivo de firma excluidos de Git.
- Compilación web verificada.
- Dependencias de producción sin vulnerabilidades conocidas.

### Configuración que debe conservar el propietario

- Archivo `hcm-release.jks` y sus contraseñas.
- Acceso del propietario a GitHub, Supabase y Vercel.
- Copias JSON periódicas mientras se utilice el plan gratuito.
- Autenticación de dos factores en las cuentas administrativas.

### Antes de iniciar el SaaS

- Crear un ambiente de pruebas separado de producción.
- Probar el aislamiento con dos talleres ficticios.
- Configurar correo transaccional profesional.
- Migrar Supabase y Vercel a planes comerciales.
- Crear dominio propio, suscripciones y Platform Control Center.
