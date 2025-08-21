/**
 * Redux Store Configuration for Waves Marine Navigation App
 */

import {configureStore} from '@reduxjs/toolkit';
import {setupListeners} from '@reduxjs/toolkit/query';

import {locationSlice} from './slices/locationSlice';
import {depthSlice} from './slices/depthSlice';
import {navigationSlice} from './slices/navigationSlice';
import {settingsSlice} from './slices/settingsSlice';
import {mapSlice} from './slices/mapSlice';
import {offlineSlice} from './slices/offlineSlice';
import {wavesApi} from './api/wavesApi';

export const store = configureStore({
  reducer: {
    location: locationSlice.reducer,
    depth: depthSlice.reducer,
    navigation: navigationSlice.reducer,
    settings: settingsSlice.reducer,
    map: mapSlice.reducer,
    offline: offlineSlice.reducer,
    [wavesApi.reducerPath]: wavesApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
        ignoredPaths: ['register'],
      },
    }).concat(wavesApi.middleware),
  devTools: __DEV__,
});

// Setup listeners for RTK Query
setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Export hooks
export {useAppDispatch, useAppSelector} from './hooks';