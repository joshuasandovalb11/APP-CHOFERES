# App Choferes - Sistema de Entregas

Una aplicación móvil desarrollada en React Native con Expo para choferes que necesitan gestionar sus entregas diarias de manera eficiente.

## 📋 Funcionalidades

### ✅ Funciones Implementadas
- **Autenticación de chofer** con usuario y contraseña
- **Sistema FEC** (Factura de Entrega Chofer) para organizar entregas diarias
- **Dashboard principal** con listado de entregas ordenadas por proximidad
- **Detalles de entrega** con información completa del cliente
- **Gestión de estado de entregas** (pendiente → en progreso → completada)
- **Integración con mapas** para visualizar ubicaciones
- **Navegación con Google Maps** para rutas optimizadas
- **Seguimiento de ubicación** del chofer
- **Persistencia de sesión** entre aberturas de la app

### 🔄 Flujo de la Aplicación

1. **Inicio de sesión**: El chofer ingresa sus credenciales
2. **Ingreso de FEC**: Se ingresa el número de factura del día
3. **Dashboard**: Visualización de entregas ordenadas por proximidad
4. **Detalle de entrega**: Información completa y opciones de acción
5. **Navegación**: Integración con Google Maps para rutas
6. **Completar entrega**: Marcar entregas como finalizadas

## 🛠 Tecnologías Utilizadas

- **React Native** con **Expo**
- **Expo Router** para navegación
- **TypeScript** para tipado seguro
- **AsyncStorage** para persistencia local
- **Expo Location** para geolocalización
- **Context API** para manejo de estado global

## 📱 Pantallas

1. **Index** - Pantalla de carga y verificación de sesión
2. **Login** - Autenticación del chofer
3. **FEC Input** - Ingreso del número de factura
4. **Dashboard** - Lista de entregas y estado actual
5. **Delivery Detail** - Detalles completos de cada entrega

## 🚀 Instalación y Uso

### Prerrequisitos
- Node.js instalado
- Expo CLI instalado globalmente
- Expo Go app en tu dispositivo móvil

### Pasos de instalación
```bash
# Clonar el repositorio
git clone <tu-repositorio>

# Instalar dependencias
npm install

# Iniciar el servidor de desarrollo
npm start
# o
npx expo start
```

### Para probar en tu dispositivo
1. Instala **Expo Go** desde la App Store o Play Store
2. Escanea el código QR que aparece en la terminal
3. La aplicación se cargará automáticamente

## 🔐 Credenciales de Prueba

Para probar la aplicación usa:
- **Usuario**: `chofer1`
- **Contraseña**: `password`
- **FEC**: Cualquier número (ej: `FEC-001`)

## 📁 Estructura del Proyecto

```
App-choferes/
├── app/                    # Pantallas de la aplicación
│   ├── index.tsx          # Pantalla de inicio
│   ├── login.tsx          # Pantalla de login
│   ├── fec-input.tsx      # Ingreso de FEC
│   ├── dashboard.tsx      # Dashboard principal
│   ├── delivery-detail.tsx # Detalles de entrega
│   └── _layout.tsx        # Layout principal
├── context/               # Context API
│   └── AppContext.tsx     # Estado global de la app
├── services/              # Servicios
│   ├── api.ts            # Servicio de API (con mock data)
│   └── location.ts       # Servicio de ubicación
├── types/                 # Definiciones de TypeScript
│   └── index.ts          # Interfaces y tipos
├── components/           # Componentes reutilizables
├── constants/           # Constantes (colores, etc.)
└── assets/             # Recursos (imágenes, fuentes)
```

## 🎯 Tipos de Datos Principales

### Driver (Chofer)
```typescript
interface Driver {
  driver_id: number;
  username: string;
  num_unity: string;
  vehicle_plate: string;
  phone_number: string;
}
```

### Client (Cliente)
```typescript
interface Client {
  client_id: number;
  name: string;
  phone: number;
  gps_location: string;
}
```

### Delivery (Entrega)
```typescript
interface Delivery {
  delivery_id: number;
  driver_id: number;
  client_id: number;
  start_time: string;
  delivery_time?: string;
  actual_duration?: string;
  estimated_duration?: string;
  start_latitud: number;
  start_longitud: number;
  end_latitud?: number;
  end_longitud?: number;
  accepted_next_at?: string;
  client?: Client;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  distance?: number;
  priority?: number;
}
```

## 🗺 Integración con Mapas

La aplicación se integra con **Google Maps** para:
- Mostrar ubicaciones de entrega
- Proporcionar navegación paso a paso
- Calcular distancias entre ubicaciones
- Ordenar entregas por proximidad

## 🔄 Estados de Entrega

1. **Pendiente** (pending) - Entrega asignada pero no iniciada
2. **En Progreso** (in_progress) - Entrega iniciada
3. **Completada** (completed) - Entrega finalizada
4. **Cancelada** (cancelled) - Entrega cancelada

## 📊 Datos Mock

La aplicación incluye datos de prueba para facilitar el desarrollo y testing:
- 3 entregas de ejemplo con diferentes clientes
- Coordenadas reales de Monterrey, México
- Información completa de clientes y entregas

## 🔧 Configuración de Permisos

La aplicación requiere permisos de ubicación:

### iOS
- `NSLocationWhenInUseUsageDescription`
- `NSLocationAlwaysAndWhenInUseUsageDescription`

### Android
- `ACCESS_FINE_LOCATION`
- `ACCESS_COARSE_LOCATION`
- `ACCESS_BACKGROUND_LOCATION`

## 🚧 Futuras Mejoras

### Para el Dashboard del Administrador
- Panel de administración web
- Reportes de rendimiento por chofer
- Análisis de rutas y tiempos
- Gestión de FECs y asignaciones
- Alertas en tiempo real

### Para la App del Chofer
- Notificaciones push
- Chat en tiempo real con despachador
- Cámara para evidencias de entrega
- Firma digital del cliente
- Modo offline

### Tracking y Analytics
- Seguimiento detallado de rutas
- Métricas de desempeño
- Optimización automática de rutas
- Reportes de desviaciones

## 📝 Notas de Desarrollo

- La aplicación usa **datos mock** actualmente
- Para producción, conectar con API real
- Los servicios están preparados para integración con backend
- El estado se persiste localmente con AsyncStorage

## 🤝 Contribución

1. Fork del proyecto
2. Crear rama para feature (`git checkout -b feature/AmazingFeature`)
3. Commit de cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo LICENSE para detalles.

---

**Desarrollado con ❤️ para optimizar las rutas de entrega de choferes**
