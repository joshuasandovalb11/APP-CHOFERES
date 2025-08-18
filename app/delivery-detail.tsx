import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Text, View } from "@/components/Themed";
import { useApp } from "@/context/AppContext";
import LocationService from "@/services/location";
import { Delivery, Location } from "@/types";

const { width } = Dimensions.get("window");

export default function DeliveryDetailScreen() {
  // Se quita 'cancelDelivery'
  const { state, startDelivery, completeDelivery, updateLocation } = useApp();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [destinationLocation, setDestinationLocation] =
    useState<Location | null>(null);
  const [distance, setDistance] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams();

  const findDelivery = (deliveryId: number): boolean => {
    const pendingDelivery = state.deliveryStatus.nextDeliveries.find(
      (d) => d.delivery_id === deliveryId
    );
    if (pendingDelivery) {
      setDelivery(pendingDelivery);
      return true;
    }
    if (state.deliveryStatus.currentDelivery?.delivery_id === deliveryId) {
      setDelivery(state.deliveryStatus.currentDelivery);
      return true;
    }
    const completedDelivery = state.deliveryStatus.completedDeliveries.find(
      (d) => d.delivery_id === deliveryId
    );
    if (completedDelivery) {
      setDelivery(completedDelivery);
      return true;
    }
    return false;
  };

  useEffect(() => {
    const deliveryId = parseInt(params.deliveryId as string);
    const wasFound = findDelivery(deliveryId);

    if (!wasFound && !delivery) {
      Alert.alert("Error", "Entrega no encontrada", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  }, [params.deliveryId, state]);

  useEffect(() => {
    if (delivery?.client?.gps_location && state.currentLocation) {
      const destination = parseGPSLocation(delivery.client.gps_location);
      if (destination) {
        setDestinationLocation(destination);
        const dist = LocationService.calculateDistance(
          state.currentLocation,
          destination
        );
        setDistance(formatDistance(dist));
      }
    }
  }, [delivery, state.currentLocation]);

  const parseGPSLocation = (gpsLocation: string): Location | null => {
    try {
      const [lat, lng] = gpsLocation
        .split(",")
        .map((coord) => parseFloat(coord.trim()));
      if (isNaN(lat) || isNaN(lng)) return null;
      return { latitude: lat, longitude: lng };
    } catch {
      return null;
    }
  };

  const formatDistance = (distance: number): string => {
    if (distance < 1000) return `${Math.round(distance)}m`;
    return `${(distance / 1000).toFixed(1)}km`;
  };

  const handleViewOnMap = async () => {
    if (!destinationLocation) {
      Alert.alert("Error", "No se puede mostrar la ubicación en el mapa");
      return;
    }
    await LocationService.viewLocationOnMap(destinationLocation);
  };

  const handleStartDelivery = async () => {
    if (!delivery) return;
    if (state.deliveryStatus.hasActiveDelivery) {
      Alert.alert(
        "Entrega ya en progreso",
        "Ya tienes una entrega activa. Debes completarla antes de iniciar otra.",
        [{ text: "OK" }]
      );
      return;
    }
    setIsLoading(true);
    try {
      const currentLocation = await LocationService.getCurrentLocation();
      if (currentLocation) {
        updateLocation(currentLocation);
      }
      startDelivery(delivery.delivery_id);
      Alert.alert(
        "Entrega Iniciada",
        "¿Deseas abrir Google Maps para iniciar la navegación?",
        [
          { text: "Más tarde", style: "cancel" },
          { text: "Navegar", onPress: () => handleNavigate() },
        ]
      );
    } catch (error) {
      Alert.alert("Error", "No se pudo iniciar la entrega");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigate = async () => {
    if (!destinationLocation) {
      Alert.alert("Error", "No se puede iniciar la navegación");
      return;
    }
    await LocationService.openGoogleMaps(
      destinationLocation,
      state.currentLocation || undefined
    );
  };

  const handleCompleteDelivery = () => {
    if (!delivery) return;
    Alert.alert(
      "Completar Entrega",
      "¿Confirmas que la entrega ha sido completada exitosamente?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Completar",
          onPress: async () => {
            setIsLoading(true);
            try {
              const currentLocation =
                await LocationService.getCurrentLocation();
              if (currentLocation) {
                updateLocation(currentLocation);
              }
              completeDelivery(delivery.delivery_id);
              router.back();
            } catch (error) {
              Alert.alert("Error", "No se pudo completar la entrega");
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "pending":
        return "#FFA500";
      case "in_progress":
        return "#007AFF";
      case "completed":
        return "#28A745";
      default:
        return "#6C757D";
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case "pending":
        return "Pendiente";
      case "in_progress":
        return "En Progreso";
      case "completed":
        return "Completada";
      default:
        return "Desconocido";
    }
  };

  if (!delivery) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <FontAwesome name="arrow-left" size={20} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cargando...</Text>
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER SIMPLIFICADO */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <FontAwesome name="arrow-left" size={20} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalle de Entrega</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(delivery.status) },
            ]}
          >
            <Text style={styles.statusText}>
              {getStatusText(delivery.status)}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información del Cliente</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <FontAwesome name="user" size={20} color="#007AFF" />
              <Text style={styles.infoLabel}>Nombre:</Text>
              <Text style={styles.infoValue}>
                {delivery.client?.name || "N/A"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <FontAwesome name="phone" size={20} color="#007AFF" />
              <Text style={styles.infoLabel}>Teléfono:</Text>
              <Text style={styles.infoValue}>
                {delivery.client?.phone || "N/A"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ubicación</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <FontAwesome name="map-marker" size={20} color="#007AFF" />
              <Text style={styles.infoLabel}>Coordenadas:</Text>
              <Text style={styles.infoValue}>
                {delivery.client?.gps_location || "N/A"}
              </Text>
            </View>
            {distance && (
              <View style={styles.infoRow}>
                <FontAwesome name="road" size={20} color="#007AFF" />
                <Text style={styles.infoLabel}>Distancia:</Text>
                <Text style={styles.infoValue}>{distance}</Text>
              </View>
            )}
          </View>
          {destinationLocation && (
            <TouchableOpacity
              style={styles.mapButton}
              onPress={handleViewOnMap}
            >
              <FontAwesome name="map" size={20} color="white" />
              <Text style={styles.mapButtonText}>Ver en Mapa</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información de Entrega</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <FontAwesome name="hashtag" size={20} color="#007AFF" />
              <Text style={styles.infoLabel}>ID:</Text>
              <Text style={styles.infoValue}>{delivery.delivery_id}</Text>
            </View>
            <View style={styles.infoRow}>
              <FontAwesome name="clock-o" size={20} color="#007AFF" />
              <Text style={styles.infoLabel}>Hora de inicio:</Text>
              <Text style={styles.infoValue}>
                {new Date(delivery.start_time).toLocaleTimeString()}
              </Text>
            </View>
            {delivery.estimated_duration && (
              <View style={styles.infoRow}>
                <FontAwesome name="hourglass-half" size={20} color="#007AFF" />
                <Text style={styles.infoLabel}>Duración estimada:</Text>
                <Text style={styles.infoValue}>
                  {delivery.estimated_duration}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <View style={styles.actionButtons}>
        {delivery.status === "pending" && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.startButton,
              isLoading && styles.buttonDisabled,
            ]}
            onPress={handleStartDelivery}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <FontAwesome name="play" size={20} color="white" />
                <Text style={styles.actionButtonText}>Iniciar Entrega</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {delivery.status === "in_progress" && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.navigateButton]}
              onPress={handleNavigate}
            >
              <FontAwesome name="map-marker" size={20} color="white" />
              <Text style={styles.actionButtonText}>Navegar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.completeButton,
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleCompleteDelivery}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <FontAwesome name="check" size={20} color="white" />
                  <Text style={styles.actionButtonText}>Completar</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "white",
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: "bold",
    flex: 1, // Permite que el título se centre correctamente
  },
  headerSpacer: {
    width: 30, // Espacio a la derecha para balancear el botón de regreso
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statusContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  statusBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#333",
  },
  infoCard: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  infoLabel: {
    fontSize: 16,
    marginLeft: 10,
    marginRight: 10,
    fontWeight: "500",
    minWidth: 80,
  },
  infoValue: {
    fontSize: 16,
    flex: 1,
    color: "#666",
  },
  mapButton: {
    backgroundColor: "#28A745",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  mapButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  actionButtons: {
    backgroundColor: "white",
    padding: 20,
    paddingBottom: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    padding: 15,
    flex: 1,
  },
  actionButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  startButton: {
    backgroundColor: "#007AFF",
  },
  navigateButton: {
    backgroundColor: "#FFA500",
    marginRight: 10,
  },
  completeButton: {
    backgroundColor: "#28A745",
    marginLeft: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
