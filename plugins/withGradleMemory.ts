import { ConfigPlugin, withGradleProperties } from '@expo/config-plugins';

const MEMORY_PROPS: Record<string, string> = {
  'org.gradle.parallel': 'false',
  'org.gradle.workers.max': '2',
  'kotlin.daemon.jvmargs': '-Xmx1024m',
};

const withGradleMemory: ConfigPlugin = (config) => {
  return withGradleProperties(config, (modConfig) => {
    for (const [key, value] of Object.entries(MEMORY_PROPS)) {
      const existing = modConfig.modResults.find(
        (item) => item.type === 'property' && item.key === key
      );
      if (existing && existing.type === 'property') {
        existing.value = value;
      } else {
        modConfig.modResults.push({ type: 'property', key, value });
      }
    }
    return modConfig;
  });
};

export default withGradleMemory;
