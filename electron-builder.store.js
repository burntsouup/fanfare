// electron-builder config for the Microsoft Store (MSIX/AppX) package.
//
//   npm run package:store        -> release/Fanfare-Store-<version>.appx (upload to Partner Center)
//   npm run package:store:test   -> test package for local sideloading (sign it with a trusted test cert first)
//
// Reuses the main `build` config from package.json, but drops Azure code
// signing and GitHub publishing: the Store signs the package itself and
// delivers updates, so this build needs neither.
const base = require('./package.json').build

// Copy these three values from Partner Center:
// Apps and games > Fanfare > Product management > Product identity.
const STORE_IDENTITY = {
  identityName: 'REPLACE_ME', // "Package/Identity/Name"
  publisher: 'CN=REPLACE_ME', // "Package/Identity/Publisher"
  publisherDisplayName: 'REPLACE_ME' // "Package/Properties/PublisherDisplayName"
}

// Identity for a locally sideloaded test build. Windows only installs it once
// it's signed with a matching certificate that the PC trusts.
const LOCAL_TEST_IDENTITY = {
  identityName: 'Fanfare.LocalTest',
  publisher: 'CN=FanfareLocalTest',
  publisherDisplayName: 'Fanfare (local test)'
}

const isLocalTest = process.env.FANFARE_STORE_TEST === '1'
const identity = isLocalTest ? LOCAL_TEST_IDENTITY : STORE_IDENTITY

if (Object.values(identity).some((v) => v.includes('REPLACE_ME'))) {
  throw new Error(
    'electron-builder.store.js: fill in STORE_IDENTITY from Partner Center before building the Store package.'
  )
}

const { azureSignOptions: _azureSignOptions, ...winWithoutSigning } = base.win

module.exports = {
  ...base,
  publish: null,
  win: {
    ...winWithoutSigning,
    target: [{ target: 'appx', arch: ['x64'] }]
  },
  appx: {
    ...identity,
    applicationId: 'Fanfare',
    displayName: 'Fanfare',
    backgroundColor: 'transparent',
    languages: ['en-US'],
    // Windows 10 1809+; required for the desktop StartupTask extension and Electron 42.
    minVersion: '10.0.17763.0',
    maxVersionTested: '10.0.26100.0',
    customExtensionsPath: 'build/appx-extensions.xml',
    artifactName: isLocalTest
      ? '${productName}-Store-${version}-localtest.${ext}'
      : '${productName}-Store-${version}.${ext}'
  }
}
