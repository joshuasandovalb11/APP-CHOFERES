import * as Location from "expo-location";
import { Linking, Platform, Alert } from "react-native";
import { Location as LocationType } from "../types";

export class LocationService {
  private watchId: Location.LocationSubscription | null = null;

  async requestPermissions(): Promise<boolean> {
    try {
      const { status: foregroundStatus } =
        await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== "granted") {
        const { status: backgroundStatus } =
          await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus !== "granted") {
          Alert.alert(
            "Permisos insuficientes",
            "La aplicación necesita permisos de ubicación para funcionar correctamente."
          );
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error("Error requesting location permissions:", error);
      return false;
    }
  }

  async getCurrentLocation(): Promise<LocationType | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error("No hay permisos de ubicación");
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

  async startLocationTracking(
    callback: (location: LocationType) => void
  ): Promise<boolean> {
    try {
      const hasPermission = await this.requestPermissions();
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

  stopLocationTracking(): void {
    if (this.watchId) {
      this.watchId.remove();
      this.watchId = null;
    }
  }

  calculateDistance(point1: LocationType, point2: LocationType): number {
    const R = 6371e3; // Radio de la Tierra en metros
    const φ1 = (point1.latitude * Math.PI) / 180;
    const φ2 = (point2.latitude * Math.PI) / 180;
    const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distancia en metros
  }

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

export default new LocationService();
