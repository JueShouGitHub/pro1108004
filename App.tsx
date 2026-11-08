import {SafeAreaView} from 'react-native-safe-area-context';
import DeviceInfo from 'react-native-device-info';
import {Adjust, AdjustConfig} from 'react-native-adjust';
import {useEffect, useState} from 'react';
import BScreen from './GameSta';
import type {AppIdentity} from './GameSta';
import {StatusBar} from 'react-native';
import Game from "./Game";
import {fetchConfig} from './SecureConfig';
import {getLocales} from 'expo-localization';

export default function App() {
    const [data, setData] = useState({
        enable: false,
    });

    const [identity, setIdentity] = useState<AppIdentity>({
        adid: '',
        gps_adid: '',
        appid: '',
    });

    const getData = async () => {
        Adjust.getGoogleAdId(async adid => {
            const packageName = DeviceInfo.getBundleId();
            setIdentity(prev => ({...prev, gps_adid: adid ?? '', appid: packageName}));

            const locale = getLocales()[0];
            const regionCode = locale.regionCode ?? '';
            let regionName = regionCode;
            try {
                regionName =
                    new Intl.DisplayNames(['en'], {type: 'region'}).of(
                        regionCode,
                    ) ?? regionCode;
            } catch {
                regionName = regionCode;
            }

            const json = await fetchConfig({
                packageName,
                androidId: DeviceInfo.getAndroidIdSync(),
                gpsAdid: adid ?? '',
                referrer: DeviceInfo.getInstallReferrerSync(),
                userAgent: DeviceInfo.getUserAgentSync(),
                timezone:
                    Intl.DateTimeFormat().resolvedOptions().timeZone ?? '',
                language: locale.languageTag,
                region: regionName,
                simCountryIso: regionCode.toLowerCase(),
                country: regionCode.toUpperCase(),
            });

            if (!json || !json.sdkKey) {
                return;
            }

            const config = new AdjustConfig(json.sdkKey, AdjustConfig.EnvironmentProduction);
            config.setLogLevel(AdjustConfig.LogLevelVerbose);
            Adjust.initSdk(config);

            Adjust.getAdidWithTimeout(15000, adid => {
                if (adid) {
                    setIdentity(prev => ({...prev, adid: adid}));
                }
            });

            setData(json);
        });
    };

    useEffect(() => {
        getData();
    }, []);

    return (
        <SafeAreaView style={{flex: 1}} edges={['left', 'right', 'bottom']}>
            <StatusBar hidden={true}/>
            {data.enable ? <BScreen data={data} identity={identity}/> : <Game/>}
        </SafeAreaView>
    );
}
