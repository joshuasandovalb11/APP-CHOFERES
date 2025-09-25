import React, { useState } from "react";
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert, // Importar Alert para mensajes nativos
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Text, View } from "@/components/Themed";
import { useApp } from "@/context/AppContext";
import { apiService } from "@/services/api";
import { Driver } from "@/types";
import locationService from "@/services/location";
import ActionModal from "@/components/ActionModal";

export default function FECInputScreen() {
  const [fecNumber, setFecNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, startJourneyTracking, setOptimizedRoute } = useApp();
  const router = useRouter();
  const params = useLocalSearchParams();

  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState("");

  // Funcion para manejar cambios en el número FEC
  const handleFECNumberChange = (text: string) => {
    setFecNumber(text.replace(/[^0-9\s]/g, ""));
  };

  // Función para mostrar un error en el modal
  const showErrorModal = (message: string) => {
    setModalMessage(message);
    setModalVisible(true);
  };

  // Función para manejar el envío del número FEC
  const handleFECSubmit = async () => {
    if (!fecNumber.trim()) {
      Alert.alert("Error", "Por favor ingresa el número FEC");
      return;
    }

    setIsLoading(true);
    try {
      const hasPermissions =
        await locationService.checkAndRequestLocationPermissions();
      if (!hasPermissions) {
        setIsLoading(false);
        return;
      }

      // Crear objeto Driver temporal con el username del login
      const driver: Driver = {
        driver_id: 0,
        username: params.username as string,
        num_unity: "",
        vehicle_plate: "",
        phone_number: "",
      };

      let fecData = await apiService.getFEC(fecNumber);

      const hasCompleteOptimizedRoute =
        fecData.suggestedJourneyPolyline &&
        fecData.suggestedJourneyPolyline.length > 0 &&
        fecData.optimizedOrderId_list &&
        fecData.optimizedOrderId_list.length > 0;

      console.log("[FEC Input] Verificando ruta existente:", {
        fecId: fecData.fec_id,
        hasSuggestedPolyline: !!fecData.suggestedJourneyPolyline,
        polylineLength: fecData.suggestedJourneyPolyline?.length || 0,
        hasOptimizedOrder: !!fecData.optimizedOrderId_list,
        optimizedOrderLength: fecData.optimizedOrderId_list?.length || 0,
        hasCompleteRoute: hasCompleteOptimizedRoute,
      });

      if (!hasCompleteOptimizedRoute) {
        console.log(
          "[FEC Input] No se encontró ruta optimizada completa. Calculando..."
        );

        try {
          const currentLocation = await locationService.getCurrentLocation();

          if (currentLocation && fecData.deliveries.length > 0) {
            const pendingDeliveries = fecData.deliveries.filter(
              (delivery) => delivery.status === "pending"
            );

            if (pendingDeliveries.length > 0) {
              console.log(
                `[FEC Input] Calculando ruta para ${pendingDeliveries.length} entregas pendientes`
              );

              const updatedFecData = await setOptimizedRoute(
                fecData,
                pendingDeliveries,
                currentLocation
              );

              if (updatedFecData) {
                fecData = updatedFecData;
              }
            } else {
              console.log(
                "[FEC Input] No hay entregas pendientes para optimizar."
              );
            }
          }
        } catch (optimizationError) {
          console.error("Optimization Error:", optimizationError);
        }
      } else {
        console.log(
          "[FEC Input] ✅ Se encontró una ruta optimizada completa. Usando ruta existente:",
          {
            optimizedOrderId_list: fecData.optimizedOrderId_list,
            polylineLength: fecData.suggestedJourneyPolyline?.length,
          }
        );
      }

      console.log("[FEC Input] FEC final antes del login:", {
        optimizedOrderId_list: fecData.optimizedOrderId_list,
        suggestedJourneyPolyline: !!fecData.suggestedJourneyPolyline,
        polylineLength: fecData.suggestedJourneyPolyline?.length || 0,
      });

      await login(driver, fecData);
      startJourneyTracking();
      router.replace("/dashboard");
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.detail ||
        error.message ||
        "Ocurrió un error inesperado.";

      showErrorModal(errorMessage);
      console.error("Error en FEC input:", error.response?.data || error);

      if (error.response?.status === 401) {
        router.replace("/login");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Funcion para manejar el botón de volver
  const handleBack = () => {
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ActionModal
        visible={modalVisible}
        title="Error"
        message={modalMessage}
        buttons={[
          {
            text: "Entendido",
            onPress: () => setModalVisible(false),
            style: "confirm",
          },
        ]}
        onClose={() => setModalVisible(false)}
      />

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Verificar FEC</Text>
          <Text style={styles.subtitle}>
            Ingresa el número de FEC para cargar tus entregas del día.
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Número FEC"
            value={fecNumber}
            // onChangeText={setFecNumber}
            onChangeText={(number: string) =>
              handleFECNumberChange(number.replace(/\s/g, ""))
            }
            keyboardType="number-pad"
            returnKeyType="done"
          />

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleFECSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Continuar</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            disabled={isLoading}
          >
            <Text style={styles.backButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#007AFF",
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: "center",
  },
  form: {
    width: "100%",
    maxWidth: 300,
  },
  input: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    fontSize: 16,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  backButton: {
    padding: 10,
  },
  backButtonText: {
    color: "#007AFF",
    textAlign: "center",
  },
});
