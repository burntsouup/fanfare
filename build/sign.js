// Custom electron-builder signing hook for Azure Trusted Signing (Artifact Signing).
//
// electron-builder calls this for every signable Windows artifact (the app .exe
// and the NSIS installer). It shells out to Windows `signtool.exe` using the
// Azure Code Signing dlib, which talks to your cloud certificate profile.
//
// It is intentionally a no-op when the signing environment variables are absent,
// so local `npm run package:win` and any release built before Azure is set up
// still succeed — just unsigned. Signing activates automatically once CI provides
// SIGNTOOL_PATH, AZURE_CODESIGNING_DLIB and AZURE_CODESIGNING_METADATA.
const { execFileSync } = require('node:child_process')

exports.default = async function sign(configuration) {
  const filePath = configuration.path
  if (process.platform !== 'win32') return

  const signtool = process.env.SIGNTOOL_PATH
  const dlib = process.env.AZURE_CODESIGNING_DLIB
  const metadata = process.env.AZURE_CODESIGNING_METADATA

  if (!signtool || !dlib || !metadata) {
    console.warn(`[sign] Signing env not set — leaving "${filePath}" unsigned.`)
    return
  }

  console.log(`[sign] Signing ${filePath}`)
  execFileSync(
    signtool,
    [
      'sign',
      '/v',
      '/debug',
      '/fd',
      'SHA256',
      '/tr',
      'http://timestamp.acs.microsoft.com',
      '/td',
      'SHA256',
      '/dlib',
      dlib,
      '/dmdf',
      metadata,
      filePath
    ],
    { stdio: 'inherit' }
  )
}
