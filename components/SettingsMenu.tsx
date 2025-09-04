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
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from "react-native-reanimated";

const { width, height } = Dimensions.get("window");

// Definimos las props que el componente recibirá
interface SettingsMenuProps {
  visible: boolean;
  onClose: () => void;
  onLogoutPress: () => void;
  isOffline: boolean;
}

export default function SettingsMenu({
  visible,
  onClose,
  onLogoutPress,
  isOffline,
}: SettingsMenuProps) {
  const [isModalVisible, setIsModalVisible] = useState(visible);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const offsetX = useSharedValue(-width); // Posición inicial del menú (fuera de la pantalla)
  const overlayOpacity = useSharedValue(0); // Opacidad inicial del fondo oscuro

  // Este efecto se ejecuta cada vez que el menú se hace visible
  useEffect(() => {
    if (visible) {
      setIsModalVisible(true);
      offsetX.value = withSpring(0, { damping: 15 });
      overlayOpacity.value = withTiming(1, { duration: 300 });
      checkCurrentPermissions();
    } else {
      offsetX.value = withTiming(-width * 0.8, { duration: 250 });
      overlayOpacity.value = withTiming(0, { duration: 300 }, (finished) => {
        if (finished) {
          runOnJS(setIsModalVisible)(false);
        }
      });
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
      Linking.openSettings();
    } else {
      const { status: newStatus } =
        await Notifications.requestPermissionsAsync();
      setNotificationsEnabled(newStatus === "granted");
    }
  };

  // Manejador para el switch de ubicación
  const handleLocationToggle = async () => {
    const permissionsOk =
      await locationService.checkAndRequestLocationPermissions();
    setLocationEnabled(permissionsOk);
  };

  // Funcion para manejar el cierre de sesión
  const handleLogoutPress = () => {
    onClose();
    onLogoutPress();
  };

  const animatedMenuContainerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: offsetX.value }],
    };
  });

  const animatedOverlayStyle = useAnimatedStyle(() => {
    return {
      opacity: overlayOpacity.value,
    };
  });

  if (!isModalVisible) {
    return null;
  }

  return (
    <Modal
      visible={isModalVisible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.overlay, animatedOverlayStyle]}>
        <TouchableOpacity
          style={styles.touchableOverlay}
          activeOpacity={1}
          onPress={onClose}
        />
      </Animated.View>

      <Animated.View style={[styles.menuContainer, animatedMenuContainerStyle]}>
        <Text style={styles.title}>Configuración</Text>

        <View style={styles.optionRow}>
          <FontAwesome name="wifi" size={18} color="#333" />
          <Text style={styles.optionText}>Estado de la Red</Text>
          <Text
            style={[
              styles.statusText,
              isOffline ? styles.offlineText : styles.onlineText,
            ]}
          >
            {isOffline ? "Offline" : "Online"}
          </Text>
        </View>

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
          <FontAwesome name="sign-out" size={25} color="#FF3B30" />
          <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

// Estilos para que se vea como un menú lateral
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(94, 93, 93, 0.5)",
  },
  touchableOverlay: {
    flex: 1,
  },
  menuContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    height: height,
    width: width * 0.8,
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
    bottom: 40,
    left: 20,
    padding: 10,
  },
  logoutButtonText: {
    fontSize: 16,
    color: "#FF3B30",
    marginLeft: 15,
    fontWeight: "bold",
  },
  statusText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  onlineText: {
    color: "#34C759", // Verde iOS
  },
  offlineText: {
    color: "#FF3B30", // Rojo iOS (igual que el de logout)
  },
});
