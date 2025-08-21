/**
 * Waves Marine Navigation App
 * Main App Component
 */

import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {Provider} from 'react-redux';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {StatusBar, StyleSheet} from 'react-native';

import {store} from '@/store';
import {AppNavigator} from '@/navigation/AppNavigator';
import {LocationProvider} from '@/services/location/LocationProvider';
import {MapboxProvider} from '@/services/maps/MapboxProvider';
import {OfflineDataProvider} from '@/services/offline/OfflineDataProvider';

const App = (): JSX.Element => {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <GestureHandlerRootView style={styles.container}>
          <LocationProvider>
            <MapboxProvider>
              <OfflineDataProvider>
                <NavigationContainer>
                  <StatusBar
                    barStyle="light-content"
                    backgroundColor="#001F3F"
                    translucent={false}
                  />
                  <AppNavigator />
                </NavigationContainer>
              </OfflineDataProvider>
            </MapboxProvider>
          </LocationProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;