import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  Platform,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Text, View } from "@/components/Themed";
import { useApp } from "@/context/AppContext";
import LocationService from "@/services/location";
import { useDeliveryTracking } from "@/hooks/useDeliveryTracking";
import { Delivery } from "@/types";
import SettingsMenu from "@/components/SettingsMenu";
import * as Notifications from "expo-notifications";

export default function DashboardScreen() {
  const { state, logout, dispatch, isOffline } = useApp();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const tracking = useDeliveryTracking();
  const router = useRouter();

  // Estados para controlar los modales
  const [isLogoutModalVisible, setLogoutModalVisible] = useState(false);
  const [isAutoLogoutModalVisible, setAutoLogoutModalVisible] = useState(false);

  const warningTimerRef = useRef<NodeJS.Timeout | number | null>(null);
  const logoutTimerRef = useRef<NodeJS.Timeout | number | null>(null);

  const TIME_UNTIL_WARNING = 1 * 60 * 1000;
  const LOGOUT_COUNTDOWN = 30 * 1000;

  const [isMenuVisible, setMenuVisible] = useState(false);

  // Limpia y cancela los temporizadores de cierre de sesión.
  const cleanupTimers = () => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
  };

  // Ejecuta el cierre de sesión final.
  const startFinalLogoutCountdown = async () => {
    setAutoLogoutModalVisible(false);
    await logout();
  };

  // Muestra el modal de advertencia e inicia el conteo final.
  const showLogoutWarning = () => {
    setAutoLogoutModalVisible(true);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    logoutTimerRef.current = setTimeout(
      startFinalLogoutCountdown,
      LOGOUT_COUNTDOWN
    );
    Notifications.scheduleNotificationAsync({
      content: {
        title: "Cierre de sesión automático en progreso",
        body: "Tu sesión se cerrará en 30 segundos a menos que la canceles.",
        sound: "default",
        vibrate: [0, 250, 250, 250],
        data: { type: "logout_warning" },
      },
      trigger: null,
    });
  };

  // Inicia el temporizador principal para el cierre de sesión automático.
  const startLogoutTimer = () => {
    cleanupTimers();
    warningTimerRef.current = setTimeout(showLogoutWarning, TIME_UNTIL_WARNING);
  };

  // Vigila el estado de las entregas para iniciar/detener el timer de logout.
  useEffect(() => {
    const { hasActiveDelivery, nextDeliveries } = state.deliveryStatus;
    const allTasksCompleted = !hasActiveDelivery && nextDeliveries.length === 0;

    if (allTasksCompleted) {
      startLogoutTimer();
    } else {
      cleanupTimers();
    }
    return () => cleanupTimers();
  }, [state.deliveryStatus]);

  useEffect(() => {
    initializeLocation();
  }, []);

  // Redirige al login si el usuario no está autenticado.
  useEffect(() => {
    if (!state.isLoggedIn && !state.driver && !state.currentFEC) {
      router.replace("/login");
    }
  }, [state.isLoggedIn, state.driver, state.currentFEC]);

  // Obtiene y guarda la ubicación actual del conductor.
  const initializeLocation = async () => {
    const location = await LocationService.getCurrentLocation();
    if (location) {
      dispatch({ type: "SET_LOCATION", payload: location });
    }
  };

  // Maneja el gesto de "deslizar para refrescar".
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await initializeLocation();
    setIsRefreshing(false);
  };

  // Maneja el cierre de sesión manual.
  const handleLogout = () => {
    cleanupTimers();
    setLogoutModalVisible(true);
  };

  // Navega a la pantalla de detalle de entrega.
  const handleDeliveryPress = (delivery: Delivery) => {
    router.push({
      pathname: "/delivery-detail",
      params: { deliveryId: delivery.delivery_id.toString() },
    });
  };

  // Lógica para determinar la entrega a mostrar y la lista de pendientes
  const { currentDelivery, completedDeliveries } = state.deliveryStatus;

  // Ordenamos las entregas pendientes (incluyendo la que está en progreso)
  const sortedPendingDeliveries = useMemo(() => {
    const pending =
      state.currentFEC?.deliveries.filter((d) => d.status !== "completed") ||
      [];

    const optimizedOrderIds = state.currentFEC?.optimizedOrderId_list;

    if (optimizedOrderIds && optimizedOrderIds.length > 0) {
      const deliveryMap = new Map(pending.map((d) => [d.delivery_id, d]));
      return optimizedOrderIds
        .map((id) => deliveryMap.get(id))
        .filter((d): d is Delivery => d !== undefined);
    }

    if (state.currentLocation && pending.length > 0) {
      return LocationService.sortDeliveriesByProximity(
        pending,
        state.currentLocation
      );
    }

    return pending;
  }, [state.currentFEC, state.currentLocation]);

  const deliveryToShow = currentDelivery || sortedPendingDeliveries[0] || null;

  // Lista de pendientes excluyendo la entrega actual
  const pendingList = useMemo(() => {
    if (currentDelivery) {
      return sortedPendingDeliveries.filter(
        (d) => d.delivery_id !== currentDelivery.delivery_id
      );
    }
    return sortedPendingDeliveries.slice(1);
  }, [currentDelivery, sortedPendingDeliveries]);

  // Retorna la lista de entregas según la pestaña activa.
  const getListData = (): Delivery[] => {
    switch (selectedTab) {
      case 0: // Pendientes
        return pendingList;
      case 1: // Completadas
        return state.deliveryStatus.completedDeliveries || [];
      default:
        return [];
    }
  };

  const listData = getListData();
  const tabTitles = ["Pendientes", "Completadas"];

  // Retorna un color según el estado de la entrega.
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

  // Retorna un texto legible para el estado.
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

  // Formatea la distancia a metros o kilómetros.
  const formatDistance = (distance?: number) => {
    if (!distance && distance !== 0) return "N/A";
    if (distance < 1000) return `${Math.round(distance)}m`;
    return `${(distance / 1000).toFixed(1)}km`;
  };

  // Renderiza un item de la lista de entregas.
  const renderDeliveryItem = ({
    item,
    index,
  }: {
    item: Delivery;
    index: number;
  }) => {
    const isDisabled =
      selectedTab === 0 ||
      (selectedTab === 1 && state.deliveryStatus.hasActiveDelivery);

    const innerViewBackgroundColor = isDisabled ? "transparent" : "white";

    return (
      <TouchableOpacity
        style={[styles.deliveryCard, isDisabled && styles.deliveryCardDisabled]}
        onPress={() => handleDeliveryPress(item)}
        disabled={isDisabled}
      >
        <View
          style={[
            styles.deliveryHeader,
            { backgroundColor: innerViewBackgroundColor },
          ]}
        >
          <Text style={styles.clientName}>
            {item.client?.client_id || "ID desconocido"} -{" "}
            {item.client?.name || "Cliente desconocido"}
          </Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(item.status) },
            ]}
          >
            <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
          </View>
        </View>

        <View
          style={[
            styles.deliveryInfo,
            { backgroundColor: innerViewBackgroundColor },
          ]}
        >
          <View
            style={[
              styles.infoRow,
              { backgroundColor: innerViewBackgroundColor },
            ]}
          >
            <FontAwesome name="phone" size={20} color="#007AFF" />
            <Text style={styles.infoText}>{item.client?.phone || "N/A"}</Text>
          </View>

          {item.status === "pending" && (
            <View
              style={[
                styles.infoRow,
                { backgroundColor: innerViewBackgroundColor },
              ]}
            >
              <FontAwesome name="location-arrow" size={20} color="#007AFF" />
              <Text style={styles.infoText}>
                Distancia: {formatDistance(item.distance)}
              </Text>
            </View>
          )}
        </View>

        <View
          style={[
            styles.deliveryFooter,
            { backgroundColor: innerViewBackgroundColor },
          ]}
        >
          <Text style={[styles.deliveryId, { color: "#007AFF" }]}>
            # Orden: {item.delivery_id}
          </Text>
          <FontAwesome name="chevron-right" size={20} color="#007AFF" />
        </View>
      </TouchableOpacity>
    );
  };

  // Renderiza el mensaje para listas vacías.
  const renderEmptyState = () => {
    const messages: {
      [key: number]: { icon: any; color: string; title: string; text: string };
    } = {
      0: {
        icon: "check-circle",
        color: "#28A745",
        title: "¡Todo listo por hoy!",
        text: "No tienes entregas pendientes.",
      },
      1: {
        icon: "send",
        color: "#6C757D",
        title: "Sin Entregas Completadas",
        text: "Aún no has completado ninguna entrega.",
      },
    };
    const currentMessage = messages[selectedTab];

    return (
      <View style={styles.emptyState}>
        <FontAwesome
          name={currentMessage.icon}
          size={64}
          color={currentMessage.color}
        />
        <Text style={styles.emptyStateTitle}>{currentMessage.title}</Text>
        <Text style={styles.emptyStateText}>{currentMessage.text}</Text>
      </View>
    );
  };

  if (!state.isLoggedIn || !state.driver || !state.currentFEC) {
    return null;
  }

  return (
    <View style={styles.container}>
      <SettingsMenu
        visible={isMenuVisible}
        onClose={() => setMenuVisible(false)}
        onLogoutPress={handleLogout}
        isOffline={isOffline}
      />
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.driverName}>Hola, {state.driver.username}</Text>
          <Text style={styles.vehicleInfo}>
            {state.driver.vehicle_plate} - {state.driver.num_unity}
          </Text>
          <Text style={styles.fecInfo}>FEC: {state.currentFEC.fec_number}</Text>
        </View>
        <TouchableOpacity onPress={() => setMenuVisible(true)}>
          <FontAwesome name="bars" size={25} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Sección de Entrega Actual / Siguiente Entrega */}
      {deliveryToShow && (
        <View style={styles.currentDeliveryContainer}>
          <Text style={styles.sectionTitle}>
            {deliveryToShow.status === "in_progress"
              ? "Entrega Actual"
              : "Siguiente Entrega"}
          </Text>
          <TouchableOpacity
            style={[
              styles.deliveryCard,
              deliveryToShow.status === "in_progress"
                ? styles.activeDeliveryCard
                : styles.nextDeliveryCard,
            ]}
            onPress={() => handleDeliveryPress(deliveryToShow)}
          >
            {/* --- VISTA PARA ENTREGA EN PROGRESO --- */}
            {deliveryToShow.status === "in_progress" && (
              <>
                <View style={styles.activeDeliveryHeader}>
                  <Text style={styles.currentDeliveryText}>
                    {deliveryToShow.client?.client_id || "ID desconocido"} -{" "}
                    {deliveryToShow.client?.name || "Cliente desconocido"}
                  </Text>
                  {tracking.isTimerActive && (
                    <View style={styles.timerContainer}>
                      <FontAwesome name="clock-o" size={16} color="#007AFF" />
                      <Text style={styles.timerText}>
                        {tracking.formattedTime}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.trackingInfo}>
                  <Text style={styles.currentDeliverySubtext}>
                    En progreso...
                  </Text>
                  {tracking.isTracking && (
                    <View style={styles.trackingStats}>
                      <View style={styles.trackingStat}>
                        <FontAwesome
                          name="map-marker"
                          size={12}
                          color="#28A745"
                        />
                        <Text style={styles.trackingStatText}>
                          Tracking activo
                        </Text>
                      </View>
                      <View style={styles.trackingStat}>
                        <FontAwesome name="road" size={12} color="#666" />
                        <Text style={styles.trackingStatText}>
                          {tracking.totalDistance > 0
                            ? formatDistance(tracking.totalDistance)
                            : "0m"}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </>
            )}

            {/* --- VISTA PARA SIGUIENTE ENTREGA (PENDIENTE) --- */}
            {deliveryToShow.status === "pending" && (
              <>
                <View style={styles.deliveryHeader}>
                  <Text style={styles.clientName}>
                    {deliveryToShow.client?.client_id || "ID desconocido"} -{" "}
                    {deliveryToShow.client?.name || "Cliente desconocido"}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: getStatusColor(deliveryToShow.status),
                      },
                    ]}
                  >
                    <Text style={styles.statusText}>Toca para iniciar</Text>
                  </View>
                </View>
                <View style={styles.deliveryInfo}>
                  <View style={styles.infoRow}>
                    <FontAwesome name="phone" size={20} color="#007AFF" />
                    <Text style={styles.infoText}>
                      {deliveryToShow.client?.phone || "N/A"}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <FontAwesome
                      name="location-arrow"
                      size={20}
                      color="#007AFF"
                    />
                    <Text style={styles.infoText}>
                      Distancia: {formatDistance(deliveryToShow.distance)}
                    </Text>
                  </View>
                </View>
                <View style={styles.deliveryFooter}>
                  <Text style={[styles.deliveryId, { color: "#007AFF" }]}>
                    # Orden: {deliveryToShow.delivery_id}
                  </Text>
                  <FontAwesome name="chevron-right" size={20} color="#007AFF" />
                </View>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Delivery List with Tabs */}
      <View style={styles.deliveryListContainer}>
        <View style={styles.tabsContainer}>
          <View style={{ flexDirection: "row" }}>
            {tabTitles.map((title, index) => (
              <TouchableOpacity
                key={title}
                onPress={() => setSelectedTab(index)}
                style={[
                  styles.androidTab,
                  selectedTab === index && styles.androidTabActive,
                ]}
              >
                <Text
                  style={[
                    styles.androidTabText,
                    selectedTab === index && styles.androidTabTextActive,
                  ]}
                >
                  {title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {listData.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={listData}
            renderItem={renderDeliveryItem}
            keyExtractor={(item) => item.delivery_id.toString()}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* --- Modal para Logout Manual --- */}
      <Modal
        transparent={true}
        visible={isLogoutModalVisible}
        animationType="fade"
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cerrar Sesión</Text>
            <Text style={styles.modalText}>
              ¿Estás seguro de que deseas cerrar sesión?
            </Text>
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setLogoutModalVisible(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={async () => {
                  setLogoutModalVisible(false);
                  await logout();
                }}
              >
                <Text style={styles.modalButtonText}>Cerrar Sesión</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- Modal para Logout Automático --- */}
      <Modal
        transparent={true}
        visible={isAutoLogoutModalVisible}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cierre de sesión automático</Text>
            <Text style={styles.modalText}>
              Has completado todas tus entregas. Tu sesión se cerrará en{" "}
              {LOGOUT_COUNTDOWN / 1000} segundos.
            </Text>
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  cleanupTimers();
                  setAutoLogoutModalVisible(false);
                }}
              >
                <Text style={styles.modalButtonTextCancel}>Permanecer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={async () => {
                  cleanupTimers();
                  setAutoLogoutModalVisible(false);
                  await logout();
                }}
              >
                <Text style={styles.modalButtonText}>Cerrar Sesión</Text>
              </TouchableOpacity>
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
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "white",
    padding: 20,
    paddingBottom: 10,
    paddingTop: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 1,
  },
  headerInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#007AFF",
  },
  vehicleInfo: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  fecInfo: {
    fontSize: 12,
    color: "#999",
  },
  logoutButton: {
    paddingBottom: 40,
  },
  currentDeliveryContainer: {
    backgroundColor: "white",
    margin: 15,
    padding: 15,
    borderRadius: 10,
    // shadowColor: "#000",
    // shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: "hidden",
  },
  deliveryListContainer: {
    flex: 1,
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#333",
  },
  deliveryCard: {
    backgroundColor: "white",
    borderRadius: 10,
    borderColor: "#e9ecef",
    borderWidth: 1,
    padding: 15,
    marginBottom: 10,
    elevation: 1,
    overflow: "hidden",
  },
  deliveryCardDisabled: {
    opacity: 0.3,
    backgroundColor: "#e9ecef",
  },
  activeDeliveryCard: {
    borderColor: "#007AFF",
    borderWidth: 2,
  },
  nextDeliveryCard: {
    borderColor: "#FFA500",
    borderWidth: 2,
  },
  deliveryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  clientName: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "white",
    fontSize: 12,
    fontWeight: "500",
  },
  deliveryInfo: {
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  infoText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "500" as "500",
    color: "#666",
  },
  deliveryFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 10,
  },
  deliveryId: {
    fontSize: 14,
    color: "#999",
    fontWeight: "800" as "800",
  },
  currentDeliveryText: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 5,
    flex: 1, // Para que el texto no empuje el timer
  },
  currentDeliverySubtext: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    // marginTop: 10,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 10,
    textAlign: "center",
  },
  emptyStateText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  activeDeliveryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timerText: {
    marginLeft: 5,
    fontSize: 14,
    fontWeight: "600",
    color: "#007AFF",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  trackingInfo: {
    marginTop: 5,
  },
  trackingStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  trackingStat: {
    flexDirection: "row",
    alignItems: "center",
  },
  trackingStatText: {
    marginLeft: 5,
    fontSize: 12,
    color: "#666",
  },
  tabsContainer: {
    marginBottom: 15,
  },
  androidTab: {
    flex: 1,
    padding: 10,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "#ddd",
  },
  androidTabActive: {
    borderBottomColor: "#007AFF",
  },
  androidTabText: {
    color: "#666",
    fontSize: 16,
  },
  androidTabTextActive: {
    fontWeight: "bold",
    color: "#007AFF",
    fontSize: 16,
  },
  // Estilos para el modal
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
    backgroundColor: "#ff0019ff",
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
