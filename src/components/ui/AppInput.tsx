import React, { useState } from 'react';
import {
  KeyboardTypeOptions,
  Pressable,
  ReturnKeyTypeOptions,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface AppInputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  blurOnSubmit?: boolean;
  inputRef?: React.Ref<TextInput>;
  error?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export const AppInput: React.FC<AppInputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  returnKeyType,
  onSubmitEditing,
  blurOnSubmit,
  inputRef,
  error,
  icon,
}) => {
  // Toggle password visibility
  const [hidePassword, setHidePassword] = useState(secureTextEntry);

  return (
    <View style={styles.container}>
      {/* Input Label */}
      {label ? <Text style={styles.label}>{label}</Text> : null}

      {/* Input Field Box */}
      <View
        style={[
          styles.inputContainer,
          error ? styles.inputContainerError : null,
        ]}
      >
        {/* Left Icon */}
        {icon ? (
          <Ionicons
            name={icon}
            size={20}
            color={colors.mutedText}
            style={styles.leftIcon}
          />
        ) : null}

        {/* Text Input */}
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedText}
          secureTextEntry={secureTextEntry ? hidePassword : false}
          keyboardType={keyboardType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={blurOnSubmit}
          autoCapitalize="none"
          accessibilityLabel={label || placeholder || 'Text input'}
          style={styles.textInput}
        />

        {/* Password Eye Toggle Icon */}
        {secureTextEntry ? (
          <Pressable
            onPress={() => setHidePassword(!hidePassword)}
            accessibilityRole="button"
            accessibilityLabel={hidePassword ? 'Show password' : 'Hide password'}
            style={styles.eyeButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={hidePassword ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={colors.mutedText}
            />
          </Pressable>
        ) : null}
      </View>

      {/* Error Message */}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 52,
    paddingHorizontal: 14,
    // Soft shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inputContainerError: {
    borderColor: colors.error,
  },
  leftIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 12,
  },
  eyeButton: {
    padding: 8,
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 13,
    color: colors.error,
    marginTop: 4,
  },
});

export default AppInput;
