import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'token';

async function readNative(key: string) {
  return SecureStore.getItemAsync(key);
}

async function writeNative(key: string, value: string) {
  await SecureStore.setItemAsync(key, value);
}

async function deleteNative(key: string) {
  await SecureStore.deleteItemAsync(key);
}

export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(TOKEN_KEY);
  }
  return readNative(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await writeNative(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(TOKEN_KEY);
    return;
  }
  await deleteNative(TOKEN_KEY);
}
