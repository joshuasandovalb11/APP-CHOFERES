import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  FlatList,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Text, View } from "@/components/Themed";
import { useApp } from "@/context/AppContext";
import LocationService from "@/services/location";
import { useDeliveryTracking } from "@/hooks/useDeliveryTracking";
import { Delivery } from "@/types";

export default function DashboardScreen() {
  const { state, logout, dispatch } = useApp();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const tracking = useDeliveryTracking();
  const router = useRouter();

  useEffect(() => {
    initializeLocation();
  }, []);

  useEffect(() => {
    if (!state.isLoggedIn || !state.driver || !state.currentFEC) {
      router.replace("/login");
    }
  }, [state.isLoggedIn, state.driver, state.currentFEC]);

  const initializeLocation = async () => {
    const location = await LocationService.getCurrentLocation();
    if (location) {
      dispatch({ type: "SET_LOCATION", payload: location });
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await initializeLocation();
    setIsRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert("Cerrar Sesión", "¿Estás seguro de que deseas cerrar sesión?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar Sesión",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  };

  const handleDeliveryPress = (delivery: Delivery) => {
    router.push({
      pathname: "/delivery-detail",
      params: { deliveryId: delivery.delivery_id.toString() },
    });
  };

  const getListData = (): Delivery[] => {
    switch (selectedTab) {
      case 0: // Pendientes
        return state.currentLocation
          ? LocationService.sortDeliveriesByProximity(
              state.deliveryStatus.nextDeliveries,
              state.currentLocation
            )
          : state.deliveryStatus.nextDeliveries;
      case 1: // Completadas
        return state.deliveryStatus.completedDeliveries || [];
      default:
        return [];
    }
  };

  const listData = getListData();
  const tabTitles = ["Pendientes", "Completadas"]; // <-- PESTAÑAS SIMPLIFICADAS

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

  const formatDistance = (distance?: number) => {
    if (!distance && distance !== 0) return "N/A";
    if (distance < 1000) return `${Math.round(distance)}m`;
    return `${(distance / 1000).toFixed(1)}km`;
  };

  const renderDeliveryItem = ({ item }: { item: Delivery }) => (
    <TouchableOpacity
      style={styles.deliveryCard}
      onPress={() => handleDeliveryPress(item)}
    >
      <View style={styles.deliveryHeader}>
        <Text style={styles.clientName}>
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

      <View style={styles.deliveryInfo}>
        <View style={styles.infoRow}>
          <FontAwesome name="phone" size={16} color="#666" />
          <Text style={styles.infoText}>{item.client?.phone || "N/A"}</Text>
        </View>

        {item.status === "pending" && (
          <View style={styles.infoRow}>
            <FontAwesome name="map-marker" size={16} color="#666" />
            <Text style={styles.infoText}>
              Distancia: {formatDistance(item.distance)}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.deliveryFooter}>
        <Text style={styles.deliveryId}>ID: {item.delivery_id}</Text>
        <FontAwesome name="chevron-right" size={16} color="#007AFF" />
      </View>
    </TouchableOpacity>
  );

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
        icon: "history",
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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.driverName}>Hola, {state.driver.username}</Text>
          <Text style={styles.vehicleInfo}>
            {state.driver.vehicle_plate} - {state.driver.num_unity}
          </Text>
          <Text style={styles.fecInfo}>FEC: {state.currentFEC.fec_number}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <FontAwesome name="sign-out" size={20} color="#DC3545" />
        </TouchableOpacity>
      </View>

      {/* Current Delivery */}
      {state.deliveryStatus.hasActiveDelivery &&
        state.deliveryStatus.currentDelivery && (
          <View style={styles.currentDeliveryContainer}>
            <Text style={styles.sectionTitle}>Entrega Actual</Text>
            <TouchableOpacity
              style={[styles.deliveryCard, styles.activeDeliveryCard]}
              onPress={() =>
                handleDeliveryPress(state.deliveryStatus.currentDelivery!)
              }
            >
              <View style={styles.activeDeliveryHeader}>
                <Text style={styles.currentDeliveryText}>
                  {state.deliveryStatus.currentDelivery.client?.name ||
                    "Cliente desconocido"}
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
    </View>
  );
}

// Estilos (sin cambios funcionales)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5ff5",
  },
  header: {
    backgroundColor: "white",
    padding: 20,
    paddingTop: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 5,
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
    padding: 10,
  },
  currentDeliveryContainer: {
    backgroundColor: "white",
    margin: 15,
    padding: 15,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deliveryListContainer: {
    flex: 1,
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#333",
  },
  deliveryCard: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  activeDeliveryCard: {
    borderColor: "#007AFF",
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
    fontSize: 12,
    color: "#999",
  },
  currentDeliveryText: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 5,
  },
  currentDeliverySubtext: {
    fontSize: 14,
    color: "#007AFF",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    marginTop: 20,
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
  },
  androidTabTextActive: {
    fontWeight: "bold",
    color: "#007AFF",
  },
});
