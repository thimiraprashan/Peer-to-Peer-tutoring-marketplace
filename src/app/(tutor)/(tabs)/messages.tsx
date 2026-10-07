import { StyleSheet, Text, View } from "react-native";
import { colors as COLORS } from "../../../theme/colors";

export default function Messages() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Messages</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { fontSize: 18, color: COLORS.primary },
});
