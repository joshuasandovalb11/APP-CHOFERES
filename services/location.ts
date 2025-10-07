// services/location.ts - VERSIÓN OPTIMIZADA

import * as Location from "expo-location";
import { Linking, Alert } from "react-native";
import { Delivery, Location as LocationType } from "../types";
import * as Notifications from "expo-notifications";

const JOURNEY_TRACKING_TASK = "journey-tracking-task";
const DELIVERY_TRACKING_TASK = "delivery-tracking-task";

export class LocationService {
  private persistentNotificationId: string | null = null;
  private currentTrackingMode: "journey" | "delivery" | null = null;

  /**
   * MODO 1: Tracking de Jornada (sin entrega activa)
   * - Menos frecuente para ahorrar batería
   * - Solo captura la ruta general del día
   */
  async startJourneyTracking(): Promise<void> {
    const hasPermission = await this.checkAndRequestLocationPermissions();
    if (!hasPermission) throw new Error("Sin permisos");

    // Detener tracking de delivery si existe
    await this.stopDeliveryTracking();

    const isRunning = await Location.hasStartedLocationUpdatesAsync(
      JOURNEY_TRACKING_TASK
    );
    if (isRunning) {
      console.log("[JourneyTracking] Ya está activo");
      return;
    }

    await Location.startLocationUpdatesAsync(JOURNEY_TRACKING_TASK, {
      accuracy: Location.Accuracy.Balanced, // Balance entre precisión y batería
      distanceInterval: 50, // Cada 100 metros (antes 50m)
      timeInterval: 3 * 60 * 1000, // O cada 5 minutos (antes 2min)
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "Jornada Activa",
        notificationBody: "Registrando tu ruta del día",
        notificationColor: "#007AFF",
      },
    });

