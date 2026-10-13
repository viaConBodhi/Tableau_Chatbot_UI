# Third-party notices

## Tableau Extensions API 1.17.0

The SDK at `public/lib/tableau.extensions.1.17.0.js` is vendored without changes
from Tableau's public `tableau/extensions-api` repository. Its exact upstream
revision and SHA-256 checksums are recorded in `vendor/tableau-extensions-api.json`.

The upstream Apache License 2.0 text, including Salesforce's copyright notice,
is retained at `public/licenses/tableau-extensions-api.LICENSE.txt` and copied
into deployed assets. Preserve these files and upstream notices on updates.

The project's existing GPLv2 license has not been changed. Licensing compatibility
for distribution of the combined extension remains an owner-review item before
publishing the development extension; this notice does not relicense the SDK or
provide a legal compatibility determination.

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
