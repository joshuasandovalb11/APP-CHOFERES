import React, { useEffect } from 'react';
import { StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text, View } from '@/components/Themed';
import { useApp } from '@/context/AppContext';
import { Driver, FEC } from '@/types';

export default function IndexScreen() {
  const { state, login } = useApp();
  const router = useRouter();

  useEffect(() => {
    checkAuthState();
  }, []);

  useEffect(() => {
    // Si el usuario hace logout, redirigir al login
    if (!state.isLoggedIn && state.driver === null && state.currentFEC === null) {
      router.replace('/login');
    }
  }, [state.isLoggedIn, state.driver, state.currentFEC]);

  const checkAuthState = async () => {
    try {
      // Intentar recuperar la sesión guardada
      const driverData = await AsyncStorage.getItem('driver');
      const fecData = await AsyncStorage.getItem('currentFEC');

      if (driverData && fecData) {
        const driver: Driver = JSON.parse(driverData);
        const fec: FEC = JSON.parse(fecData);
        
        // Restaurar sesión
        await login(driver, fec);
        router.replace('/dashboard');
      } else {
        // No hay sesión guardada, ir al login
        router.replace('/login');
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
      // En caso de error, ir al login
      router.replace('/login');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>App Choferes</Text>
      <Text style={styles.subtitle}>Cargando...</Text>
      <ActivityIndicator size="large" color="#007AFF" style={styles.loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#007AFF',
  },
  subtitle: {
    fontSize: 18,
    opacity: 0.7,
    marginBottom: 40,
  },
  loading: {
    marginTop: 20,
  },
});
