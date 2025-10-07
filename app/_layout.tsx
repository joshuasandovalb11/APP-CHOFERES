import "react-native-reanimated";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import {
  Stack,
  useRouter,
  usePathname,
  useLocalSearchParams,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";

import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as Device from "expo-device";

import { useColorScheme } from "@/components/useColorScheme";
import { AppProvider, useApp } from "@/context/AppContext";
import locationService from "@/services/location";
import AsyncStorage from "@react-native-async-storage/async-storage";

const JOURNEY_TRACKING_TASK = "journey-tracking-task";
const DELIVERY_TRACKING_TASK = "delivery-tracking-task";
const GEOFENCING_TASK = "geofencing-task";
const BACKGROUND_TRACKING_STORAGE_KEY = "background_tracking_queue";

interface StoredPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
}

// Función Haversine para calcular distancia
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

const addPointToStorage = async (location: Location.LocationObject) => {
  try {
    const existingPointsJSON = await AsyncStorage.getItem(
      BACKGROUND_TRACKING_STORAGE_KEY
    );
    const points: StoredPoint[] = existingPointsJSON
      ? JSON.parse(existingPointsJSON)
      : [];

    const newPoint: StoredPoint = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      timestamp: new Date(location.timestamp).toISOString(),
    };

    // LÓGICA DE FILTRADO INTELIGENTE
    if (points.length > 0) {
      const lastPoint = points[points.length - 1];

      // Calcular distancia desde el último punto
      const distance = calculateDistance(
        lastPoint.latitude,
        lastPoint.longitude,
        newPoint.latitude,
        newPoint.longitude
      );

      // Calcular tiempo desde el último punto (en minutos)
      const lastTime = new Date(lastPoint.timestamp).getTime();
      const newTime = new Date(newPoint.timestamp).getTime();
      const minutesElapsed = (newTime - lastTime) / (1000 * 60);

      // REGLAS DE FILTRADO:

      // REGLA 1: Si se movió menos de 30m
      if (distance < 30) {
        // Pero ya pasaron más de 10 minutos en el mismo lugar
        // Guardar UN punto adicional para marcar que sigue ahí
        if (minutesElapsed > 10) {
          // Buscar si ya hay un punto reciente en esta ubicación
          const recentStationaryPoints = points.filter((p) => {
            const pointTime = new Date(p.timestamp).getTime();
            const minutesSincePoint = (newTime - pointTime) / (1000 * 60);
            const pointDistance = calculateDistance(
              p.latitude,
              p.longitude,
              newPoint.latitude,
              newPoint.longitude
            );
            return pointDistance < 30 && minutesSincePoint < 15;
          });

          // Si ya hay 2+ puntos recientes aquí, no guardar más
          if (recentStationaryPoints.length >= 2) {
            console.log(
              `[TaskManager] ⏭️ Punto ignorado: Ya hay ${recentStationaryPoints.length} puntos en esta ubicación estacionaria`
            );
            return;
          }
        } else {
          // Menos de 10 minutos y menos de 30m = definitivamente ignorar
          console.log(
            `[TaskManager] ⏭️ Punto ignorado: ${distance.toFixed(
              1
            )}m en ${minutesElapsed.toFixed(1)}min`
          );
          return;
        }
      }

      // REGLA 2: Se movió más de 30m = siempre guardar
      console.log(
        `[TaskManager] ✅ Punto guardado: ${distance.toFixed(
          1
        )}m desde último punto`
      );
    } else {
      console.log(`[TaskManager] ✅ Primer punto guardado`);
    }

    points.push(newPoint);
    await AsyncStorage.setItem(
      BACKGROUND_TRACKING_STORAGE_KEY,
      JSON.stringify(points)
    );

    console.log(`[TaskManager] Total en buffer: ${points.length} puntos`);
  } catch (e) {
    console.error("[TaskManager] Error al guardar punto:", e);
  }
};

