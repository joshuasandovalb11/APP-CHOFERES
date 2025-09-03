import * as Location from "expo-location";
import { Linking, Platform, Alert } from "react-native";
import { Location as LocationType } from "../types";

export class LocationService {
  private watchId: Location.LocationSubscription | null = null;

  /**
   * Verifica y solicita permisos de ubicación de forma inteligente.
   * Guía al usuario si necesita ir a la configuración.
   * @returns {Promise<boolean>} Devuelve true si todos los permisos necesarios están concedidos.
   */
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

  // Funcion para INICIAR el seguimiento de la ubicación
  async startLocationTracking(
    callback: (location: LocationType) => void
  ): Promise<boolean> {
    try {
      const hasPermission = await this.checkAndRequestLocationPermissions();
      if (!hasPermission) {
        return false;
      }

      this.watchId = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000, // Actualizar cada 10 segundos
          distanceInterval: 50, // O cuando se mueva 50 metros
        },
        (location) => {
          callback({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      );

      return true;
    } catch (error) {
      console.error("Error starting location tracking:", error);
      return false;
    }
  }

  // Funcion para DETENER el seguimiento de la ubicación
  stopLocationTracking(): void {
    if (this.watchId) {
      this.watchId.remove();
      this.watchId = null;
    }
  }

  // Funcion para calcular la distancia entre dos puntos
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

  // Funcion para abrir Google Maps con navegación
  async openGoogleMaps(
    destination: LocationType,
    origin?: LocationType
  ): Promise<void> {
    try {
      let url: string;

      if (origin) {
        // Ruta desde origen específico
        url = `https://www.google.com/maps/dir/${origin.latitude},${origin.longitude}/${destination.latitude},${destination.longitude}`;
      } else {
        // Ruta desde ubicación actual
        url = `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;
      }

      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        // Fallback a la app de mapas del sistema
        const fallbackUrl = `maps:${destination.latitude},${destination.longitude}`;
        await Linking.openURL(fallbackUrl);
      }
    } catch (error) {
      console.error("Error opening maps:", error);
    }
  }

  // Abrir Google Maps solo para ver la ubicación (sin navegación)
  async viewLocationOnMap(location: LocationType): Promise<void> {
    try {
      const label = "Ubicación del Cliente";
      const url = `geo:${location.latitude},${location.longitude}?q=${location.latitude},${location.longitude}(${label})&z=15`;

      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        // Fallback a la URL web si no hay una app de mapas
        const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=...,${location.longitude},15z`;
        await Linking.openURL(fallbackUrl);
      }
    } catch (error) {
      console.error("Error opening maps to view location:", error);
      Alert.alert("Error", "No se pudo abrir la aplicación de mapas.");
    }
  }

  // Funcion para obtener la dirección a partir de coordenadas
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

  // Funcion para ordenar entregas por proximidad
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

  // Funcion para parsear la ubicación GPS desde string
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
