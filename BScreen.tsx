import WebView, { WebViewProps } from 'react-native-webview';
import { useEffect, useRef } from 'react';
import { BackHandler, Linking } from 'react-native';
import { Adjust, AdjustEvent } from 'react-native-adjust';

export type AppIdentity = {
  adid: string;
  gps_adid: string;
  appid: string;
};

// imperative handle exposed at runtime via forwardRef, but not modeled by the
// v14 type declarations (plain FunctionComponent), so re-declare it locally
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

  // window.adid / window.gps_adid / window.appid + remote config
  // (same injection the C# WebView_OnNavigating did via EvaluateJavaScriptAsync)
  const injectScript =
    `window.adid='${esc(identity.adid)}';` +
    `window.gps_adid='${esc(identity.gps_adid)}';` +
    `window.appid='${esc(identity.appid)}';` +
    `${data.config ?? ''};true;`;

  // re-inject when an identity value (e.g. adid) arrives after the page loaded
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
      onMessage={async event => {
        const d = JSON.parse(event.nativeEvent.data);

        console.log(d);

        if (d['event'] === 'openWindow') {
          await Linking.openURL(d['params']['url']);
        } else {
          const adjustEvent = new AdjustEvent(d['event']);
          if (d['params']['revenue']) {
            adjustEvent.setRevenue(
              Number(d['params']['revenue']),
              d['params']['currency'],
            );
          }
          Adjust.trackEvent(adjustEvent);
        }
      }}
    ></WebViewWithRef>
  );
}
