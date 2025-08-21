/**
 * Main App Navigation for Waves Marine Navigation App
 */

import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Import screens
import {MapScreen} from '@/screens/map/MapScreen';
import {Navigation3DScreen} from '@/screens/navigation/Navigation3DScreen';
import {DepthReportingScreen} from '@/screens/depth/DepthReportingScreen';
import {SettingsScreen} from '@/screens/settings/SettingsScreen';
import {ProfileScreen} from '@/screens/profile/ProfileScreen';
import {RouteDetailsScreen} from '@/screens/navigation/RouteDetailsScreen';
import {OfflineMapScreen} from '@/screens/map/OfflineMapScreen';

export type RootStackParamList = {
  MainTabs: undefined;
  RouteDetails: {routeId: string};
  OfflineMap: undefined;
  Profile: undefined;
};

export type MainTabParamList = {
  Map: undefined;
  Navigation: undefined;
  Depth: undefined;
  Settings: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const MainTabs = (): JSX.Element => {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        tabBarIcon: ({focused, color, size}) => {
          let iconName: string;

          switch (route.name) {
            case 'Map':
              iconName = focused ? 'map' : 'map-outline';
              break;
            case 'Navigation':
              iconName = focused ? 'compass' : 'compass-outline';
              break;
            case 'Depth':
              iconName = focused ? 'waves' : 'waves';
              break;
            case 'Settings':
              iconName = focused ? 'cog' : 'cog-outline';
              break;
            default:
              iconName = 'help';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#001F3F',
          borderTopColor: '#003366',
          paddingBottom: 5,
          height: 60,
        },
        headerStyle: {
          backgroundColor: '#001F3F',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          title: 'Marine Chart',
          headerShown: false, // Map will have its own header overlay
        }}
      />
      <Tab.Screen
        name="Navigation"
        component={Navigation3DScreen}
        options={{
          title: '3D Navigation',
        }}
      />
      <Tab.Screen
        name="Depth"
        component={DepthReportingScreen}
        options={{
          title: 'Depth Data',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
};

export const AppNavigator = (): JSX.Element => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#001F3F',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="RouteDetails"
        component={RouteDetailsScreen}
        options={{
          title: 'Route Details',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="OfflineMap"
        component={OfflineMapScreen}
        options={{
          title: 'Offline Maps',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'User Profile',
          presentation: 'modal',
        }}
      />
    </Stack.Navigator>
  );
};