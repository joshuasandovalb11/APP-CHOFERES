import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { IncidentReason } from "@/types"; // Importamos nuestro tipo

// Definimos las props que el componente recibirá
export interface IncidentModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: IncidentReason, notes?: string) => void;
}

export default function IncidentModal({
  visible,
  onClose,
  onSubmit,
}: IncidentModalProps) {
  const [reason, setReason] = useState<IncidentReason | null>(null);
  const [notes, setNotes] = useState("");

  const reasons: { label: string; value: IncidentReason }[] = [
    { label: "Cliente ausente", value: "CLIENTE_AUSENTE" },
    { label: "Dirección incorrecta", value: "DIRECCION_INCORRECTA" },
    // { label: "Mercancía Rechazada", value: "MERCANCIA_RECHAZADA" },
    { label: "Vehículo Averiado", value: "VEHICULO_AVERIADO" },
    // { label: "Otro", value: "OTRO" },
  ];

  const handleSubmit = () => {
    if (reason) {
      onSubmit(reason, notes);
      setReason(null);
      setNotes("");
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Reportar Incidencia</Text>
          <Text style={styles.modalSubtitle}>Selecciona un motivo:</Text>

          {reasons.map((r) => (
            <TouchableOpacity
              key={r.value}
              onPress={() => setReason(r.value)}
              style={[
                styles.reasonButton,
                reason === r.value && styles.reasonSelected,
              ]}
            >
              <Text
                style={[
                  styles.reasonButtonText,
                  reason === r.value && styles.reasonSelectedText,
                ]}
              >
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}

          {/* {reason == "OTRO" && (
            <TextInput
              style={styles.notesInput}
              placeholder="Descripción adicional (opcional)"
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          )} */}

          <View style={styles.modalActions}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.modalButton, styles.cancelButton]}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={!reason}
              onPress={handleSubmit}
              style={[
                styles.modalButton,
                styles.confirmButton,
                !reason && styles.disabledButton,
              ]}
            >
              <Text style={styles.confirmButtonText}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// --- ESTILOS EXCLUSIVOS PARA ESTE COMPONENTE ---
const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 15,
    padding: 20,
    width: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 15,
    textAlign: "center",
  },
  reasonButton: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DDD",
    marginBottom: 10,
  },
  reasonSelected: {
    backgroundColor: "#FF3B30",
    borderColor: "#FF3B30",
  },
  reasonButtonText: {
    textAlign: "center",
    fontSize: 14,
    color: "#333",
  },
  reasonSelectedText: {
    color: "#FFF",
    fontWeight: "bold",
  },
  notesInput: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    fontSize: 14,
    padding: 10,
    minHeight: 80,
    textAlignVertical: "top",
    marginTop: 10,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#EFEFEF",
    marginRight: 10,
  },
  cancelButtonText: {
    color: "#333",
    fontWeight: "bold",
  },
  confirmButton: {
    backgroundColor: "#007AFF",
    marginLeft: 10,
  },
  confirmButtonText: {
    color: "#FFF",
    fontWeight: "bold",
  },
  disabledButton: {
    backgroundColor: "#CCC",
  },
});
