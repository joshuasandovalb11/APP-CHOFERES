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
import "react-native-reanimated";

import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as Device from "expo-device";

import { useColorScheme } from "@/components/useColorScheme";
import { AppProvider, useApp } from "@/context/AppContext";
import locationService from "@/services/location";

const GEOFENCING_TASK = "geofencing-task";

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

      // Configuración específica para Android
      if (Device.osName === "Android") {
        // Crear el canal de notificación para la entrega en progreso
        await Notifications.setNotificationChannelAsync("delivery-ongoing", {
          name: "Entregas en progreso",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0],
          sound: null,
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
        const notificationDeliveryId = response.notification.request.content
          .data.deliveryId as number | undefined;

        // Obtenemos el ID actual desde la referencia de nuestro estado global
        const currentlyViewedDeliveryId =
          appStateRef.current.currentlyViewedDeliveryId;

        if (
          notificationDeliveryId &&
          notificationDeliveryId === currentlyViewedDeliveryId
        ) {
          return; // No navegamos
        }

        if (notificationDeliveryId) {
          router.push(`/delivery-detail?deliveryId=${notificationDeliveryId}`);
        }
      }
    );

    return () => subscription.remove();
  }, [router]); // La dependencia es solo el router

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
