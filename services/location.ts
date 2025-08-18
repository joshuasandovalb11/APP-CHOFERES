import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { Location as LocationType } from '../types';

export class LocationService {
  private watchId: Location.LocationSubscription | null = null;

  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        const backgroundStatus = await Location.requestBackgroundPermissionsAsync();
        return backgroundStatus.status === 'granted';
      }
      return true;
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }

  async getCurrentLocation(): Promise<LocationType | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('No hay permisos de ubicación');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  async startLocationTracking(callback: (location: LocationType) => void): Promise<boolean> {
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
      console.error('Error starting location tracking:', error);
      return false;
    }
  }

  stopLocationTracking(): void {
    if (this.watchId) {
      this.watchId.remove();
      this.watchId = null;
    }
  }

  // Calcular distancia entre dos puntos usando fórmula Haversine
  calculateDistance(
    point1: LocationType,
    point2: LocationType
  ): number {
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

  // Abrir Google Maps para navegación
  async openGoogleMaps(destination: LocationType, origin?: LocationType): Promise<void> {
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
      console.error('Error opening maps:', error);
    }
  }

  // Abrir Google Maps solo para ver la ubicación (sin navegación)
  async viewLocationOnMap(location: LocationType): Promise<void> {
    try {
      const url = `https://www.google.com/maps/@${location.latitude},${location.longitude},15z`;
      
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        const fallbackUrl = `maps:${location.latitude},${location.longitude}`;
        await Linking.openURL(fallbackUrl);
      }
    } catch (error) {
      console.error('Error opening maps:', error);
    }
  }

  // Convertir coordenadas a dirección (geocoding reverso)
  async getAddressFromCoordinates(location: LocationType): Promise<string> {
    try {
      const addresses = await Location.reverseGeocodeAsync(location);
      if (addresses.length > 0) {
        const address = addresses[0];
        return `${address.street || ''} ${address.streetNumber || ''}, ${address.city || ''}, ${address.region || ''}`.trim();
      }
      return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
    } catch (error) {
      console.error('Error getting address:', error);
      return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
    }
  }

  // Ordenar entregas por proximidad
  sortDeliveriesByProximity<T extends { client?: { gps_location: string } }>(
    deliveries: T[],
    currentLocation: LocationType
  ): T[] {
    return deliveries.sort((a, b) => {
      const locationA = this.parseGPSLocation(a.client?.gps_location || '');
      const locationB = this.parseGPSLocation(b.client?.gps_location || '');

      if (!locationA || !locationB) return 0;

      const distanceA = this.calculateDistance(currentLocation, locationA);
      const distanceB = this.calculateDistance(currentLocation, locationB);

      return distanceA - distanceB;
    });
  }

  // Parsear string de GPS location "lat,lng"
  private parseGPSLocation(gpsLocation: string): LocationType | null {
    try {
      const [lat, lng] = gpsLocation.split(',').map(coord => parseFloat(coord.trim()));
      if (isNaN(lat) || isNaN(lng)) return null;
      return { latitude: lat, longitude: lng };
    } catch {
      return null;
    }
  }
}

export default new LocationService();
