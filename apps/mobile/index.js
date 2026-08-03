import { registerRootComponent } from 'expo'

import App from './App'

// registerRootComponent both loads Expo's autolinked native module setup and
// calls AppRegistry.registerComponent('main', () => App), so this one call
// works identically from Expo Go, a dev client, or a native release build.
registerRootComponent(App)
