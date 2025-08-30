import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Text, View } from "@/components/Themed";
import { useApp } from "@/context/AppContext";
import LocationService from "@/services/location";
import { Delivery, Location } from "@/types";
import MapView, { Marker } from "react-native-maps";

const { width } = Dimensions.get("window");

interface ModalInfo {
  visible: boolean;
  title: string;
  message: string;
  buttons: {
    text: string;
    onPress: () => void;
    style?: "cancel" | "confirm";
  }[];
}

export default function DeliveryDetailScreen() {
  const {
    state,
    startDelivery,
    completeDelivery,
    updateLocation,
    logDeliveryEvent,
  } = useApp();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [destinationLocation, setDestinationLocation] =
    useState<Location | null>(null);
  const [distance, setDistance] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams();

  const [modalInfo, setModalInfo] = useState<ModalInfo>({
    visible: false,
    title: "",
    message: "",
    buttons: [],
  });

  const hideModal = () => {
    setModalInfo({ ...modalInfo, visible: false });
  };

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
      setModalInfo({
        visible: true,
        title: "Error",
        message: "Entrega no encontrada",
        buttons: [{ text: "OK", onPress: () => router.back() }],
      });
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

  const handleStartDelivery = () => {
    if (!delivery) return;
    if (state.deliveryStatus.hasActiveDelivery) {
      setModalInfo({
        visible: true,
        title: "Entrega ya en progreso",
        message:
          "Ya tienes una entrega activa. Debes completarla antes de iniciar otra.",
        buttons: [{ text: "OK", onPress: hideModal }],
      });
      return;
    }

    setModalInfo({
      visible: true,
      title: "Iniciar Entrega",
      message: "¿Deseas iniciar la navegación con Google Maps?",
      buttons: [
        { text: "Cancelar", onPress: hideModal, style: "cancel" },
        {
          text: "Navegar",
          onPress: async () => {
            hideModal();
            setIsLoading(true);
            try {
              const currentLocation =
                await LocationService.getCurrentLocation();
              if (currentLocation) {
                updateLocation(currentLocation);
                logDeliveryEvent(
                  "start_delivery",
                  delivery.delivery_id,
                  currentLocation
                );
              }
              startDelivery(delivery.delivery_id);
              handleNavigate();
            } catch (error) {
              setModalInfo({
                visible: true,
                title: "Error",
                message: "No se pudo iniciar la entrega.",
                buttons: [{ text: "OK", onPress: hideModal }],
              });
            } finally {
              setIsLoading(false);
            }
          },
          style: "confirm",
        },
      ],
    });
  };

  const handleCompleteDelivery = () => {
    if (!delivery) return;
    setModalInfo({
      visible: true,
      title: "Completar Entrega",
      message: "¿Confirmas que la entrega ha sido completada exitosamente?",
      buttons: [
        { text: "Cancelar", onPress: hideModal, style: "cancel" },
        {
          text: "Completar",
          onPress: async () => {
            hideModal();
            setIsLoading(true);
            try {
              const currentLocation =
                await LocationService.getCurrentLocation();
              if (currentLocation) {
                updateLocation(currentLocation);
                logDeliveryEvent(
                  "end_delivery",
                  delivery.delivery_id,
                  currentLocation
                );
              }
              completeDelivery(delivery.delivery_id);
              router.back();
            } catch (error) {
              setModalInfo({
                visible: true,
                title: "Error",
                message: "No se pudo completar la entrega.",
                buttons: [{ text: "OK", onPress: hideModal }],
              });
            } finally {
              setIsLoading(false);
            }
          },
          style: "confirm",
        },
      ],
    });
  };

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

  const handleNavigate = async () => {
    if (!destinationLocation) {
      setModalInfo({
        visible: true,
        title: "Error",
        message: "No se puede iniciar la navegación.",
        buttons: [{ text: "OK", onPress: hideModal }],
      });
      return;
    }
    await LocationService.openGoogleMaps(
      destinationLocation,
      state.currentLocation || undefined
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

  const getStatusIcon = (
    status?: string
  ): keyof typeof FontAwesome.glyphMap => {
    switch (status) {
      case "pending":
        return "clock-o";
      case "in_progress":
        return "truck";
      case "completed":
        return "check-circle-o";
      default:
        return "question-circle";
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
      {/* SECCION DEL HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <FontAwesome name="chevron-left" size={20} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalle de Entrega</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* SECCION DE INFORMACION */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* INDICADOR DE ESTADO */}
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: getStatusColor(delivery.status),
                shadowColor: getStatusColor(delivery.status),
              },
            ]}
          >
            <FontAwesome
              name={getStatusIcon(delivery.status)}
              size={16}
              color="white"
              style={styles.statusIcon}
            />
            <Text style={styles.statusText}>
              {getStatusText(delivery.status)}
            </Text>
          </View>
        </View>

        {/* TARJETA INFORMACION DEL CLIENTE */}
        <View style={styles.section}>
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>Información del Cliente</Text>
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

        {/* TARJETA INFORMACION DE LA ENTREGA */}
        <View style={styles.section}>
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>Información de Entrega</Text>
            <View style={styles.infoRow}>
              <FontAwesome name="hashtag" size={20} color="#007AFF" />
              <Text style={styles.infoLabel}>No. Orden:</Text>
              <Text style={styles.infoValue}>{delivery.delivery_id}</Text>
            </View>
            {distance && (
              <View style={[styles.infoRow]}>
                <FontAwesome name="road" size={20} color="#007AFF" />
                <Text style={styles.infoLabel}>Distancia:</Text>
                <Text style={styles.infoValue}>{distance}</Text>
              </View>
            )}

            <View
              style={[
                styles.infoRow,
                { justifyContent: "center" },
                { marginBottom: -2 },
                { marginTop: 5 },
              ]}
            >
              <FontAwesome name="map" size={20} color="#007AFF" />
              <Text style={styles.infoLabel}>Ubicación del cliente</Text>
            </View>

            {/* SECCION DEL MAPA INTERACTIVO */}
            {destinationLocation && (
              <View style={styles.mapContainer}>
                <MapView
                  style={styles.map}
                  region={{
                    latitude: destinationLocation.latitude,
                    longitude: destinationLocation.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                  pitchEnabled={false}
                  rotateEnabled={false}
                  scrollEnabled={true}
                  zoomEnabled={true}
                >
                  <Marker
                    coordinate={destinationLocation}
                    title={delivery.client?.name || "Cliente"}
                  />
                </MapView>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* BOTONES DE ACCION */}
      <View style={styles.actionButtons}>
        {delivery.status === "pending" && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.startButton,
              (isLoading || state.deliveryStatus.hasActiveDelivery) &&
                styles.buttonDisabled,
            ]}
            onPress={handleStartDelivery}
            disabled={isLoading || state.deliveryStatus.hasActiveDelivery}
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

      {/* MODAL GENERICO PARA CONFIRMAR ACCIONES */}
      <Modal
        transparent={true}
        visible={modalInfo.visible}
        animationType="fade"
        onRequestClose={hideModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{modalInfo.title}</Text>
            <Text style={styles.modalText}>{modalInfo.message}</Text>
            <View style={styles.modalButtonContainer}>
              {modalInfo.buttons.map((button, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.modalButton,
                    button.style === "cancel"
                      ? styles.modalButtonCancel
                      : styles.modalButtonConfirm,
                  ]}
                  onPress={button.onPress}
                >
                  <Text
                    style={
                      button.style === "cancel"
                        ? styles.modalButtonTextCancel
                        : styles.modalButtonText
                    }
                  >
                    {button.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  header: {
    backgroundColor: "white",
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#EFEFEF",
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: "bold",
    flex: 1,
  },
  headerSpacer: {
    width: 30,
  },
  content: {
    flex: 1,
    marginBottom: -30,
  },
  contentContainer: {
    padding: 15,
  },
  statusContainer: {
    alignItems: "center",
    marginBottom: 15,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 10,
  },
  statusIcon: {
    marginRight: 8,
  },
  statusText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  infoCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: "#EFEFEF",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    marginLeft: 15,
    marginRight: 10,
    fontWeight: "500",
    color: "#555",
    minWidth: 70,
  },
  infoValue: {
    fontSize: 14,
    flex: 1,
    color: "#333",
    textAlign: "right",
  },
  actionButtons: {
    backgroundColor: "white",
    padding: 15,
    paddingBottom: 25,
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
    backgroundColor: "#007AFF",
    marginRight: 10,
  },
  completeButton: {
    backgroundColor: "#28A745",
    marginLeft: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Estilos del mapa
  mapContainer: {
    height: 280,
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#EFEFEF",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 20,
    width: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  modalText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    color: "#333",
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 5,
  },
  modalButtonCancel: {
    backgroundColor: "#f0f0f0",
  },
  modalButtonConfirm: {
    backgroundColor: "#007AFF",
  },
  modalButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  modalButtonTextCancel: {
    color: "#333",
    fontWeight: "bold",
  },
});
