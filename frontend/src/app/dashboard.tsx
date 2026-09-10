import { useState } from 'react';
import { View, TextInput, Button, Text, ScrollView } from 'react-native';
import { apiFetch } from '../api/apiClient';

export default function TestScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('pwd');
  const [token, setToken] = useState('');
  const [result, setResult] = useState('');

const show = (data: any) => setResult(JSON.stringify(data, null, 2));
  const handleRegister = async () => {
    try {
      show(await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name, role }),
      }));
    } catch (e: any) { setResult('Error: ' + e.message); }
  };

  const handleLogin = async () => {
    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(data.token); // stash it in plain state — SecureStore comes later, this is just wiring
      show(data);
    } catch (e:any) { setResult('Error: ' + e.message); }
  };

  const handleGetContacts = async () => {
    try {
      show(await apiFetch('/contacts', {
        headers: { Authorization: `Bearer ${token}` },
      }));
    } catch (e:any) { setResult('Error: ' + e.message); }
  };

  const handleTriggerSOS = async () => {
    try {
      show(await apiFetch('/sos/trigger', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ triggerMethod: 'manual_test', isTest: true }),
      }));
    } catch (e:any) { setResult('Error: ' + e.message); }
  };

  return (
    <ScrollView style={{ padding: 40, paddingTop: 80 }}>
      <TextInput placeholder="Name" value={name} onChangeText={setName} style={{ borderWidth: 1, marginBottom: 10, padding: 8 }} />
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" style={{ borderWidth: 1, marginBottom: 10, padding: 8 }} />
      <TextInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry style={{ borderWidth: 1, marginBottom: 10, padding: 8 }} />
      <TextInput placeholder="Role (pwd / non_pwd)" value={role} onChangeText={setRole} style={{ borderWidth: 1, marginBottom: 20, padding: 8 }} />

      <Button title="Register" onPress={handleRegister} />
      <View style={{ height: 8 }} />
      <Button title="Login" onPress={handleLogin} />
      <View style={{ height: 8 }} />
      <Button title="Get Contacts (protected)" onPress={handleGetContacts} />
      <View style={{ height: 8 }} />
      <Button title="Trigger SOS (protected)" onPress={handleTriggerSOS} />

      <Text style={{ marginTop: 20, fontFamily: 'monospace' }}>{result}</Text>
    </ScrollView>
  );
}