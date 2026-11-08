import { ConfigPlugin, withGradleProperties } from '@expo/config-plugins';

/**
 * Caps Gradle/Kotlin memory usage so release builds (dual-ABI CMake + R8)
 * fit inside EAS "medium" build workers instead of getting OOM-killed.
 * Applied at prebuild, so it works with CNG (no android/ dir committed).
 */
const MEMORY_PROPS: Record<string, string> = {
  // Serialize module builds: parallel CMake(clang x2 ABIs) + R8 exceeded worker RAM.
  'org.gradle.parallel': 'false',
  // Cap concurrent gradle tasks.
  'org.gradle.workers.max': '2',
  // Keep the Kotlin compile daemon small.
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
