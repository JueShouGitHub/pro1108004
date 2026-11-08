import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { SPOTDIFF_HTML } from './SpotDiffHtml';

const BG_COLOR = '#241f33';

export default function Game() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen} edges={['bottom']}>
        <StatusBar style="light" />
        <WebView
          source={{ html: SPOTDIFF_HTML, baseUrl: 'file:///android_asset/' }}
          style={styles.webview}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          allowFileAccess
          textZoom={100}
          scrollEnabled={false}
          overScrollMode="never"
          setSupportMultipleWindows={false}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },
  webview: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },
});
