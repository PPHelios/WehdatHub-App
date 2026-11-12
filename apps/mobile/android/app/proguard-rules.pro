# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# Native modules found by name at run time (voice recorder, gallery): keep them from being renamed or removed in release builds.
-keep class com.margelo.nitro.** { *; }
-keep class com.reactnativecommunity.cameraroll.** { *; }
