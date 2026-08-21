#!/usr/bin/env bash
set -euo pipefail

if ! xcodebuild -version >/dev/null 2>&1; then
  echo "Xcode 16 or later is required. Install Xcode, then select it with xcode-select." >&2
  exit 1
fi

if [[ -z "${APPLE_TEAM_ID:-}" ]]; then
  echo "Set APPLE_TEAM_ID to your 10-character Apple Developer Team ID." >&2
  echo "Example: APPLE_TEAM_ID=ABCDE12345 npm run ios:archive" >&2
  exit 1
fi

project_root="$(cd "$(dirname "$0")/.." && pwd)"
archive_path="$project_root/build/DAEGUK.xcarchive"
export_path="$project_root/build/export"

cd "$project_root"
npm run ios:sync

xcodebuild \
  -workspace ios/App/App.xcworkspace \
  -scheme App \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$archive_path" \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" \
  CODE_SIGN_STYLE=Automatic \
  -allowProvisioningUpdates \
  clean archive

xcodebuild \
  -exportArchive \
  -archivePath "$archive_path" \
  -exportPath "$export_path" \
  -exportOptionsPlist ios-export-options.plist \
  -allowProvisioningUpdates

echo "TestFlight export created in $export_path"
