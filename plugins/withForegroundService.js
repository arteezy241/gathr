const { withAndroidManifest } = require('@expo/config-plugins')

module.exports = function withForegroundService(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults
    const mainApplication = manifest.manifest.application[0]

    // Add permissions
    if (!manifest.manifest['uses-permission']) {
      manifest.manifest['uses-permission'] = []
    }
    const perms = manifest.manifest['uses-permission']
    const addPerm = (name) => {
      if (!perms.find((p) => p.$['android:name'] === name)) {
        perms.push({ $: { 'android:name': name } })
      }
    }
    addPerm('android.permission.FOREGROUND_SERVICE')
    addPerm('android.permission.FOREGROUND_SERVICE_SPECIAL_USE')

    // Add foreground service entries
    if (!mainApplication.service) {
      mainApplication.service = []
    }
    const services = mainApplication.service
    const addService = (name, extra = {}) => {
      if (!services.find((s) => s.$['android:name'] === name)) {
        services.push({ $: { 'android:name': name, ...extra } })
      }
    }
    addService('com.supersami.foregroundservice.ForegroundService', {
      'android:foregroundServiceType': 'specialUse',
    })
    addService('com.supersami.foregroundservice.ForegroundServiceTask', {
      'android:foregroundServiceType': 'specialUse',
    })

    return config
  })
}
