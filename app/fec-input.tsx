import React, { useState } from "react";
import {
  StyleSheet,
  Alert,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Text, View } from "@/components/Themed";
import { useApp } from "@/context/AppContext";
import { mockApiService } from "@/services/api";
import { Driver } from "@/types";

export default function FECInputScreen() {
  const [fecNumber, setFecNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useApp();
  const router = useRouter();
  const params = useLocalSearchParams();

  const handleFECSubmit = async () => {
    if (!fecNumber.trim()) {
      Alert.alert("Error", "Por favor ingresa el número FEC");
      return;
    }

    setIsLoading(true);
    try {
      // Obtener datos del driver de los parámetros
      const driver: Driver = JSON.parse(params.driverData as string);

      // Obtener las entregas del FEC
      const fecData = await mockApiService.getDeliveriesByFEC(fecNumber);

      // Hacer login con el driver y FEC
      await login(driver, fecData);

      // Navegar a la pantalla principal
      router.replace("/dashboard");
    } catch (error) {
      Alert.alert("Error", "Número FEC no válido o no hay entregas asignadas");
    } finally {
      setIsLoading(false);
    }
  };

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
          <Text style={styles.title}>Ingresa tu FEC</Text>
          <Text style={styles.subtitle}>
            Número de Factura de Entrega del Chofer
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Ej: FEC-2024-001"
            value={fecNumber}
            onChangeText={setFecNumber}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!isLoading}
          />

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleFECSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
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
    borderRadius: 8,
    padding: 15,
    alignItems: "center",
    marginBottom: 15,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  backButton: {
    padding: 15,
    alignItems: "center",
  },
  backButtonText: {
    color: "#007AFF",
    fontSize: 16,
  },
});
