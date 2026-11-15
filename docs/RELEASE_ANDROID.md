# Android release (Google Play)

One time:
1. Make the upload key (keep the file and passwords safe; Play keeps the real signing key):
   `keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`
2. In GitHub → Settings → Secrets → Actions add: `UPLOAD_KEYSTORE_B64` (`base64 -w0 upload.jks`), `UPLOAD_STORE_PASSWORD`, `UPLOAD_KEY_ALIAS` (upload), `UPLOAD_KEY_PASSWORD`.
3. Play Console → Create app (package `com.wehdathub`), accept Play App Signing, fill Store listing, Data safety, Content rating, Privacy policy URL, Target audience.

Every release:
1. Actions → **Release Android** → Run workflow → version code (higher than last) and name.
2. Download `wehdathub-release-aab`, upload it in Play Console → Testing → Internal testing → Create release.
3. Add testers, check the app on a phone, then promote to Production.