// ============================================
// TASK 1: Tracking de Jornada (baja frecuencia)
// ============================================
TaskManager.defineTask(JOURNEY_TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    console.error("[JourneyTracking] Error:", error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];

    console.log(
      `[JourneyTracking] Recibidos ${locations.length} puntos en background.`
    );

    for (const location of locations) {
      await addPointToStorage(location);
    }

    console.log("[JourneyTracking] Punto capturado (baja frecuencia):", {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      time: new Date().toLocaleTimeString(),
      accuracy: Math.round(location.coords.accuracy || 0) + "m",
    });
  }
});

// ============================================
// TASK 2: Tracking de Entrega (alta frecuencia)
// ============================================
TaskManager.defineTask(DELIVERY_TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    console.error("[DeliveryTracking] Error:", error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];

    console.log(
      `[DeliveryTracking] Recibidos ${locations.length} puntos en background.`
    );

    for (const location of locations) {
      await addPointToStorage(location);
    }

    console.log("[DeliveryTracking] Punto capturado (alta frecuencia):", {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      time: new Date().toLocaleTimeString(),
      accuracy: Math.round(location.coords.accuracy || 0) + "m",
      speed: location.coords.speed
        ? `${Math.round(location.coords.speed * 3.6)} km/h`
        : "0 km/h",
    });
  }
});

// Definición de la tarea de geofencing
TaskManager.defineTask(GEOFENCING_TASK, async ({ data, error }) => {
  if (error) {
    console.error("TaskManager Error:", error);
    return;
  }

  const { eventType, region } = data as {
    eventType: Location.GeofencingEventType;
    region: Location.LocationRegion & { identifier?: string };
  };

  if (eventType === Location.GeofencingEventType.Enter && region?.identifier) {
    const deliveryId = region.identifier.split("-")[1];

    if (deliveryId) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "¡Estás cerca de tu destino!",
          body: "No olvides marcar la entrega como completada al finalizar.",
          sound: "default",
          vibrate: [0, 250, 250, 250],
          data: { deliveryId: Number(deliveryId) },
        },
        trigger: null,
      });
    }
  }
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldShowBanner: true,
    shouldSetBadge: false,
    shouldShowList: true,
  }),
});

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
  // Ensure that reloading on `/login` keeps a back button present.
  initialRouteName: "index",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  useEffect(() => {
    const setupApp = async () => {
      // Pedir permisos de ubicación (foreground y background)
      await locationService.checkAndRequestLocationPermissions();

      // Pedir permisos de notificación
      await Notifications.requestPermissionsAsync();

      if (Device.osName === "Android") {
        await Notifications.setNotificationChannelAsync("delivery-ongoing", {
          name: "Entregas en progreso",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0],
          sound: null,
          lockscreenVisibility:
            Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: true,
          showBadge: true,
        });

        // Nuevo canal para notificaciones persistentes
        await Notifications.setNotificationChannelAsync("delivery-persistent", {
          name: "Seguimiento de Entregas",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0],
          sound: null,
          lockscreenVisibility:
            Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: true,
          showBadge: true,
        });
      }
    };

    setupApp();
  }, []);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AppProvider>
      <RootLayoutNav />
    </AppProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { state } = useApp();
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const router = useRouter();

  const appStateRef = useRef(state);
  useEffect(() => {
    appStateRef.current = state;
  }, [state]);

  // useEffect para el listener de notificaciones, ahora usando el estado global
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;

        if (data && data.type === "logout_warning") {
          return;
        }

        if (data && data.deliveryId) {
          const notificationDeliveryId = response.notification.request.content
            .data.deliveryId as number | undefined;

          const currentlyViewedDeliveryId =
            appStateRef.current.currentlyViewedDeliveryId;

          if (
            notificationDeliveryId &&
            notificationDeliveryId === currentlyViewedDeliveryId
          ) {
            return;
          }

          if (notificationDeliveryId) {
            router.push(
              `/delivery-detail?deliveryId=${notificationDeliveryId}`
            );
          }
        }
      }
    );

    return () => subscription.remove();
  }, [router]);

  // useEffect para proteger las rutas
  useEffect(() => {
    const isProtectedRoute =
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/delivery-detail");

    if (!state.isLoggedIn && isProtectedRoute) {
      router.replace("/login");
    }
  }, [state.isLoggedIn, pathname]);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="fec-input" options={{ headerShown: false }} />
        <Stack.Screen name="dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="delivery-detail" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