    this.currentTrackingMode = "journey";
    console.log("[JourneyTracking] INICIADO - Modo ahorro de batería");
  }

  /**
   * MODO 2: Tracking de Entrega (durante una entrega activa)
   * - Más frecuente y preciso
   * - Necesario para calcular distancia real recorrida
   */
  async startDeliveryTracking(delivery: Delivery): Promise<void> {
    const hasPermission = await this.checkAndRequestLocationPermissions();
    if (!hasPermission) {
      console.log("No se pudo iniciar el servicio por falta de permisos.");
      return;
    }

    // Detener tracking de journey
    await this.stopJourneyTracking();

    const isRunning = await Location.hasStartedLocationUpdatesAsync(
      DELIVERY_TRACKING_TASK
    );
    if (isRunning) {
      console.log("[DeliveryTracking] Ya está activo");
      return;
    }

    // Crear notificación persistente
    if (this.persistentNotificationId) {
      await Notifications.dismissNotificationAsync(
        this.persistentNotificationId
      );
    }

    const distance = delivery.estimated_distance || "Calculando...";
    const duration = delivery.estimated_duration || "Calculando...";

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `🚚 En ruta hacia: ${delivery.client?.name || "Cliente"}`,
        body: `Entrega #${delivery.delivery_id} | ${distance} | ${duration}`,
        data: {
          deliveryId: delivery.delivery_id,
          type: "delivery_in_progress",
          persistent: true,
        },
        priority: Notifications.AndroidNotificationPriority.MAX,
        sticky: true,
        autoDismiss: false,
      },
      trigger: null,
    });

    this.persistentNotificationId = notificationId;

    // Iniciar tracking más preciso
    await Location.startLocationUpdatesAsync(DELIVERY_TRACKING_TASK, {
      accuracy: Location.Accuracy.High, // Alta precisión
      distanceInterval: 20, // Cada 30 metros (más frecuente)
      timeInterval: 1 * 60 * 1000, // O cada 1 minuto
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: `Entrega en progreso: ${delivery.client?.name}`,
        notificationBody: `${distance} | ${duration}`,
        notificationColor: "#28A745",
      },
    });

    this.currentTrackingMode = "delivery";
    console.log("[DeliveryTracking] INICIADO - Modo alta precisión");
  }

  /**
   * Detiene el tracking de jornada y vuelve a modo delivery si hay una activa
   */
  async stopJourneyTracking(): Promise<void> {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(
      JOURNEY_TRACKING_TASK
    );

    if (isRunning) {
      await Location.stopLocationUpdatesAsync(JOURNEY_TRACKING_TASK);
      console.log("[JourneyTracking] DETENIDO");
    }
  }

  /**
   * Detiene el tracking de delivery y vuelve a modo journey
   */
  async stopDeliveryTracking(): Promise<void> {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(
      DELIVERY_TRACKING_TASK
    );

    if (isRunning) {
      await Location.stopLocationUpdatesAsync(DELIVERY_TRACKING_TASK);
      console.log("[DeliveryTracking] DETENIDO");
    }

    if (this.persistentNotificationId) {
      await Notifications.dismissNotificationAsync(
        this.persistentNotificationId
      );
      this.persistentNotificationId = null;
      console.log("Notificación de entrega eliminada");
    }

    this.currentTrackingMode = null;
  }

  /**
   * Detiene todo el tracking (al finalizar la jornada)
   */
  async stopAllTracking(): Promise<void> {
    await this.stopJourneyTracking();
    await this.stopDeliveryTracking();
    this.currentTrackingMode = null;
    console.log("[LocationService] Todo el tracking DETENIDO");
  }

  // Función para verificar y solicitar permisos de ubicación
  async checkAndRequestLocationPermissions(): Promise<boolean> {
    let { status: foregroundStatus } =
      await Location.getForegroundPermissionsAsync();
    if (foregroundStatus !== "granted") {
      const { status } = await Location.requestForegroundPermissionsAsync();
      foregroundStatus = status;
    }

    if (foregroundStatus !== "granted") {
      Alert.alert(
        "Permisos Requeridos",
        "Esta aplicación necesita acceso a tu ubicación para poder funcionar. Por favor, habilita los permisos.",
        [{ text: "OK" }]
      );
      return false;
    }

    let { status: backgroundStatus } =
      await Location.getBackgroundPermissionsAsync();
    if (backgroundStatus !== "granted") {
      await new Promise((resolve) =>
        Alert.alert(
          "Permiso Adicional Necesario",
          "Para el seguimiento de ruta y las notificaciones de proximidad, la app necesita tu permiso para acceder a la ubicación 'todo el tiempo'.\n\nPor favor, pulsa 'Ir a Configuración' y selecciona la opción 'Permitir todo el tiempo'.",
          [
            {
              text: "Ahora no",
              style: "cancel",
              onPress: () => resolve(false),
            },
            {
              text: "Ir a Configuración",
              onPress: async () => {
                await Linking.openSettings();
                resolve(true);
              },
            },
          ]
        )
      );
      const { status: newBackgroundStatus } =
        await Location.getBackgroundPermissionsAsync();
      return newBackgroundStatus === "granted";
    }

    return true;
  }

  // Funcion para OBTENER la ubicación actual
  async getCurrentLocation(): Promise<LocationType | null> {
    try {
      const hasPermission = await this.checkAndRequestLocationPermissions();
      if (!hasPermission) {
        console.log("Obtención de ubicación cancelada por falta de permisos.");
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.error("Error getting current location:", error);
      return null;
    }
  }

  // Función para calcular la distancia entre dos puntos (Haversine)
  calculateDistance(point1: LocationType, point2: LocationType): number {
    const R = 6371e3;
    const φ1 = (point1.latitude * Math.PI) / 180;
    const φ2 = (point2.latitude * Math.PI) / 180;
    const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  // Función para abrir Google Maps con indicaciones
  async openGoogleMaps(
    destination: LocationType,
    origin?: LocationType
  ): Promise<void> {
    try {
      let url: string;

      if (origin) {
        url = `https://www.google.com/maps/dir/${origin.latitude},${origin.longitude}/${destination.latitude},${destination.longitude}`;
      } else {
        url = `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;
      }

      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        const fallbackUrl = `maps:${destination.latitude},${destination.longitude}`;
        await Linking.openURL(fallbackUrl);
      }
    } catch (error) {
      console.error("Error opening maps:", error);
    }
  }

  // Función para ver una ubicación en el mapa (sin ruta)
  async viewLocationOnMap(location: LocationType): Promise<void> {
    try {
      const label = "Ubicación del Cliente";
      const url = `geo:${location.latitude},${location.longitude}?q=${location.latitude},${location.longitude}(${label})&z=15`;

      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude},15z`;
        await Linking.openURL(fallbackUrl);
      }
    } catch (error) {
      console.error("Error opening maps to view location:", error);
      Alert.alert("Error", "No se pudo abrir la aplicación de mapas.");
    }
  }

  // Función para obtener la dirección a partir de coordenadas
  async getAddressFromCoordinates(location: LocationType): Promise<string> {
    try {
      const addresses = await Location.reverseGeocodeAsync(location);
      if (addresses.length > 0) {
        const address = addresses[0];
        return `${address.street || ""} ${address.streetNumber || ""}, ${
          address.city || ""
        }, ${address.region || ""}`
          .trim()
          .replace(/, $/, "");
      }
      return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(
        6
      )}`;
    } catch (error) {
      console.error("Error getting address:", error);
      return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(
        6
      )}`;
    }
  }

  // Función para ordenar entregas por proximidad a una ubicación
  sortDeliveriesByProximity<
    T extends { client?: { gps_location: string }; distance?: number }
  >(deliveries: T[], currentLocation: LocationType): T[] {
    const deliveriesWithDistance = deliveries.map((delivery) => {
      const location = this.parseGPSLocation(
        delivery.client?.gps_location || ""
      );
      const distance = location
        ? this.calculateDistance(currentLocation, location)
        : Infinity;
      return { ...delivery, distance };
    });

    return deliveriesWithDistance.sort((a, b) => a.distance - b.distance);
  }

  // Función para convertir "lat,lng" a objeto LocationType
  private parseGPSLocation(gpsLocation: string): LocationType | null {
    try {
      if (!gpsLocation || !gpsLocation.includes(",")) return null;
      const [lat, lng] = gpsLocation
        .split(",")
        .map((coord) => parseFloat(coord.trim()));
      if (isNaN(lat) || isNaN(lng)) return null;
      return { latitude: lat, longitude: lng };
    } catch {
      return null;
    }
  }
}

const locationService = new LocationService();
export default locationService;
