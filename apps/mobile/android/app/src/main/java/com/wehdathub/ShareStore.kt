package com.wehdathub

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import java.io.File

/** What another app (WhatsApp, Gallery, Files) shared into this one, copied into the app's cache so it stays readable. */
object ShareStore {
  data class Item(val uri: String, val mimeType: String, val name: String)

  @Volatile var text: String? = null
  @Volatile var files: List<Item> = emptyList()

  fun clear() {
    text = null
    files = emptyList()
  }

  @Suppress("DEPRECATION")
  private fun displayName(context: Context, uri: Uri): String? =
    try {
      context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
        if (c.moveToFirst()) c.getString(0) else null
      }
    } catch (_: Exception) {
      null
    }

  fun handle(context: Context, intent: Intent?) {
    if (intent == null) return
    val action = intent.action
    if (action != Intent.ACTION_SEND && action != Intent.ACTION_SEND_MULTIPLE) return
    val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)
    val uris = ArrayList<Uri>()
    if (action == Intent.ACTION_SEND) {
      (intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM))?.let { uris.add(it) }
    } else {
      intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)?.let { uris.addAll(it) }
    }
    val dir = File(context.cacheDir, "shared").apply { mkdirs() }
    // A new share replaces the old one, and old copies are removed.
    dir.listFiles()?.forEach { it.delete() }
    val copied = ArrayList<Item>()
    uris.take(15).forEachIndexed { i, uri ->
      try {
        val mime = context.contentResolver.getType(uri) ?: intent.type ?: "application/octet-stream"
        val name = displayName(context, uri) ?: "shared_$i"
        val target = File(dir, "${System.currentTimeMillis()}_${i}_${name.replace(Regex("[^A-Za-z0-9._-]"), "_")}")
        context.contentResolver.openInputStream(uri)?.use { input -> target.outputStream().use { input.copyTo(it) } }
        copied.add(Item(Uri.fromFile(target).toString(), mime, name))
      } catch (_: Exception) {
        // A file that cannot be read is skipped; the rest still arrive.
      }
    }
    text = sharedText
    files = copied
    // This intent is handled: a later app resume must not process it again.
    intent.action = null
  }
}
