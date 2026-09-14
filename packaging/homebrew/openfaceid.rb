cask "openfaceid" do
  version "0.2.1-rc.1"
  sha256 :no_check # Updated automatically during release manifest generation

  url "https://github.com/JayantOlhyan/OpenFaceID/releases/download/v#{version}/OpenFaceID-#{version}-arm64.dmg"
  name "OpenFaceID"
  desc "Local, privacy-preserving face unlock and presence system for macOS"
  homepage "https://github.com/JayantOlhyan/OpenFaceID"

  livecheck do
    url :url
    strategy :github_latest
  end

  depends_on macos: ">= :ventura"
  depends_on arch: :arm64

  app "OpenFaceID.app"

  zap trash: [
    "~/.openfaceid",
    "~/Library/Application Support/OpenFaceID",
    "~/Library/Preferences/org.openfaceid.desktop.plist",
    "~/Library/Caches/org.openfaceid.desktop",
  ]
end
