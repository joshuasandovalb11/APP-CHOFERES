import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Linking,
  Dimensions,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import locationService from "@/services/location";

const { width, height } = Dimensions.get("window");

// Definimos las props que el componente recibirá
interface SettingsMenuProps {
  visible: boolean;
  onClose: () => void;
  onLogoutPress: () => void;
}

export default function SettingsMenu({
  visible,
  onClose,
  onLogoutPress,
}: SettingsMenuProps) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);

  // Este efecto se ejecuta cada vez que el menú se hace visible
  useEffect(() => {
    if (visible) {
      checkCurrentPermissions();
    }
  }, [visible]);

  // Función para verificar el estado actual de los permisos y actualizar los switches
  const checkCurrentPermissions = async () => {
    const { status: notificationStatus } =
      await Notifications.getPermissionsAsync();
    setNotificationsEnabled(notificationStatus === "granted");

    const { status: backgroundStatus } =
      await Location.getBackgroundPermissionsAsync();
    setLocationEnabled(backgroundStatus === "granted");
  };

  // Manejador para el switch de notificaciones
  const handleNotificationsToggle = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === "granted") {
      // Si ya están concedidos, el switch solo puede llevar a configuración para desactivarlos
      Linking.openSettings();
    } else {
      // Si no están concedidos, pedimos permiso
      const { status: newStatus } =
        await Notifications.requestPermissionsAsync();
      setNotificationsEnabled(newStatus === "granted");
    }
  };

  // Manejador para el switch de ubicación
  const handleLocationToggle = async () => {
    // Usamos nuestra función inteligente que ya creamos en el servicio
    // Esta función ya muestra el modal correcto si es necesario
    const permissionsOk =
      await locationService.checkAndRequestLocationPermissions();
    setLocationEnabled(permissionsOk);
  };

  const handleLogoutPress = () => {
    onClose();
    onLogoutPress();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.menuContainer}>
          <Text style={styles.title}>Configuración</Text>

          <View style={styles.optionRow}>
            <FontAwesome name="bell" size={20} color="#333" />
            <Text style={styles.optionText}>Notificaciones</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationsToggle}
              trackColor={{ false: "#767577", true: "#81b0ff" }}
              thumbColor={notificationsEnabled ? "#007AFF" : "#f4f3f4"}
            />
          </View>

          <View style={styles.optionRow}>
            <FontAwesome name="location-arrow" size={22} color="#333" />
            <Text style={styles.optionText}> Permisos de Ubicación</Text>
            <Switch
              value={locationEnabled}
              onValueChange={handleLocationToggle}
              trackColor={{ false: "#767577", true: "#81b0ff" }}
              thumbColor={locationEnabled ? "#007AFF" : "#f4f3f4"}
            />
          </View>

          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogoutPress}
          >
            <FontAwesome name="sign-out" size={20} color="#FF3B30" />
            <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// Estilos para que se vea como un menú lateral
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  menuContainer: {
    height: height,
    width: width * 0.8, // Ocupa el 80% del ancho
    backgroundColor: "white",
    paddingTop: 40,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 30,
    color: "#007AFF",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 15,
  },
  separator: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginVertical: 20,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    position: "absolute",
    bottom: 80,
    left: 20,
    padding: 10,
  },
  logoutButtonText: {
    fontSize: 16,
    color: "#FF3B30",
    marginLeft: 15,
    fontWeight: "bold",
  },
});
