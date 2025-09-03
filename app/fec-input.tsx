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
import { mockApiService } from "@/services/api";
import { Driver } from "@/types";
import locationService from "@/services/location"; // Importar LocationService

export default function FECInputScreen() {
  const [fecNumber, setFecNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, startJourneyTracking, setOptimizedRoute } = useApp();
  const router = useRouter();
  const params = useLocalSearchParams();

  // Funcion para manejar cambios en el número FEC
  const handleFECNumberChange = (text: string) => {
    setFecNumber(text.replace(/[^0-9\s]/g, ""));
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
      const driver: Driver = JSON.parse(params.driverData as string);
      const fecData = await mockApiService.getDeliveriesByFEC(fecNumber);

      try {
        const currentLocation = await locationService.getCurrentLocation();

        if (currentLocation && fecData.deliveries.length > 0) {
          await setOptimizedRoute(fecData.deliveries, currentLocation);
        } else {
          console.log(
            "No se pudo obtener la ubicación actual o no hay entregas para optimizar."
          );
        }
      } catch (optimizationError) {
        console.error("Optimization Error:", optimizationError);
        // Opcional: podrías mostrar una alerta no bloqueante, pero para el conductor es mejor que no vea nada
        // Alert.alert("Aviso", "No se pudo optimizar la ruta. Se mostrará en el orden predeterminado.");
      }

      await login(driver, fecData);
      startJourneyTracking();
      router.replace("/dashboard");
    } catch (error) {
      Alert.alert("Error", "Número FEC no válido o no hay entregas asignadas");
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
