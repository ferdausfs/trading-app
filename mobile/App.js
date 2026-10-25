/**
 * TradeLite মোবাইল অ্যাপ — Expo React Native
 * --------------------------------------------
 * চালানোর নিয়ম:
 *   cd mobile && npm install && npx expo start
 * তারপর Expo Go অ্যাপ দিয়ে QR স্ক্যান করুন (Android/iOS)।
 * APK বিল্ড: npx eas-cli build -p android --profile preview
 */

import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import ChartScreen from './src/screens/ChartScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { COLORS } from './src/config';

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: COLORS.bg, card: COLORS.panel, border: COLORS.border, primary: COLORS.accent },
};

const icons = {
  Chart: '📈',
  Settings: '⚙️',
};

export default function App() {
  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerStyle: { backgroundColor: COLORS.panel },
          headerTintColor: COLORS.text,
          tabBarStyle: { backgroundColor: COLORS.panel, borderTopColor: COLORS.border },
          tabBarActiveTintColor: COLORS.accent,
          tabBarInactiveTintColor: COLORS.muted,
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 16, opacity: focused ? 1 : 0.6 }}>{icons[route.name] ?? '•'}</Text>
          ),
        })}
      >
        <Tab.Screen name="Chart" component={ChartScreen} options={{ title: 'চার্ট' }} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'সেটিংস' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
