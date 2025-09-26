import React, { useState } from "react";
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Text, View } from "@/components/Themed";
import { useApp } from "@/context/AppContext";
import { apiService } from "@/services/api";
import FontAwesome from "@expo/vector-icons/FontAwesome";

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const { login } = useApp();
  const router = useRouter();

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      alert("Error: Por favor ingresa usuario y contraseña");
      return;
    }

    setIsLoading(true);
    try {
      // Solo validamos credenciales y obtenemos el token
      await apiService.login(username, password);

      // Si el login es exitoso, pasamos a la pantalla de FEC
      // El username se usará para crear el objeto Driver temporal
      router.push({
        pathname: "/fec-input",
        params: { username: username },
      });
    } catch (error: any) {
      // Manejo mejorado de errores
      let errorMessage = "Credenciales inválidas";

      if (error.message) {
        // Si la API devuelve un mensaje específico, lo usamos
        errorMessage = error.message;
      } else if (error.toString().includes("Network")) {
        errorMessage = "Error de conexión. Verifica tu internet";
      } else if (error.toString().includes("timeout")) {
        errorMessage = "Tiempo de espera agotado. Intenta nuevamente";
      }

      alert(`Error: ${errorMessage}`);
      console.error("Error en login:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <Text style={styles.title}>App Entregas</Text>
          <Text style={styles.subtitle}>Sistema de Entregas</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Usuario"
            value={username}
            onChangeText={(text) => setUsername(text.replace(/\s/g, ""))}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />

          {/* Contenedor para el input de contraseña y el ícono */}
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.input}
              placeholder="Contraseña"
              value={password}
              onChangeText={(text) => setPassword(text.replace(/\s/g, ""))}
              secureTextEntry={!isPasswordVisible}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setPasswordVisible(!isPasswordVisible)}
            >
              <FontAwesome
                name={isPasswordVisible ? "eye-slash" : "eye"}
                size={16}
                color="#8d8d8dff"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>Iniciar Sesión</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 50,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#007AFF",
  },
  subtitle: {
    fontSize: 18,
    opacity: 0.7,
  },
  form: {
    width: "100%",
    alignItems: "center",
  },
  input: {
    width: "100%",
    maxWidth: 300,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    maxWidth: 300,
    marginBottom: 15,
    position: "relative",
  },
  eyeIcon: {
    position: "absolute",
    right: 15,
    height: "100%",
    justifyContent: "center",
    paddingBottom: 15,
  },
  button: {
    width: "100%",
    maxWidth: 300,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 15,
    alignItems: "center",
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    marginTop: 40,
    paddingHorizontal: 20,
  },
  footerText: {
    textAlign: "center",
    fontSize: 12,
    opacity: 0.6,
  },
});
