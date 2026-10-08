import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors as COLORS } from "../../../theme/colors";

export default function TutorTabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: "#999",
        tabBarStyle: {
          height: 62 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: any;

          //
          if (route.name === "tutor")
            iconName = focused ? "stats-chart" : "stats-chart-outline";
          else if (route.name === "requests")
            iconName = focused ? "albums" : "albums-outline";
          else if (route.name === "availability")
            iconName = focused ? "calendar" : "calendar-outline";
          else if (route.name === "sessions")
            iconName = focused ? "videocam" : "videocam-outline";
          else if (route.name === "messages")
            iconName = focused ? "chatbubbles" : "chatbubbles-outline";
          else if (route.name === "profile")
            iconName = focused ? "person" : "person-outline";

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="tutor" options={{ title: "Dashboard" }}></Tabs.Screen>
      <Tabs.Screen name="requests" options={{ title: "Requests" }} />
      <Tabs.Screen name="availability" options={{ title: "Availability" }} />
      <Tabs.Screen name="sessions" options={{ title: "Sessions" }} />
      <Tabs.Screen name="messages" options={{ title: "Messages" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
