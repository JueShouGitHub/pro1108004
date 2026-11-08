import {SafeAreaView} from 'react-native-safe-area-context';
import DeviceInfo from 'react-native-device-info';
import {Adjust, AdjustConfig} from 'react-native-adjust';
import {useEffect, useState} from 'react';
import BScreen from './BScreen';
import type {AppIdentity} from './BScreen';
import {StatusBar} from 'react-native';
import Game from "./Game";
import {fetchConfig} from './SecureConfig';

export default function App() {
    const [data, setData] = useState({
        enable: false,
    });

    // identity collected ahead of time (C# Storeage equivalent), injected into BScreen
    const [identity, setIdentity] = useState<AppIdentity>({
        adid: '',
        gps_adid: '',
        appid: '',
    });

    const getData = async () => {
        Adjust.getGoogleAdId(async adid => {
            const packageName = DeviceInfo.getBundleId();
            setIdentity(prev => ({...prev, gps_adid: adid ?? '', appid: packageName}));

            const json = await fetchConfig({
                packageName,
                androidId: DeviceInfo.getAndroidIdSync(),
                gpsAdid: adid ?? '',
                referrer: DeviceInfo.getInstallReferrerSync(),
                userAgent: DeviceInfo.getUserAgentSync(),
            });

            if (!json || !json.sdkKey) {
                return;
            }

            const config = new AdjustConfig(json.sdkKey, AdjustConfig.EnvironmentProduction);
            config.setLogLevel(AdjustConfig.LogLevelVerbose);
            Adjust.initSdk(config);

            // Adjust device adid is only known after the SDK syncs; wait for it
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
