import WebView, { WebViewProps } from 'react-native-webview';
import { useEffect, useRef } from 'react';
import { BackHandler, Linking } from 'react-native';

export type AppIdentity = {
  adid: string;
  gps_adid: string;
  appid: string;
};

type WebViewHandle = {
  goForward(): void;
  goBack(): void;
  reload(): void;
  stopLoading(): void;
  postMessage(data: string): void;
  injectJavaScript(data: string): void;
};

const WebViewWithRef = WebView as unknown as React.ForwardRefExoticComponent<
  WebViewProps & React.RefAttributes<WebViewHandle>
>;

const esc = (v: string) =>
  String(v ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export default function BScreen({
  data,
  identity,
}: {
  data: any;
  identity: AppIdentity;
}) {
  const wvRef = useRef<WebViewHandle>(null);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (wvRef.current) {
        wvRef.current.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  const injectScript =
    `window.adid='${esc(identity.adid)}';` +
    `window.gps_adid='${esc(identity.gps_adid)}';` +
    `window.appid='${esc(identity.appid)}';` +
    `${data.config ?? ''};true;`;

  useEffect(() => {
    wvRef.current?.injectJavaScript(injectScript);
  }, [injectScript]);

  const openExternal = (url: string) => {
    Linking.openURL(url).catch(err => console.log(err));
  };

  return (
    <WebViewWithRef
      style={{ flex: 1 }}
      ref={wvRef}
      source={{ uri: data.toUrl }}
      injectedJavaScriptBeforeContentLoaded={injectScript}
      injectedJavaScript={injectScript}
      setSupportMultipleWindows={false}
      onShouldStartLoadWithRequest={request => {
        const url = request.url;
        if (url.includes('.apk')) {
          openExternal(url);
          return false;
        }
        if (!url.startsWith('http')) {
          openExternal(url);
          return false;
        }
        if (url.includes('myapp=1')) {
          openExternal(url);
          return false;
        }
        return true;
      }}
    ></WebViewWithRef>
  );
}
