import { Stack } from "expo-router";

export default function TutorLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="request-details" />
      <Stack.Screen name="request-reject" />
      <Stack.Screen name="reschedule-request" />
      <Stack.Screen name="tutor-chat" />
      <Stack.Screen name="tutor-profile-form" />
      <Stack.Screen name="tutor-document-upload" />
      <Stack.Screen name="tutor-verification-status" />
    </Stack>
  );
}
