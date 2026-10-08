import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

export default function TutorMessages() {
  return (
    <View style={styles.container}>
      <Ionicons name="chatbubbles-outline" size={64} color="#DDE8D8" />
      <Text style={styles.title}>Messages</Text>
      <Text style={styles.text}>
        Tutor ↔ Student chat will be available soon
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EAF2E5",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2E2E2E",
    marginTop: 16,
  },
  text: {
    fontSize: 13,
    color: "#7A8A7A",
    marginTop: 8,
    textAlign: "center",
  },
});