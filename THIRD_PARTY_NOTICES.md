# Third-party notices

## Tableau Extensions API 1.17.0

The SDK at `public/lib/tableau.extensions.1.17.0.js` is vendored without changes
from Tableau's public `tableau/extensions-api` repository. Its exact upstream
revision and SHA-256 checksums are recorded in `vendor/tableau-extensions-api.json`.

The upstream Apache License 2.0 text, including Salesforce's copyright notice,
is retained at `public/licenses/tableau-extensions-api.LICENSE.txt` and copied
into deployed assets. Preserve these files and upstream notices on updates.

The project's existing GPLv2 license has not been changed. On October 13, 2026,
the owner confirmed that the licensing review for the project and Apache-2.0
Tableau SDK was complete and authorized development publication. This records
the owner's confirmation; it does not relicense the SDK or provide a legal
compatibility determination.

## UI reference

The chat layout and interaction were adapted from the owner's Informatics_Chatbot
Forge app, reference revision `d026b1e238f9f0b062700434ecdeb0a81acb36db`,
`Informatics_Chatbot/static/hello-world/src/App.jsx` and `App.css`. The source
repository was read only. The Tableau port uses the existing project license;
it does not include Forge bridge code, Atlassian profile calls, or browser
identity/storage helpers.

## Artwork

The robot SVG is original project artwork. The manifests' 70 × 70 PNG is rendered
from that asset during the build. No Flaticon asset is included.

## React and React DOM 18.3.1

The upstream MIT license texts are copied from the pinned installed packages to
`public/licenses/react.LICENSE.txt` and `public/licenses/react-dom.LICENSE.txt`
during the build, and are included with deployed assets.

## Tooling and application dependencies

Dependency versions are exact-pinned in `package.json`; transitive versions and
their declared licenses are recorded in `package-lock.json`. Build/test tools are
development dependencies. Their source is not copied into the hosted application.
