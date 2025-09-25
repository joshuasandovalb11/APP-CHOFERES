// require("dotenv").config();
import "dotenv/config";

export default {
  expo: {
    name: "Sistema Entregas",
    slug: "App-entregas",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/new-icon.png",
    scheme: "appentregas",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/images/new-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/new-icon.png",
        backgroundColor: "#ffffff",
      },
      usesCleartextTraffic: true,
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      },
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "FOREGROUND_SERVICE",
      ],
      edgeToEdgeEnabled: true,
      package: "com.erick.sandoval10.Appentregas",
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/new-icon.png",
    },
    plugins: [
      "expo-router",
      "expo-notifications",
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "Permitir que $(PRODUCT_NAME) use tu ubicación para rastrear las entregas y actualizar las rutas en tiempo real.",
          isAndroidBackgroundLocationEnabled: true,
          foregroundService: {
            notificationTitle: "App Entregas está usando tu ubicación",
            notificationBody:
              "Para el seguimiento en tiempo real de la ruta de entrega.",
            notificationColor: "#ffffff",
          },
        },
      ],
      "expo-font",
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: "a2a7c750-4853-4d24-9091-623ccdf02ea7",
      },
    },
    updates: {
      url: "https://u.expo.dev/a2a7c750-4853-4d24-9091-623ccdf02ea7",
    },
    runtimeVersion: {
      policy: "appVersion",
    },
  },
};
