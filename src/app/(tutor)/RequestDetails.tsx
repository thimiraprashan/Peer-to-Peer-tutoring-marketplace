import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

export default function RequestDetails() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  return (
    <View>
      <Text>Booking: {bookingId}</Text>
    </View>
  );
}