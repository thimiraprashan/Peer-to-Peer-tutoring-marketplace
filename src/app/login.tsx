import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Button, Text, TextInput, View } from 'react-native';
import { loginUser } from '../services/authService';

const VALID_ROLES = ['student', 'tutor', 'admin'];

export default function Login() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Missing details', 'Enter email and password.');
            return;
        }

        setLoading(true);
        try {
            const profile: any = await loginUser(email.trim(), password);
            if (!profile) {
                Alert.alert('Error', 'No profile found for this account.');
                return;
            }

            if (!VALID_ROLES.includes(profile.role)) {
                Alert.alert('Error', `Invalid user role "${profile.role}".`);
                return;
            }

            router.replace(`/${profile.role}` as any); // /student, /tutor or /admin
        } catch (e: any) {
            Alert.alert('Login failed', e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Peer Tutor Login</Text>
            <TextInput
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
                style={{ borderWidth: 1, padding: 10, borderRadius: 6 }}
            />
            <TextInput
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!loading}
                style={{ borderWidth: 1, padding: 10, borderRadius: 6 }}
            />
            {loading ? (
                <ActivityIndicator size="large" color="#0000ff" />
            ) : (
                <Button title="Login" onPress={handleLogin} />
            )}
        </View>
    );
}